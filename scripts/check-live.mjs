#!/usr/bin/env node
/**
 * Smoke-test the production site (anno.ldas.jp) over plain HTTP.
 * Run by hand after a deploy: npm run test:live
 * (For the authenticated read/write API against Firestore, see check-api.mjs.)
 *
 * Checks:
 *   1. Main pages return 200 and their canonical / og:url point to the production host
 *   2. /_next assets referenced by those pages, the OGP image, robots.txt and sitemap.xml return 200
 *   3. Unknown paths return 404, and http redirects to https
 *   4. /api answers directly (no redirect), including CORS preflight for external clients
 *
 * The old *.vercel.app hosts are no longer checked: the Vercel deployment is disabled
 * (HTTP 402) since the move to Cloudflare Workers, so their redirects are gone.
 */
const NEW = 'https://anno.ldas.jp';

const errors = [];
let passed = 0;
const ok = (cond, msg) => (cond ? passed++ : errors.push(msg));
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts });

// 1, 2
const assets = new Set();
for (const page of ['/', '/en', '/help', '/api-docs', '/vocabulary']) {
  const r = await get(NEW + page);
  ok(r.status === 200, `${NEW}${page} → ${r.status} (expected 200)`);
  const html = await r.text();
  const og = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
  ok(og?.startsWith(NEW), `${page} og:url is ${og}`);
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  ok(ogImage === `${NEW}/ogp.webp`, `${page} og:image is ${ogImage}`);
  ok(!html.includes('iiif-annotator.vercel.app'), `${page} still mentions the old Vercel host`);
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/[^"]+)"/g)) assets.add(m[1]);
}
ok(assets.size > 0, 'no /_next asset references found');
for (const path of [...assets, '/ogp.webp', '/robots.txt', '/sitemap.xml']) {
  const r = await get(NEW + path, { method: 'HEAD' });
  ok(r.status === 200, `${NEW}${path} → ${r.status}`);
}
{
  const txt = await (await get(NEW + '/robots.txt')).text();
  ok(txt.includes(`Sitemap: ${NEW}/sitemap.xml`), 'robots.txt Sitemap line does not point to the new host');
  const xml = await (await get(NEW + '/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(locs.length > 0 && locs.every((u) => u.startsWith(NEW + '/')), `sitemap locs: ${locs.join(', ')}`);
}

// 3
{
  const r = await get(NEW + '/no-such-page');
  ok(r.status === 404, `missing page → ${r.status} (expected 404)`);
  const h = await get('http://anno.ldas.jp/help?q=1');
  const loc = h.headers.get('location');
  ok([301, 308].includes(h.status) && loc === `${NEW}/help?q=1`, `http → ${h.status} ${loc}`);
}

// 4
{
  const r = await get(NEW + '/api/openapi');
  ok(r.status === 200, `${NEW}/api/openapi → ${r.status} (expected 200)`);
  const a = await get(NEW + '/api/annotations');
  ok(a.status !== 308 && a.status !== 301 && a.status < 500, `${NEW}/api/annotations → ${a.status} (expected no redirect or error)`);
  const p = await get(NEW + '/api/annotations', {
    method: 'OPTIONS',
    headers: { Origin: 'https://example.org', 'Access-Control-Request-Method': 'GET' },
  });
  ok(p.status < 300, `${NEW}/api/annotations preflight → ${p.status}`);
}

if (errors.length) {
  console.error(`NG: ${errors.length} (OK: ${passed})`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${passed}`);
