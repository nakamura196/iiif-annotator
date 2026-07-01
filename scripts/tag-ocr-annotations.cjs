#!/usr/bin/env node
/**
 * OCR 一括生成アノテーションに tags:["OCR"] を後付けする（annotationPages 対象）。
 *
 * 背景: seinan 翻刻には、OCR(NDL古典籍OCR) で一括生成された種アノテーションが
 * ユーザー中村覚 (userId=VqKVP3fr…) のアカウントで登録されている。人手清書分
 * (重田未来 eZQshkv8…) と区別できるよう OCR タグを付ける。
 *
 * 対象（定義A）: 「重田も付与した drupal manifest」に載っている中村の item のみ。
 *   ＝重田が清書済みで OCR 種が冗長になっている manifest。重田が触っていない
 *     中村単独 manifest（例: 2014-007）は対象外＝タグを付けない。
 *
 * 冪等: 既に tags に "OCR" を含む item はスキップ。
 *
 * 実行:
 *   # dry-run（書き込まない・対象件数のみ）
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/tag-ocr-annotations.cjs
 *   # 適用
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/tag-ocr-annotations.cjs --apply
 *
 * 事前バックアップ（ロールバック元）:
 *   next-fb-anno/backups/firestore-backup-2026-07-01T12-51-58-141Z.json.gz
 */
const admin = require('firebase-admin');

const COLLECTION = 'annotationPages';
const OCR_UID = 'VqKVP3frekQI7BTenoRRjz1rm2F3'; // 中村覚（OCR 実行アカウント）
const HUMAN_UID = 'eZQshkv8YzSEKkC8xdLPeWtrR673'; // 重田未来（人手清書）
const DRUPAL_PREFIX = 'https://drupal.lab.hi.u-tokyo.ac.jp/api/iiif/2/';
const TAG = 'OCR';
const APPLY = process.argv.includes('--apply');

function initDb() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

async function main() {
  const db = initDb();

  // 1) 重田が付与している drupal manifest 集合（＝清書済み manifest）。
  const humanSnap = await db.collection(COLLECTION).where('userId', '==', HUMAN_UID).get();
  const sharedManifests = new Set();
  humanSnap.forEach((doc) => {
    const m = doc.data().manifestId;
    if (typeof m === 'string' && m.startsWith(DRUPAL_PREFIX)) sharedManifests.add(m);
  });

  // 2) 中村のシャードのうち、shared manifest 上のものを対象に OCR タグを付与。
  const ocrSnap = await db.collection(COLLECTION).where('userId', '==', OCR_UID).get();

  const perManifest = {};
  const updates = []; // { ref, items }
  let candidateShards = 0;
  let taggedItems = 0;
  let alreadyTagged = 0;

  ocrSnap.forEach((doc) => {
    const data = doc.data();
    const m = data.manifestId;
    if (typeof m !== 'string' || !m.startsWith(DRUPAL_PREFIX)) return;
    if (!sharedManifests.has(m)) return; // 中村単独 manifest はスキップ（定義A）
    candidateShards++;
    const items = Array.isArray(data.items) ? data.items : [];
    let changed = false;
    for (const it of items) {
      const tags = Array.isArray(it.tags) ? it.tags : [];
      if (tags.includes(TAG)) {
        alreadyTagged++;
        continue;
      }
      it.tags = [...tags, TAG];
      changed = true;
      taggedItems++;
      perManifest[m] = (perManifest[m] || 0) + 1;
    }
    if (changed) updates.push({ ref: doc.ref, items });
  });

  console.log('=== OCR タグ後付け（定義A: 重田も付与した drupal manifest の中村分）===');
  console.log(`重田の drupal manifest 数: ${sharedManifests.size}`);
  console.log(`中村の対象シャード数: ${candidateShards} / 更新シャード数: ${updates.length}`);
  console.log(`タグ付与 item 数: ${taggedItems}  （既にOCRタグ有りでスキップ: ${alreadyTagged}）`);
  console.log('manifest 別付与数:');
  for (const [m, n] of Object.entries(perManifest)) {
    const uuid = m.slice(DRUPAL_PREFIX.length).replace(/\/manifest$/, '');
    console.log(`  ${n}\t${uuid}`);
  }

  if (!APPLY) {
    console.log('\n[dry-run] 書き込みは行いませんでした。--apply で適用します。');
    return;
  }

  console.log(`\n[apply] ${updates.length} シャードを更新します…`);
  const now = new Date();
  let done = 0;
  // シャードは大きい(最大~1MiB)ので 1 件ずつ update（バッチの 10MiB 制限に配慮）。
  for (const u of updates) {
    await u.ref.update({ items: u.items, modified: now });
    if (++done % 5 === 0 || done === updates.length) {
      console.log(`  updated ${done}/${updates.length}`);
    }
  }
  console.log('完了しました。');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
