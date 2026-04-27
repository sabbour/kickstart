/**
 * RunConfig — centralises all per-run options for `sdkRunner.run()`.
 *
 * Issues #105 (RunConfig type), #104 (defaultHandoffInputFilter),
 * and #108 (onHandoff observability callback).
 *
 * Design notes:
 * - `RunConfig` is a harness-level abstraction. It is NOT the SDK's own
 *   `RunConfig` (which lives on the `Runner` constructor and governs
 *   provider / guardrail defaults). The two types are intentionally distinct.
 * - `buildRunConfig` produces the options object passed to `sdkRunner.run()`,
 *   wiring defaults for `handoffInputFilter` and (indirectly) `onHandoff`.
 * - `defaultHandoffInputFilter` strips A2UI tool-output items and compresses
 *   old turns to keep handoff context lean (issue #104).
 * - `HandoffCallback` is exported so application code can customise the
 *   default logging behaviour (issue #108).
 */

import type { HandoffInputData, RunItem } from '@openai/agents';

// ---------------------------------------------------------------------------
// HandoffContext — carried into each HandoffCallback invocation (#108)
// ---------------------------------------------------------------------------

/** Lightweight context snapshot supplied to every `HandoffCallback`. */
export type HandoffContext = {
  /** The 1-based turn number within the current `Runner.run()` call. */
  turn: number;
  /** The session identifier from the active Session instance. */
  sessionId: string;
};

/**
 * Callback fired just before each agent handoff.
 *
 * @param from     - Name of the handing-off agent.
 * @param to       - Name of the receiving agent.
 * @param context  - Snapshot of turn + session at the moment of handoff.
 *
 * Exported so callers can provide a custom implementation in their own
 * `RunConfig.onHandoff` field.
 */
export type HandoffCallback = (from: string, to: string, context: HandoffContext) => Promise<void> | void;

/**
 * Default `HandoffCallback`: logs the handoff to the console.
 *
 * Format: `[handoff] {from} → {to} at turn {turn}`
 */
export const defaultHandoffCallback: HandoffCallback = (from, to, ctx) => {
  console.log(`[handoff] ${from} → ${to} at turn ${ctx.turn}`);
};

// ---------------------------------------------------------------------------
// HandoffInputFilter — strips A2UI payloads, compresses old turns (#104)
// ---------------------------------------------------------------------------

/**
 * Type alias that mirrors `HandoffInputFilter` from the SDK
 * (`@openai/agents-core`). Defined locally because the SDK does not
 * publicly re-export the type alias (only `HandoffInputData` is exported).
 */
export type HandoffInputFilter = (input: HandoffInputData) => HandoffInputData;

/**
 * Marker present on every A2UI envelope payload (`version: 'v0.9'`).
 * Used by the filter to detect and strip A2UI tool outputs.
 */
const A2UI_VERSION_MARKER = '"version":"v0.9"';

/**
 * Return true when a `RunToolCallOutputItem`'s output string contains an
 * A2UI payload.  The check is intentionally conservative (substring match
 * on the JSON version key) so it works whether or not the JSON is pretty-
 * printed and regardless of property ordering.
 */
function isA2UIToolOutput(item: RunItem): boolean {
  if (item.type !== 'tool_call_output_item') return false;
  const out = (item as { output?: unknown }).output;
  if (typeof out !== 'string') return false;
  // Fast path — most outputs are not A2UI
  if (!out.includes('"version"')) return false;
  // Normalise whitespace around the colon so `"version" : "v0.9"` also matches
  return out.replace(/\s/g, '').includes(A2UI_VERSION_MARKER);
}

/**
 * Number of `preHandoffItems` to keep verbatim (most recent).
 * Older items beyond this window are replaced with a single summary message.
 */
const VERBATIM_WINDOW = 10;

/**
 * Minimum number of `preHandoffItems` required before compression kicks in.
 * Compression is skipped when the history is already small.
 */
const COMPRESSION_THRESHOLD = 20;

