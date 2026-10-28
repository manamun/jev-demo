import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  MESSAGE_TYPES,
  POLITENESS_LEVELS,
  LLM_TOOL_NAME as TOOL_NAME,
  LLM_SYSTEM_PROMPT as SYSTEM_PROMPT,
  buildState,
} from "./questions.mjs";

const bedrock = new BedrockRuntimeClient({});

// ツール使用を強制して、3 つの判定を JSON で受け取る
const TOOL_CONFIG = {
  tools: [
    {
      toolSpec: {
        name: TOOL_NAME,
        description: "メッセージについての 3 つの判定を提出する。",
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

export async function judgeWithLlm(message, recipient) {
  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: JSON.stringify(buildState(message, recipient)) }] }],
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
