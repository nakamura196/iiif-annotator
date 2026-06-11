import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// コンポーネントの単体テスト用設定。
// 対象は src/**/*.test.{ts,tsx}。jsdom 上で React Testing Library を使う。
// （録画用の Playwright スクリプト scripts/record/ は対象外）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
