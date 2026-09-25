import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

// 日本語は接頭辞なし、英語は /en(next-intl の localePrefix: 'as-needed')
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((p) => {
    const ja = SITE_URL + (p === "/" ? "/" : p);
    const en = SITE_URL + "/en" + (p === "/" ? "" : p);
    return { url: ja, alternates: { languages: { ja, en } } };
  });
}
