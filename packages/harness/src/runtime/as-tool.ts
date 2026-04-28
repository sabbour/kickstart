/**
 * asTool — harness wrapper for bounded specialist consultation.
 *
 * Exposes an existing `@openai/agents` `Agent` instance as a callable
 * `ToolContribution` so a host agent can ask a specialist agent a question
 * and receive a plain-string answer, without a one-way handoff.
 *
 * Design constraints (per #130 / #118 decomposition):
 *  - Non-streaming: runs the specialist to completion and returns text.
 *  - Bounded: defaults to 5 SDK loop iterations (well below the host's
 *    maxTurns cap of 10) so nested consultation can't exhaust the budget.
 *  - No session threading: consultation is stateless — the specialist sees
 *    only the query passed to it, never the host session history.
 *  - No guardrails: the host agent's guardrails already screened the query;
 *    double-wrapping would double-block false positives.
 */

import { Agent, Runner as SDKRunner } from '@openai/agents';
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '../types/tool.js';
import { buildModelProvider } from './model-helpers.js';
import { resolveOutputText } from './model-helpers.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AsToolOptions {
  /**
   * Name for the generated tool (must match `[a-zA-Z0-9_-]+`).
   * Defaults to `ask_<sanitized-agent-name>`, e.g. `ask_core_architect`.
   */
  toolName?: string;

  /**
   * Human-readable description injected into the tool definition so the
   * calling LLM knows when to invoke this specialist.
   * Defaults to a generic "Ask the <name> specialist…" description.
   */
  description?: string;

  /**
   * When provided, overrides the specialist agent's system instructions for
   * this consultation.  Useful for giving the specialist a narrower focus
   * without mutating the shared `Agent` instance — a new ephemeral clone is
   * created for the consultation only.
   */
  systemPromptOverride?: string;

  /**
   * Maximum SDK agent-loop iterations for the consultation run.
   * Defaults to {@link AS_TOOL_MAX_TURNS_DEFAULT} (5).
   */
  maxTurns?: number;
}

/** Default per-consultation turn cap — intentionally below the host's 10. */
export const AS_TOOL_MAX_TURNS_DEFAULT = 5;

// ---------------------------------------------------------------------------
// Module-level lazy SDK runner (shared across all asTool consultations)
// ---------------------------------------------------------------------------

let _asToolRunner: SDKRunner | null = null;

/** Lazily initialise a shared `SDKRunner` for consultation calls. */
function getAsToolRunner(): SDKRunner {
  if (!_asToolRunner) {
    const provider = buildModelProvider();
    _asToolRunner = new SDKRunner({ modelProvider: provider });
  }
  return _asToolRunner;
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Extract a plain-text response from a non-streaming SDK `RunResult`.
 *
 * Priority:
 *  1. Structured `AgentOutput.message` via `resolveOutputText` (agents that
 *     use the `AgentOutput` schema — all harness-managed agents do).
 *  2. `output_text` content blocks inside `AssistantMessageItem` output items
 *     (plain-text agents or third-party agents without structured output).
 *  3. JSON-stringify of `finalOutput` as last resort.
 */
function extractResponseText(
  finalOutput: unknown,
  outputItems: ReadonlyArray<unknown>,
): string {
  // 1. Structured output (AgentOutput.message or similar)
  const structured = resolveOutputText(finalOutput, '');
  if (structured) return structured;

  // 2. Scan output items for assistant text content
  const textParts: string[] = [];
  for (const item of outputItems) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as Record<string, unknown>).role;
    if (role !== 'assistant') continue;
    const content = (item as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block?.type === 'output_text' && typeof block.text === 'string') {
          textParts.push(block.text);
        }
      }
    } else if (typeof content === 'string' && content) {
      textParts.push(content);
    }
  }
  if (textParts.length > 0) return textParts.join('');

  // 3. JSON fallback for unexpected structured outputs
  if (finalOutput != null) {
    return typeof finalOutput === 'string'
      ? finalOutput
      : JSON.stringify(finalOutput);
  }

  return '';
}

// ---------------------------------------------------------------------------
// Tool name sanitisation
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary agent name (may contain dots, spaces, etc.) into a
 * valid OpenAI tool name: only `[a-zA-Z0-9_-]` characters, collapsed runs of
 * underscores, no leading/trailing underscores.
 */
function sanitiseToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// asTool()
// ---------------------------------------------------------------------------

/**
 * Wrap an `Agent` as a callable `ToolContribution`.
 *
 * The returned tool accepts a single `{ query: string }` argument, runs the
 * specialist agent to completion (non-streaming, bounded turn count), and
 * returns its response as a plain string.
 *
 * @example
 * ```ts
 * const architectTool = asTool(architectAgent, {
 *   toolName: 'ask_architect',
 *   description: 'Ask the architect specialist to review a design decision.',
 *   maxTurns: 3,
 * });
 * ```
 */
export function asTool(
  agent: Agent<any, any>,
  options: AsToolOptions = {},
): ToolContribution {
  const {
    toolName,
    description,
    systemPromptOverride,
    maxTurns = AS_TOOL_MAX_TURNS_DEFAULT,
  } = options;

  const derivedName = toolName ?? `ask_${sanitiseToolName(agent.name)}`;
  const derivedDescription =
    description ??
    `Ask the ${agent.name} specialist a question and return their response.`;

  // Clone agent when a system-prompt override is provided so the shared
  // instance is never mutated (Agent.clone() creates a shallow copy with
  // overridden fields per the SDK contract).
  const targetAgent: Agent<any, any> = systemPromptOverride
    ? agent.clone({ instructions: systemPromptOverride })
    : agent;

  const sdkTool = tool({
    name: derivedName,
    description: derivedDescription,
    parameters: z.object({
      query: z.string().describe('The question or context to send to the specialist agent.'),
    }),
    execute: async ({ query }: { query: string }): Promise<string> => {
      const runner = getAsToolRunner();
      const result = await runner.run(targetAgent, query, {
        stream: false,
        maxTurns,
      });
      return extractResponseText(result.finalOutput, result.output);
    },
  });

  return {
    name: derivedName,
    tool: sdkTool,
  };
}
