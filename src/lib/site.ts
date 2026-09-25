// 公開 URL はここ 1 か所で決める(canonical・OGP・robots・sitemap が参照する)。
// 2026-09 に iiif-annotator.vercel.app から anno.ldas.jp へ移した。
// 旧ホストの転送は vercel.json(画面だけ転送し、/api は旧ホストでも答え続ける)。
export const SITE_URL = "https://anno.ldas.jp";

// 旧ホスト。next-fb-anno.vercel.app は Vercel のドメイン設定で iiif-annotator.vercel.app へ転送される
export const OLD_HOSTS = ["iiif-annotator.vercel.app", "next-fb-anno.vercel.app"];

// sitemap に載せる公開ページ(ログイン不要で中身があるもの)
export const PUBLIC_PATHS = ["/", "/help", "/api-docs", "/vocabulary", "/changelog"];
