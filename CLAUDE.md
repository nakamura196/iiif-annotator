# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IIIF Annotation Editor — a Next.js 15 web app for creating and managing annotations on IIIF digital images (primarily Japanese historical documents). Uses Firebase for authentication and real-time data sync via Firestore.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build (runs prebuild to copy OCR models first)
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking (tsc --noEmit)
```

The `prebuild` script copies OCR model files from `@nakamura196/ndl-koten-ocr-web` to `public/models/` and `public/config/`. This runs automatically before `build`.

## Architecture

### Routing & i18n

- **Next.js App Router** with `[locale]` dynamic segment (`src/app/[locale]/`)
- **next-intl** handles internationalization; locales: `ja` (default), `en`
- Locale prefix is `as-needed` — Japanese URLs have no prefix, English uses `/en/`
- Translation files: `src/messages/en.json`, `src/messages/ja.json`
- Use navigation helpers from `src/i18n/routing.ts` (`Link`, `redirect`, `useRouter`, etc.) instead of Next.js defaults

### Key Pages

- `/` — Home page with manifest/collection URL input form
- `/item?manifest=URL&pos=N` — Annotation editor for a specific IIIF manifest canvas
- `/collection?url=URL` — Browse IIIF collection hierarchy
- `/my-annotations` — User's saved annotations across manifests
- `/help` — Documentation viewer

### Core Component Flow

```
Editor (src/components/editor.tsx)
  → OpenSeadragon (deep-zoom image viewer)
  → Annotorious (annotation drawing: rectangle/polygon)
  → FirestoreAnnotationAdapter (src/lib/FirestoreAnnotationAdapter.js)
  → Firestore (annotations collection)
```

`editor.tsx` is the central component (~700 lines) orchestrating manifest loading, canvas pagination, annotation CRUD, OCR, and export.

### Data Layer

- **Firebase Auth**: Google OAuth + email/password
- **Firestore**: `annotations` collection stores all annotation data, keyed by `canvasId` and `manifestId`
- **FirestoreAnnotationAdapter** (`src/lib/FirestoreAnnotationAdapter.js`): Custom adapter bridging Annotorious and Firestore — handles create/update/delete/list
- **API route** (`src/app/api/annotations/route.ts`): Server-side endpoint requiring `X-API-Key` header; uses Firebase Admin SDK

### Export Utilities (`src/lib/utils/`)

- `annotationConverter.ts` — Annotorious ↔ IIIF format conversion
- `createTEI.ts` — TEI/XML export for digital humanities
- `createManifest.ts` — Generate IIIF manifests with embedded annotations

### OCR

- `src/components/OCRProcessor.tsx` uses `@nakamura196/ndl-koten-ocr-web` with ONNX Runtime (WebAssembly) for client-side Japanese document OCR
- Webpack configured for `.wasm` and `.onnx` file handling; `onnxruntime-web` is externalized on client

## Environment Variables

Copy `.env.example` to `.env.local`. Required:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase client SDK config (API key, auth domain, project ID, etc.)
- `FIREBASE_SERVICE_ACCOUNT_BASE64` — Base64-encoded Firebase service account JSON (for Admin SDK / API routes)
- `NEXT_PUBLIC_MIRADOR_URL` — External Mirador viewer URL

## Key Conventions

- Path alias: `@/*` maps to `src/*`
- Client components use `"use client"` directive; heavy libraries (Annotorious, OpenSeadragon) are dynamically imported
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Icons: `lucide-react`
- Rich text editing: CKEditor 5 with premium features
- Theme switching: `next-themes` (light/dark)

## Admin / backup tooling

Firestore backups, usage-stats generation, and maintenance scripts live in a
**separate private repo** (`nakamura196/iiif-annotator-admin`) so this public
repo never contains user data. That repo holds the former `scripts/` and
`backups/` directories and the weekly backup GitHub Action.
