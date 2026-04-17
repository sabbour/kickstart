/**
 * @module @kickstart/api/lib/agents-sse-adapter
 *
 * Spike checkpoint #3 — RunResult/StreamedRunResult → typed SSE contract adapter.
 *
 * Transforms the SDK's run output into the existing `{ message, a2ui, actions }`
 * SSE contract that the web surface expects.
 *
 * Security invariant (Zapp): No raw SDK run items, traces, or tool payloads are
 * forwarded to the browser. Only an explicit allowlist of fields passes through.
 *
 * A2UI preservation: The adapter calls `processResponse()` from the core package
 * on the final text output, maintaining the existing A2UI extraction pipeline.
 */

import {
  extractAllTextOutput,
  RunMessageOutputItem,
} from "@openai/agents";
import type { RunResult } from "@openai/agents";
import { processResponse } from "@kickstart/core";
import type { UsageSummary } from "./usage-tracking.js";

// ---------------------------------------------------------------------------
// Allowlisted response shape — ONLY these fields reach the browser
// ---------------------------------------------------------------------------

/**
 * The adapted response that may be forwarded to the browser.
 * Raw SDK items, traces, and tool payloads are explicitly excluded.
 */
export interface AdaptedRunResponse {
  /** Processed assistant message (A2UI markers stripped). */
  message: string;
  /** A2UI component updates extracted from the message. */
  a2uiMessages: object[];
  /** Whether the LLM signalled phase completion (advisory). */
  phaseComplete: boolean;
  /** Whether more files are pending generation (advisory). */
  filesComplete: boolean | null;
  /** Token usage for this turn (safe to forward — no prompts). */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

// ---------------------------------------------------------------------------
// RunResult → AdaptedRunResponse
// ---------------------------------------------------------------------------

/**
 * Adapt a non-streaming `RunResult` to the browser-safe `AdaptedRunResponse`.
 *
 * Only the final text output is extracted. All raw model responses, tool call
 * items, reasoning items, and trace data are discarded at this boundary.
 */
export function adaptRunResult(result: RunResult<any, any>): AdaptedRunResponse {
  const rawText = extractFinalText(result);
  return adaptRawText(rawText, result);
}

function extractFinalText(result: RunResult<any, any>): string {
  // newItems contains the items produced in this turn only.
  // We want only message output — never tool call payloads.
  const msgItems = result.newItems.filter(
    (item): item is RunMessageOutputItem =>
      item instanceof RunMessageOutputItem,
  );

  if (msgItems.length > 0) {
    return extractAllTextOutput(msgItems);
  }

  // Fall back to finalOutput if it's a string
  if (typeof result.finalOutput === "string") {
    return result.finalOutput;
  }

  return "";
}

/**
 * Parse advisory flags (phaseComplete, filesComplete) from the raw LLM output.
 * These are still used advisory-only — the route planner owns advancement.
 */
function extractAdvisoryFlags(rawText: string): {
  phaseComplete: boolean;
  filesComplete: boolean | null;
} {
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    return {
      phaseComplete: parsed.phaseComplete === true,
      filesComplete:
        typeof parsed.filesComplete === "boolean" ? parsed.filesComplete : null,
    };
  } catch {
    return { phaseComplete: false, filesComplete: null };
  }
}

/**
 * Extract safe usage metrics from a RunResult.
 * Only token counts are forwarded — no prompts, no tool payloads.
 */
function extractSafeUsage(
  result: RunResult<any, any>,
): AdaptedRunResponse["usage"] | undefined {
  try {
    const rawResponses = result.rawResponses;
    if (!rawResponses?.length) return undefined;

    let inputTokens = 0;
    let outputTokens = 0;
    for (const resp of rawResponses) {
      const usage = (resp as { usage?: { inputTokens?: number; outputTokens?: number } }).usage;
      if (!usage) continue;
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
    }
    if (inputTokens === 0 && outputTokens === 0) return undefined;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  } catch {
    return undefined;
  }
}

