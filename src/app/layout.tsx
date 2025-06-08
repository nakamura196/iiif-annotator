import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";
import ThemeProvider from "@/app/theme-provider";

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
const url = "https://iiif-annotator.vercel.app";
const imageUrl = "https://iiif-annotator.vercel.app/ogp.webp";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} 
          antialiased min-h-screen flex flex-col`}
      >
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
      </body>
    </html>
  );
}
