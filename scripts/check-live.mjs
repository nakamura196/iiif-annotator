#!/usr/bin/env node
/**
 * 本番 (anno.ldas.jp) と旧 URL の転送を、実際に HTTP で叩いて確かめる。
 * マージ (= Vercel の本番配布) と独自ドメインの設定後に手元で実行する: npm run test:live
 *
 * 見ること:
 *   1. 新ホストの主なページが 200 で、canonical / og:url が新ホスト
 *   2. ページが読む /_next の資産、OGP 画像、robots.txt、sitemap.xml が 200
 *   3. 存在しないパスが 404、http は https へ転送
 *   4. 旧 iiif-annotator.vercel.app の画面は同じパス・クエリのまま 308 で新ホストへ
 *      (next-fb-anno.vercel.app は Vercel のドメイン設定で旧ホストへ、そこから新ホストへ)
 *   5. 旧ホストの /api は転送せず答え続ける(外部の利用者と CORS の事前確認を壊さない)
 */
const NEW = 'https://anno.ldas.jp';
const OLD = 'https://iiif-annotator.vercel.app';
const OLDER = 'https://next-fb-anno.vercel.app';

const errors = [];
let passed = 0;
const ok = (cond, msg) => (cond ? passed++ : errors.push(msg));
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts });

// 1, 2
const assets = new Set();
for (const page of ['/', '/en', '/help', '/api-docs', '/vocabulary']) {
  const r = await get(NEW + page);
  ok(r.status === 200, `${NEW}${page} → ${r.status} (200 のはず)`);
  const html = await r.text();
  const og = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
  ok(og?.startsWith(NEW), `${page} の og:url が ${og}`);
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  ok(ogImage === `${NEW}/ogp.webp`, `${page} の og:image が ${ogImage}`);
  ok(!html.includes('iiif-annotator.vercel.app'), `${page} に旧ホストの文字列が残っている`);
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/[^"]+)"/g)) assets.add(m[1]);
}
ok(assets.size > 0, '/_next の資産参照が見つからない');
for (const path of [...assets, '/ogp.webp', '/robots.txt', '/sitemap.xml']) {
  const r = await get(NEW + path, { method: 'HEAD' });
  ok(r.status === 200, `${NEW}${path} → ${r.status}`);
}
{
  const txt = await (await get(NEW + '/robots.txt')).text();
  ok(txt.includes(`Sitemap: ${NEW}/sitemap.xml`), 'robots.txt の Sitemap 行が新ホストでない');
  const xml = await (await get(NEW + '/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(locs.length > 0 && locs.every((u) => u.startsWith(NEW + '/')), `sitemap の loc: ${locs.join(', ')}`);
}

// 3
{
  const r = await get(NEW + '/no-such-page');
  ok(r.status === 404, `存在しないページが ${r.status} (404 のはず)`);
  const h = await get('http://anno.ldas.jp/help?q=1');
  const loc = h.headers.get('location');
  ok([301, 308].includes(h.status) && loc === `${NEW}/help?q=1`, `http → ${h.status} ${loc}`);
}

// 4
const manifest = 'https://dl.ndl.go.jp/api/iiif/1288277/manifest.json';
for (const path of ['/', '/en', '/help', '/api-docs', `/item?manifest=${encodeURIComponent(manifest)}&pos=2`, '/ogp.webp']) {
  const r = await get(OLD + path);
  const loc = r.headers.get('location');
  ok(r.status === 308 && loc === NEW + path, `${OLD}${path} → ${r.status} ${loc} (308 ${NEW + path} のはず)`);
}
{
  const r = await fetch(OLDER + '/help', { redirect: 'follow' });
  ok(r.status === 200 && r.url === NEW + '/help', `${OLDER}/help → ${r.status} ${r.url} (最終的に ${NEW}/help のはず)`);
}

// 5
for (const base of [OLD, NEW]) {
  const r = await get(base + '/api/openapi');
  ok(r.status === 200, `${base}/api/openapi → ${r.status} (200 のはず、転送しない)`);
  const a = await get(base + '/api/annotations');
  ok(a.status !== 308 && a.status !== 301 && a.status < 500, `${base}/api/annotations → ${a.status} (転送もエラーもしないはず)`);
  const p = await get(base + '/api/annotations', {
    method: 'OPTIONS',
    headers: { Origin: 'https://example.org', 'Access-Control-Request-Method': 'GET' },
  });
  ok(p.status < 300, `${base}/api/annotations の preflight → ${p.status}`);
}

if (errors.length) {
  console.error(`NG: ${errors.length} 件 (OK ${passed} 件)`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${passed} 件`);
