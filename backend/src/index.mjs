import { judgeWithJev, warmJev } from "./jev.mjs";
import { judgeWithLlm, warmLlm } from "./llm.mjs";
import { RECIPIENTS, DEFAULT_RECIPIENT } from "./questions.mjs";

const MAX_MESSAGE_LENGTH = 2000;

const ROUTES = {
  "POST /api/check": judgeWithJev,
  "POST /api/race/jev": judgeWithJev,
  "POST /api/race/llm": judgeWithLlm,
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  // CloudFront 経由（Basic 認証済み）以外からの直接アクセスを拒否する
  if (event.headers?.["x-origin-secret"] !== process.env.ORIGIN_SECRET) {
    return respond(403, { error: "forbidden" });
  }

  // 対決の前にコールドスタートと初回の接続を済ませる。どのインスタンスが対決を受けても温まっているよう、両方を準備する
  if (event.routeKey === "POST /api/warmup") {
    const results = await Promise.allSettled([warmJev(), warmLlm()]);
    results.filter((r) => r.status === "rejected").forEach((r) => console.error(r.reason));
    return respond(200, { warmed: results.map((r) => r.status === "fulfilled") });
  }

  const judge = ROUTES[event.routeKey];
  if (!judge) {
    return respond(404, { error: "not found" });
  }

  let message;
  let recipient;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const body = JSON.parse(raw ?? "{}");
    message = body.message?.trim();
    recipient = body.recipient ?? DEFAULT_RECIPIENT;
  } catch {
    return respond(400, { error: "リクエストの JSON が不正です" });
  }
  if (!message) {
    return respond(400, { error: "メッセージを入力してください" });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return respond(400, { error: `メッセージは ${MAX_MESSAGE_LENGTH} 文字以内にしてください` });
  }
  if (!Object.hasOwn(RECIPIENTS, recipient)) {
    return respond(400, { error: "送る相手の指定が不正です" });
  }

  try {
    return respond(200, await judge(message, recipient));
  } catch (err) {
    console.error(err);
    return respond(502, { error: "AI の呼び出しに失敗しました", detail: err.message });
  }
}
