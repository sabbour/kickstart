/**
 * Tests for agents-azure-provider.ts
 *
 * Validates that:
 * - createAzureModelProvider() builds an OpenAIProvider from env vars
 * - Missing env vars throw with a clear message
 * - getAgentsDeployment() resolves the correct env var priority
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("agents-azure-provider", () => {
  beforeEach(() => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://my-resource.openai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key-123");
    vi.stubEnv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-5.4-mini");
    vi.stubEnv("AZURE_OPENAI_CODEX_DEPLOYMENT", "gpt-5.4");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createAzureModelProvider", () => {
    it("returns an OpenAIProvider when env vars are set", async () => {
      const { createAzureModelProvider } = await import("./agents-azure-provider.js");
      const provider = createAzureModelProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getModel).toBe("function");
    });

    it("throws when AZURE_OPENAI_ENDPOINT is missing", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
      const { createAzureModelProvider } = await import("./agents-azure-provider.js");
      expect(() => createAzureModelProvider()).toThrow(
        "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required",
      );
    });

    it("throws when AZURE_OPENAI_API_KEY is missing", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com");
      const { createAzureModelProvider } = await import("./agents-azure-provider.js");
      expect(() => createAzureModelProvider()).toThrow(
        "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required",
      );
    });
  });

  describe("getAgentsDeployment", () => {
    it("returns AZURE_OPENAI_CHAT_DEPLOYMENT when set", async () => {
      const { getAgentsDeployment } = await import("./agents-azure-provider.js");
      expect(getAgentsDeployment()).toBe("gpt-5.4-mini");
    });

    it("falls back to AZURE_OPENAI_DEPLOYMENT when chat deployment not set", async () => {
      vi.stubEnv("AZURE_OPENAI_CHAT_DEPLOYMENT", "");
      vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-fallback");
      const { getAgentsDeployment } = await import("./agents-azure-provider.js");
      expect(getAgentsDeployment()).toBe("gpt-fallback");
    });

    it("throws when no deployment is configured", async () => {
      vi.stubEnv("AZURE_OPENAI_CHAT_DEPLOYMENT", "");
      vi.stubEnv("AZURE_OPENAI_CODEX_DEPLOYMENT", "");
      vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "");
      const { getAgentsDeployment } = await import("./agents-azure-provider.js");
      expect(() => getAgentsDeployment()).toThrow();
    });
  });

  describe("getAgentsGenerateDeployment", () => {
    it("returns AZURE_OPENAI_CODEX_DEPLOYMENT when set", async () => {
      const { getAgentsGenerateDeployment } = await import("./agents-azure-provider.js");
      expect(getAgentsGenerateDeployment()).toBe("gpt-5.4");
    });

    it("falls back to AZURE_OPENAI_DEPLOYMENT", async () => {
      vi.stubEnv("AZURE_OPENAI_CODEX_DEPLOYMENT", "");
      vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-fallback");
      const { getAgentsGenerateDeployment } = await import("./agents-azure-provider.js");
      expect(getAgentsGenerateDeployment()).toBe("gpt-fallback");
    });
  });
});
