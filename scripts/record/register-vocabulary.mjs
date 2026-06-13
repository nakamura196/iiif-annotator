// 「メタデータ語彙」管理ページ(/vocabulary)のデモ録画（ja / en バイリンガル）。
// 2 層モデル（名前付き語彙 → プロパティ）を pj-a / pj-b の 2 つ作成して見せる:
//   ログイン → 既存をクリア → 語彙を2つ作成 → 保存 → エクスポート(JSON) →
//   再読込で「語彙ごとに別プロパティ」が保持されることを確認。
//
// 既定は CLEAN モード（字幕を焼き込まず、VTT を書き出す）。YouTube に上げて
// CC トラックを付ける既存デモと同じ運用に合わせるため。ANNO_CLEAN=0 で焼き込み。
//
// 使い方:
//   ANNO_BASE=http://localhost:3010 ANNO_LOCALE=ja \
//   node scripts/record/register-vocabulary.mjs   # → demo/videos/register-vocabulary-ja.{webm,vtt}
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setupRecorder } from './lib/recorder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../demo');

const BASE = process.env.ANNO_BASE || 'http://localhost:3010';
const LOCALE = process.env.ANNO_LOCALE === 'en' ? 'en' : 'ja';
const CLEAN = process.env.ANNO_CLEAN !== '0'; // 既定: 字幕焼き込みなし（VTT出力）

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

// ロケール別の UI 文言（セレクタ用）
const UI = {
  ja: {
    loginBtn: 'ログイン',
    save: '保存',
    addVocab: '語彙を追加',
    addField: '項目を追加',
    removeVocab: 'この語彙を削除',
    export: 'エクスポート',
    heading: 'メタデータ項目（語彙）',
    namePh: '語彙名（例: pj-a）',
    propPh: '項目名（例: 図面種別、制作年）',
    saved: '保存しました',
  },
  en: {
    loginBtn: 'Login',
    save: 'Save',
    addVocab: 'Add vocabulary',
    addField: 'Add field',
    removeVocab: 'Remove this vocabulary',
    export: 'Export',
    heading: 'Metadata fields (vocabulary)',
    namePh: 'Vocabulary name (e.g. pj-a)',
    propPh: 'Field name (e.g. Drawing type, Year)',
    saved: 'Saved',
  },
};

// 作成する語彙（2 層: 名前 + プロパティ群）。pj ごとに別プロパティ。
const VOCABS = {
  ja: [
    { name: 'pj-a 設計図', properties: ['図面種別', '制作年', '縮尺'] },
    { name: 'pj-b 版画', properties: ['絵師', '版元', '判型'] },
  ],
  en: [
    { name: 'pj-a Drawings', properties: ['Drawing type', 'Year', 'Scale'] },
    { name: 'pj-b Prints', properties: ['Artist', 'Publisher', 'Format'] },
  ],
};

// 字幕（ナレーション調・既存デモと同じトーン）。CLEAN 時は VTT になる。
const CAP = {
  ja: {
    login: 'IIIF Annotator にログインします。',
    intro: 'APIキー管理とは別の「メタデータ語彙」管理ページを開きます。',
    clear: 'まず、既存の語彙を整理します。',
    pjA: '語彙「pj-a」を作成し、図面種別・制作年・縮尺の項目を登録します。',
    pjB: 'プロジェクトごとに項目は変えられます。「pj-b」には絵師・版元・判型を登録します。',
    save: '保存すると、ユーザー単位で永続化されます。',
    export: 'JSON でエクスポートでき、複数人で語彙を共有できます。',
    reload: '再読み込みしても、語彙ごとに項目が保持されています。',
  },
  en: {
    login: 'Sign in to IIIF Annotator.',
    intro: 'Open the dedicated metadata vocabulary page, separate from API key settings.',
    clear: 'First, clear the existing vocabularies.',
    pjA: 'Create vocabulary "pj-a" with the fields Drawing type, Year and Scale.',
    pjB: 'Each project can have its own fields. "pj-b" gets Artist, Publisher and Format.',
    save: 'Saving persists the vocabularies per user.',
    export: 'Export as JSON to share vocabularies across people.',
    reload: 'After reloading, each vocabulary keeps its own fields.',
  },
};

