import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_INSTRUCTIONS,
  POLITENESS_LEVELS,
  POLITENESS_INSTRUCTIONS,
  OK_TO_SEND,
  buildState,
} from "./questions.mjs";

const bedrock = new BedrockRuntimeClient({});
const TOOL_NAME = "submit_judgments";

// Jev と同じ定義から 1 回の呼び出しで 3 つの判定を返させる。ツール使用を強制して JSON を受け取る。
const SYSTEM_PROMPT = [
  "You judge a workplace message that the sender is about to send to their boss.",
  "The input is a JSON object; `message` is the message text.",
  `Answer three questions by calling the ${TOOL_NAME} tool exactly once. Do not write any other text.`,
  "",
  `1. message_type: ${MESSAGE_TYPE_INSTRUCTIONS}`,
  ...Object.entries(MESSAGE_TYPES).map(([key, t]) => `   - ${key}: ${t.description}`),
  "",
  `2. politeness: ${POLITENESS_INSTRUCTIONS} Answer with the level number.`,
  ...POLITENESS_LEVELS.map((level, i) => `   - ${i}: ${level.description}`),
  "",
  `3. ok_to_send: ${OK_TO_SEND.instructions}`,
  `   - true: ${OK_TO_SEND.criteria.true}`,
  `   - false: ${OK_TO_SEND.criteria.false}`,
].join("\n");

const TOOL_CONFIG = {
  tools: [
    {
      toolSpec: {
        name: TOOL_NAME,
        description: "Submit the three judgments about the message.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              message_type: { type: "string", enum: Object.keys(MESSAGE_TYPES) },
              politeness: { type: "integer", minimum: 0, maximum: POLITENESS_LEVELS.length - 1 },
              ok_to_send: { type: "boolean" },
            },
            required: ["message_type", "politeness", "ok_to_send"],
          },
        },
      },
    },
  ],
  toolChoice: { tool: { name: TOOL_NAME } },
};

// 認証情報の読み込みと Bedrock への接続を済ませておく（1 トークンだけ出力させる）
export async function warmLlm() {
  await bedrock.send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      messages: [{ role: "user", content: [{ text: "hi" }] }],
      inferenceConfig: { maxTokens: 1 },
    }),
  );
}

export async function judgeWithLlm(message) {
  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: JSON.stringify(buildState(message)) }] }],
    toolConfig: TOOL_CONFIG,
    inferenceConfig: { maxTokens: 200, temperature: 0 },
  });

  const started = performance.now();
  const res = await bedrock.send(command);
  const aiMs = performance.now() - started;

  const toolUse = res.output.message.content.find((block) => block.toolUse)?.toolUse;
  if (!toolUse) {
    throw new Error(`LLM did not call ${TOOL_NAME}: ${JSON.stringify(res.output.message.content)}`);
  }
  const { message_type: type, politeness, ok_to_send: ok } = toolUse.input;

  return {
    provider: "llm",
    model: process.env.BEDROCK_MODEL_ID,
    aiMs,
    bedrockLatencyMs: res.metrics?.latencyMs,
    usage: { input_tokens: res.usage?.inputTokens, output_tokens: res.usage?.outputTokens },
    result: {
      messageType: {
        value: type,
        label: MESSAGE_TYPES[type]?.label ?? type,
      },
      politeness: {
        score: politeness,
        max: POLITENESS_LEVELS.length - 1,
        label: POLITENESS_LEVELS[politeness]?.label ?? String(politeness),
      },
      okToSend: { ok },
    },
  };
}
