/**
 * Guardrails engine — runs GuardrailContributions at input/tool/output stages.
 *
 * Security invariants:
 * - core/ guardrails always run first; their `block` verdict is non-overridable.
 * - Every evaluate() throw → block (fail-closed).
 * - Payload coercion errors → block.
 * - SSE errors are ALWAYS opaque: { code: "GUARDRAIL_BLOCK", message: "..." }
 *   — no guardrail id, reason, pattern, or stage is ever emitted.
 * - Tool-stage block halts ALL remaining tool calls for the turn.
 * - Dual-eval chaining: each guardrail runs on the current (possibly already
 *   redacted) payload so downstream guardrails see the cleaned form.
 *
 * SDK-native parallel adapters (toSdkInputGuardrail / toSdkOutputGuardrail):
 * - Wrap GuardrailContributions as SDK InputGuardrail / OutputGuardrail objects.
 * - Multiple rules run concurrently via the SDK's Promise.all pipeline.
 * - block  → tripwireTriggered: true (SDK throws InputGuardrailTripwireTriggered).
 * - redact → tripwireTriggered: false + emits guardrail_warn + stores redacted text
 *   in outputInfo so the runner can update session.recentTurns after the SDK run.
 * - Dual-eval chaining is intentionally broken for speed (DP #116 tradeoff).
 * - Tool stage retains sequential custom pipeline (SDK has no tool-arg hook).
 */

import type { InputGuardrail, OutputGuardrail, AgentOutputType } from '@openai/agents';
import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '../types/guardrail.js';
import type { SSEWriter } from './sse.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunGuardrailsResult {
  blocked: boolean;
  mutatedInput: GuardrailInput;
}

// ---------------------------------------------------------------------------
// Glob matching — minimal implementation (no external dep)
// ---------------------------------------------------------------------------

function matchGlob(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  // Escape special regex chars except * and ?
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr).test(value);
}

function matchesAnyGlob(patterns: string[], value: string): boolean {
  return patterns.some((p) => matchGlob(p, value));
}

// ---------------------------------------------------------------------------
// applyRedact — mutates GuardrailInput per stage
// ---------------------------------------------------------------------------

/**
 * Applies a `redact` verdict to the input, mutating it in-place.
 * Throws if the result payload cannot be applied (payload coercion error → block).
 */
