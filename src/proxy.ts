import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  ...routing,
  localePrefix: 'as-needed' // Don't show prefix for default locale (ja)
});

export const config = {
  // Match all paths except static files and api routes
  matcher: [
    // Skip all internal paths (_next)
    // Skip all API routes
    // Skip all static files (images, fonts, etc.)
    // Skip models and config directories for OCR
    // Skip ONNX runtime files
    // 注: `api` は `api(?:/|$)` に限定する。単に `api` だと `/api-docs` のような
    // 「api で始まるページ」まで i18n リライトから除外されて 404 になるため。
    '/((?!_next|api(?:/|$)|favicon.ico|models|config|.*\\..*|ort-.*|.*\\.wasm|.*\\.onnx).*)'
  ]
};