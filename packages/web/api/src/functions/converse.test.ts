import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Phase } from "@kickstart/core";
import { createSession, getSession } from "../lib/session-store.js";

const registeredHandlers = new Map<string, (request: unknown, context: unknown) => Promise<unknown>>();
const registerHttpHandler = vi.fn((name: string, config: { handler: (request: unknown, context: unknown) => Promise<unknown> }) => {
  registeredHandlers.set(name, config.handler);
});

const chatCompletionWithTools = vi.fn();
const chatCompletion = vi.fn();

vi.mock("@azure/functions", () => ({
  app: {
    http: registerHttpHandler,
  },
}));

vi.mock("../lib/openai-client.js", () => ({
  chatCompletion,
  chatCompletionWithTools,
  getChatDeploymentName: () => "test-chat-model",
}));

vi.mock("../lib/content-safety.js", () => ({
  checkContentSafety: vi.fn(async () => ({ safe: true })),
}));

vi.mock("../lib/rate-limiter.js", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29 })),
  rateLimitResponse: vi.fn((retryAfterMs: number) => ({
    status: 429,
    headers: {
      "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    },
    jsonBody: { error: "Too many requests. Please try again later." },
  })),
}));

vi.mock("../lib/auto-continue.js", () => ({
  chatCompletionWithAutoContinue: vi.fn(async () => ({ content: "" })),
  isTruncated: vi.fn(() => false),
}));

let converseHandler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import("./converse.js");
  const handler = registeredHandlers.get("converse");
  if (!handler) {
    throw new Error("converse handler was not registered");
  }
  converseHandler = handler;
});

beforeEach(() => {
  chatCompletionWithTools.mockReset();
  chatCompletion.mockReset();
});

function createRequest(
  body: unknown,
  headers: Record<string, string> = {},
): {
  headers: { get(name: string): string | undefined };
  json: () => Promise<unknown>;
} {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: {
      get(name: string) {
        return normalizedHeaders.get(name.toLowerCase());
      },
    },
    json: async () => body,
  };
}

function createContext(): { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}

async function readStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

function parseSseEvents(payload: string): Array<{ event: string; data: string }> {
  return payload
    .trim()
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "";
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "";
      return { event, data };
    })
    .filter((event) => event.event && event.data);
}

describe("converse phase progression", () => {
  it("rebuilds the next-turn system prompt from the advanced phase after phaseComplete", async () => {
    const session = createSession();

    chatCompletionWithTools
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Great — let's move into architecture.",
          a2ui: [],
          actions: [],
          phaseComplete: true,
          filesComplete: null,
        }),
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Here's the next design step.",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
      });

    const firstResponse = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "Continue",
      }),
      createContext(),
    ) as {
      status: number;
      jsonBody: { phase: string; a2ui: Array<{ currentPhase: string; phases: Array<{ id: string; status: string }> }> };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.jsonBody.phase).toBe(Phase.Design);
    expect(firstResponse.jsonBody.a2ui[0]).toMatchObject({
      currentPhase: Phase.Design,
      phases: expect.arrayContaining([
        expect.objectContaining({ id: Phase.Discover, status: "complete" }),
        expect.objectContaining({ id: Phase.Design, status: "active" }),
      ]),
    });
    expect(getSession(session.state.sessionId)?.engineState.currentPhase).toBe(
      Phase.Design,
    );

    const secondResponse = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "What's next?",
      }),
      createContext(),
    ) as { status: number; jsonBody: { phase: string } };

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.jsonBody.phase).toBe(Phase.Design);

    const secondCallMessages = chatCompletionWithTools.mock.calls[1]?.[0] as Array<{
      role: string;
      content: string | null;
    }>;

    expect(secondCallMessages[0]).toMatchObject({ role: "system" });
    expect(secondCallMessages[0]?.content).toContain("## Current Phase: Design");
  });

  it("streams the advanced phase in both the done payload and ConversationPhase event", async () => {
    const session = createSession();

    chatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        message: "Perfect — now let's talk through the architecture.",
        a2ui: [],
        actions: [],
        phaseComplete: true,
        filesComplete: null,
      }),
      finishReason: "stop",
    });

    const response = await converseHandler(
      createRequest(
        {
          sessionId: session.state.sessionId,
          message: "Continue",
        },
        { accept: "text/event-stream" },
      ),
      createContext(),
    ) as { status: number; body: ReadableStream<Uint8Array> };

    expect(response.status).toBe(200);

    const events = parseSseEvents(await readStream(response.body));
    const donePayload = JSON.parse(
      events.find((event) => event.event === "done")?.data ?? "{}",
    ) as { phase?: string; phaseLabel?: string; sessionId?: string };
    const phaseIndicator = events
      .filter((event) => event.event === "a2ui")
      .map((event) => JSON.parse(event.data) as { type?: string; currentPhase?: string; phases?: Array<{ id: string; status: string }> })
      .find((payload) => payload.type === "ConversationPhase");

    expect(donePayload).toMatchObject({
      sessionId: session.state.sessionId,
      phase: Phase.Design,
      phaseLabel: "Design",
    });
    expect(phaseIndicator).toMatchObject({
      currentPhase: Phase.Design,
      phases: expect.arrayContaining([
        expect.objectContaining({ id: Phase.Discover, status: "complete" }),
        expect.objectContaining({ id: Phase.Design, status: "active" }),
      ]),
    });
    expect(getSession(session.state.sessionId)?.engineState.currentPhase).toBe(
      Phase.Design,
    );
  });
});
