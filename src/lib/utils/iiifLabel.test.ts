import { describe, it, expect } from "vitest";
import { getIIIFLabel } from "./iiifLabel";

describe("getIIIFLabel", () => {
  describe("空・不正値", () => {
    it("undefined/null/空文字は空文字を返す", () => {
      expect(getIIIFLabel(undefined)).toBe("");
      expect(getIIIFLabel(null)).toBe("");
      expect(getIIIFLabel("")).toBe("");
    });
  });

  describe("v2 形式", () => {
    it("単純文字列はそのまま返す", () => {
      expect(getIIIFLabel("Book 1")).toBe("Book 1");
    });

    it("言語タグ付き単一値は @value を返す", () => {
      expect(getIIIFLabel({ "@value": "本", "@language": "ja" })).toBe("本");
    });

    it("言語タグ付き配列は指定ロケールを優先する", () => {
      const label = [
        { "@value": "Book 1", "@language": "en" },
        { "@value": "本", "@language": "ja" },
      ];
      expect(getIIIFLabel(label, "en")).toBe("Book 1");
      expect(getIIIFLabel(label, "ja")).toBe("本");
    });

    it("指定ロケールが無ければ ja → 先頭の順でフォールバック", () => {
      const label = [
        { "@value": "本", "@language": "ja" },
        { "@value": "Book 1", "@language": "en" },
      ];
      expect(getIIIFLabel(label, "fr")).toBe("本");
    });

    it("文字列配列は先頭を返す", () => {
      expect(getIIIFLabel(["Book 1", "本"])).toBe("Book 1");
    });
  });

  describe("v3 形式（言語マップ）", () => {
    const label = { ja: ["B5 MARUZENノート"], en: ["B5 Sketchbook"] };

    it("指定ロケールを優先する", () => {
      expect(getIIIFLabel(label, "en")).toBe("B5 Sketchbook");
      expect(getIIIFLabel(label, "ja")).toBe("B5 MARUZENノート");
    });

    it("指定ロケールが無ければ ja にフォールバックする", () => {
      expect(getIIIFLabel(label, "fr")).toBe("B5 MARUZENノート");
    });

    it("ja も無ければ none → 先頭言語の順でフォールバックする", () => {
      expect(getIIIFLabel({ none: ["Untitled"] }, "ja")).toBe("Untitled");
      expect(getIIIFLabel({ de: ["Buch"] }, "ja")).toBe("Buch");
    });

    it("空配列の言語はスキップして次の候補を使う", () => {
      expect(getIIIFLabel({ ja: [], en: ["Book"] }, "ja")).toBe("Book");
    });
  });
});
