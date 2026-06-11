import { describe, it, expect } from "vitest";
import {
  cleanProperties,
  normalizeVocabularies,
  vocabulariesFromDoc,
  mergeVocabulariesByName,
  addPropertiesTo,
  type Vocabulary,
} from "./metadataVocabulary.helpers";

const vocab = (name: string, properties: string[], id = name): Vocabulary => ({
  id,
  name,
  properties,
});

describe("cleanProperties", () => {
  it("空白除去・空要素除去・重複除去し、順序を保つ", () => {
    expect(cleanProperties(["  a ", "b", "a", "", "  ", "c"])).toEqual(["a", "b", "c"]);
  });

  it("文字列以外は無視する", () => {
    expect(cleanProperties(["a", 1, null, undefined, {}, "b"])).toEqual(["a", "b"]);
  });

  it("配列でなければ空配列", () => {
    expect(cleanProperties("a")).toEqual([]);
    expect(cleanProperties(null)).toEqual([]);
    expect(cleanProperties(undefined)).toEqual([]);
  });
});

describe("normalizeVocabularies", () => {
  it("name 空（空白のみ含む）の語彙は捨てる", () => {
    const out = normalizeVocabularies([
      { id: "1", name: "pj-a", properties: ["x"] },
      { id: "2", name: "   ", properties: ["y"] },
      { id: "3", name: "", properties: ["z"] },
    ]);
    expect(out.map((v) => v.name)).toEqual(["pj-a"]);
  });

  it("name はトリムし、properties は正規化する", () => {
    const out = normalizeVocabularies([
      { id: "1", name: "  pj-a  ", properties: ["  種別 ", "種別", "年"] },
    ]);
    expect(out[0].name).toBe("pj-a");
    expect(out[0].properties).toEqual(["種別", "年"]);
  });

  it("id が無ければ採番する（非空の文字列）", () => {
    const out = normalizeVocabularies([{ name: "pj-a", properties: [] }]);
    expect(typeof out[0].id).toBe("string");
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it("オブジェクトでない要素や配列以外の入力は捨てる", () => {
    expect(normalizeVocabularies(["x", 1, null])).toEqual([]);
    expect(normalizeVocabularies("nope")).toEqual([]);
    expect(normalizeVocabularies(undefined)).toEqual([]);
  });
});

describe("vocabulariesFromDoc", () => {
  it("新形式 { vocabularies } をそのまま正規化して返す", () => {
    const out = vocabulariesFromDoc({
      vocabularies: [{ id: "1", name: "pj-a", properties: ["種別"] }],
    });
    expect(out).toEqual([{ id: "1", name: "pj-a", properties: ["種別"] }]);
  });

  it("旧形式 { fields: string[] } は『既定』語彙へ移行する", () => {
    const out = vocabulariesFromDoc({ fields: ["図面種別", "制作年"] });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("既定");
    expect(out[0].properties).toEqual(["図面種別", "制作年"]);
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it("旧形式でも fields が空なら空配列", () => {
    expect(vocabulariesFromDoc({ fields: [] })).toEqual([]);
    expect(vocabulariesFromDoc({ fields: ["  ", ""] })).toEqual([]);
  });

  it("新形式が優先され、旧 fields は無視される", () => {
    const out = vocabulariesFromDoc({
      vocabularies: [{ id: "1", name: "pj-a", properties: ["x"] }],
      fields: ["legacy"],
    });
    expect(out.map((v) => v.name)).toEqual(["pj-a"]);
  });

  it("null / undefined / 空オブジェクトは空配列", () => {
    expect(vocabulariesFromDoc(null)).toEqual([]);
    expect(vocabulariesFromDoc(undefined)).toEqual([]);
    expect(vocabulariesFromDoc({})).toEqual([]);
  });
});

describe("mergeVocabulariesByName", () => {
  it("同名の語彙はプロパティを和集合（順序維持）にする", () => {
    const current = [vocab("pj-a", ["種別", "年"])];
    const incoming = [vocab("pj-a", ["年", "縮尺"])];
    const out = mergeVocabulariesByName(current, incoming);
    expect(out).toHaveLength(1);
    expect(out[0].properties).toEqual(["種別", "年", "縮尺"]);
  });

  it("同名マージでは既存の id を保持する", () => {
    const current = [vocab("pj-a", ["x"], "keep-me")];
    const incoming = [vocab("pj-a", ["y"], "other-id")];
    const out = mergeVocabulariesByName(current, incoming);
    expect(out[0].id).toBe("keep-me");
  });

  it("新しい名前の語彙は追加される", () => {
    const current = [vocab("pj-a", ["x"])];
    const incoming = [vocab("pj-b", ["y"])];
    const out = mergeVocabulariesByName(current, incoming);
    expect(out.map((v) => v.name)).toEqual(["pj-a", "pj-b"]);
  });

  it("current が空でも incoming を取り込む（インポート相当）", () => {
    const out = mergeVocabulariesByName([], [vocab("pj-a", ["x"])]);
    expect(out.map((v) => v.name)).toEqual(["pj-a"]);
  });
});

describe("addPropertiesTo", () => {
  const base = [vocab("pj-a", ["種別"], "a"), vocab("pj-b", ["色"], "b")];

  it("指定語彙に新プロパティを追記する", () => {
    const out = addPropertiesTo(base, "a", ["年"]);
    expect(out.find((v) => v.id === "a")?.properties).toEqual(["種別", "年"]);
    // 他の語彙は不変
    expect(out.find((v) => v.id === "b")?.properties).toEqual(["色"]);
  });

  it("既存プロパティ・空白は追加しない", () => {
    const out = addPropertiesTo(base, "a", ["種別", " ", ""]);
    // 変化なし → 同一参照を返す
    expect(out).toBe(base);
  });

  it("語彙が見つからなければ同一参照を返す", () => {
    expect(addPropertiesTo(base, "missing", ["x"])).toBe(base);
  });

  it("追記時は新しい配列を返す（元を破壊しない）", () => {
    const out = addPropertiesTo(base, "a", ["年"]);
    expect(out).not.toBe(base);
    expect(base.find((v) => v.id === "a")?.properties).toEqual(["種別"]);
  });
});
