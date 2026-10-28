// Jev と LLM に同じ 3 つの判定を頼むための定義。
// Jev は英語が主な学習言語なので、指示は英語・メッセージ本文は日本語のまま渡す。

export const MESSAGE_TYPES = {
  report: { label: "報告", description: "Report: conveys the result or progress of work the sender has already done." },
  notice: { label: "連絡", description: "Notice: shares information, schedules, or facts the boss should be aware of." },
  consult: { label: "相談", description: "Consultation: asks for the boss's opinion or advice before the sender decides something." },
  request: { label: "依頼", description: "Request: asks the boss to do, approve, or provide something." },
  apology: { label: "謝罪", description: "Apology: apologizes for a mistake, delay, or trouble the sender caused." },
  thanks: { label: "お礼", description: "Thanks: mainly expresses gratitude to the boss." },
  other: { label: "その他", description: "Other: none of the above, or not a work message." },
};

export const POLITENESS_LEVELS = [
  {
    label: "くだけすぎ",
    description: "Too casual for a boss: friend-like tone, slang, or no polite forms at all (タメ口).",
  },
  {
    label: "ややくだけている",
    description: "Somewhat casual: mostly polite forms, but with casual expressions or abrupt phrasing.",
  },
  {
    label: "ちょうどよい",
    description: "Appropriately polite: standard business Japanese (keigo) that fits a message to one's boss.",
  },
  {
    label: "やや硬い",
    description: "Somewhat stiff: more formal or roundabout than needed for a boss in the same team.",
  },
  {
    label: "丁寧すぎ",
    description: "Excessively polite: piled-up honorifics or overly humble phrasing that hurts readability.",
  },
];

export const OK_TO_SEND = {
  instructions:
    "Can the `message` be sent to the sender's boss as-is, with no rewrite needed? " +
    "Consider whether the tone is appropriate, whether what is being reported or asked is clear, " +
    "and whether anything could be rude or cause misunderstanding.",
  criteria: {
    true: "The message is ready to send to the boss without any changes.",
    false: "The message should be revised before sending it to the boss.",
  },
};

export const MESSAGE_TYPE_INSTRUCTIONS =
  "What kind of workplace message is the `message` that the sender is about to send to their boss? " +
  "Pick the purpose that best describes the message as a whole.";

export const POLITENESS_INSTRUCTIONS =
  "How polite is the wording of the `message` for a message sent to one's boss in a Japanese workplace?";

export function buildState(message) {
  return {
    recipient: "the sender's boss (上司) at work",
    message,
  };
}
