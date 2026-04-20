import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@aks-kickstart/harness": resolve(__dirname, "packages/harness/src/index.ts"),
      "@aks-kickstart/core": resolve(__dirname, "packages/harness/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "packages/web/api/src/**/*.test.ts",
    ],
    exclude: ["dist/**", "node_modules/**", "**/*.spec.ts", "**/e2e/**"],
  },
});
