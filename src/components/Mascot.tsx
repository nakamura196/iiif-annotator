"use client";

/**
 * 虫めがねのマスコット「ルーペちゃん」— 全ページ右下に固定で登場する案内役。
 *
 * IIIF 画像を拡大して観察し、気になるところに注釈を付ける、という
 * このツールの体験に合わせて虫めがね (ルーペ) をモチーフにした純 SVG キャラ。
 * 画像アセットは不要で、ゆったり揺れる (mascot-bob) + まばたき (mascot-eyes) は
 * globals.css の @keyframes で動く。クリックすると表情とセリフが切り替わる。
 *
 * - セリフは i18n (Mascot.lines) から読み、ja/en に追従する。
 * - 吹き出しから紹介ページ (/mascot) へ動線を張る。
 * - 吹き出しを閉じた状態は localStorage に覚え、リロードで毎回出ないようにする。
 * - 配色は本文と被らないよう DS 変数 (--ds-bg / --ds-border / --ds-fg ...) を使い、
 *   ダークモードに自動対応する。
 *
 * 紹介ページ (`(site)/mascot/page.tsx`) でも同じ絵を使えるよう、SVG 本体の
 * `Loupe` を export している。
 */

import { useId, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { X } from "lucide-react";

export type MascotMood = "default" | "happy" | "thinking";

// クリックごとに巡回する表情。セリフの index に対応づけて変化させる。
const MOODS: MascotMood[] = ["default", "happy", "thinking"];

// 吹き出しを閉じたことを覚えるキー。
const LS_KEY = "iiif-annotator:mascot-bubble";

/**
 * 「吹き出しを閉じたか」を localStorage に置く小さな外部ストア。
 * useSyncExternalStore で読むことで、effect 内 setState を避けつつ
 * hydration ズレも出さない (サーバーは常に false スナップショット)。
 * storage イベントは別タブ用なので、同タブの更新は listeners で通知する。
 */
const bubbleListeners = new Set<() => void>();

function readBubbleClosed(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "closed";
  } catch {
    return false;
  }
}

function setBubbleClosed(closed: boolean) {
  try {
    if (closed) localStorage.setItem(LS_KEY, "closed");
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* localStorage 不可の環境では無視 */
  }
  bubbleListeners.forEach((l) => l());
}

