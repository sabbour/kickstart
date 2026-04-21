/**
 * Characterization tests for widget-inspirations handler.
 *
 * These tests lock the observable behaviour of the handler before and after
 * the simplification refactor (issue #1020).  They are NOT integration tests
 * — Azure OpenAI and the Azure Functions runtime are both mocked.
 *
 * Covers:
 *  - Non-streaming (JSON) mode — success, OpenAI failure, unconfigured
 *  - Streaming (SSE) mode — success, OpenAI failure, unconfigured
 *  - SSE frame format and [DONE] terminator
 *  - Error logging (context.log called on failure paths)
 *  - 500 path (outer handler catch)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetIdea } from "../lib/widget-inspirations-data.js";

// ---------------------------------------------------------------------------
// Capture the handler registered with app.http()
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (request: unknown, context: unknown) => Promise<unknown>
  >();
  const registerHttpHandler = vi.fn(
    (
      name: string,
      config: { handler: (request: unknown, context: unknown) => Promise<unknown> },
    ) => {
      registeredHandlers.set(name, config.handler);
    },
  );
  return { registeredHandlers, registerHttpHandler };
});

vi.mock("@azure/functions", () => ({
  app: { http: registerHttpHandler },
}));

// ---------------------------------------------------------------------------
// Mock OpenAI client (used via dynamic import inside the handler)
// ---------------------------------------------------------------------------

const mockChatCompletion = vi.fn();
const mockChatCompletionStream = vi.fn();

vi.mock("../lib/openai-client.js", () => ({
  chatCompletion: mockChatCompletion,
  chatCompletionStream: mockChatCompletionStream,
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

await import("./widget-inspirations.js");
import {
  _resetFocusCursorForTests,
  _resetLastFallbackIdxForTests,
  FALLBACK_IDEAS,
  pickFallbackIdea,
} from "../lib/widget-inspirations-data.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): unknown {
  const urlParams = new URLSearchParams(params);
  return {
    query: { get: (key: string) => urlParams.get(key) },
    url: "https://example.com/api/inspirations/widgets",
    method: "GET",
  };
}

interface MockContext {
  log: ReturnType<typeof vi.fn>;
}

function makeContext(): MockContext {
  return { log: vi.fn() };
}

async function drainStream(body: unknown): Promise<string> {
  const stream = body as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(decoder.decode(value, { stream: true }));
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Setup: deterministic state
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetFocusCursorForTests(0);
  _resetLastFallbackIdxForTests(-1);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function getHandler() {
  const h = registeredHandlers.get("widget-inspirations");
  if (!h) throw new Error("Handler not registered");
  return h as (
    req: unknown,
    ctx: MockContext,
  ) => Promise<{
    status: number;
    headers?: Record<string, string>;
    jsonBody?: unknown;
    body?: unknown;
  }>;
}

// ---------------------------------------------------------------------------
// Non-streaming (JSON) mode
// ---------------------------------------------------------------------------

describe("non-streaming mode", () => {
  const OPENAI_ENV = {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
    KICKSTART_CHAT_MODEL: "gpt-4o",
    AZURE_OPENAI_API_KEY: "test-key",
  };

  afterEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.KICKSTART_CHAT_MODEL;
    delete process.env.AZURE_OPENAI_API_KEY;
  });

  it("returns fallback idea as JSON array when OpenAI is not configured", async () => {
    const handler = getHandler();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = makeContext();
    const response = await handler(makeRequest(), ctx);

    expect(response.status).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("application/json");
    const ideas = response.jsonBody as WidgetIdea[];
    expect(Array.isArray(ideas)).toBe(true);
    expect(ideas).toHaveLength(1);
    expect(typeof ideas[0].title).toBe("string");
    expect(typeof ideas[0].subtitle).toBe("string");
    expect(typeof ideas[0].prompt).toBe("string");
    expect(FALLBACK_IDEAS).toContain(ideas[0]);
  });

  it("returns OpenAI-generated ideas when configured and succeeds", async () => {
    Object.assign(process.env, OPENAI_ENV);
    const generatedIdea: WidgetIdea = {
      title: "Test Widget",
      subtitle: "A test widget",
      prompt: "I want to build a test widget. Use only core A2UI components.",
    };
    mockChatCompletion.mockResolvedValue({
      content: JSON.stringify([generatedIdea]),
    });

    const handler = getHandler();
    const ctx = makeContext();
    const response = await handler(makeRequest(), ctx);

    expect(response.status).toBe(200);
    const ideas = response.jsonBody as WidgetIdea[];
    expect(ideas).toEqual([generatedIdea]);
    expect(mockChatCompletion).toHaveBeenCalledOnce();
  });

  it("falls back to fallback idea when OpenAI throws", async () => {
    Object.assign(process.env, OPENAI_ENV);
    mockChatCompletion.mockRejectedValue(new Error("OpenAI unavailable"));

    const handler = getHandler();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = makeContext();
    const response = await handler(makeRequest(), ctx);

    expect(response.status).toBe(200);
    const ideas = response.jsonBody as WidgetIdea[];
    expect(Array.isArray(ideas)).toBe(true);
    expect(ideas).toHaveLength(1);
    expect(FALLBACK_IDEAS).toContain(ideas[0]);
    expect(ctx.log).toHaveBeenCalledWith(
      expect.stringContaining("OpenAI generation failed"),
    );
  });

  it("falls back when OpenAI returns malformed JSON", async () => {
    Object.assign(process.env, OPENAI_ENV);
    mockChatCompletion.mockResolvedValue({ content: "not json" });

    const handler = getHandler();
    const ctx = makeContext();
    const response = await handler(makeRequest(), ctx);

    expect(response.status).toBe(200);
    const ideas = response.jsonBody as WidgetIdea[];
    expect(ideas).toHaveLength(1);
    expect(ctx.log).toHaveBeenCalled();
  });

  it("falls back when OpenAI returns empty array", async () => {
    Object.assign(process.env, OPENAI_ENV);
    mockChatCompletion.mockResolvedValue({ content: "[]" });

    const handler = getHandler();
    const ctx = makeContext();
    const response = await handler(makeRequest(), ctx);

    expect(response.status).toBe(200);
    const ideas = response.jsonBody as WidgetIdea[];
    expect(ideas).toHaveLength(1);
    expect(ctx.log).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Streaming (SSE) mode
// ---------------------------------------------------------------------------

describe("streaming mode", () => {
  const OPENAI_ENV = {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
    KICKSTART_CHAT_MODEL: "gpt-4o",
    AZURE_OPENAI_API_KEY: "test-key",
  };

  afterEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.KICKSTART_CHAT_MODEL;
    delete process.env.AZURE_OPENAI_API_KEY;
  });

  it("returns SSE headers when OpenAI is not configured", async () => {
    vi.useFakeTimers();

    const handler = getHandler();
    // Use a very short fallback prompt to speed up simulated streaming
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = makeContext();

    const responsePromise = handler(makeRequest({ stream: "true" }), ctx);

    // Let all timers fire (simulateStreaming uses setTimeout per char)
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("text/event-stream");
    expect(response.headers?.["Cache-Control"]).toBe("no-cache");
    expect(response.body).toBeDefined();
  });

  it("SSE stream ends with [DONE] frame when OpenAI is not configured", async () => {
    vi.useFakeTimers();

    const handler = getHandler();
    // Pin to a short fallback entry. FALLBACK_IDEAS[1] has a reasonably short prompt.
    vi.spyOn(Math, "random").mockReturnValue(0 / FALLBACK_IDEAS.length);

    const ctx = makeContext();
    const responsePromise = handler(makeRequest({ stream: "true" }), ctx);

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    // Drain the stream (it's already complete after timers ran)
    const fullText = await drainStream(response.body);

    expect(fullText).toContain("data: [DONE]\n\n");
  });

  it("SSE frames match data: <text>\\n\\n format", async () => {
    vi.useFakeTimers();

    const handler = getHandler();
    _resetLastFallbackIdxForTests(-1);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const ctx = makeContext();
    const responsePromise = handler(makeRequest({ stream: "true" }), ctx);

    await vi.runAllTimersAsync();
    const response = await responsePromise;
    const fullText = await drainStream(response.body);

    // Every frame must match the SSE format
    const frames = fullText.split("\n\n").filter((f) => f.length > 0);
    for (const frame of frames) {
      expect(frame).toMatch(/^data: /);
    }
    // Last meaningful frame is [DONE]
    const doneFrame = frames[frames.length - 1];
    expect(doneFrame).toBe("data: [DONE]");
  });

  it("streams OpenAI chunks when configured and succeeds", async () => {
    Object.assign(process.env, OPENAI_ENV);

    const chunks = ["I want", " to build", " a widget."];
    async function* mockStream(): AsyncGenerator<string> {
      for (const c of chunks) yield c;
    }
    mockChatCompletionStream.mockReturnValue(mockStream());

    const handler = getHandler();
    const ctx = makeContext();
    const response = await handler(makeRequest({ stream: "true" }), ctx);

    expect(response.status).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("text/event-stream");

    const fullText = await drainStream(response.body);
    expect(fullText).toContain("data: I want\n\n");
    expect(fullText).toContain("data:  to build\n\n");
    expect(fullText).toContain("data:  a widget.\n\n");
    expect(fullText).toContain("data: [DONE]\n\n");
    expect(mockChatCompletionStream).toHaveBeenCalledOnce();
  });

  it("falls back to simulated streaming when OpenAI stream throws", async () => {
    Object.assign(process.env, OPENAI_ENV);
    vi.useFakeTimers();

    async function* failingStream(): AsyncGenerator<string> {
      throw new Error("Stream failed");
      yield ""; // unreachable — keeps TS happy about AsyncGenerator type
    }
    mockChatCompletionStream.mockReturnValue(failingStream());

    const handler = getHandler();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = makeContext();

    const responsePromise = handler(makeRequest({ stream: "true" }), ctx);
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("text/event-stream");

    const fullText = await drainStream(response.body);
    expect(fullText).toContain("data: [DONE]\n\n");
    // Error must be logged, not surfaced in the stream
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Streaming error"));
  });
});

// ---------------------------------------------------------------------------
// Outer error path
// ---------------------------------------------------------------------------

describe("outer error handling", () => {
  it("returns 500 when an unexpected synchronous error is thrown", async () => {
    // Make request.query.get throw synchronously to trigger outer catch
    const badRequest = {
      query: {
        get: () => {
          throw new Error("query exploded");
        },
      },
    };

    const handler = getHandler();
    const ctx = makeContext();
    const response = await handler(badRequest, ctx);

    expect(response.status).toBe(500);
    expect((response.jsonBody as { error: string }).error).toContain("query exploded");
    expect(ctx.log).toHaveBeenCalledWith(
      expect.stringContaining("Widget inspirations error"),
    );
  });
});