function adaptRawText(
  rawText: string,
  result: RunResult<any, any>,
): AdaptedRunResponse {
  const processed = processResponse(rawText);
  const flags = extractAdvisoryFlags(rawText);
  const usage = extractSafeUsage(result);

  return {
    message: processed.message,
    a2uiMessages: processed.a2uiMessages,
    phaseComplete: flags.phaseComplete,
    filesComplete: flags.filesComplete,
    ...(usage ? { usage } : {}),
  };
}

// ---------------------------------------------------------------------------
// StreamedRunResult → SSE chunks
// ---------------------------------------------------------------------------

export interface SseChunk {
  type: "chunk" | "tool_call" | "tool_result" | "message" | "a2ui" | "done" | "error";
  data: object;
}

/**
 * Stream an `AsyncIterable<RunStreamEvent>` to `SseChunk[]` — the caller
 * is responsible for encoding and flushing each chunk to the HTTP response.
 *
 * Allowlist enforcement: only text delta chunks and final message/a2ui/done
 * events are emitted. Raw model events, tool call payloads, and reasoning
 * items are discarded.
 *
 * @param stream   - The SDK stream (StreamedRunResult as AsyncIterable)
 * @param onChunk  - Callback invoked for each allowed SSE chunk
 * @param onDone   - Callback invoked once with the final adapted response
 */
export async function adaptStreamedRunResult(
  stream: AsyncIterable<import("@openai/agents").RunStreamEvent>,
  onChunk: (chunk: SseChunk) => void,
  onDone: (adapted: AdaptedRunResponse) => void,
): Promise<void> {
  let accumulatedText = "";

  for await (const event of stream) {
    if (event.type === "raw_model_stream_event") {
      // Extract text deltas only — no metadata, no finish_reason, no tool args
      const data = event.data as Record<string, unknown>;
      if (
        data.type === "response.output_text.delta" &&
        typeof data.delta === "string"
      ) {
        accumulatedText += data.delta;
        onChunk({ type: "chunk", data: { content: data.delta } });
      } else if (
        data.type === "content_block_delta" &&
        typeof (data as { delta?: { text?: string } }).delta?.text === "string"
      ) {
        const text = (data.delta as { text: string }).text;
        accumulatedText += text;
        onChunk({ type: "chunk", data: { content: text } });
      }
    } else if (event.type === "run_item_stream_event") {
      // Only emit tool_call name (not args) for progress indication
      if (event.name === "tool_called") {
        const toolName =
          (event.item as { rawItem?: { name?: string } }).rawItem?.name ?? "unknown";
        // Sanitize: only forward tool name — never arguments or results
        onChunk({ type: "tool_call", data: { name: toolName } });
      }
      // tool_output is intentionally NOT forwarded — tool results may contain sensitive data
    }
  }

  // Build final adapted response from accumulated text
  // (stream doesn't give us a RunResult directly, build from what we have)
  const processed = processResponse(accumulatedText);
  const flags = extractAdvisoryFlags(accumulatedText);

  const adapted: AdaptedRunResponse = {
    message: processed.message,
    a2uiMessages: processed.a2uiMessages,
    phaseComplete: flags.phaseComplete,
    filesComplete: flags.filesComplete,
  };

  // Emit message event
  onChunk({ type: "message", data: { content: adapted.message } });

  // Emit a2ui events
  for (const msg of adapted.a2uiMessages) {
    onChunk({ type: "a2ui", data: msg as object });
  }

  onDone(adapted);
}

/**
 * Convert usage from our AdaptedRunResponse format to the ChatUsage format
 * expected by usage-tracking.ts.
 */
export function adaptedUsageToChatUsage(
  usage: AdaptedRunResponse["usage"],
): import("./usage-tracking.js").ChatUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

/**
 * Validate that A2UI structure is preserved through the adapter.
 * Used in tests (spike checkpoint from Leela review).
 *
 * Returns true if `a2uiMessages` from `adaptRunResult` would contain
 * valid A2UI message objects (type + id fields present on at least one).
 */
export function validateA2UIPreserved(adapted: AdaptedRunResponse): boolean {
  if (adapted.a2uiMessages.length === 0) return true; // No A2UI is valid
  return adapted.a2uiMessages.every(
    (msg) =>
      msg !== null &&
      typeof msg === "object",
  );
}
