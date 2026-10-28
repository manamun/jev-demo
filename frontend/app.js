// 上司像は Lambda が Jev / LLM に渡しているものと同じファイルを読み込んで表示する
import { RECIPIENTS, DEFAULT_RECIPIENT } from "./questions.mjs";

const SAMPLES = [
  {
    label: "丁寧な依頼",
    text: "お疲れ様です。明日の定例ですが、資料の準備が間に合わないため、開始を30分後ろ倒しにしていただくことは可能でしょうか。ご検討のほどよろしくお願いいたします。",
  },
  {
    label: "フランクな連絡",
    text: "了解です！明日の資料、午前中には送りますね〜",
  },
  {
    label: "タメ口の報告",
    text: "例の件おわったよー。あとで見といて！",
  },
  {
    label: "要点不明の相談",
    text: "すみません、ちょっとあれなんですけど、例のやつってどうなってましたっけ？ なんか色々あって、どうしようかなと思ってます。",
  },
  {
    label: "丁寧すぎる謝罪",
    text: "大変恐縮ではございますが、この度は私の不手際により多大なるご迷惑をおかけいたしましたこと、誠に申し訳なく、深くお詫び申し上げさせていただきたく存じ上げます。",
  },
  {
    label: "具体的な謝罪",
    text: "お疲れ様です。本日提出予定だったA社向け見積書の送付が遅れ、先方にご迷惑をおかけしました。申し訳ございません。15時までに送付いたします。",
  },
];

const OK_THRESHOLD = 0.6;
const WARN_THRESHOLD = 0.4;

const $ = (selector, root = document) => root.querySelector(selector);

// ---------- タブ ----------

const tabs = [...document.querySelectorAll(".tab")];
tabs.forEach((tab) => {
  tab.addEventListener("click", () => selectTab(tab.id));
});

function selectTab(id) {
  tabs.forEach((tab) => {
    const selected = tab.id === id;
    tab.setAttribute("aria-selected", String(selected));
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
  });
  try { localStorage.setItem("tab", id); } catch {}
}

try {
  const saved = localStorage.getItem("tab");
  if (saved && document.getElementById(saved)) selectTab(saved);
} catch {}

// ---------- 入力欄（2 つのタブで同じ文章を共有する） ----------

const inputs = [...document.querySelectorAll(".message-input")];
inputs.forEach((input) => {
  input.addEventListener("input", () => syncInputs(input.value, input));
});

function syncInputs(value, source) {
  inputs.forEach((input) => {
    if (input !== source) input.value = value;
  });
}

document.querySelectorAll(".samples").forEach((container) => {
  SAMPLES.forEach((sample) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sample";
    button.textContent = sample.label;
    button.addEventListener("click", () => syncInputs(sample.text));
    container.append(button);
  });
});

// ---------- 送る相手（2 つのタブで共有する） ----------

let recipient = DEFAULT_RECIPIENT;
try {
  const saved = localStorage.getItem("recipient");
  if (Object.hasOwn(RECIPIENTS, saved)) recipient = saved;
} catch {}

const recipientButtons = [];
document.querySelectorAll(".recipients").forEach((group) => {
  Object.entries(RECIPIENTS).forEach(([key, { label, description }]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recipient";
    button.setAttribute("role", "radio");
    button.dataset.recipient = key;

    // i マークにホバー（またはボタンにフォーカス）すると、プロンプトに渡している上司像を表示する
    const tooltipId = `recipient-${key}-${group.dataset.panel}`;
    const tooltip = el("span", "tooltip");
    tooltip.id = tooltipId;
    tooltip.setAttribute("role", "tooltip");
    tooltip.append(el("strong", null, "プロンプトに渡している上司像"), el("span", null, description));
    const info = el("span", "info", "i");
    info.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-describedby", tooltipId);
    button.append(el("span", null, label), info, tooltip);
    button.addEventListener("click", () => selectRecipient(key));
    group.append(button);
    recipientButtons.push(button);
  });
});

