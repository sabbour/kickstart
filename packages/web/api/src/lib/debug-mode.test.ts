import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { HttpRequest } from "@azure/functions";

function makeRequest(headers: Record<string, string> = {}, search = ""): HttpRequest {
  const url = `https://example.com/api/converse${search}`;
  return {
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as HttpRequest;
}

describe("isDebugMode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.KICKSTART_DEBUG_ALLOWED;
  });

  it("returns false when KICKSTART_DEBUG_ALLOWED is unset", async () => {
    delete process.env.KICKSTART_DEBUG_ALLOWED;
    const { isDebugMode } = await import("./debug-mode.js");
    expect(isDebugMode(makeRequest({ "x-kickstart-debug": "true" }))).toBe(false);
  });

  it("returns false when KICKSTART_DEBUG_ALLOWED is not 'true'", async () => {
    process.env.KICKSTART_DEBUG_ALLOWED = "1";
    const { isDebugMode } = await import("./debug-mode.js");
    expect(isDebugMode(makeRequest({ "x-kickstart-debug": "true" }))).toBe(false);
  });

  it("returns true when env is set and debug header is present", async () => {
    process.env.KICKSTART_DEBUG_ALLOWED = "true";
    const { isDebugMode } = await import("./debug-mode.js");
    expect(isDebugMode(makeRequest({ "x-kickstart-debug": "true" }))).toBe(true);
  });

  it("returns true when env is set and debug query param is present", async () => {
    process.env.KICKSTART_DEBUG_ALLOWED = "true";
    const { isDebugMode } = await import("./debug-mode.js");
    expect(isDebugMode(makeRequest({}, "?debug=true"))).toBe(true);
  });

  it("returns false when env is set but no debug header or param", async () => {
    process.env.KICKSTART_DEBUG_ALLOWED = "true";
    const { isDebugMode } = await import("./debug-mode.js");
    expect(isDebugMode(makeRequest())).toBe(false);
  });
});

describe("buildConverseDebugMeta", () => {
  it("includes systemPrompt in metadata", async () => {
    const { buildConverseDebugMeta } = await import("./debug-mode.js");
    const meta = buildConverseDebugMeta({ model: "gpt-4o", rawContent: "raw", a2uiCount: 0, hadExplicitA2UI: false, currentPhase: "idea", systemPrompt: "my system prompt" });
    expect(meta.systemPrompt).toBe("my system prompt");
  });

  it("truncates systemPrompt exceeding 8192 chars", async () => {
    const { buildConverseDebugMeta } = await import("./debug-mode.js");
    const longPrompt = "x".repeat(9000);
    const meta = buildConverseDebugMeta({ model: "gpt-4o", rawContent: "raw", a2uiCount: 0, hadExplicitA2UI: false, currentPhase: "idea", systemPrompt: longPrompt });
    expect(meta.systemPrompt).toHaveLength(8192 + "\u2026[truncated]".length);
    expect(meta.systemPrompt?.endsWith("\u2026[truncated]")).toBe(true);
  });

  it("omits systemPrompt when not provided", async () => {
    const { buildConverseDebugMeta } = await import("./debug-mode.js");
    const meta = buildConverseDebugMeta({ model: "gpt-4o", rawContent: "raw", a2uiCount: 0, hadExplicitA2UI: false, currentPhase: "idea" });
    expect(meta.systemPrompt).toBeUndefined();
  });
});
