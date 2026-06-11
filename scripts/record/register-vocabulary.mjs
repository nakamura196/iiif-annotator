// 「メタデータ項目（語彙）」管理ページ(/vocabulary)のデモ録画。
// 2 層モデル（名前付き語彙 → プロパティ）を、pj-a / pj-b の 2 つ作成して見せる:
//   ログイン → 既存をクリア → 語彙を2つ作成 → 保存 → エクスポート(JSON) →
//   再読込で「語彙ごとに別プロパティ」が保持されることを確認。
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

// 作成する語彙（2 層: 名前 + プロパティ群）。pj ごとに別プロパティ。
const VOCABS = [
  { name: 'pj-a 設計図', properties: ['図面種別', '制作年', '縮尺'] },
  { name: 'pj-b 版画', properties: ['絵師', '版元', '判型'] },
];

const vocabularyUrl = `${BASE}/${LOCALE}/vocabulary`;
const NAME_PH = '語彙名（例: pj-a）';
const PROP_PH = '項目名（例: 図面種別、制作年）';

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

// 既存の語彙をすべて削除（「この語彙を削除」だけを正確に対象にする）
async function clearVocabularies(page) {
  for (let guard = 0; guard < 30; guard++) {
    const del = page.getByRole('button', { name: 'この語彙を削除', exact: true });
    if ((await del.count()) === 0) break;
    await del.first().click();
    await page.waitForTimeout(250);
  }
}

// 語彙を 1 つ作成（名前 + プロパティ群）。直近に追加したカード(=最後)を対象にする。
async function addVocabulary(page, vocab) {
  await page.getByRole('button', { name: '語彙を追加' }).click();
  await page.waitForTimeout(450);
  await page.getByPlaceholder(NAME_PH).last().fill(vocab.name);
  await page.waitForTimeout(400);
  for (let i = 0; i < vocab.properties.length; i++) {
    if (i > 0) {
      // 追加直後のカードは空プロパティ 1 つを持つので、2 つ目以降だけ「項目を追加」
      await page.getByRole('button', { name: '項目を追加' }).last().click();
      await page.waitForTimeout(250);
    }
    await page.getByPlaceholder(PROP_PH).last().fill(vocab.properties[i]);
    await page.waitForTimeout(400);
  }
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

    // ② 語彙管理ページ
    await scene('② メタデータ語彙の管理ページ', 2200);
    const heading = page.getByRole('heading', { name: 'メタデータ項目（語彙）' });
    await heading.waitFor({ timeout: 10000 });
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // ③ 既存の語彙をクリア
    await scene('③ 既存の語彙を一旦クリア', 1600);
    await clearVocabularies(page);
    await page.waitForTimeout(500);

    // ④ 語彙 pj-a を作成
    await scene('④ 語彙「pj-a」を作成（図面種別・制作年・縮尺）', 2400);
    await addVocabulary(page, VOCABS[0]);
    await page.waitForTimeout(600);

    // ⑤ 語彙 pj-b を作成（pj ごとに別プロパティ）
    await scene('⑤ もう1つ「pj-b」を作成（pjごとに別プロパティ）', 2400);
    await addVocabulary(page, VOCABS[1]);
    await page.waitForTimeout(600);

    // ⑥ 保存
    await scene('⑥ 保存', 1600);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page
      .getByText('保存しました')
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // ⑦ エクスポート（JSON で共有）
    await scene('⑦ エクスポート（JSONで他の人と共有）', 2200);
    const [download] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      page.getByRole('button', { name: 'エクスポート' }).click(),
    ]);
    if (download) {
      await download
        .saveAs(resolve(outDir, 'metadata-vocabularies.json'))
        .catch(() => {});
    }
    await page.waitForTimeout(1200);

    // ⑧ 再読込して保持を確認
    await scene('⑧ 再読込しても語彙ごとに保持される', 1800);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page
      .getByRole('heading', { name: 'メタデータ項目（語彙）' })
      .scrollIntoViewIfNeeded();
    const names = await page
      .getByPlaceholder(NAME_PH)
      .evaluateAll((els) => els.map((e) => e.value));
    const props = await page
      .getByPlaceholder(PROP_PH)
      .evaluateAll((els) => els.map((e) => e.value));
    console.log('[record] reload後の語彙名:', JSON.stringify(names));
    console.log('[record] reload後のプロパティ:', JSON.stringify(props));
    await scene('語彙ごとに別のプロパティを保持 ✓', 2400);

    const { webm } = await finalize();
    console.log('[record] webm:', webm);
  } catch (e) {
    console.log('録画中にエラー:', e.message);
    await finalize().catch(() => {});
    process.exitCode = 1;
  }
}

main();
