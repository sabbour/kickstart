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
 */

import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '../types/guardrail.js';

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
