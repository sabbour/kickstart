/**
 * Tests for agents-sse-adapter.ts
 *
 * Spike checkpoint #3 — verifies:
 * - adaptRunResult extracts text from RunMessageOutputItem
 * - Raw SDK items/traces are not in the output (allowlist enforcement)
 * - A2UI structure is preserved through the adapter
 * - Advisory flags (phaseComplete, filesComplete) are extracted correctly
 * - validateA2UIPreserved works correctly
 * - adaptedUsageToChatUsage converts correctly
 */

import { describe, expect, it } from "vitest";
import {
  adaptRunResult,
  adaptedUsageToChatUsage,
  validateA2UIPreserved,
} from "./agents-sse-adapter.js";
import type { AdaptedRunResponse } from "./agents-sse-adapter.js";

// ---------------------------------------------------------------------------
// Test helpers — minimal RunResult-like objects
// ---------------------------------------------------------------------------

function makeRunResult(
  finalOutput: string,
  rawResponses: object[] = [],
): Parameters<typeof adaptRunResult>[0] {
  return {
    input: "",
    newItems: [],
    rawResponses,
    lastResponseId: undefined,
    lastAgent: undefined,
    inputGuardrailResults: [],
    outputGuardrailResults: [],
    toolInputGuardrailResults: [],
    toolOutputGuardrailResults: [],
    finalOutput,
    interruptions: [],
    state: {} as never,
    runContext: {} as never,
  } as unknown as Parameters<typeof adaptRunResult>[0];
}

describe("adaptRunResult", () => {
  it("extracts message from finalOutput when no message items present", () => {
    const result = makeRunResult(
      JSON.stringify({ message: "Hello there!", a2ui: [] }),
    );
    const adapted = adaptRunResult(result);
    expect(adapted.message).toBe("Hello there!");
  });

  it("returns empty a2uiMessages for plain text response", () => {
    const result = makeRunResult("plain text, not JSON");
    const adapted = adaptRunResult(result);
    // processResponse treats non-JSON as plain text
    expect(adapted.message).toBe("plain text, not JSON");
    expect(adapted.a2uiMessages).toBeInstanceOf(Array);
  });

  it("extracts phaseComplete advisory flag from JSON envelope", () => {
    const result = makeRunResult(
      JSON.stringify({
        message: "Design complete.",
        a2ui: [],
        phaseComplete: true,
      }),
    );
    const adapted = adaptRunResult(result);
    expect(adapted.phaseComplete).toBe(true);
  });

  it("extracts filesComplete=false advisory flag", () => {
    const result = makeRunResult(
      JSON.stringify({
        message: "More files pending.",
        a2ui: [],
        filesComplete: false,
      }),
    );
    const adapted = adaptRunResult(result);
    expect(adapted.filesComplete).toBe(false);
  });

  it("filesComplete is null when not in JSON", () => {
    const result = makeRunResult(JSON.stringify({ message: "ok", a2ui: [] }));
    const adapted = adaptRunResult(result);
    expect(adapted.filesComplete).toBeNull();
  });

  it("does NOT include raw SDK fields in the output", () => {
    const result = makeRunResult("{}");
    const adapted = adaptRunResult(result);
    // Allowlist check: none of these dangerous fields should be present
    expect((adapted as unknown as Record<string, unknown>).newItems).toBeUndefined();
    expect((adapted as unknown as Record<string, unknown>).rawResponses).toBeUndefined();
    expect((adapted as unknown as Record<string, unknown>).state).toBeUndefined();
    expect((adapted as unknown as Record<string, unknown>).runContext).toBeUndefined();
  });

  it("extracts usage from rawResponses when available", () => {
    const result = makeRunResult("{}", [
      { usage: { inputTokens: 100, outputTokens: 50 } },
    ]);
    const adapted = adaptRunResult(result);
    expect(adapted.usage).toBeDefined();
    expect(adapted.usage!.inputTokens).toBe(100);
    expect(adapted.usage!.outputTokens).toBe(50);
    expect(adapted.usage!.totalTokens).toBe(150);
  });

  it("extracts text from newItems when message_output_item present", () => {
    // Use a duck-typed mock — RunMessageOutputItem requires a real Agent to
    // construct, but extractFinalText only needs type === "message_output_item"
    // and a `.content` string (consistent with how RunMessageOutputItem works).
    const mockMsgItem = {
      type: "message_output_item",
      content: "extracted from newItems",
    } as unknown as NonNullable<Parameters<typeof adaptRunResult>[0]["newItems"]>[number];

    const resultWithItems = {
      input: "",
      newItems: [mockMsgItem],
      rawResponses: [],
      lastResponseId: undefined,
      lastAgent: undefined,
      inputGuardrailResults: [],
      outputGuardrailResults: [],
      toolInputGuardrailResults: [],
      toolOutputGuardrailResults: [],
      finalOutput: "should not use fallback",
      interruptions: [],
      state: {} as never,
      runContext: {} as never,
    } as unknown as Parameters<typeof adaptRunResult>[0];

    const adapted = adaptRunResult(resultWithItems);
    expect(adapted.message).toBe("extracted from newItems");
  });

  it("ignores non-message newItems (tool calls etc.)", () => {
    const toolCallItem = {
      type: "tool_call_item",
      content: "secret tool args that must not leak",
    } as unknown as NonNullable<Parameters<typeof adaptRunResult>[0]["newItems"]>[number];

    const resultWithTool = {
      input: "",
      newItems: [toolCallItem],
      rawResponses: [],
      lastResponseId: undefined,
      lastAgent: undefined,
      inputGuardrailResults: [],
      outputGuardrailResults: [],
      toolInputGuardrailResults: [],
      toolOutputGuardrailResults: [],
      finalOutput: "fallback used",
      interruptions: [],
      state: {} as never,
      runContext: {} as never,
    } as unknown as Parameters<typeof adaptRunResult>[0];

    const adapted = adaptRunResult(resultWithTool);
    // Tool call item is not a message_output_item; falls back to finalOutput
    expect(adapted.message).toBe("fallback used");
  });

  it("returns undefined usage when no rawResponses", () => {
    const result = makeRunResult("{}");
    const adapted = adaptRunResult(result);
    expect(adapted.usage).toBeUndefined();
  });
});

