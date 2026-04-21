import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@aks-kickstart/harness/runtime/redact": resolve(__dirname, "packages/harness/src/runtime/redact.ts"),
      "@aks-kickstart/harness/runtime/registry": resolve(__dirname, "packages/harness/src/runtime/registry.ts"),
      "@aks-kickstart/harness": resolve(__dirname, "packages/harness/src/index.ts"),
      "@aks-kickstart/core": resolve(__dirname, "packages/harness/src/index.ts"),
      "@aks-kickstart/pack-azure/client": resolve(__dirname, "packages/pack-azure/src/client.ts"),
      "@aks-kickstart/pack-aks-automatic/client": resolve(__dirname, "packages/pack-aks-automatic/src/client.ts"),
      "@aks-kickstart/pack-github/client": resolve(__dirname, "packages/pack-github/src/client.ts"),
      // Stub out @opentelemetry/api so harness unit tests don't need the full
      // OpenTelemetry install. The otel bridge is tested in integration only.
      "@opentelemetry/api": resolve(__dirname, "packages/harness/src/__mocks__/opentelemetry-api.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "packages/web/api/src/**/*.test.ts",
      ".squad/scripts/**/*.test.mjs",
    ],
    exclude: ["dist/**", "node_modules/**", "**/*.spec.ts", "**/e2e/**"],
  },
});
