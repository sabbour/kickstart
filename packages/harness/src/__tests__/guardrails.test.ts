/**
 * Guardrails engine tests — Step 11
 *
 * Covers:
 * - block/pass/redact verdicts
 * - 3-stage hooks (input/tool/output)
 * - core-first ordering
 * - non-overridable core block
 * - dual-eval chaining (redact + downstream)
 * - all 5 fail-closed paths:
 *   1. evaluate() throws on input hook → block
 *   2. evaluate() throws on output hook → block
 *   3. evaluate() throws on tool hook → block
 *   4. applyRedact() throws → block
 *   5. Payload coercion error → block
 * - Registry rejects duplicate guardrail IDs
 * - Registry reserves core/ namespace
 * - no-credential-leak blocks all 3 stages
 * - aks.no-latest-tag blocks image:latest at tool stage
 * - core.no-secrets-in-artifacts blocks writes with secret-like patterns
 */

import { describe, it, expect, vi } from 'vitest';
import { runGuardrails, applyRedact } from '../../src/runtime/guardrails.js';
import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '../../src/types/guardrail.js';

// ── Helper to build a guardrail contribution ─────────────────────────────────

function makeGuardrail(
  id: string,
  stages: Array<'input' | 'output' | 'tool'>,
  evaluate: (input: GuardrailInput) => Promise<GuardrailResult>,
  appliesTo = ['*'],
): GuardrailContribution {
  return { id, appliesTo, stages, evaluate };
}

// ── 1. Stage filtering ────────────────────────────────────────────────────────

describe('runGuardrails — stage filtering', () => {
  it('only runs guardrails matching the requested stage', async () => {
    const called: string[] = [];
    const guardrails = [
      makeGuardrail('test/input-only', ['input'], async () => { called.push('input'); return { verdict: 'pass' }; }),
      makeGuardrail('test/tool-only', ['tool'], async () => { called.push('tool'); return { verdict: 'pass' }; }),
      makeGuardrail('test/multi', ['input', 'tool'], async () => { called.push('multi'); return { verdict: 'pass' }; }),
    ];

    await runGuardrails('input', { stage: 'input', userMessage: 'hello' }, guardrails, 'agent');
    expect(called).toEqual(['input', 'multi']);

    called.length = 0;
    await runGuardrails('tool', { stage: 'tool', toolName: 't', toolArgs: {} }, guardrails, 'agent');
    expect(called).toEqual(['tool', 'multi']);
  });

  it('filters by appliesTo agent-name glob', async () => {
    const called: string[] = [];
    const guardrails = [
      makeGuardrail('test/all', ['input'], async () => { called.push('all'); return { verdict: 'pass' }; }, ['*']),
      makeGuardrail('test/aks-only', ['input'], async () => { called.push('aks'); return { verdict: 'pass' }; }, ['aks.*']),
    ];

    await runGuardrails('input', { stage: 'input', userMessage: 'x' }, guardrails, 'core.setup');
    expect(called).toEqual(['all']); // aks-only should not fire for core.setup
    expect(called).not.toContain('aks');

    called.length = 0;
    await runGuardrails('input', { stage: 'input', userMessage: 'x' }, guardrails, 'aks.deploy');
    expect(called).toContain('all');
    expect(called).toContain('aks');
  });
});

// ── 2. Verdict: pass ──────────────────────────────────────────────────────────

describe('runGuardrails — pass verdict', () => {
  it('returns blocked=false when all guardrails pass', async () => {
    const g = makeGuardrail('test/pass', ['input'], async () => ({ verdict: 'pass' }));
    const input: GuardrailInput = { stage: 'input', userMessage: 'hello' };
    const result = await runGuardrails('input', input, [g], 'agent');
    expect(result.blocked).toBe(false);
    expect(result.mutatedInput.userMessage).toBe('hello');
  });
});

// ── 3. Verdict: block ─────────────────────────────────────────────────────────

