// 「メタデータ項目（語彙）」編集画面のデモ録画。
// ログイン → 設定画面の語彙セクション → 既存をクリア → 項目を追加 → 保存 →
// 再読込で永続化を確認、までを字幕付きで録る。
//
// 使い方:
//   ANNO_BASE=http://localhost:3010 \
//   ANNO_EMAIL=... ANNO_PASSWORD=... \   # 無指定なら .demo-creds.env から読む
//   node scripts/record/register-vocabulary.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setupRecorder } from './lib/recorder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../demo');

const BASE = process.env.ANNO_BASE || 'http://localhost:3010';
const LOCALE = process.env.ANNO_LOCALE || 'ja';

// 資格情報: env 優先、無ければ blog 側の .demo-creds.env から読む
function loadCreds() {
  let email = process.env.ANNO_EMAIL || '';
  let password = process.env.ANNO_PASSWORD || '';
  if (!email || !password) {
    try {
      const c = readFileSync(
        '/Users/nakamura/git/blog/next-fb-anno/scripts/.demo-creds.env',
        'utf8'
      );
      email = email || c.match(/DEMO_EMAIL=(.*)/)?.[1]?.trim() || '';
      password = password || c.match(/DEMO_PASSWORD=(.*)/)?.[1]?.trim() || '';
    } catch {
      /* なければ未ログインで失敗させる */
    }
  }
  return { email, password };
}
const { email: EMAIL, password: PASSWORD } = loadCreds();

// 登録する語彙（env ANNO_VOCAB で上書き可。カンマ区切り）
const VOCAB = (process.env.ANNO_VOCAB || '図面種別,制作年,縮尺').split(',').map((s) => s.trim());

const vocabularyUrl = `${BASE}/${LOCALE}/vocabulary`;
const PLACEHOLDER = '項目名（例: 図面種別、制作年）';

async function login(page, scene) {
  await scene('① ログイン（デモアカウント）', 1600);
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  const ok = await page
    .locator('input[type="password"]')
    .waitFor({ state: 'detached', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) throw new Error('ログインに失敗しました（資格情報を確認）');
  await page.waitForTimeout(1500);
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('ANNO_EMAIL / ANNO_PASSWORD が無い');

  const { page, scene, finalize } = await setupRecorder({
    outDir,
    name: 'register-vocabulary',
  });

  try {
    await page.goto(vocabularyUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    await login(page, scene);

    // ② 語彙セクションへスクロール
    await scene('② 設定 → メタデータ項目の語彙', 2200);
    const heading = page.getByRole('heading', { name: 'メタデータ項目（語彙）' });
    await heading.waitFor({ timeout: 10000 });
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // ③ 既存の項目をクリア（毎回まっさらから見せる）
    await scene('③ 既存の項目を一旦クリア', 1800);
    for (let guard = 0; guard < 20; guard++) {
      const del = page.getByRole('button', { name: '削除' });
      if ((await del.count()) === 0) break;
      await del.first().click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);

    // ④ 項目を追加していく
    await scene('④ 語彙（項目名）を登録', 2200);
    for (const term of VOCAB) {
      await page.getByRole('button', { name: '項目を追加' }).click();
      await page.getByPlaceholder(PLACEHOLDER).last().fill(term);
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(700);

    // ⑤ 保存
    await scene('⑤ 保存', 1600);
    await page.getByRole('button', { name: '保存' }).click();
    await page
      .getByText('保存しました')
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // ⑥ 再読込して永続化を確認
    await scene('⑥ 再読込しても語彙は保持される', 1800);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByRole('heading', { name: 'メタデータ項目（語彙）' }).scrollIntoViewIfNeeded();
    const values = await page
      .getByPlaceholder(PLACEHOLDER)
      .evaluateAll((els) => els.map((e) => e.value));
    console.log('[record] reload後の語彙:', JSON.stringify(values));
    await scene('登録した語彙が保持されています ✓', 2400);

    const { webm } = await finalize();
    console.log('[record] webm:', webm);
  } catch (e) {
    console.log('録画中にエラー:', e.message);
    await finalize().catch(() => {});
    process.exitCode = 1;
  }
}

main();
