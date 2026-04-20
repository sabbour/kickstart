import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@kickstart/harness": resolve(__dirname, "packages/harness/src/index.ts"),
      "@kickstart/harness/runtime/session": resolve(__dirname, "packages/harness/src/runtime/session.ts"),
      "@kickstart/harness/runtime/runner": resolve(__dirname, "packages/harness/src/runtime/runner.ts"),
      "@kickstart/harness/runtime/sse": resolve(__dirname, "packages/harness/src/runtime/sse.ts"),
      "@kickstart/core": resolve(__dirname, "packages/harness/src/index.ts"),
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
