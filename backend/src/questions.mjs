// Jev と LLM に同じ 3 つの判定を頼むための定義。
// デモで中身を読めるよう、指示も日本語で書いている（Jev の主な学習言語は英語なので、精度は英語より落ちうる）。

export const MESSAGE_TYPES = {
  report: { label: "報告", description: "報告：送り手がすでに行った仕事の結果や進み具合を伝えている。" },
  notice: { label: "連絡", description: "連絡：上司が知っておくべき情報・予定・事実を共有している。" },
  consult: { label: "相談", description: "相談：送り手が何かを決める前に、上司の意見や助言を求めている。" },
  request: { label: "依頼", description: "依頼：上司に何かをしてもらう、承認してもらう、提供してもらうよう頼んでいる。" },
  apology: { label: "謝罪", description: "謝罪：送り手のミス・遅れ・迷惑について謝っている。" },
  thanks: { label: "お礼", description: "お礼：主に上司への感謝を伝えている。" },
  other: { label: "その他", description: "その他：上のどれにも当てはまらない、または仕事のメッセージではない。" },
};

// 判定の基準になる上司像。丁寧さと「そのまま送っていいか」は、選んだ上司にとってどうかで判定する
export const RECIPIENTS = {
  direct: {
    label: "直属の上司（仲がいい）",
    description:
      "日本の会社で、送り手と同じチームの直属の上司。毎日一緒に働いていて仲がよく、気さくでおおらかな人。" +
      "軽いです・ます調で、親しみのある言い回しやくだけた緩衝表現、「！」が入っていてもまったく問題ない。" +
      "かしこまった硬い敬語だと、かえって距離を感じる。" +
      "ただし、です・ますのない友達口調（タメ口）は少しくだけすぎ。短く分かりやすいメッセージを好む。",
  },
  executive: {
    label: "部長・役員クラス",
    description:
      "日本の会社で、送り手より何段階も上の部長・役員クラスの人。送り手が直接話すことはあまりない。" +
      "社内で目上の人に使う標準的なビジネス敬語（例：〜いたします、〜いただけますでしょうか、よろしくお願いいたします）を期待し、" +
      "くだけた表現や「！」は好まない。そうした敬語で書かれた依頼はまさにちょうどよい。" +
      "ただし、手紙のような儀礼的な言い回しで要点が埋もれるのも好まない。",
  },
};

export const DEFAULT_RECIPIENT = "direct";

export const POLITENESS_LEVELS = [
  {
    label: "くだけすぎ",
    description: "`recipient` に対して、くだけすぎ：相手が期待する丁寧さを明らかに下回っている。",
  },
  {
    label: "ややくだけている",
    description: "`recipient` に対して、ややくだけている：おおむね問題ないが、相手の期待よりくだけた言葉づかいがある。",
  },
  {
    label: "ちょうどよい",
    description: "`recipient` に対して、ちょうどよい：丁寧さが相手の期待に合っている。",
  },
  {
    label: "やや硬い",
    description: "`recipient` に対して、やや硬い：相手の期待より堅苦しい、または回りくどい。",
  },
  {
    label: "丁寧すぎ",
    description: "`recipient` に対して、丁寧すぎ：敬語を重ねすぎたり、へりくだりすぎたりして読みにくい。",
  },
];

export const OK_TO_SEND = {
  instructions:
    "`recipient` は、この `message` をそのまま受け取って問題ないと感じるか？" +
    "次の 2 つがどちらも満たされていれば問題ないとする：丁寧さが相手に合っていること、" +
    "何を報告・依頼しているのかを相手が推測せずに分かること。完璧である必要はない。",
  criteria: {
    true: "この相手に、そのまま送って問題ない。",
    false: "はっきりした問題がある：丁寧さがこの相手に合っていない、または要点があいまい。",
  },
};

export const MESSAGE_TYPE_INSTRUCTIONS =
  "送り手が `recipient` に送ろうとしている `message` は、どんな種類の仕事のメッセージか？" +
  "メッセージ全体の目的にいちばん近いものを選ぶ。";

export const POLITENESS_INSTRUCTIONS =
  "`message` の言葉づかいは、`recipient` が期待する丁寧さと比べてどのくらい丁寧か？";

// LLM（Haiku）には Jev と同じ定義から組み立てた指示文を渡し、1 回の呼び出しで 3 つの判定を返させる
export const LLM_TOOL_NAME = "submit_judgments";

export const LLM_SYSTEM_PROMPT = [
  "あなたは、送り手が上司に送ろうとしている仕事のメッセージを判定します。",
  "入力は JSON オブジェクトで、`recipient` は上司の人物像、`message` はメッセージ本文です。",
  `次の 3 つの質問に、${LLM_TOOL_NAME} ツールを 1 回だけ呼んで答えてください。ほかの文章は書かないでください。`,
  "",
  `1. message_type: ${MESSAGE_TYPE_INSTRUCTIONS}`,
  ...Object.entries(MESSAGE_TYPES).map(([key, t]) => `   - ${key}: ${t.description}`),
  "",
  `2. politeness: ${POLITENESS_INSTRUCTIONS} 段階の番号で答える。`,
  ...POLITENESS_LEVELS.map((level, i) => `   - ${i}: ${level.description}`),
  "",
  `3. ok_to_send: ${OK_TO_SEND.instructions}`,
  `   - true: ${OK_TO_SEND.criteria.true}`,
  `   - false: ${OK_TO_SEND.criteria.false}`,
].join("\n");

export function buildState(message, recipient) {
  return {
    recipient: RECIPIENTS[recipient].description,
    message,
  };
}
