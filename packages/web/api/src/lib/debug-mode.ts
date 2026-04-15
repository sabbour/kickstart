/**
 * @module @kickstart/api/lib/debug-mode
 *
 * Detects whether a request has debug mode enabled and builds
 * debug metadata payloads for SSE events.
 *
 * Activation: `x-kickstart-debug: true` header OR `?debug=true` query param.
 * When inactive, all helpers return undefined so callers can spread safely.
 */

import type { HttpRequest } from "@azure/functions";

/** Check if the incoming request has debug mode enabled. */
export function isDebugMode(request: HttpRequest): boolean {
  // Server-side gate: debug metadata is only available when explicitly
  // allowed via environment variable. In production this should be unset.
  if (process.env.KICKSTART_DEBUG_ALLOWED !== "true") return false;

  const header = request.headers.get("x-kickstart-debug");
  if (header === "true" || header === "1") return true;

  const param = new URL(request.url).searchParams.get("debug");
  return param === "true" || param === "1";
}

/** A rendering decision recorded during response processing. */
export interface RenderDecision {
  /** What was decided (e.g., "component-inferred", "a2ui-parsed", "catalog-used"). */
  type: string;
  /** Human-readable description. */
  detail: string;
}

/** Debug metadata attached to SSE events when debug mode is on. */
export interface DebugMetadata {
  model: string;
  rawContent: string;
  renderDecisions: RenderDecision[];
}

/** Maximum characters of raw LLM content exposed in debug metadata. */
const RAW_CONTENT_MAX_LENGTH = 500;

/**
 * Redact raw LLM content for safe inclusion in debug metadata.
 * Truncates to a safe length to avoid leaking full prompt/completion text.
 */
function redactRawContent(raw: string): string {
  if (raw.length <= RAW_CONTENT_MAX_LENGTH) return raw;
  return raw.slice(0, RAW_CONTENT_MAX_LENGTH) + "\u2026 [truncated]";
}

/**
 * Build debug metadata for a converse response.
 *
 * @param model      - The deployment/model name used
 * @param rawContent - The raw LLM output before processing
 * @param a2uiCount  - Number of A2UI messages extracted
 * @param hadExplicitA2UI - Whether the LLM returned explicit A2UI JSON
 * @param currentPhase - Current conversation phase name
 */
export function buildConverseDebugMeta(
  model: string,
  rawContent: string,
  a2uiCount: number,
  hadExplicitA2UI: boolean,
  currentPhase?: string,
): DebugMetadata {
  const renderDecisions: RenderDecision[] = [];

  // Phase indicator is always injected
  renderDecisions.push({
    type: "phase_indicator",
    detail: `ConversationPhase component added for phase: ${currentPhase ?? "unknown"}`,
  });

  if (hadExplicitA2UI) {
    renderDecisions.push({
      type: "a2ui_parsed",
      detail: `LLM returned structured JSON envelope with ${a2uiCount} A2UI component(s)`,
    });
  } else if (a2uiCount > 0) {
    renderDecisions.push({
      type: "component_inferred",
      detail: `No explicit A2UI block; ${a2uiCount} component(s) inferred from response text`,
    });
  } else {
    renderDecisions.push({
      type: "no_a2ui",
      detail: "Text-only response, no A2UI components generated",
    });
  }

  return { model, rawContent: redactRawContent(rawContent), renderDecisions };
}

/**
 * Build debug metadata for a generate (codex) response.
 */
export function buildGenerateDebugMeta(
  model: string,
  rawContent: string,
): DebugMetadata {
  return {
    model,
    rawContent: redactRawContent(rawContent),
    renderDecisions: [
      { type: "codex_generation", detail: `Code generated via ${model}` },
      { type: "no_a2ui", detail: "Code generation endpoint — no A2UI rendering" },
    ],
  };
}

/**
 * Format render decisions as plain strings for SSE transmission.
 * The frontend expects `renderDecisions: string[]` at the top level
 * of SSE event data payloads.
 */
export function formatRenderDecisions(decisions: RenderDecision[]): string[] {
  return decisions.map((d) => `[${d.type}] ${d.detail}`);
}
