import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpack = require("webpack");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // trailingSlash: true,
  transpilePackages: ["@nakamura196/react-ui"],
  webpack: (config, { isServer }) => {
    // Add support for WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rules for WebAssembly and ONNX files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    config.module.rules.push({
      test: /\.onnx$/,
      type: 'asset/resource'
    });

    // Ignore the worker file reference in ndl-koten-ocr-web (only NDLKotenOCR is used, not NDLKotenOCRWorker)
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /\.\/ocr\.worker\.ts$/,
        contextRegExp: /@nakamura196\/ndl-koten-ocr-web/,
      })
    );

    // Client-side specific config
    if (!isServer) {
      // Make onnxruntime-web external and use global
      config.externals = {
        ...config.externals,
        'onnxruntime-web': 'ort'
      };

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
      };
    }

    return config;
  },
  async headers() {
    return [
      // Headers removed to allow Google Sign-in popup
      // Note: This may affect OCR/WASM functionality
    ];
  }
};

export default withNextIntl(nextConfig);
