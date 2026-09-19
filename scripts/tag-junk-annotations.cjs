#!/usr/bin/env node
/**
 * ゴミ本文のアノテーションに tags:["skip"] を付与する（annotationPages 対象）。
 *
 * 「skip」は「公開しない」用途タグ（由来を表す OCR とは別）。dcb 取り込みで除外する。
 * 対象: drupal manifest 上の item で、本文(HTMLタグ除去・trim・小文字化)が JUNK_VALUES に完全一致。
 *   既定は "div" のみ（HTML エディタ由来の空要素残骸）。1文字翻刻の誤爆を避けるため
 *   "p"/"b" 等の紛らわしい語は入れない。
 *
 * 冪等: 既に skip タグがあればスキップ。
 *
 * 実行:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/tag-junk-annotations.cjs          # dry-run
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/tag-junk-annotations.cjs --apply   # 付与
 */
const admin = require('firebase-admin');

const COLLECTION = 'annotationPages';
const DRUPAL_PREFIX = 'https://drupal.lab.hi.u-tokyo.ac.jp/api/iiif/2/';
const JUNK_VALUES = new Set(['div']);
const TAG = 'skip';
const APPLY = process.argv.includes('--apply');

function initDb() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function bodyText(body) {
  const v = body && typeof body === 'object' ? (Array.isArray(body) ? body[0]?.value : body.value) : body;
  return (typeof v === 'string' ? v : '').replace(/<[^>]+>/g, '').trim().toLowerCase();
}

async function main() {
  const db = initDb();
  const snap = await db.collection(COLLECTION).get();

  const updates = [];
  const hits = [];
  let already = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    const m = data.manifestId;
    if (typeof m !== 'string' || !m.startsWith(DRUPAL_PREFIX)) return;
    const items = Array.isArray(data.items) ? data.items : [];
    let changed = false;
    for (const it of items) {
      if (!JUNK_VALUES.has(bodyText(it.body))) continue;
      const tags = Array.isArray(it.tags) ? it.tags : [];
      if (tags.includes(TAG)) { already++; continue; }
      it.tags = [...tags, TAG];
      changed = true;
      hits.push({ manifestId: m, id: it.id, userId: data.userId });
    }
    if (changed) updates.push({ ref: doc.ref, items });
  });

  console.log('=== ゴミ本文へ skip タグ付与（drupal manifest 上の本文=' + [...JUNK_VALUES].join('/') + '）===');
  console.log(`対象 item 数: ${hits.length}（既に skip 済みでスキップ: ${already}）`);
  for (const h of hits) {
    const uuid = h.manifestId.slice(DRUPAL_PREFIX.length).replace(/\/manifest$/, '');
    console.log(`  manifest=${uuid}  user=${h.userId.slice(0, 6)}…  id=${h.id.slice(-12)}`);
  }

  if (!APPLY) {
    console.log('\n[dry-run] 書き込みは行いませんでした。--apply で適用します。');
    return;
  }
  const now = new Date();
  for (const u of updates) await u.ref.update({ items: u.items, modified: now });
  console.log(`\n[apply] ${updates.length} シャード更新・完了しました。`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
