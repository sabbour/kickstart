import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatCompletion } = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
}));

vi.mock("./openai-client.js", () => ({
  chatCompletion,
}));

import { chatCompletionWithAutoContinue } from "./auto-continue.js";

describe("chatCompletionWithAutoContinue", () => {
  beforeEach(() => {
    chatCompletion.mockReset();
  });

  it("preserves the explicit generate deployment across continuation rounds", async () => {
    chatCompletion
      .mockResolvedValueOnce({
        content: "{\"message\":\"partial",
        finishReason: "length",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      })
      .mockResolvedValueOnce({
        content: "\"}",
        finishReason: "stop",
        usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
      });

    const result = await chatCompletionWithAutoContinue(
      [{ role: "user", content: "Generate the next files" }],
      { deployment: "gpt-5.4", responseFormat: { type: "json_object" } },
      { continuationPrompt: "Continue the JSON output." },
    );

    expect(result).toMatchObject({
      content: "{\"message\":\"partial\"}",
      finishReason: "stop",
      continuations: 1,
      usage: {
        inputTokens: 140,
        outputTokens: 70,
        totalTokens: 210,
      },
    });

    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(chatCompletion.mock.calls[0]?.[1]).toMatchObject({
      deployment: "gpt-5.4",
    });
    expect(chatCompletion.mock.calls[1]?.[1]).toMatchObject({
      deployment: "gpt-5.4",
    });
    expect(chatCompletion.mock.calls[1]?.[0]).toEqual([
      { role: "user", content: "Generate the next files" },
      { role: "assistant", content: "{\"message\":\"partial" },
      { role: "user", content: "Continue the JSON output." },
    ]);
  });
});
