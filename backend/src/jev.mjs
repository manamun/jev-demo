import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_INSTRUCTIONS,
  POLITENESS_LEVELS,
  POLITENESS_INSTRUCTIONS,
  OK_TO_SEND,
  buildState,
} from "./questions.mjs";

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODELS_ENDPOINT = "https://api.typesafe.ai/v1/models";
const ssm = new SSMClient({});
let apiKeyPromise;

// API キーはコールドスタート時に 1 回だけ Parameter Store から取得してキャッシュする
function getApiKey() {
  apiKeyPromise ??= ssm
    .send(new GetParameterCommand({ Name: process.env.JEV_API_KEY_PARAM, WithDecryption: true }))
    .then((res) => res.Parameter.Value)
    .catch((err) => {
      apiKeyPromise = undefined;
      throw err;
    });
  return apiKeyPromise;
}

function buildQuestions() {
  return {
    message_type: {
      type: "choice",
      instructions: MESSAGE_TYPE_INSTRUCTIONS,
      criteria: Object.fromEntries(Object.entries(MESSAGE_TYPES).map(([key, t]) => [key, t.description])),
    },
    politeness: {
      type: "score",
      instructions: POLITENESS_INSTRUCTIONS,
      criteria: POLITENESS_LEVELS.map((level) => level.description),
    },
    ok_to_send: {
      type: "noul",
      instructions: OK_TO_SEND.instructions,
      criteria: OK_TO_SEND.criteria,
    },
  };
}

// API キーを取得し、課金のない GET /v1/models で Jev API への接続を確立しておく
export async function warmJev() {
  const apiKey = await getApiKey();
  const res = await fetch(JEV_MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` } });
  await res.arrayBuffer();
}

export async function judgeWithJev(message, recipient) {
  const apiKey = await getApiKey();
  const body = JSON.stringify({
    model: process.env.JEV_MODEL,
    state: buildState(message, recipient),
    questions: buildQuestions(),
  });

  // AI の処理時間は API 呼び出しの往復だけを測る（キー取得などは含めない）
  const started = performance.now();
  const res = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body,
  });
  const data = await res.json();
  const aiMs = performance.now() - started;

  if (!res.ok) {
    throw new Error(`Jev API error ${res.status}: ${JSON.stringify(data)}`);
  }

  const { message_type: type, politeness, ok_to_send: ok } = data.answers;
  return {
    provider: "jev",
    model: data.model,
    aiMs,
    usage: data.usage,
    result: {
      messageType: {
        value: type.choice,
        label: MESSAGE_TYPES[type.choice]?.label ?? type.choice,
        confidence: type.confidence,
        probabilities: Object.fromEntries(
          Object.entries(type.probabilities).map(([key, p]) => [MESSAGE_TYPES[key]?.label ?? key, p]),
        ),
      },
      politeness: {
        score: politeness.score,
        max: POLITENESS_LEVELS.length - 1,
        label: POLITENESS_LEVELS[Math.round(politeness.score)].label,
        confidence: politeness.confidence,
      },
      okToSend: {
        ok: ok.noul >= 0.5,
        probability: ok.noul,
      },
    },
  };
}
