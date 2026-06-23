// IIIF の label/値を、Presentation API v2・v3 のどちらの形式でも
// 1 本の文字列に解決するヘルパー。
//
// 対応する入力形:
//   - v2 単純文字列:           "Book 1"
//   - v2 言語タグ付き単一値:   { "@value": "本", "@language": "ja" }
//   - v2 言語タグ付き配列:     [ { "@value": "Book 1", "@language": "en" }, ... ]
//   - v2 文字列配列:           [ "Book 1", "本" ]
//   - v3 言語マップ:           { ja: ["本"], en: ["Book 1"], none: ["..."] }
//
// 解決順は「指定ロケール → ja → none → 最初に見つかった言語」。
// IIIF Presentation API は現状 v3 が最新で v4 は存在しないが、言語マップ構造は
// 将来も踏襲される想定のため v3 形式を既定として扱う。

type V2LangValue = { "@value"?: string; "@language"?: string };

export type IIIFLabel =
  | string
  | V2LangValue
  | Array<string | V2LangValue>
  | { [language: string]: string[] }
  | null
  | undefined;

const isV2LangValue = (v: unknown): v is V2LangValue =>
  typeof v === "object" && v !== null && "@value" in v;

export function getIIIFLabel(label: IIIFLabel, locale = "ja"): string {
  if (!label) return "";

  // v2 単純文字列
  if (typeof label === "string") return label;

  // 配列（v2 の文字列配列 / 言語タグ付き配列）
  if (Array.isArray(label)) {
    const pickByLang = (lang: string) =>
      label.find((v) => isV2LangValue(v) && v["@language"] === lang);

    const match = pickByLang(locale) ?? pickByLang("ja") ?? label[0];
    if (typeof match === "string") return match;
    if (isV2LangValue(match)) return match["@value"] || "";
    return "";
  }

  // オブジェクト
  if (typeof label === "object") {
    // v2 言語タグ付き単一値
    if (isV2LangValue(label)) return label["@value"] || "";

    // v3 言語マップ
    const map = label as { [language: string]: string[] };
    const fromLang = (lang: string): string | undefined =>
      Array.isArray(map[lang]) ? map[lang][0] : undefined;

    // 値を持つ最初の言語（空配列はスキップ）
    const firstWithValue = Object.keys(map)
      .map(fromLang)
      .find((v) => v != null);

    return fromLang(locale) ?? fromLang("ja") ?? fromLang("none") ?? firstWithValue ?? "";
  }

  return "";
}
