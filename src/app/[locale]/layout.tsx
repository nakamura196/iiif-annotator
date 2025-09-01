import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "../globals.css";
import ThemeProvider from "@/app/theme-provider";
import { routing } from '@/i18n/routing';
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "IIIF Annotator";
const description = "Annotate IIIF images with Annotorious v3";
const url = "https://next-fb-anno.vercel.app";
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
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <head>
        <Script
          src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js"
          strategy="beforeInteractive"
        />
        <Script src="/ort-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} 
          antialiased min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
