# IIIF Annotator

[![Live](https://img.shields.io/badge/demo-iiif--annotator.vercel.app-0B8BEE)](https://iiif-annotator.vercel.app/)
[![CI](https://github.com/nakamura196/iiif-annotator/actions/workflows/ci.yml/badge.svg)](https://github.com/nakamura196/iiif-annotator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A web-based annotation editor for [IIIF](https://iiif.io/) (International Image
Interoperability Framework) images, with real-time sync via Firebase and
client-side OCR for Japanese historical documents.

IIIF 画像にアノテーションを付与・管理できる Web エディタです。Firebase による
リアルタイム同期と、日本語史料向けのクライアントサイド OCR を備えています。

**English** | [日本語](#日本語)

---

## English

### Features

- 🖼️ **IIIF support** — Presentation API v2 & v3 manifests and collection browsing
- ✏️ **Annotation tools** — rectangle & polygon regions on deep-zoom images (OpenSeadragon + Annotorious)
- 🔥 **Real-time sync** — annotations stored in Firestore, synced live
- 🔍 **OCR** — in-browser Japanese OCR (NDL Koten OCR, ONNX Runtime / WebAssembly)
- 📤 **Export** — IIIF Annotation / IIIF Manifest, TEI/XML, JSON, CSV
- 🔐 **Auth** — Firebase Auth (Google and Email/Password)
- 🔑 **API access** — issue API keys and read annotations via a REST endpoint
- 🌐 **i18n** — Japanese / English (next-intl), light & dark themes

### Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 + shared design system [`@nakamura196/react-ui`](https://github.com/nakamura196/react-ui)
- **Viewer**: OpenSeadragon + Annotorious
- **Backend**: Firebase (Firestore, Authentication)
- **OCR**: `@nakamura196/ndl-koten-ocr-web`
- **IIIF**: `@iiif/parser`, `@iiif/presentation-3`

### Getting started

**Prerequisites**: Node.js 20+, a Firebase project with Firestore & Authentication enabled.

```bash
git clone https://github.com/nakamura196/iiif-annotator.git
cd iiif-annotator
npm install
```

Copy `.env.example` to `.env.local` and fill in your values (see the file for the
full list — Firebase client config, `FIREBASE_SERVICE_ACCOUNT_BASE64` for the API
routes, and optional GA / Mirador URLs):

```bash
cp .env.example .env.local
```

```bash
npm run dev      # http://localhost:3111
```

### Usage

- **Home** (`/`) — paste a IIIF **manifest** or **collection** URL to begin.
- **Editor** (`/item?manifest=URL&pos=N`) — sign in, pick the rectangle/polygon
  tool, draw a region, enter text; changes save to Firestore automatically.
- **OCR** — open the OCR dialog to recognize text on the current canvas and
  apply detections as annotations.
- **Export** — choose IIIF Manifest, TEI/XML, JSON, or CSV.
- **API** — create a key under *Settings*, then call
  `GET /api/annotations` with an `X-API-Key` header.

### Scripts

```bash
npm run dev        # start dev server (port 3111)
npm run build      # production build
npm run start      # start production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

### Admin / backups

Firestore backups, usage statistics, and maintenance scripts live in a separate
**private** repository (`nakamura196/iiif-annotator-admin`) so this public repo
never contains user data.

### License

MIT — see [LICENSE](LICENSE).

### Acknowledgments

- [IIIF Consortium](https://iiif.io/) — IIIF specifications
- [NDL Lab](https://lab.ndl.go.jp/) — Koten OCR model
- [Annotorious](https://annotorious.github.io/) — annotation framework
- [OpenSeadragon](https://openseadragon.github.io/) — deep-zoom viewer

---

## 日本語

[English](#english) | **日本語**

IIIF 画像（国際的な画像相互運用フレームワーク）にアノテーションを付与・管理する
Web エディタです。Firebase によるリアルタイム同期と、日本語史料向けの
クライアントサイド OCR に対応しています。

### 主な機能

- 🖼️ **IIIF 対応** — Presentation API v2 / v3 のマニフェスト・コレクション閲覧
- ✏️ **アノテーション** — ディープズーム画像上に矩形・ポリゴンで領域指定（OpenSeadragon + Annotorious）
- 🔥 **リアルタイム同期** — アノテーションを Firestore に保存し即時同期
- 🔍 **OCR** — ブラウザ内で日本語 OCR（NDL古典籍OCR、ONNX Runtime / WebAssembly）
- 📤 **エクスポート** — IIIF Annotation / IIIF Manifest、TEI/XML、JSON、CSV
- 🔐 **認証** — Firebase Auth（Google / メール・パスワード）
- 🔑 **API 連携** — API キーを発行し、REST エンドポイントでアノテーション取得
- 🌐 **多言語** — 日本語 / 英語（next-intl）、ライト・ダークテーマ

### 技術スタック

- **フレームワーク**: Next.js 16（App Router）、React 19、TypeScript
- **スタイル**: Tailwind CSS v4 + 共有デザインシステム [`@nakamura196/react-ui`](https://github.com/nakamura196/react-ui)
- **ビューア**: OpenSeadragon + Annotorious
- **バックエンド**: Firebase（Firestore、Authentication）
- **OCR**: `@nakamura196/ndl-koten-ocr-web`
- **IIIF**: `@iiif/parser`、`@iiif/presentation-3`

### セットアップ

**前提**: Node.js 20 以上、Firestore と Authentication を有効化した Firebase プロジェクト。

```bash
git clone https://github.com/nakamura196/iiif-annotator.git
cd iiif-annotator
npm install
```

`.env.example` を `.env.local` にコピーし、値を設定します（必要な変数の一覧は
ファイル内を参照。Firebase クライアント設定、API ルート用の
`FIREBASE_SERVICE_ACCOUNT_BASE64`、任意の GA / Mirador URL など）:

```bash
cp .env.example .env.local
```

```bash
npm run dev      # http://localhost:3111
```

### 使い方

- **ホーム**（`/`）— IIIF の**マニフェスト**または**コレクション**の URL を入力して開始。
- **エディタ**（`/item?manifest=URL&pos=N`）— ログイン後、矩形/ポリゴンツールで
  領域を描画しテキストを入力。変更は自動で Firestore に保存されます。
- **OCR** — OCR ダイアログで現在のキャンバスの文字を認識し、検出結果を
  アノテーションとして適用できます。
- **エクスポート** — IIIF Manifest / TEI/XML / JSON / CSV から選択。
- **API** — 「設定」でキーを発行し、`X-API-Key` ヘッダ付きで
  `GET /api/annotations` を呼び出します。

### npm スクリプト

```bash
npm run dev        # 開発サーバ起動（ポート 3111）
npm run build      # 本番ビルド
npm run start      # 本番サーバ起動
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

### 管理・バックアップ

Firestore のバックアップ、利用統計、メンテナンス用スクリプトは、ユーザーデータを
公開リポジトリに含めないため、別の**プライベートリポジトリ**
（`nakamura196/iiif-annotator-admin`）で管理しています。

### ライセンス

MIT — [LICENSE](LICENSE) を参照してください。

### 謝辞

- [IIIF Consortium](https://iiif.io/) — IIIF 仕様
- [NDL Lab](https://lab.ndl.go.jp/) — 古典籍 OCR モデル
- [Annotorious](https://annotorious.github.io/) — アノテーションフレームワーク
- [OpenSeadragon](https://openseadragon.github.io/) — ディープズームビューア
