import { judgeWithJev } from "./jev.mjs";
import { judgeWithLlm } from "./llm.mjs";

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

  const judge = ROUTES[event.routeKey];
  if (!judge) {
    return respond(404, { error: "not found" });
  }

  let message;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    message = JSON.parse(raw ?? "{}").message?.trim();
  } catch {
    return respond(400, { error: "リクエストの JSON が不正です" });
  }
  if (!message) {
    return respond(400, { error: "メッセージを入力してください" });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return respond(400, { error: `メッセージは ${MAX_MESSAGE_LENGTH} 文字以内にしてください` });
  }

  try {
    return respond(200, await judge(message));
  } catch (err) {
    console.error(err);
    return respond(502, { error: "AI の呼び出しに失敗しました", detail: err.message });
  }
}
