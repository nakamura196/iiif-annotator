// ドメイン移行(iiif-annotator.vercel.app → anno.ldas.jp)の設定を固定するテスト。
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { OLD_HOSTS, PUBLIC_PATHS, SITE_URL } from "./site";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const root = join(__dirname, "../..");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

describe("公開 URL", () => {
  it("anno.ldas.jp", () => {
    expect(SITE_URL).toBe("https://anno.ldas.jp");
  });

  it("robots は sitemap を新ホストで示し、/api を除外する", () => {
    const r = robots();
    expect(r.sitemap).toBe("https://anno.ldas.jp/sitemap.xml");
    expect(JSON.stringify(r.rules)).toContain("/api/");
  });

  it("sitemap は全件新ホストで、日英の組を持つ", () => {
    const s = sitemap();
    expect(s.map((e) => e.url)).toEqual(PUBLIC_PATHS.map((p) => SITE_URL + p));
    expect(s[0].alternates?.languages).toEqual({ ja: `${SITE_URL}/`, en: `${SITE_URL}/en` });
    expect(s[1].alternates?.languages).toEqual({ ja: `${SITE_URL}/help`, en: `${SITE_URL}/en/help` });
  });

  it("sitemap のページは実在する", () => {
    for (const p of PUBLIC_PATHS.filter((p) => p !== "/")) {
      expect(statSync(join(root, "src/app/[locale]/(site)", p, "page.tsx")).isFile()).toBe(true);
    }
  });
});

describe("旧ホストの転送 (vercel.json)", () => {
  const [rule] = vercel.redirects;
  // Vercel の source(path-to-regexp)を同じ意味の正規表現に直して判定する
  const param = rule.source.match(/^\/:rest\((.*)\)$/)[1];
  const re = new RegExp(`^/(${param})$`);

  it("旧ホストだけが対象で、同じパスへ恒久転送", () => {
    expect(vercel.redirects).toHaveLength(1);
    expect(rule.has).toEqual([{ type: "host", value: OLD_HOSTS[0] }]);
    expect(rule.destination).toBe("https://anno.ldas.jp/:rest");
    expect(rule.permanent).toBe(true);
  });

  it.each(["/", "/item", "/en/help", "/api-docs", "/en/api-docs", "/apiary", "/ogp.webp"])("%s は転送する", (p) => {
    expect(re.test(p)).toBe(true);
  });

  // API は外部から呼ばれる。転送を追わない利用者や CORS の事前確認を壊さないよう、旧ホストでも答え続ける
  it.each(["/api", "/api/", "/api/annotations", "/api/annotations/abc", "/api/openapi"])("%s は転送しない", (p) => {
    expect(re.test(p)).toBe(false);
  });
});

describe("旧ホストの文字列が残っていない", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.(tsx?|jsx?|json|md|cff)$/.test(n)) files.push(f);
    }
  };
  walk(join(root, "src"));
  files.push(join(root, "README.md"), join(root, "CITATION.cff"));

  it.each(OLD_HOSTS)("%s", (host) => {
    const hits = files.filter((f) => !f.endsWith("site.ts") && !f.endsWith("site.test.ts") && readFileSync(f, "utf8").includes(host));
    expect(hits).toEqual([]);
  });
});
