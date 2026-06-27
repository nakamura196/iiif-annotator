import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";
import ThemeProvider from "@/app/theme-provider";
import { Mascot } from "@/components/Mascot";
import { routing } from '@/i18n/routing';
import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';

// Google Analytics の測定ID。専用の NEXT_PUBLIC_GA_ID があればそれを使い、
// 無ければ Firebase 由来の既存 GA4 プロパティ (NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) を再利用する。
// dev のアクセスが計測に混ざらないよう、本番ビルドのみ有効化する。
const gaId =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_GA_ID ?? process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    : undefined;

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_JP({
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const title = "IIIF Annotator";
const description = "Annotate IIIF images with Annotorious v3";
const url = "https://iiif-annotator.vercel.app";
const imageUrl = `${url}/ogp.webp`;
const twitter = "@nsatoru196";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: title,
  description: description,
  keywords: [
    "IIIF",
    "TEI",
    "XML",
    "Next.js",
    "Vercel",
    "Annotorious",
    "Firebase",
  ],
  authors: [
    { name: "Satoru Nakamura", url: "https://researchmap.jp/nakamura.satoru" },
  ],
  openGraph: {
    title: title,
    description: description,
    url: url,
    type: "website",
    siteName: title,
    images: imageUrl,
  },
  twitter: {
    card: "summary",
    site: twitter,
    creator: twitter,
    title: title,
    description: description,
    images: imageUrl,
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoSerif.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* ONNX Runtime Web をグローバル `ort` として読み込む。next.config.ts で
            onnxruntime-web を external('ort') にしているため、OCR チャンクが評価
            される前にこの単一の beforeInteractive スクリプトで window.ort を定義
            しておく必要がある。バージョンは package.json の依存(^1.22.0)および
            OCR パッケージの最低要件(^1.16.0)に合わせる。 */}
        <Script
          src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Mascot />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
