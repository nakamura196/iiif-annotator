// アノテーション登録デモの録画基盤（メール/パスワード認証 or ログイン無し）。
//
// ~/git/blog/dlm-manyo/scripts/edit/lib/recorder-auth.mjs を下敷きにしつつ、
// ログインが email/password で自動化できるため永続プロファイルは使わず、
// 通常の launch + newContext({ recordVideo }) で 1 セッション録画する。
//
// 提供する仕組み:
//   - recordVideo による .webm 出力
//   - 仮想カーソル（headless でもポインタが見える）
//   - Next.js dev インジケータの非表示
//   - 画面下部のキャプション帯（scene() で更新 → ナレーションを焼き込む）
//   - mouseTo()（カーソルが滑らかに動く）/ scene()（字幕＋ウェイト）/ finalize()

import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function setupRecorder({
  outDir,
  name = 'demo',
  viewport = { width: 1440, height: 900 },
  slowMo = 140,
  // clean=true: 字幕の焼き込みをやめ、字幕は VTT(cues)として書き出す。
  // YouTube に上げて CC トラックを付ける運用（既存デモと同じ）向け。
  clean = false,
} = {}) {
  const videosDir = resolve(outDir, 'videos');
  await mkdir(videosDir, { recursive: true });

  // OpenSeadragon は headless Chromium だと描画器を確保できず
  // ("Unable to auto-detect a suitable renderer") クラッシュする。
  // 実 Chrome をヘッドありで使う（~/git/blog の recorder-auth と同方針）。
  const launchOpts = {
    headless: false,
    slowMo,
    channel: 'chrome',
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  };
  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    console.log('[recorder] channel:chrome 起動失敗 → chromium(headed) にフォールバック:', e.message);
    delete launchOpts.channel;
    browser = await chromium.launch(launchOpts);
  }
  const context = await browser.newContext({
    viewport,
    locale: 'ja-JP',
    deviceScaleFactor: 2,
    recordVideo: { dir: videosDir, size: viewport },
  });

  // 仮想カーソル + dev インジケータ非表示 + キャプション帯
  await context.addInitScript(() => {
    const ensure = () => {
      if (!document.getElementById('__hide_dev__')) {
        const st = document.createElement('style');
        st.id = '__hide_dev__';
        st.textContent =
          'nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none !important;visibility:hidden !important;}';
        (document.head || document.documentElement).appendChild(st);
      }
      if (!document.getElementById('__pw_cursor__')) {
        const c = document.createElement('div');
        c.id = '__pw_cursor__';
        c.style.cssText =
          'position:fixed;left:-50px;top:-50px;width:20px;height:20px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px #fff,0 0 10px rgba(0,0,0,.45);pointer-events:none;z-index:2147483646;transform:translate(-50%,-50%);transition:left .16s ease-out,top .16s ease-out';
        document.documentElement.appendChild(c);
        document.addEventListener(
          'mousemove',
          (e) => {
            c.style.left = e.clientX + 'px';
            c.style.top = e.clientY + 'px';
          },
          true
        );
      }
      if (!document.getElementById('__cap__')) {
        const cap = document.createElement('div');
        cap.id = '__cap__';
        cap.style.cssText =
          'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:80%;padding:10px 18px;background:rgba(17,17,17,.82);color:#fff;font:600 18px/1.5 system-ui,sans-serif;border-radius:10px;z-index:2147483647;pointer-events:none;text-align:center;opacity:0;transition:opacity .25s';
        document.documentElement.appendChild(cap);
      }
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', ensure, { once: true });
    else ensure();
    // SPA 遷移でも消えないよう定期的に確認
    setInterval(ensure, 1000);
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  // VTT 字幕用のキュー（録画開始からの相対秒）。t0 は概ね録画開始時刻。
  const cues = [];
  const t0 = Date.now();

  // 滑らかにカーソルを動かす（途中点を挟む）
  async function mouseTo(x, y, steps = 18) {
    await page.mouse.move(x, y, { steps });
    await page.waitForTimeout(120);
  }

  // 字幕を出して一定時間ホールド。clean=true のときは焼き込まず、VTT 用に記録のみ。
  async function scene(text, hold = 2600) {
    cues.push({ start: (Date.now() - t0) / 1000, hold: hold / 1000, text });
    if (!clean) {
      await page
        .evaluate((t) => {
          const cap = document.getElementById('__cap__');
          if (cap) {
            cap.textContent = t;
            cap.style.opacity = t ? '1' : '0';
          }
        }, text)
        .catch(() => {});
    }
    await page.waitForTimeout(hold);
  }

  async function finalize() {
    const v = page.video();
    await context.close(); // recordVideo はここで確定
    await browser.close();
    let webm = v ? await v.path() : null;
    if (webm) {
      const dest = resolve(videosDir, `${name}.webm`);
      try {
        await rename(webm, dest);
        webm = dest;
      } catch {
        /* 別ファイル名のまま */
      }
    }
    return { webm, cues };
  }

  return { browser, context, page, mouseTo, scene, finalize, cues };
}
