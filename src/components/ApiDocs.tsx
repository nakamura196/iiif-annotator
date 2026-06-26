"use client";

import { useEffect, useRef } from "react";

// Swagger UI を CDN（固定バージョン）から読み込み、/api/openapi を描画する。
// npm 依存（swagger-ui-react は重く、onnxruntime を含む本プロジェクトの webpack 設定と
// 相性問題が出やすい）を増やさないため、CDN のスタンドアロン版を使う。
const SWAGGER_VERSION = "5.18.2";
const CSS_URL = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
const JS_URL = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SwaggerUIBundle?: any;
  }
}

function ensureStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (window.SwaggerUIBundle) resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export default function ApiDocs() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    ensureStylesheet(CSS_URL);
    loadScript(JS_URL)
      .then(() => {
        if (cancelled || !window.SwaggerUIBundle || !containerRef.current) return;
        window.SwaggerUIBundle({
          url: "/api/openapi",
          domNode: containerRef.current,
          deepLinking: true,
        });
      })
      .catch((err) => {
        // 読み込み失敗時は最低限のフォールバック表示
        if (containerRef.current) {
          containerRef.current.textContent =
            "Swagger UI の読み込みに失敗しました。/api/openapi を直接参照してください。";
        }
        console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={containerRef} />;
}