/**
 * Default handoff input filter wired into every run by `buildRunConfig`.
 *
 * Two-pass transformation:
 *
 * 1. **Strip A2UI outputs** — remove any `tool_call_output_item` whose
 *    `output` contains an A2UI envelope (`version:"v0.9"`).  These can be
 *    very large (full rendered component trees) and are never useful to the
 *    receiving agent.
 *
 * 2. **Compress old turns** — when `preHandoffItems` still exceeds
 *    `COMPRESSION_THRESHOLD` after stripping, keep the most-recent
 *    `VERBATIM_WINDOW` items verbatim and replace the rest with a single
 *    synthetic user message summarising that context was compressed.
 *    This acts as a circuit-breaker against unbounded context growth while
 *    preserving the most recent reasoning for the receiving agent.
 */
export const defaultHandoffInputFilter: HandoffInputFilter = (input: HandoffInputData): HandoffInputData => {
  // Pass 1: strip A2UI tool output items
  const stripped = input.preHandoffItems.filter((item) => !isA2UIToolOutput(item));

  // Pass 2: compress if still over threshold
  let compressed: RunItem[];
  if (stripped.length > COMPRESSION_THRESHOLD) {
    const verbatim = stripped.slice(-VERBATIM_WINDOW);
    const droppedCount = stripped.length - VERBATIM_WINDOW;
    // Synthetic AgentInputItem-compatible summary message
    const summaryItem: RunItem = {
      type: 'message_output_item',
      rawItem: {
        role: 'user',
        content: `[context compressed: ${droppedCount} earlier turn(s) omitted to reduce handoff context]`,
      },
    } as unknown as RunItem;
    compressed = [summaryItem, ...verbatim];
  } else {
    compressed = stripped;
  }

  return { ...input, preHandoffItems: compressed };
};

// ---------------------------------------------------------------------------
// RunConfig — harness-level per-run options type (#105)
// ---------------------------------------------------------------------------

/** SDK AgentInputItem type (re-exported for convenience). */
export type { HandoffInputData };

/**
 * Harness-level per-run options.  All fields map onto arguments or options
 * passed to `sdkRunner.run(agent, input, opts)`.
 *
 * `buildRunConfig` consumes this type and returns the final
 * `(agent, input, opts)` triple ready for `sdkRunner.run()`.
 */
export type RunConfig = {
  /** Model name override; when absent the agent's own model is used. */
  model?: string;

  /**
   * Filter applied to handoff input before passing context to the next agent.
   * Defaults to `defaultHandoffInputFilter` (strips A2UI outputs, compresses
   * old turns).  Pass `undefined` explicitly to disable filtering.
   */
  handoffInputFilter?: HandoffInputFilter | undefined;

  /**
   * Callback fired just before each agent-to-agent handoff.
   * Defaults to `defaultHandoffCallback` (console log).
   * Pass `undefined` explicitly to suppress logging.
   */
  onHandoff?: HandoffCallback | undefined;

  /** Maximum number of agent-loop iterations (circuit-breaker). */
  maxTurns?: number;
};

// ---------------------------------------------------------------------------
// buildRunConfig — factory that converts RunConfig → sdkRunner.run() options
// ---------------------------------------------------------------------------

/**
 * Merge caller-supplied `RunConfig` with harness defaults and return the
 * options object that `sdkRunner.run()` accepts.
 *
 * Defaults applied when the caller does not override:
 * - `handoffInputFilter` → `defaultHandoffInputFilter`
 * - `onHandoff`          → `defaultHandoffCallback`
 *
 * The `onHandoff` callback is NOT threaded into the SDK's own `handoff()`
 * config — it is fired directly by the runner when it observes a
 * `handoff_occurred` stream event, which keeps the wiring in one place and
 * works regardless of how the handoff was constructed.
 */
export function buildRunConfig(config: RunConfig): {
  handoffInputFilter?: HandoffInputFilter;
  onHandoff?: HandoffCallback;
  maxTurns?: number;
} {
  return {
    handoffInputFilter:
      'handoffInputFilter' in config
        ? config.handoffInputFilter
        : defaultHandoffInputFilter,
    onHandoff:
      'onHandoff' in config
        ? config.onHandoff
        : defaultHandoffCallback,
    maxTurns: config.maxTurns,
  };
}
