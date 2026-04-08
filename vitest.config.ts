import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "**/*.spec.ts", "**/e2e/**"],
  },
});
