/**
 * Phase E — PlanArtifactMissing integration spec.
 *
 * Verifies that `core.codesmith` (and `core.architect`) surface a fixed-copy
 * HARNESS_E001 Card when the `plan` artifact is absent from the session,
 * without making any LLM calls.
 *
 * These are excluded from the default vitest run (*.spec.ts is in the
 * exclude list) and are intended as integration-level checks.
 */

import { describe, expect, it } from 'vitest';
import { Runner } from '../src/runtime/runner.js';
import { Session } from '../src/runtime/session.js';
import type { SSEWriter } from '../src/runtime/sse.js';

// Minimal PackRegistry stub — only the methods called before the plan guard.
function makeMinimalRegistry(agentName: string) {
  return {
    getAgent: () => {
      throw new Error(`Unexpected getAgent call for ${agentName}`);
    },
    getGuardrailsByStage: () => [],
    getToolsForAgent: () => [],
    getSkillsForAgent: () => [],
    listSkillsForAgent: () => [],
    getSkill: () => undefined,
    components: [],
    playgroundStubs: {},
  } as any;
}

/**
 * Run an agent against a minimal session and collect all SSE events.
 *
 * @param agentName - The agent to activate (e.g. 'core.codesmith').
 * @param opts.planPath - If non-null, adds a `plan` artifact to the session.
 */
async function runAgent(
  agentName: string,
  opts: { planPath: string | null },
): Promise<{ output: { components: Record<string, unknown>[] }; events: Array<{ type: string; data: unknown }> }> {
  const session = new Session({
    user: { oid: 'test-user', tid: 'test-tenant' },
    workspaceRoot: '/test',
  });
  session.activeAgent = agentName;

  if (opts.planPath !== null) {
    session.setArtifact({ path: opts.planPath, content: '{"steps":[]}' });
  }

  const registry = makeMinimalRegistry(agentName);
  const runner = new Runner(registry);

  const events: Array<{ type: string; data: unknown }> = [];
  const sseWrite: SSEWriter = (type, data) => events.push({ type, data });

  await runner.run(session, 'run me', sseWrite);

  // Collect all components from a2ui updateComponents events.
  const components = events
    .filter((e) => e.type === 'a2ui')
    .flatMap((e) => {
      const msg = e.data as Record<string, unknown>;
      const uc = msg.updateComponents as { components?: unknown[] } | undefined;
      return uc?.components ?? [];
    }) as Record<string, unknown>[];

  return { output: { components }, events };
}

describe('PlanArtifactMissing — HARNESS_E001', () => {
  it('codesmith surfaces PlanArtifactMissing without a plan', async () => {
    const { output } = await runAgent('core.codesmith', { planPath: null });
    expect(output.components).toContainEqual(
      expect.objectContaining({
        type: 'Card',
        title: expect.stringMatching(/plan artifact missing/i),
        errorCode: 'HARNESS_E001',
      }),
    );
  });

  it('architect surfaces PlanArtifactMissing without a plan', async () => {
    const { output } = await runAgent('core.architect', { planPath: null });
    expect(output.components).toContainEqual(
      expect.objectContaining({
        type: 'Card',
        errorCode: 'HARNESS_E001',
      }),
    );
  });

  it('codesmith with a plan artifact does NOT emit HARNESS_E001', async () => {
    // With a plan present, the guard passes and we reach registry.getAgent —
    // which our stub throws for, so we check no HARNESS_E001 card is in events.
    const { output, events } = await runAgent('core.codesmith', { planPath: 'plan' });
    const hasE001 = output.components.some((c) => c.errorCode === 'HARNESS_E001');
    // The run fails at getAgent (no LLM) but no HARNESS_E001 card.
    expect(hasE001).toBe(false);
    // The error from registry.getAgent surfaces as an SSE error event.
    const errEvent = events.find((e) => e.type === 'error');
    expect(errEvent).toBeDefined();
  });

  it('recovery action uses enum-bounded schema (no free-form fields)', async () => {
    const { output } = await runAgent('core.codesmith', { planPath: null });
    const card = output.components.find(
      (c): c is Record<string, unknown> => c.errorCode === 'HARNESS_E001',
    );
    expect(card).toBeDefined();
    const actions = card!.actions as Array<{ action: Record<string, unknown> }>;
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
    const action = actions[0].action;
    // Only enum-bounded fields — no free-form strings.
    expect(action.targetPhase).toBe('architect');
    expect(action.reason).toBe('plan_artifact_missing');
    expect(Object.keys(action)).toEqual(['targetPhase', 'reason']);
  });
});
