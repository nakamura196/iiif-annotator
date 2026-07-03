#!/usr/bin/env node
/**
 * seinan のテスト用アノテーション（本文が "aaa"/"あああ"）を annotationPages から削除する。
 *
 * 対象: drupal manifest 上の item で、本文(HTMLタグ除去・trim)が完全一致で "aaa" か "あああ"。
 *   これで seinan の3件（1990-032-033 の "あああ"/"aaa"、2014-005-21 の "aaa"）に限定される。
 *   他プロジェクトの同種テストは drupal 以外の manifest なので対象外。
 *
 * 実行:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/delete-test-annotations.cjs           # dry-run
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/delete-test-annotations.cjs --apply    # 削除
 *
 * 事前バックアップ: next-fb-anno/backups/firestore-backup-2026-07-01T12-51-58-141Z.json.gz
 */
const admin = require('firebase-admin');

const COLLECTION = 'annotationPages';
const DRUPAL_PREFIX = 'https://drupal.lab.hi.u-tokyo.ac.jp/api/iiif/2/';
const TEST_VALUES = new Set(['aaa', 'あああ']);
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
  return (typeof v === 'string' ? v : '').replace(/<[^>]+>/g, '').trim();
}

async function main() {
  const db = initDb();
  const snap = await db.collection(COLLECTION).get();

  const hits = []; // { docRef, docId, manifestId, itemId, text, userId }
  const shardsToUpdate = new Map(); // docId -> { ref, items, removeIds:Set }

  snap.forEach((doc) => {
    const data = doc.data();
    const m = data.manifestId;
    if (typeof m !== 'string' || !m.startsWith(DRUPAL_PREFIX)) return;
    const items = Array.isArray(data.items) ? data.items : [];
    for (const it of items) {
      if (TEST_VALUES.has(bodyText(it.body))) {
        hits.push({ docId: doc.id, manifestId: m, itemId: it.id, text: bodyText(it.body), userId: data.userId });
        if (!shardsToUpdate.has(doc.id)) {
          shardsToUpdate.set(doc.id, { ref: doc.ref, items, removeIds: new Set() });
        }
        shardsToUpdate.get(doc.id).removeIds.add(it.id);
      }
    }
  });

  console.log('=== テスト用アノテーション削除（drupal manifest 上の "aaa"/"あああ"）===');
  console.log(`対象 item 数: ${hits.length}`);
  for (const h of hits) {
    const uuid = h.manifestId.slice(DRUPAL_PREFIX.length).replace(/\/manifest$/, '');
    console.log(`  "${h.text}"  manifest=${uuid}  user=${h.userId.slice(0, 6)}…  id=${h.itemId.slice(-12)}`);
  }

  if (!APPLY) {
    console.log('\n[dry-run] 削除は行いませんでした。--apply で実行します。');
    return;
  }

  console.log(`\n[apply] ${shardsToUpdate.size} シャードから ${hits.length} 件を削除します…`);
  const now = new Date();
  for (const { ref, items, removeIds } of shardsToUpdate.values()) {
    const remaining = items.filter((it) => !removeIds.has(it.id));
    if (remaining.length === 0) {
      await ref.delete();
    } else {
      await ref.update({ items: remaining, modified: now });
    }
  }
  console.log('完了しました。');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
