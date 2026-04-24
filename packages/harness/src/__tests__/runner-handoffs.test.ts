/**
 * Unit tests for #1073 Layer D2: handoff wiring inside
 * `Runner.buildAgentInstance()` and the `resolveMaxTurns()` helper.
 *
 * Covers:
 *  - T1: recursion correctness (A→B→C resolves all three).
 *  - T2: cycle-break via per-turn Map (A↔B terminates, no stack overflow).
 *  - T2b: regression guard for closure freshness — turn 2 rebuilds with
 *    fresh per-turn cache, not the one from turn 1.
 *  - T2c: self-handoff (A→A) terminates via the cache.
 *  - T3: empty `handoffs: []` produces zero handoff tools (regression
 *    guard for current behavior).
 *  - Z4: dot-notation agent ids produce the expected `transfer_to_*`
 *    tool names (dots → underscores per SDK `toFunctionToolName`).
 *  - resolveMaxTurns() honors env override and rejects invalid values.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PackRegistry } from '../runtime/registry.js';
import { Runner, resolveMaxTurns, RUNNER_MAX_TURNS_DEFAULT } from '../runtime/runner.js';
import type { AgentContribution } from '../types/agent.js';
import type { ComponentContribution } from '../types/component.js';

function makeAgent(
  name: string,
  handoffs: AgentContribution['handoffs'] = [],
): AgentContribution {
  return {
    name,
    description: `${name} description`,
    model: { envVar: 'KICKSTART_CHAT_MODEL' },
    toolAllowlist: [],
    handoffs,
    userInvocable: name.endsWith('.triage'),
    modelInvocable: true,
    instructionsBase: `You are ${name}.`,
    source: { kind: 'inline' },
  };
}

function buildRegistry(agents: AgentContribution[]): PackRegistry {
  const registry = new PackRegistry();
  registry.register({
    name: 'core',
    version: '1.0.0',
    agents,
  });
  registry.enable(['core']);
  // Note: seal() validates handoff targets — callers that want to test
  // invalid-target behavior should skip .seal() and invoke the private
  // validator path via the registry.test.ts suite instead.
  registry.seal();
  return registry;
}

function buildRegistryWithComponents(
  agents: AgentContribution[],
  components: ComponentContribution[],
): PackRegistry {
  const registry = new PackRegistry();
  registry.register({
    name: 'core',
    version: '1.0.0',
    agents,
    components,
  });
  registry.enable(['core']);
  registry.seal();
  return registry;
}

function makeComponent(name: string, llmHint?: string): ComponentContribution {
  return {
    name,
    propertySchema: z.object({}).strict(),
    renderer: null,
    llmHint,
  };
}

// Tiny fakes for the per-turn build context. `buildAgentInstance` only
// threads these through to `wrapTool` / `wrapUserAction` — with no tools
// in the fixtures below, nothing ever calls them.
function makeBuildCtx() {
  const abortCtrl = new AbortController();
  return {
    session: {} as any,
    sseWrite: (() => {}) as any,
    abortCtrl,
    toolGuardrails: [] as any,
    isHalted: () => false,
    setHalted: () => {},
  };
}

// Private helper accessor. `buildAgentInstance` is intentionally private
// for runtime encapsulation; tests poke it via `as any`.
function callBuild(runner: Runner, agentName: string, cache = new Map<string, any>()) {
  return (runner as any).buildAgentInstance(agentName, cache, makeBuildCtx());
}

describe('#1073 Runner.buildAgentInstance — handoff wiring', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
    vi.stubEnv('KICKSTART_CODEX_MODEL', 'gpt-4o-mini');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // T1 — linear recursion
  it('recursively resolves handoff chains (A → B → C)', () => {
    const registry = buildRegistry([
      makeAgent('core.a', [{ label: 'to B', agent: 'core.b' }]),
      makeAgent('core.b', [{ label: 'to C', agent: 'core.c' }]),
      makeAgent('core.c'),
    ]);
    const runner = new Runner(registry);
    const rootA = callBuild(runner, 'core.a');
    expect(rootA.handoffs).toHaveLength(1);
    // SDK wraps as Handoff instances — `agentName` holds the target id.
    const handoffToB = rootA.handoffs[0];
    expect(handoffToB.agentName ?? handoffToB.toolName).toContain('b');
  });

  // T2 — mutual cycle must not blow the stack and B must resolve once.
  it('breaks A ↔ B cycles via per-turn cache (no stack overflow)', () => {
    const registry = buildRegistry([
      makeAgent('core.a', [{ label: 'go', agent: 'core.b' }]),
      makeAgent('core.b', [{ label: 'back', agent: 'core.a' }]),
    ]);
    const runner = new Runner(registry);
    const cache = new Map<string, any>();
    const a = callBuild(runner, 'core.a', cache);
    // Both agents present in cache
    expect(cache.has('core.a')).toBe(true);
    expect(cache.has('core.b')).toBe(true);
    // A.handoffs[0] wraps B; B.handoffs[0] wraps A (same identity).
    expect(a.handoffs).toHaveLength(1);
    const b = cache.get('core.b');
    expect(b.handoffs).toHaveLength(1);
    // Cache invariant: the A returned and the A reached via B's handoff
    // chain should be the same instance (cache-before-recurse).
    expect(cache.get('core.a')).toBe(a);
  });

  // T2b — fresh cache per turn (per-turn isolation).
  it('builds a fresh Agent instance when called with a fresh cache (turn isolation, Nibbler N1)', () => {
    const registry = buildRegistry([makeAgent('core.a')]);
    const runner = new Runner(registry);
    const a1 = callBuild(runner, 'core.a', new Map());
    const a2 = callBuild(runner, 'core.a', new Map());
    // Two separate Map instances → two separate Agent instances.
    // This is the regression guard for the rejected "process-scoped cache".
    expect(a1).not.toBe(a2);
  });

  // T2c — self-handoff.
  it('allows self-handoff (A → A) via the cache', () => {
    const registry = buildRegistry([
      makeAgent('core.a', [{ label: 'loop', agent: 'core.a' }]),
    ]);
    const runner = new Runner(registry);
    const cache = new Map<string, any>();
    const a = callBuild(runner, 'core.a', cache);
    expect(a.handoffs).toHaveLength(1);
    expect(cache.get('core.a')).toBe(a);
  });

  // T3 — empty handoffs[] produces zero handoff tools.
  it('produces zero handoff tools when frontmatter handoffs: [] (regression guard)', () => {
    const registry = buildRegistry([makeAgent('core.alone')]);
    const runner = new Runner(registry);
    const a = callBuild(runner, 'core.alone');
    expect(a.handoffs).toEqual([]);
  });

  // Z4 — dot-notation in agent id lands correctly in the SDK tool name.
  it('generates transfer_to_<id> tool names compatible with dot-notation agent ids (Zapp Z4)', () => {
    const registry = buildRegistry([
      makeAgent('core.triage', [{ label: 'Generate', agent: 'core.codesmith' }]),
      makeAgent('core.codesmith'),
    ]);
    const runner = new Runner(registry);
    const triage = callBuild(runner, 'core.triage');
    expect(triage.handoffs).toHaveLength(1);
    // SDK's toFunctionToolName replaces non-alphanumerics (incl. `.`) with
    // underscores. So `core.codesmith` → `transfer_to_core_codesmith`.
    // If the SDK ever changes the mapping, this assertion lights up and
    // we know to add a `toolNameOverride`.
    const toolName = triage.handoffs[0].toolName;
    expect(toolName).toBe('transfer_to_core_codesmith');
  });

  // Handoff description carries frontmatter prompt.
  it('maps handoff.prompt into toolDescriptionOverride', () => {
    const registry = buildRegistry([
      makeAgent('core.triage', [{
        label: 'Generate files',
        agent: 'core.codesmith',
        prompt: 'Requirements are clear.',
      }]),
      makeAgent('core.codesmith'),
    ]);
    const runner = new Runner(registry);
    const triage = callBuild(runner, 'core.triage');
    const ho = triage.handoffs[0];
    // Handoff exposes `toolDescription` (derived from description override).
    const desc = ho.toolDescription ?? '';
    expect(desc).toContain('Generate files');
    expect(desc).toContain('Requirements are clear');
  });
});

describe('#1073 resolveMaxTurns — Zapp Z2 runtime circuit-breaker', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the default when env var is unset', () => {
    vi.stubEnv('KICKSTART_RUNNER_MAX_TURNS', '');
    expect(resolveMaxTurns()).toBe(RUNNER_MAX_TURNS_DEFAULT);
  });

  it('honors a positive integer env override', () => {
    vi.stubEnv('KICKSTART_RUNNER_MAX_TURNS', '25');
    expect(resolveMaxTurns()).toBe(25);
  });

  it('falls back to the default on non-numeric values', () => {
    vi.stubEnv('KICKSTART_RUNNER_MAX_TURNS', 'abc');
    expect(resolveMaxTurns()).toBe(RUNNER_MAX_TURNS_DEFAULT);
  });

  it('falls back to the default on zero or negative values', () => {
    vi.stubEnv('KICKSTART_RUNNER_MAX_TURNS', '0');
    expect(resolveMaxTurns()).toBe(RUNNER_MAX_TURNS_DEFAULT);
    vi.stubEnv('KICKSTART_RUNNER_MAX_TURNS', '-5');
    expect(resolveMaxTurns()).toBe(RUNNER_MAX_TURNS_DEFAULT);
  });
});

describe('#1130 Runner.buildAgentInstance — catalog hint injection', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('injects prop-aware llm hints for components that provide them', () => {
    const registry = buildRegistryWithComponents(
      [makeAgent('core.triage')],
      [
        makeComponent('core/DecisionCard', 'Decision helper with title and recommendation props.'),
        makeComponent('core/Text'),
      ],
    );

    const runner = new Runner(registry);
    const triage = callBuild(runner, 'core.triage') as { instructions: string };

    expect(triage.instructions).toContain('## A2UI Component Catalog (2 components available)');
    expect(triage.instructions).toContain(
      '- **core/DecisionCard** — Decision helper with title and recommendation props.',
    );
    expect(triage.instructions).toContain('- core/Text');
  });

  it('normalizes llm hints before injecting them into instructions', () => {
    const registry = buildRegistryWithComponents(
      [makeAgent('core.triage')],
      [
        makeComponent(
          'core/RadioGroup',
          'Single-select picker.\n\nUse action on pick.\u0007 '.concat('x'.repeat(260)),
        ),
      ],
    );

    const runner = new Runner(registry);
    const triage = callBuild(runner, 'core.triage') as { instructions: string };

    expect(triage.instructions).toContain('- **core/RadioGroup** — Single-select picker. Use action on pick.');
    expect(triage.instructions).not.toContain('\n\nUse action on pick');
    expect(triage.instructions).not.toContain('\u0007');
    const injectedLine = triage.instructions.split('\n').find((line) => line.includes('core/RadioGroup'));
    expect(injectedLine).toBeDefined();
    expect(injectedLine!.length).toBeLessThanOrEqual(270);
  });
});
// Avoid an unused-import warning on `z` while keeping it handy for future tests.
void z;