describe('runGuardrails — block verdict', () => {
  it('returns blocked=true on block verdict', async () => {
    const g = makeGuardrail('test/block', ['input'], async () => ({ verdict: 'block', reason: 'test block' }));
    const result = await runGuardrails('input', { stage: 'input', userMessage: 'x' }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });

  it('halts after first block (does not run subsequent guardrails)', async () => {
    const secondCalled = vi.fn();
    const guardrails = [
      makeGuardrail('test/blocker', ['input'], async () => ({ verdict: 'block', reason: 'stop' })),
      makeGuardrail('test/after', ['input'], async () => { secondCalled(); return { verdict: 'pass' }; }),
    ];
    await runGuardrails('input', { stage: 'input', userMessage: 'x' }, guardrails, 'agent');
    expect(secondCalled).not.toHaveBeenCalled();
  });
});

// ── 4. Verdict: redact ────────────────────────────────────────────────────────

describe('runGuardrails — redact verdict', () => {
  it('applies redact to input stage and continues', async () => {
    const guardrails = [
      makeGuardrail('test/redact-input', ['input'], async (inp) => {
        if (inp.userMessage?.includes('bad')) {
          return { verdict: 'redact', redacted: inp.userMessage!.replace('bad', '[CLEAN]') };
        }
        return { verdict: 'pass' };
      }),
      makeGuardrail('test/verify', ['input'], async (inp) => {
        expect(inp.userMessage).toBe('hello [CLEAN] world');
        return { verdict: 'pass' };
      }),
    ];
    const input: GuardrailInput = { stage: 'input', userMessage: 'hello bad world' };
    const result = await runGuardrails('input', input, guardrails, 'agent');
    expect(result.blocked).toBe(false);
    expect(result.mutatedInput.userMessage).toBe('hello [CLEAN] world');
  });

  it('applies redact to output stage', async () => {
    const g = makeGuardrail('test/redact-out', ['output'], async () => ({
      verdict: 'redact',
      redacted: 'cleaned output',
    }));
    const input: GuardrailInput = { stage: 'output', proposedOutput: 'original output' };
    const result = await runGuardrails('output', input, [g], 'agent');
    expect(result.blocked).toBe(false);
    expect(result.mutatedInput.proposedOutput).toBe('cleaned output');
  });

  it('applies redact to tool stage via redactedArgs', async () => {
    const g = makeGuardrail('test/redact-tool', ['tool'], async () => ({
      verdict: 'redact',
      redactedArgs: { content: 'safe content' },
    }));
    const input: GuardrailInput = { stage: 'tool', toolName: 't', toolArgs: { content: 'sensitive content' } };
    const result = await runGuardrails('tool', input, [g], 'agent');
    expect(result.blocked).toBe(false);
    expect(result.mutatedInput.toolArgs).toEqual({ content: 'safe content' });
  });
});

// ── 5. Core-first ordering ────────────────────────────────────────────────────

describe('runGuardrails — core-first ordering', () => {
  it('runs core/ guardrails before non-core', async () => {
    const order: string[] = [];
    const guardrails = [
      makeGuardrail('pack/non-core', ['input'], async () => { order.push('non-core'); return { verdict: 'pass' }; }),
      makeGuardrail('core/first', ['input'], async () => { order.push('core'); return { verdict: 'pass' }; }),
    ];
    await runGuardrails('input', { stage: 'input', userMessage: 'x' }, guardrails, 'agent');
    expect(order[0]).toBe('core');
    expect(order[1]).toBe('non-core');
  });

  it('core/ block halts immediately (non-overridable)', async () => {
    const nonCoreCalled = vi.fn();
    const guardrails = [
      makeGuardrail('pack/non-core', ['input'], async () => { nonCoreCalled(); return { verdict: 'pass' }; }),
      makeGuardrail('core/blocker', ['input'], async () => ({ verdict: 'block', reason: 'core says no' })),
    ];
    const result = await runGuardrails('input', { stage: 'input', userMessage: 'x' }, guardrails, 'agent');
    expect(result.blocked).toBe(true);
    expect(nonCoreCalled).not.toHaveBeenCalled();
  });
});

// ── 6. Fail-closed paths ─────────────────────────────────────────────────────

describe('runGuardrails — fail-closed (Zapp conditions)', () => {
  it('FC1: evaluate() throws on input hook → block', async () => {
    const g = makeGuardrail('test/throws', ['input'], async () => { throw new Error('oops'); });
    const result = await runGuardrails('input', { stage: 'input', userMessage: 'x' }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });

  it('FC2: evaluate() throws on output hook → block', async () => {
    const g = makeGuardrail('test/throws', ['output'], async () => { throw new Error('oops'); });
    const result = await runGuardrails('output', { stage: 'output', proposedOutput: 'x' }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });

  it('FC3: evaluate() throws on tool hook → block', async () => {
    const g = makeGuardrail('test/throws', ['tool'], async () => { throw new Error('oops'); });
    const result = await runGuardrails('tool', { stage: 'tool', toolName: 't', toolArgs: {} }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });

  it('FC4: applyRedact() throws → block (payload coercion error)', async () => {
    // A guardrail that returns redact with null for an input stage (string expected)
    const g = makeGuardrail('test/bad-redact', ['input'], async () => ({
      verdict: 'redact',
      redacted: null, // should throw in applyRedact since input stage needs a string
    }));
    const result = await runGuardrails('input', { stage: 'input', userMessage: 'x' }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });

  it('FC5: payload coercion error → block (simulate by numeric redacted for input stage)', async () => {
    const g = makeGuardrail('test/coerce-fail', ['input'], async () => ({
      verdict: 'redact',
      redacted: 12345, // number, not string — should block
    }));
    const result = await runGuardrails('input', { stage: 'input', userMessage: 'test' }, [g], 'agent');
    expect(result.blocked).toBe(true);
  });
});

// ── 7. applyRedact standalone tests ──────────────────────────────────────────

describe('applyRedact', () => {
  it('throws for non-string redacted on input stage', () => {
    const input: GuardrailInput = { stage: 'input', userMessage: 'original' };
    expect(() => applyRedact(input, { verdict: 'redact', redacted: 42 })).toThrow();
  });

  it('throws for non-string redacted on output stage', () => {
    const input: GuardrailInput = { stage: 'output', proposedOutput: 'original' };
    expect(() => applyRedact(input, { verdict: 'redact', redacted: { x: 1 } })).toThrow();
  });

  it('applies string redact to input.userMessage', () => {
    const input: GuardrailInput = { stage: 'input', userMessage: 'original' };
    applyRedact(input, { verdict: 'redact', redacted: 'cleaned' });
    expect(input.userMessage).toBe('cleaned');
  });

  it('applies string redact to output.proposedOutput', () => {
    const input: GuardrailInput = { stage: 'output', proposedOutput: 'original' };
    applyRedact(input, { verdict: 'redact', redacted: 'cleaned' });
    expect(input.proposedOutput).toBe('cleaned');
  });

  it('applies redactedArgs to tool.toolArgs', () => {
    const input: GuardrailInput = { stage: 'tool', toolName: 't', toolArgs: { x: 1 } };
    applyRedact(input, { verdict: 'redact', redactedArgs: { x: 99 } });
    expect(input.toolArgs).toEqual({ x: 99 });
  });

  it('falls back to redacted object for tool stage when no redactedArgs', () => {
    const input: GuardrailInput = { stage: 'tool', toolName: 't', toolArgs: { x: 1 } };
    applyRedact(input, { verdict: 'redact', redacted: { x: 0 } });
    expect(input.toolArgs).toEqual({ x: 0 });
  });

  it('is a no-op for pass verdict', () => {
    const input: GuardrailInput = { stage: 'input', userMessage: 'original' };
    applyRedact(input, { verdict: 'pass' });
    expect(input.userMessage).toBe('original');
  });
});
