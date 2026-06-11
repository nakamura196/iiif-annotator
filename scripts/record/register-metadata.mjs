// メタデータ付きアノテーション登録の様子を録画する。
//
// 使い方（dev サーバを別ターミナルで起動: `npm run dev`、ポート3111）:
//   ANNO_EMAIL=... ANNO_PASSWORD=... node scripts/record/register-metadata.mjs
//   # 1Password 経由で秘密を渡す例:
//   #   op run --env-file=scripts/record/.cred.env -- node scripts/record/register-metadata.mjs
//   # ログイン情報を渡さない場合は「保存」直前までの UI を録画（保存は要ログイン）。
//
// 環境変数:
//   ANNO_BASE      既定 http://localhost:3111
//   ANNO_LOCALE    既定 ja
//   ANNO_MANIFEST  既定 kojima B-03 manifest
//   ANNO_POS       既定 1（ページ番号 1始まり）
//   ANNO_EMAIL / ANNO_PASSWORD  ログイン（任意）

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupRecorder } from './lib/recorder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.ANNO_BASE || 'http://localhost:3111';
const LOCALE = process.env.ANNO_LOCALE || 'ja';
// 既定はアプリの「入力例」と同じ 百鬼夜行図（東大史料編纂所）
const MANIFEST =
  process.env.ANNO_MANIFEST ||
  'https://da.dl.itc.u-tokyo.ac.jp/portal/repo/iiif/fbd0479b-dbb4-4eaa-95b8-f27e1c423e4b/manifest';
const POS = process.env.ANNO_POS || '1';
const EMAIL = process.env.ANNO_EMAIL || '';
const PASSWORD = process.env.ANNO_PASSWORD || '';

// 入力内容（百鬼夜行図向けの既定。env で上書き可）
const LABEL = process.env.ANNO_LABEL || '百鬼夜行';
const META = process.env.ANNO_META
  ? JSON.parse(process.env.ANNO_META)
  : [
      { label: '種別', value: '絵巻物' },
      { label: '時代', value: '室町時代' },
    ];

const editorUrl = `${BASE}/${LOCALE}/item?manifest=${encodeURIComponent(MANIFEST)}&pos=${POS}`;

const SIGNUP = process.env.ANNO_SIGNUP === '1';

async function readLoginError(page) {
  return page
    .evaluate(() => {
      const els = [...document.querySelectorAll('div')].filter((d) =>
        /text-red-700|bg-red-100/.test(d.className)
      );
      return els.map((e) => e.innerText.trim()).filter(Boolean)[0] || '';
    })
    .catch(() => '');
}

async function login(page, scene) {
  if (!EMAIL || !PASSWORD) {
    console.log('[record] ログイン情報なし → 保存直前までを録画します');
    return false;
  }
  await scene(
    SIGNUP ? '① アカウント作成（メール / パスワード）' : '① ログイン（メール / パスワード）',
    1800
  );
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.waitForTimeout(500);
  // サインアップモードに切替（新規アカウント作成）
  if (SIGNUP) {
    await page.getByRole('button', { name: '新規アカウント作成' }).click();
    await page.waitForTimeout(400);
  }
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  // モーダルが閉じれば成功（password 入力欄が消える）
  const ok = await page
    .locator('input[type="password"]')
    .waitFor({ state: 'detached', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    const msg = await readLoginError(page);
    throw new Error(
      `${SIGNUP ? 'アカウント作成' : 'ログイン'}に失敗しました: ${msg || '(原因不明)'}`
    );
  }
  await page.waitForTimeout(1500);
  return true;
}

async function main() {
  const outDir = resolve(__dirname, '..', '..', 'demo');
  const { page, mouseTo, scene, finalize } = await setupRecorder({
    outDir,
    name: 'register-metadata',
  });

  // 保存時の確認ダイアログ（未ログイン時の「ログインが必要です」等）で固まらないように
  page.on('dialog', (d) => d.accept().catch(() => {}));

  try {
    await page.goto(editorUrl, { waitUntil: 'domcontentloaded' });
    await scene('IIIF Annotator — 領域に「ラベル＋メタデータ」を登録する', 2600);

    // OpenSeadragon のキャンバスが出るまで待つ
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 40000 });
    await page.waitForTimeout(2500);

    const loggedIn = await login(page, scene);

    // ② 画像を少し拡大 → 矩形ツールで領域を囲む
    await scene('② 画像を拡大して、矩形ツールで領域を囲む', 2400);
    const osd = page.locator('.openseadragon-canvas').first();
    // まず中央へズームイン（横長絵巻が画面に大きく映るように）
    const b0 = await osd.boundingBox();
    await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -320);
      await page.waitForTimeout(450);
    }
    // 矩形ツールを選択
    await page.getByRole('button', { name: /矩形/ }).first().click();
    await page.waitForTimeout(400);
    // Annotorious は「click → move → click」で矩形を描く（drag ではない）
    const b = await osd.boundingBox();
    const x1 = b.x + b.width * 0.4;
    const y1 = b.y + b.height * 0.38;
    const x2 = b.x + b.width * 0.6;
    const y2 = b.y + b.height * 0.62;
    await mouseTo(x1 - 30, y1 - 30);
    await mouseTo(x1, y1, 10);
    await page.mouse.click(x1, y1);
    await page.waitForTimeout(350);
    for (let s = 1; s <= 14; s++) {
      await page.mouse.move(x1 + ((x2 - x1) * s) / 14, y1 + ((y2 - y1) * s) / 14);
      await page.waitForTimeout(55);
    }
    await page.mouse.click(x2, y2);
    await page.waitForTimeout(1400);

    // ③ ラベル（本文）を入力
    await scene('③ ラベル（本文）を入力', 2200);
    const editor = page.locator('.ck-editor__editable').first();
    await editor.click();
    await page.keyboard.type(LABEL, { delay: 70 });
    await page.waitForTimeout(600);

    // ④ メタデータ（項目名＋値）を追加
    await scene('④ ラベル以外のメタデータ（項目名＋値）を追加', 2600);
    const addBtn = page.getByRole('button', { name: '項目を追加' });
    for (const { label, value } of META) {
      await addBtn.click();
      await page.getByPlaceholder('項目名（例: 図面種別）').last().fill(label);
      await page.getByPlaceholder('値').last().fill(value);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(600);

    // ⑤ 保存
    await scene('⑤ 保存', 1800);
    await page.getByRole('button', { name: '変更を保存' }).first().click();
    await page.waitForTimeout(2500);

    await scene(
      loggedIn
        ? '✓ ラベル＋メタデータを登録しました'
        : '※ 保存にはログインが必要です（ここまでが入力フロー）',
      3200
    );

    const { webm } = await finalize();
    console.log('\n✓ 録画完了:', webm);
  } catch (err) {
    console.error('録画中にエラー:', err.message);
    await finalize().catch(() => {});
    process.exit(1);
  }
}

main();