export function applyRedact(input: GuardrailInput, result: GuardrailResult): void {
  if (result.verdict !== 'redact') return;

  switch (input.stage) {
    case 'input':
      if (typeof result.redacted !== 'string') {
        throw new Error('Guardrail redact on input stage: redacted value must be a string');
      }
      input.userMessage = result.redacted;
      break;

    case 'output':
      if (typeof result.redacted !== 'string') {
        throw new Error('Guardrail redact on output stage: redacted value must be a string');
      }
      input.proposedOutput = result.redacted;
      break;

    case 'tool':
      if (result.redactedArgs != null) {
        input.toolArgs = result.redactedArgs;
      } else if (result.redacted != null) {
        input.toolArgs = result.redacted as Record<string, unknown>;
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// runGuardrails — main engine entry point
// ---------------------------------------------------------------------------

/**
 * Runs all applicable guardrails for the given stage.
 *
 * Ordering:
 *  1. core/ guardrails first (non-overridable block)
 *  2. All other guardrails in registration order
 *
 * Dual-eval chaining: each guardrail runs on the CURRENT (possibly already
 * redacted by a prior guardrail) input, so downstream guardrails see the
 * cleaned form.
 *
 * @param stage       Pipeline stage
 * @param input       Mutable input object (may be mutated by redact)
 * @param contributions All registered guardrails (will be filtered internally)
 * @param agentName   Current agent name — used for appliesTo glob filtering
 */
export async function runGuardrails(
  stage: GuardrailInput['stage'],
  input: GuardrailInput,
  contributions: GuardrailContribution[],
  agentName: string,
): Promise<RunGuardrailsResult> {
  // Filter: stage must be in stages[], and appliesTo must match agentName
  const applicable = contributions.filter(
    (g) => g.stages.includes(stage) && matchesAnyGlob(g.appliesTo, agentName),
  );

  // Sort: core/ guardrails first, then others (stable within each group)
  const coreGuardrails = applicable.filter((g) => g.id.startsWith('core/'));
  const otherGuardrails = applicable.filter((g) => !g.id.startsWith('core/'));
  const ordered = [...coreGuardrails, ...otherGuardrails];

  // Work on a shallow copy so the caller controls when mutations apply
  const current: GuardrailInput = { ...input };

  for (const guardrail of ordered) {
    let result: GuardrailResult;

    // Fail-closed: any throw → block
    try {
      result = await guardrail.evaluate(current);
    } catch {
      // Guardrail threw — fail-closed (Zapp condition 1/2/3)
      return { blocked: true, mutatedInput: current };
    }

    if (result.verdict === 'block') {
      // core/ block is non-overridable; non-core block also halts
      return { blocked: true, mutatedInput: current };
    }

    if (result.verdict === 'redact') {
      // applyRedact throw → block (Zapp condition 4 / payload coercion)
      try {
        applyRedact(current, result);
      } catch {
        return { blocked: true, mutatedInput: current };
      }
      // Continue — downstream guardrails see the redacted payload
    }

    // 'pass' — continue
  }

  // Write mutations back to the caller's input object
  Object.assign(input, current);

  return { blocked: false, mutatedInput: input };
}

// ---------------------------------------------------------------------------
// SDK-native parallel adapters
// ---------------------------------------------------------------------------

/** Opaque message used for all SDK tripwire blocks — never reveals guardrail details. */
const OPAQUE_BLOCK_MESSAGE = 'Request could not be completed';

/**
 * Extracts the user-facing text from an SDK input (string or AgentInputItem[]).
 * Returns the content of the last user-role item, or '' if none found.
 */
function extractUserText(input: string | unknown[]): string {
  if (typeof input === 'string') return input;
  for (let i = input.length - 1; i >= 0; i--) {
    const item = input[i] as { role?: string; content?: string | Array<{ type?: string; text?: string }> };
    if (item?.role === 'user') {
      if (typeof item.content === 'string') return item.content;
      if (Array.isArray(item.content)) {
        return item.content
          .filter((c) => c.type === 'input_text' || c.type === 'text')
          .map((c) => c.text ?? '')
          .join('');
      }
    }
  }
  return '';
}

/**
 * Wraps a GuardrailContribution as an SDK-native InputGuardrail.
 *
 * - block  → tripwireTriggered: true  (SDK throws InputGuardrailTripwireTriggered)
 * - redact → tripwireTriggered: false + emits guardrail_warn + preserves
 *            { verdict: 'redact', redacted } in outputInfo so the runner can
 *            update session.recentTurns with the cleaned text after the SDK run
 * - pass   → tripwireTriggered: false
 * - any throw → tripwireTriggered: true (fail-closed)
 *
 * runInParallel is false so all input guardrails complete before the LLM starts
 * (security invariant). Multiple contributions still run concurrently with each
 * other via the SDK's internal Promise.all.
 */
export function toSdkInputGuardrail(
  contrib: GuardrailContribution,
  agentName: string,
  sseWrite: SSEWriter,
): InputGuardrail {
  return {
    name: contrib.id,
    runInParallel: false,
    execute: async ({ input }) => {
      if (!matchesAnyGlob(contrib.appliesTo, agentName)) {
        return { tripwireTriggered: false, outputInfo: { verdict: 'pass' } };
      }
      const text = extractUserText(input as string | unknown[]);
      let result: GuardrailResult;
      try {
        result = await contrib.evaluate({ stage: 'input', userMessage: text });
      } catch {
        return { tripwireTriggered: true, outputInfo: { verdict: 'block', reason: OPAQUE_BLOCK_MESSAGE } };
      }
      if (result.verdict === 'block') {
        return { tripwireTriggered: true, outputInfo: result };
      }
      if (result.verdict === 'redact') {
        // Emit opaque warning (no pattern/detail per security invariant), then
        // preserve the redacted text in outputInfo so the runner can update
        // session.recentTurns after the SDK run completes.
        sseWrite('guardrail_warn', { message: 'Some personal information was removed from your request.' });
        return { tripwireTriggered: false, outputInfo: result };
      }
      return { tripwireTriggered: false, outputInfo: result };
    },
  };
}

/**
 * Wraps a GuardrailContribution as an SDK-native OutputGuardrail.
 *
 * - block  → tripwireTriggered: true  (SDK throws OutputGuardrailTripwireTriggered)
 * - redact → tripwireTriggered: false + emits guardrail_warn SSE + stores redacted in outputInfo
 * - pass   → tripwireTriggered: false
 * - any throw → tripwireTriggered: true (fail-closed)
 *
 * The runner reads result.outputGuardrailResults after the stream to apply
 * any redacted output text before flushing chunks to the client.
 */
export function toSdkOutputGuardrail(
  contrib: GuardrailContribution,
  agentName: string,
  sseWrite: SSEWriter,
): OutputGuardrail<AgentOutputType> {
  return {
    name: contrib.id,
    execute: async ({ agentOutput }) => {
      if (!matchesAnyGlob(contrib.appliesTo, agentName)) {
        return { tripwireTriggered: false, outputInfo: { verdict: 'pass' } };
      }
      // Extract text from structured AgentOutput ({message, intent}) or plain string
      const text = typeof agentOutput === 'string'
        ? agentOutput
        : (agentOutput as { message?: string }).message ?? JSON.stringify(agentOutput);
      let result: GuardrailResult;
      try {
        result = await contrib.evaluate({ stage: 'output', proposedOutput: text });
      } catch {
        return { tripwireTriggered: true, outputInfo: { verdict: 'block', reason: OPAQUE_BLOCK_MESSAGE } };
      }
      if (result.verdict === 'block') {
        return { tripwireTriggered: true, outputInfo: result };
      }
      if (result.verdict === 'redact') {
        // Content was redacted — emit opaque warning (no pattern/detail per security invariant)
        sseWrite('guardrail_warn', { message: 'Some personal information was removed from your response.' });
        return { tripwireTriggered: false, outputInfo: result };
      }
      return { tripwireTriggered: false, outputInfo: result };
    },
  };
}