describe("validateA2UIPreserved (spike checkpoint)", () => {
  it("returns true when a2uiMessages is empty", () => {
    const adapted: AdaptedRunResponse = {
      message: "ok",
      a2uiMessages: [],
      phaseComplete: false,
      filesComplete: null,
    };
    expect(validateA2UIPreserved(adapted)).toBe(true);
  });

  it("returns true when a2uiMessages contains objects with type+id", () => {
    const adapted: AdaptedRunResponse = {
      message: "ok",
      a2uiMessages: [{ type: "ConversationPhase", id: "phase-indicator", phases: [], currentPhase: "discover" }],
      phaseComplete: false,
      filesComplete: null,
    };
    expect(validateA2UIPreserved(adapted)).toBe(true);
  });

  it("returns false when any a2uiMessage is null", () => {
    const adapted: AdaptedRunResponse = {
      message: "ok",
      a2uiMessages: [null as unknown as object],
      phaseComplete: false,
      filesComplete: null,
    };
    expect(validateA2UIPreserved(adapted)).toBe(false);
  });

  it("returns false when no a2uiMessages have type+id fields", () => {
    const adapted: AdaptedRunResponse = {
      message: "ok",
      a2uiMessages: [{ someField: "value" }],
      phaseComplete: false,
      filesComplete: null,
    };
    expect(validateA2UIPreserved(adapted)).toBe(false);
  });
});

describe("adaptedUsageToChatUsage", () => {
  it("converts adapted usage to ChatUsage format", () => {
    const chatUsage = adaptedUsageToChatUsage({
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
    });
    expect(chatUsage).toEqual({
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
    });
  });

  it("returns undefined when usage is undefined", () => {
    expect(adaptedUsageToChatUsage(undefined)).toBeUndefined();
  });
});