function subscribeBubble(cb: () => void) {
  bubbleListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    bubbleListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function Mascot() {
  const t = useTranslations("Mascot");
  const pathname = usePathname();

  // セリフ一覧 (i18n)。配列でなければ空にフォールバックして描画を止めない。
  const rawLines = t.raw("lines");
  const lines: string[] = Array.isArray(rawLines) ? (rawLines as string[]) : [];

  const [index, setIndex] = useState(0);

  // 前回「×」で閉じていれば、最初から閉じておく (サーバーは常に「開」スナップショット)。
  const bubbleClosed = useSyncExternalStore(subscribeBubble, readBubbleClosed, () => false);
  const bubbleOpen = !bubbleClosed;

  const mood = MOODS[index % MOODS.length];
  const line = lines.length ? lines[index % lines.length] : "";
  const name = t("name");

  const closeBubble = () => setBubbleClosed(true);

  const handleClick = () => {
    // 吹き出しを閉じている時は、まず開くだけ。開いていれば次のセリフへ。
    if (!bubbleOpen) {
      setBubbleClosed(false);
      return;
    }
    setIndex((i) => i + 1);
  };

  // エディタ (アイテム画面) では操作ボタンと被るので出さない。
  if (pathname.includes("/item")) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 select-none">
      {bubbleOpen && line && (
        <div
          role="status"
          aria-live="polite"
          className="relative max-w-[210px] rounded-2xl border border-[var(--ds-border)]
            bg-[var(--ds-bg)] px-3 py-2 pr-6 text-sm leading-snug text-[var(--ds-fg)]
            shadow-lg animate-[mascot-pop_0.25s_ease]"
        >
          {line}
          <Link
            href="/mascot"
            className="mt-1 block text-xs font-medium text-[var(--ds-primary)] hover:underline"
          >
            {t("learnMore")}
          </Link>
          <button
            type="button"
            onClick={closeBubble}
            aria-label="Close"
            className="absolute right-1 top-1 rounded p-0.5 text-[var(--ds-fg-muted)]
              hover:text-[var(--ds-fg)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* 吹き出しのしっぽ (右下向き) */}
          <span
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45
              border-b border-r border-[var(--ds-border)] bg-[var(--ds-bg)]"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label={name}
        title={name}
        className="transition-transform duration-200 hover:scale-110 active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-primary)]
          focus-visible:ring-offset-2 rounded-full"
      >
        <Loupe mood={mood} size={76} />
      </button>
    </div>
  );
}

/**
 * 虫めがねの SVG 本体。size は高さ(px)、mood で表情が変わる。
 * 浮遊ウィジェット (Mascot) と紹介ページの両方から使う。
 */
export function Loupe({
  mood = "default",
  size = 76,
  className = "",
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const rim = `${uid}-rim`;
  const glass = `${uid}-glass`;
  const handle = `${uid}-handle`;
  const aspect = 120 / 132;

  return (
    <svg
      className={`mascot drop-shadow-md ${className}`}
      viewBox="0 0 120 132"
      width={Math.round(size * aspect)}
      height={size}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fb6e8" />
          <stop offset="1" stopColor="#2f7fc4" />
        </linearGradient>
        <radialGradient id={glass} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#eaf6ff" />
          <stop offset="1" stopColor="#c2e2f7" />
        </radialGradient>
        <linearGradient id={handle} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5a3a" />
          <stop offset="1" stopColor="#5b3f25" />
        </linearGradient>
      </defs>

      <g className="mascot-bob">
        {/* 持ち手 (レンズの後ろから右下へ) */}
        <line
          x1="72"
          y1="70"
          x2="104"
          y2="108"
          stroke={`url(#${handle})`}
          strokeWidth="16"
          strokeLinecap="round"
        />
        <line
          x1="72"
          y1="70"
          x2="104"
          y2="108"
          stroke="#9c7a52"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* レンズのガラス */}
        <circle cx="48" cy="46" r="34" fill={`url(#${glass})`} />
        {/* レンズの金属枠 */}
        <circle cx="48" cy="46" r="38" fill="none" stroke={`url(#${rim})`} strokeWidth="8" />
        {/* ガラスのハイライト */}
        <path
          d="M27 33 q9 -12 25 -11"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* 顔 */}
        <Face mood={mood} />

        {/* ほっぺ */}
        <circle cx="32" cy="53" r="3.4" fill="#f6a6a0" opacity="0.6" />
        <circle cx="64" cy="53" r="3.4" fill="#f6a6a0" opacity="0.6" />
      </g>
    </svg>
  );
}

function Face({ mood }: { mood: MascotMood }) {
  if (mood === "happy") {
    return (
      <>
        {/* ＾ ＾ のうれしい目 */}
        <path d="M33 46 q5 -6 10 0" fill="none" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M53 46 q5 -6 10 0" fill="none" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />
        {/* にっこり開いた口 */}
        <path d="M40 54 q8 10 16 0 q-8 5 -16 0z" fill="#b45447" />
      </>
    );
  }
  if (mood === "thinking") {
    return (
      <>
        {/* 上を見て考えている目 */}
        <circle cx="39" cy="42" r="3.2" fill="#1f2937" />
        <circle cx="59" cy="42" r="3.2" fill="#1f2937" />
        {/* ちょっと上がった眉 */}
        <path d="M34 35 q4 -3 9 -1" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M54 34 q5 -2 9 1" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
        {/* 小さな口 */}
        <ellipse cx="48" cy="57" rx="3" ry="2.4" fill="#b45447" />
      </>
    );
  }
  // default
  return (
    <>
      <g className="mascot-eyes">
        <ellipse cx="38" cy="44" rx="4" ry="5" fill="#1f2937" />
        <ellipse cx="58" cy="44" rx="4" ry="5" fill="#1f2937" />
        <circle cx="39.4" cy="42.2" r="1.3" fill="#fff" />
        <circle cx="59.4" cy="42.2" r="1.3" fill="#fff" />
      </g>
      <path d="M41 55 q7 6 14 0" fill="none" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
}
