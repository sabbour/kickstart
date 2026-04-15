import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Phase } from "@kickstart/core";
import { createSession, getSession } from "../lib/session-store.js";

const registeredHandlers = new Map<string, (request: unknown, context: unknown) => Promise<unknown>>();
const registerHttpHandler = vi.fn((name: string, config: { handler: (request: unknown, context: unknown) => Promise<unknown> }) => {
  registeredHandlers.set(name, config.handler);
});

const chatCompletionWithTools = vi.fn();
const chatCompletion = vi.fn();
const chatCompletionWithAutoContinue = vi.fn(async () => ({ content: "" }));
const isTruncated = vi.fn(() => false);

vi.mock("@azure/functions", () => ({
  app: {
    http: registerHttpHandler,
  },
}));

vi.mock("../lib/openai-client.js", () => ({
  chatCompletion,
  chatCompletionWithTools,
  getChatDeploymentName: () => "gpt-5.4-mini",
  getGenerateDeploymentName: () => "gpt-5.4",
  getCodexDeploymentName: () => "gpt-5.4",
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
  chatCompletionWithAutoContinue,
  isTruncated,
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
  chatCompletionWithAutoContinue.mockReset();
  chatCompletionWithAutoContinue.mockResolvedValue({ content: "" });
  isTruncated.mockReset();
  isTruncated.mockReturnValue(false);
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

function setSessionPhase(
  session: { engineState: { currentPhase: string }; state: { currentPhase: string } },
  phase: Phase,
): void {
  session.engineState.currentPhase = phase;
  session.state.currentPhase = phase;
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

describe("converse usage tracking", () => {
  it("returns turn and session token totals for non-streaming responses", async () => {
    const session = createSession();

    chatCompletionWithTools
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "First reply",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
        usage: {
          inputTokens: 120,
          outputTokens: 45,
          totalTokens: 165,
        },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Second reply",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
        usage: {
          inputTokens: 80,
          outputTokens: 30,
          totalTokens: 110,
        },
      });

    const firstResponse = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "Hello",
      }),
      createContext(),
    ) as { status: number; jsonBody: { usage?: { turn: Record<string, unknown>; session: Record<string, unknown> } } };

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.jsonBody.usage).toMatchObject({
      turn: {
        model: "gpt-5.4-mini",
        inputTokens: 120,
        outputTokens: 45,
        totalTokens: 165,
        costStatus: "unavailable",
      },
      session: {
        inputTokens: 120,
        outputTokens: 45,
        totalTokens: 165,
        turnCount: 1,
        costStatus: "unavailable",
      },
    });
    expect(getSession(session.state.sessionId)?.usageHistory).toHaveLength(1);

    const secondResponse = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "And again",
      }),
      createContext(),
    ) as { status: number; jsonBody: { usage?: { session: Record<string, unknown> } } };

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.jsonBody.usage?.session).toMatchObject({
      inputTokens: 200,
      outputTokens: 75,
      totalTokens: 275,
      turnCount: 2,
      costStatus: "unavailable",
    });
    expect(getSession(session.state.sessionId)?.usageHistory).toHaveLength(2);
  });

  it("emits usage metadata in the streaming done payload", async () => {
    const session = createSession();

    chatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        message: "Streaming reply",
        a2ui: [],
        actions: [],
        phaseComplete: false,
        filesComplete: null,
      }),
      finishReason: "stop",
      usage: {
        inputTokens: 95,
        outputTokens: 35,
        totalTokens: 130,
      },
    });

    const response = await converseHandler(
      createRequest(
        {
          sessionId: session.state.sessionId,
          message: "Stream it",
        },
        { accept: "text/event-stream" },
      ),
      createContext(),
    ) as { status: number; body: ReadableStream<Uint8Array> };

    expect(response.status).toBe(200);

    const events = parseSseEvents(await readStream(response.body));
    const donePayload = JSON.parse(
      events.find((event) => event.event === "done")?.data ?? "{}",
    ) as { usage?: { turn: Record<string, unknown>; session: Record<string, unknown> } };

    expect(donePayload.usage).toMatchObject({
      turn: {
        model: "gpt-5.4-mini",
        inputTokens: 95,
        outputTokens: 35,
        totalTokens: 130,
        costStatus: "unavailable",
      },
      session: {
        inputTokens: 95,
        outputTokens: 35,
        totalTokens: 130,
        turnCount: 1,
        costStatus: "unavailable",
      },
    });
    expect(getSession(session.state.sessionId)?.usageHistory).toHaveLength(1);
  });
});

