import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletionWithTools } from "./openai-client.js";

function createJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("chatCompletionWithTools", () => {
  beforeEach(() => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
    vi.stubEnv("KICKSTART_CHAT_MODEL", "gpt-5.4-mini");
    vi.stubEnv("KICKSTART_CODEX_MODEL", "gpt-5.4");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reuses the explicit generate deployment across tool-call rounds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "lookupFiles",
                    arguments: "{\"path\":\"src\"}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          total_tokens: 150,
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        choices: [
          {
            message: {
              content: "{\"message\":\"done\"}",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 20,
          total_tokens: 100,
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const executeTool = vi.fn(async () => ({ files: ["src/index.ts"] }));

    const result = await chatCompletionWithTools(
      [{ role: "user", content: "Generate the next batch" }],
      {
        deployment: "gpt-5.4",
        responseFormat: { type: "json_object" },
        tools: [
          {
            type: "function",
            function: {
              name: "lookupFiles",
              description: "Look up files in a path",
              parameters: {
                type: "object",
                properties: {
                  path: { type: "string" },
                },
                required: ["path"],
              },
            },
          },
        ],
      },
      executeTool,
    );

    expect(result).toMatchObject({
      content: "{\"message\":\"done\"}",
      finishReason: "stop",
      usage: {
        inputTokens: 200,
        outputTokens: 50,
        totalTokens: 250,
      },
    });
    expect(executeTool).toHaveBeenCalledWith("lookupFiles", { path: "src" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/deployments/gpt-5.4/chat/completions");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/deployments/gpt-5.4/chat/completions");

    const secondRequestBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}"),
    ) as { messages?: Array<Record<string, unknown>> };
    expect(secondRequestBody.messages).toEqual([
      { role: "user", content: "Generate the next batch" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "lookupFiles",
              arguments: "{\"path\":\"src\"}",
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        content: "{\"files\":[\"src/index.ts\"]}",
      },
    ]);
  });
});