function selectRecipient(key) {
  recipient = key;
  recipientButtons.forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.recipient === key));
  });
  try { localStorage.setItem("recipient", key); } catch {}
}
selectRecipient(recipient);

// ---------- API ----------

async function postJudge(path, message) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, recipient }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

function showError(el, err) {
  el.textContent = err ? `エラー：${err.message}` : "";
  el.hidden = !err;
}

const formatSeconds = (ms) => (ms / 1000).toFixed(3);
const formatMs = (ms) => (ms == null ? "—" : `${Math.round(ms).toLocaleString()} ms`);
const percent = (p) => `${Math.round(p * 100)}%`;

// ---------- カード ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card(title, value, tone) {
  const node = el("div", `card${tone ? ` ${tone}` : ""}`);
  node.append(el("h3", null, title), el("p", "value", value));
  return node;
}

function messageTypeCard({ label, confidence, probabilities }, compact) {
  const node = card("メッセージの種類", label);
  if (confidence != null) {
    node.append(el("p", "detail", `確信度 ${percent(confidence)}`));
  }
  if (probabilities && !compact) {
    const list = el("ul", "bars");
    Object.entries(probabilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .forEach(([name, p]) => {
        const item = el("li");
        const bar = el("span", "bar");
        const fill = el("i");
        fill.style.width = percent(p);
        bar.append(fill);
        item.append(el("span", null, name), bar, el("span", null, percent(p)));
        list.append(item);
      });
    node.append(list);
  }
  return node;
}

function politenessCard({ score, max, label, confidence }) {
  const distance = Math.abs(score - max / 2);
  const tone = distance < 0.75 ? "ok" : distance < 1.5 ? "warn" : "ng";
  const node = card("丁寧さ", label, tone);

  const meter = el("div", "meter");
  const marker = el("i");
  marker.style.left = `${(score / max) * 100}%`;
  meter.append(marker);
  const labels = el("div", "meter-labels");
  labels.append(el("span", null, "くだけすぎ"), el("span", null, "ちょうどよい"), el("span", null, "丁寧すぎ"));

  const detail = `スコア ${score.toFixed(2)} / ${max}` + (confidence != null ? `・確信度 ${percent(confidence)}` : "");
  node.append(meter, labels, el("p", "detail", detail));
  return node;
}

function okToSendCard({ ok, probability }) {
  if (probability == null) {
    return card("そのまま送っていい？", ok ? "送ってOK" : "直したほうがよい", ok ? "ok" : "ng");
  }
  const tone = probability >= OK_THRESHOLD ? "ok" : probability >= WARN_THRESHOLD ? "warn" : "ng";
  const value = { ok: "送ってOK", warn: "見直し推奨", ng: "直したほうがよい" }[tone];
  const node = card("そのまま送っていい？", value, tone);
  node.append(el("p", "detail", `送ってよい確率 ${percent(probability)}`));
  return node;
}

function renderCards(container, result, { compact = false } = {}) {
  container.replaceChildren(
    messageTypeCard(result.messageType, compact),
    politenessCard(result.politeness),
    okToSendCard(result.okToSend),
  );
}

// ---------- チェッカー ----------

const checkButton = $("#check-button");
const checkCards = $("#check-cards");
const checkMeta = $("#check-meta");
const checkError = $("#check-error");

checkButton.addEventListener("click", async () => {
  const message = $("#message-check").value.trim();
  if (!message) {
    showError(checkError, new Error("メッセージを入力してください"));
    return;
  }

  checkButton.disabled = true;
  checkButton.textContent = "チェック中…";
  showError(checkError, null);

  const sentTo = recipient;
  const started = performance.now();
  try {
    const data = await postJudge("/api/check", message);
    const totalMs = performance.now() - started;
    renderCards(checkCards, data.result);
    checkCards.hidden = false;
    checkMeta.textContent = `相手：${RECIPIENTS[sentTo].label}・${data.model}・AI の処理時間 ${formatMs(data.aiMs)}・通信込み ${formatMs(totalMs)}`;
    checkMeta.hidden = false;
  } catch (err) {
    showError(checkError, err);
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "チェック";
  }
});

// ---------- スピード対決 ----------

const raceButton = $("#race-button");
const raceError = $("#race-error");
const lanes = {
  jev: { root: $("#lane-jev"), path: "/api/race/jev" },
  llm: { root: $("#lane-llm"), path: "/api/race/llm" },
};

function field(lane, name) {
  return $(`[data-field="${name}"]`, lane.root);
}

function setTimer(lane, ms) {
  const timer = field(lane, "timer");
  timer.firstChild.textContent = formatSeconds(ms);
}

function resetLane(lane) {
  setTimer(lane, 0);
  field(lane, "timer").classList.add("running");
  field(lane, "ai").textContent = "—";
  field(lane, "total").textContent = "—";
  field(lane, "cards").replaceChildren();
  const place = field(lane, "place");
  place.hidden = true;
  place.className = "place";
  lane.done = false;
}

raceButton.addEventListener("click", async () => {
  const message = $("#message-race").value.trim();
  if (!message) {
    showError(raceError, new Error("メッセージを入力してください"));
    return;
  }

  raceButton.disabled = true;
  raceButton.textContent = "対決中…";
  showError(raceError, null);
  Object.values(lanes).forEach(resetLane);

  let finished = 0;
  let placed = 0;
  const started = performance.now();

  // 両方のタイマーを 1 つのアニメーションループで同時に進める
  const tick = () => {
    const now = performance.now() - started;
    Object.values(lanes).forEach((lane) => {
      if (!lane.done) setTimer(lane, now);
    });
    if (finished < 2) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // 2 つのリクエストを同時に送り、返ってきた順にタイマーを止める
  const runs = Object.values(lanes).map(async (lane) => {
    try {
      const data = await postJudge(lane.path, message);
      const totalMs = performance.now() - started;
      lane.done = true;
      finished += 1;
      placed += 1;

      setTimer(lane, totalMs);
      field(lane, "timer").classList.remove("running");
      field(lane, "model").textContent = data.model;
      field(lane, "ai").textContent = formatMs(data.aiMs);
      field(lane, "total").textContent = formatMs(totalMs);
      const place = field(lane, "place");
      place.textContent = `${placed}着`;
      if (placed === 1) place.classList.add("first");
      place.hidden = false;
      renderCards(field(lane, "cards"), data.result, { compact: true });
    } catch (err) {
      lane.done = true;
      finished += 1;
      field(lane, "timer").classList.remove("running");
      field(lane, "cards").replaceChildren(el("p", "error", `エラー：${err.message}`));
    }
  });

  await Promise.allSettled(runs);
  raceButton.disabled = false;
  raceButton.textContent = "対決";
});

// ---------- ウォームアップ ----------

// 対決では 2 本のリクエストが別々の Lambda インスタンスに届くので、2 本同時に送って 2 台とも起こしておく。
// Lambda が温まっているのは最後のアクセスから数分なので、時間が空いたら対決タブを開いたときにもう一度起こす。
const WARM_INTERVAL_MS = 4 * 60 * 1000;
let lastWarmedAt = 0;

function warmUp() {
  if (lastWarmedAt && performance.now() - lastWarmedAt < WARM_INTERVAL_MS) return;
  lastWarmedAt = performance.now();
  for (let i = 0; i < 2; i++) {
    fetch("/api/warmup", { method: "POST" }).catch(() => {});
  }
}

$("#tab-race").addEventListener("click", warmUp);
[...document.querySelectorAll(".message-input")].forEach((input) => input.addEventListener("focus", warmUp));
warmUp();