describe("converse model routing", () => {
  it.each([
    [Phase.Discover, "gpt-5.4-mini"],
    [Phase.Design, "gpt-5.4-mini"],
    [Phase.Generate, "gpt-5.4"],
    [Phase.Review, "gpt-5.4-mini"],
    [Phase.Handoff, "gpt-5.4-mini"],
    [Phase.Deploy, "gpt-5.4-mini"],
  ])("routes %s turns to %s in non-streaming mode", async (phase, expectedModel) => {
    const session = createSession();
    setSessionPhase(session, phase);

    chatCompletionWithTools.mockResolvedValueOnce({
      content: JSON.stringify({
        message: "Routing test response",
        a2ui: [],
        actions: [],
        phaseComplete: false,
        filesComplete: null,
      }),
      finishReason: "stop",
    });

    const response = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "Keep going",
      }),
      createContext(),
    ) as { status: number; jsonBody: { model?: string } };

    expect(response.status).toBe(200);
    expect(response.jsonBody.model).toBe(expectedModel);
    expect(chatCompletionWithTools.mock.calls[0]?.[1]).toMatchObject({
      deployment: expectedModel,
    });
  });

  it("fails closed to chat for unknown server phases", async () => {
    const session = createSession();
    session.engineState.currentPhase = "ship-it" as Phase;
    session.state.currentPhase = "ship-it" as Phase;

    chatCompletionWithTools.mockResolvedValueOnce({
      content: JSON.stringify({
        message: "Fallback route response",
        a2ui: [],
        actions: [],
        phaseComplete: false,
        filesComplete: null,
      }),
      finishReason: "stop",
    });

    const response = await converseHandler(
      createRequest({
        sessionId: session.state.sessionId,
        message: "Keep going",
      }),
      createContext(),
    ) as { status: number; jsonBody: { model?: string } };

    expect(response.status).toBe(200);
    expect(response.jsonBody.model).toBe("gpt-5.4-mini");
    expect(chatCompletionWithTools.mock.calls[0]?.[1]).toMatchObject({
      deployment: "gpt-5.4-mini",
    });
  });

  it("keeps client-rehydrated phase injection on the default chat model", async () => {
    chatCompletionWithTools
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Still working through that flow.",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Second turn, still chat-routed.",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
      });

    const firstResponse = await converseHandler(
      createRequest({
        message: "Continue generating",
        messages: [
          {
            role: "assistant",
            content: "Here are some generated files.",
            phase: Phase.Generate,
          },
        ],
      }),
      createContext(),
    ) as { status: number; jsonBody: { sessionId: string; model?: string } };

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.jsonBody.model).toBe("gpt-5.4-mini");
    expect(chatCompletionWithTools.mock.calls[0]?.[1]).toMatchObject({
      deployment: "gpt-5.4-mini",
    });

    const secondResponse = await converseHandler(
      createRequest({
        sessionId: firstResponse.jsonBody.sessionId,
        message: "Keep going",
      }),
      createContext(),
    ) as { status: number; jsonBody: { model?: string } };

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.jsonBody.model).toBe("gpt-5.4-mini");
    expect(chatCompletionWithTools.mock.calls[1]?.[1]).toMatchObject({
      deployment: "gpt-5.4-mini",
    });
  });

  it("routes streaming generate turns to gpt-5.4", async () => {
    const session = createSession();
    setSessionPhase(session, Phase.Generate);

    chatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        message: "Streaming routed through codex.",
        a2ui: [],
        actions: [],
        phaseComplete: false,
        filesComplete: null,
      }),
      finishReason: "stop",
    });

    const response = await converseHandler(
      createRequest(
        {
          sessionId: session.state.sessionId,
          message: "Generate the next batch",
        },
        { accept: "text/event-stream" },
      ),
      createContext(),
    ) as { status: number; body: ReadableStream<Uint8Array> };

    expect(response.status).toBe(200);
    expect(chatCompletion.mock.calls[0]?.[1]).toMatchObject({
      deployment: "gpt-5.4",
    });

    const events = parseSseEvents(await readStream(response.body));
    const donePayload = JSON.parse(
      events.find((event) => event.event === "done")?.data ?? "{}",
    ) as { model?: string; phase?: string };

    expect(donePayload).toMatchObject({
      model: "gpt-5.4",
      phase: Phase.Generate,
    });
  });

  it("uses generate pricing for trusted gpt-5.4 turns", async () => {
    const originalEnv: Record<string, string | undefined> = {
      AZURE_OPENAI_CHAT_INPUT_PRICE_PER_1K_USD:
        process.env.AZURE_OPENAI_CHAT_INPUT_PRICE_PER_1K_USD,
      AZURE_OPENAI_CHAT_OUTPUT_PRICE_PER_1K_USD:
        process.env.AZURE_OPENAI_CHAT_OUTPUT_PRICE_PER_1K_USD,
      AZURE_OPENAI_CODEX_INPUT_PRICE_PER_1K_USD:
        process.env.AZURE_OPENAI_CODEX_INPUT_PRICE_PER_1K_USD,
      AZURE_OPENAI_CODEX_OUTPUT_PRICE_PER_1K_USD:
        process.env.AZURE_OPENAI_CODEX_OUTPUT_PRICE_PER_1K_USD,
    };

    process.env.AZURE_OPENAI_CHAT_INPUT_PRICE_PER_1K_USD = "0.001";
    process.env.AZURE_OPENAI_CHAT_OUTPUT_PRICE_PER_1K_USD = "0.002";
    process.env.AZURE_OPENAI_CODEX_INPUT_PRICE_PER_1K_USD = "0.01";
    process.env.AZURE_OPENAI_CODEX_OUTPUT_PRICE_PER_1K_USD = "0.02";

    try {
      const session = createSession();
      setSessionPhase(session, Phase.Generate);

      chatCompletionWithTools.mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Generate pricing response",
          a2ui: [],
          actions: [],
          phaseComplete: false,
          filesComplete: null,
        }),
        finishReason: "stop",
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
      });

      const response = await converseHandler(
        createRequest({
          sessionId: session.state.sessionId,
          message: "Generate the files",
        }),
        createContext(),
      ) as {
        status: number;
        jsonBody: {
          model?: string;
          usage?: {
            turn: { estimatedCostUsd?: number; costStatus: string };
            session: { estimatedCostUsd?: number; costStatus: string };
          };
        };
      };

      expect(response.status).toBe(200);
      expect(response.jsonBody.model).toBe("gpt-5.4");
      expect(response.jsonBody.usage).toMatchObject({
        turn: {
          estimatedCostUsd: 0.02,
          costStatus: "estimated",
        },
        session: {
          estimatedCostUsd: 0.02,
          costStatus: "estimated",
        },
      });
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