const t = UI[LOCALE];
const cap = CAP[LOCALE];
const vocabs = VOCABS[LOCALE];
const vocabularyUrl = `${BASE}/${LOCALE}/vocabulary`;
const NAME = `register-vocabulary-${LOCALE}`;

async function login(page) {
  await page.getByRole('button', { name: t.loginBtn }).first().click();
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

async function clearVocabularies(page) {
  for (let guard = 0; guard < 30; guard++) {
    const del = page.getByRole('button', { name: t.removeVocab, exact: true });
    if ((await del.count()) === 0) break;
    await del.first().click();
    await page.waitForTimeout(250);
  }
}

async function addVocabulary(page, vocab) {
  await page.getByRole('button', { name: t.addVocab }).click();
  await page.waitForTimeout(450);
  await page.getByPlaceholder(t.namePh).last().fill(vocab.name);
  await page.waitForTimeout(400);
  for (let i = 0; i < vocab.properties.length; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: t.addField }).last().click();
      await page.waitForTimeout(250);
    }
    await page.getByPlaceholder(t.propPh).last().fill(vocab.properties[i]);
    await page.waitForTimeout(400);
  }
}

function toVtt(cues) {
  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s - Math.floor(s)) * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(h)}:${p(m)}:${p(sec)}.${p(ms, 3)}`;
  };
  let out = 'WEBVTT\n\n';
  cues.forEach((c, i) => {
    const end = i + 1 < cues.length ? cues[i + 1].start : c.start + c.hold;
    out += `${i + 1}\n${fmt(c.start)} --> ${fmt(end)}\n${c.text}\n\n`;
  });
  return out;
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('ANNO_EMAIL / ANNO_PASSWORD が無い');

  const { page, scene, finalize } = await setupRecorder({
    outDir,
    name: NAME,
    clean: CLEAN,
  });

  try {
    await page.goto(vocabularyUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    await scene(cap.login, 1600);
    await login(page);

    await scene(cap.intro, 2400);
    const heading = page.getByRole('heading', { name: t.heading });
    await heading.waitFor({ timeout: 10000 });
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    await scene(cap.clear, 1600);
    await clearVocabularies(page);
    await page.waitForTimeout(400);

    await scene(cap.pjA, 2800);
    await addVocabulary(page, vocabs[0]);
    await page.waitForTimeout(500);

    await scene(cap.pjB, 2800);
    await addVocabulary(page, vocabs[1]);
    await page.waitForTimeout(500);

    await scene(cap.save, 1800);
    await page.getByRole('button', { name: t.save, exact: true }).click();
    await page
      .getByText(t.saved)
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    await scene(cap.export, 2400);
    const [download] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      page.getByRole('button', { name: t.export }).click(),
    ]);
    if (download) {
      await download
        .saveAs(resolve(outDir, `metadata-vocabularies-${LOCALE}.json`))
        .catch(() => {});
    }
    await page.waitForTimeout(1000);

    await scene(cap.reload, 2200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByRole('heading', { name: t.heading }).scrollIntoViewIfNeeded();
    const names = await page
      .getByPlaceholder(t.namePh)
      .evaluateAll((els) => els.map((e) => e.value));
    console.log('[record] reload後の語彙名:', JSON.stringify(names));

    const { webm, cues } = await finalize();
    const vttPath = resolve(outDir, 'videos', `${NAME}.vtt`);
    writeFileSync(vttPath, toVtt(cues), 'utf8');
    console.log('[record] webm:', webm);
    console.log('[record] vtt :', vttPath, `(${cues.length} cues, clean=${CLEAN})`);
  } catch (e) {
    console.log('録画中にエラー:', e.message);
    await finalize().catch(() => {});
    process.exitCode = 1;
  }
}

main();
