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

// 判定の基準になる上司像。丁寧さと「そのまま送っていいか」は、選んだ上司にとってどうかで判定する
export const RECIPIENTS = {
  direct: {
    label: "直属の上司（仲がいい）",
    description:
      "The sender's direct manager in the same team at a Japanese company. They work together every day and get along well; " +
      "the manager is friendly and laid-back. Light polite Japanese (です・ます) with a friendly tone, casual softeners, " +
      "or exclamation marks is perfectly fine, and stiff formal keigo would feel distant. " +
      "Plain friend-like speech with no polite forms at all (タメ口) is still a bit too casual. Short, clear messages are welcome.",
  },
  executive: {
    label: "部長・役員クラス",
    description:
      "A senior manager or executive (部長・役員) at a Japanese company, several levels above the sender, " +
      "whom the sender rarely talks to directly. They expect the standard business keigo used toward senior people inside a company " +
      "(for example 〜いたします, 〜いただけますでしょうか, よろしくお願いいたします), with no casual expressions or exclamation marks. " +
      "A request written in such keigo is exactly right. Letter-style ceremonial phrasing that buries the point is still not welcome.",
  },
};

export const DEFAULT_RECIPIENT = "direct";

export const POLITENESS_LEVELS = [
  {
    label: "くだけすぎ",
    description: "Far too casual for the `recipient`: clearly below the level of politeness they expect.",
  },
  {
    label: "ややくだけている",
    description: "A bit too casual for the `recipient`: mostly fine, but some wording is more casual than they expect.",
  },
  {
    label: "ちょうどよい",
    description: "Just right for the `recipient`: the politeness matches what they expect.",
  },
  {
    label: "やや硬い",
    description: "A bit too formal for the `recipient`: stiffer or more roundabout than they expect.",
  },
  {
    label: "丁寧すぎ",
    description: "Far too formal for the `recipient`: piled-up honorifics or overly humble phrasing that hurts readability.",
  },
];

export const OK_TO_SEND = {
  instructions:
    "Would the `recipient` find the `message` acceptable to receive as-is? " +
    "A message is acceptable only if both hold: its politeness suits the recipient, and the recipient can tell what is being " +
    "reported or asked without guessing. It does not need to be perfect.",
  criteria: {
    true: "Acceptable to send to the recipient as-is.",
    false: "Has a clear problem: the politeness does not suit this recipient, or the point is vague.",
  },
};

export const MESSAGE_TYPE_INSTRUCTIONS =
  "What kind of workplace message is the `message` that the sender is about to send to the `recipient`? " +
  "Pick the purpose that best describes the message as a whole.";

export const POLITENESS_INSTRUCTIONS =
  "How polite is the wording of the `message`, compared with the level of politeness the `recipient` expects?";

export function buildState(message, recipient) {
  return {
    recipient: RECIPIENTS[recipient].description,
    message,
  };
}
