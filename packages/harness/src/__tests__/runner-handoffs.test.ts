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
    inputGuardContribs: [] as any,
    outputGuardContribs: [] as any,
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

describe('#107 Runner.buildAgentInstance — triage specialist handoff edges', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function buildMultiPackRegistry(): PackRegistry {
    const registry = new PackRegistry();
    // Specialist packs must be registered before core so dependsOn resolves correctly.
    registry.register({ name: 'aks', version: '1.0.0', agents: [makeAgent('aks.architect')] });
    registry.register({ name: 'azure', version: '1.0.0', agents: [makeAgent('azure.architect')] });
    registry.register({ name: 'github', version: '1.0.0', agents: [makeAgent('github.publisher')] });
    registry.register({
      name: 'core',
      version: '1.0.0',
      handoffTargets: ['aks', 'azure', 'github'],
      agents: [
        makeAgent('core.triage', [
          { label: 'AKS architecture', agent: 'aks.architect', prompt: 'AKS workload.' },
          { label: 'Azure infrastructure', agent: 'azure.architect', prompt: 'Azure infra.' },
          { label: 'Publish to GitHub', agent: 'github.publisher', prompt: 'Publish files.' },
          { label: 'Generate files', agent: 'core.codesmith' },
          { label: 'Review artifacts', agent: 'core.reviewer' },
        ]),
        makeAgent('core.codesmith'),
        makeAgent('core.reviewer'),
      ],
    });
    registry.enable(['core', 'aks', 'azure', 'github']);
    registry.seal();
    return registry;
  }

  it('seal() accepts cross-pack handoffs when handoffTargets declares the target packs', () => {
    // This should not throw — the cross-pack validation path in registry.seal()
    // must allow aks.*, azure.*, and github.* because core declares handoffTargets.
    expect(() => buildMultiPackRegistry()).not.toThrow();
  });

  it('triage hands off to aks.architect (transfer_to_aks_architect)', () => {
    const runner = new Runner(buildMultiPackRegistry());
    const triage = callBuild(runner, 'core.triage');
    const toolNames = triage.handoffs.map((h: any) => h.toolName as string);
    expect(toolNames).toContain('transfer_to_aks_architect');
  });

  it('triage hands off to azure.architect (transfer_to_azure_architect)', () => {
    const runner = new Runner(buildMultiPackRegistry());
    const triage = callBuild(runner, 'core.triage');
    const toolNames = triage.handoffs.map((h: any) => h.toolName as string);
    expect(toolNames).toContain('transfer_to_azure_architect');
  });

  it('triage hands off to github.publisher (transfer_to_github_publisher)', () => {
    const runner = new Runner(buildMultiPackRegistry());
    const triage = callBuild(runner, 'core.triage');
    const toolNames = triage.handoffs.map((h: any) => h.toolName as string);
    expect(toolNames).toContain('transfer_to_github_publisher');
  });

  it('triage retains core.codesmith and core.reviewer handoff edges', () => {
    const runner = new Runner(buildMultiPackRegistry());
    const triage = callBuild(runner, 'core.triage');
    const toolNames = triage.handoffs.map((h: any) => h.toolName as string);
    expect(toolNames).toContain('transfer_to_core_codesmith');
    expect(toolNames).toContain('transfer_to_core_reviewer');
  });

  it('triage has exactly five handoff edges after wiring specialists', () => {
    const runner = new Runner(buildMultiPackRegistry());
    const triage = callBuild(runner, 'core.triage');
    expect(triage.handoffs).toHaveLength(5);
  });
});

describe('#132 Runner.buildAgentInstance — asTools wiring (triage ↔ specialist consultation)', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeAgentWithAsTools(
    name: string,
    asTools: AgentContribution['asTools'] = [],
  ): AgentContribution {
    return {
      name,
      description: `${name} description`,
      model: { envVar: 'KICKSTART_CHAT_MODEL' },
      toolAllowlist: [],
      handoffs: [],
      asTools,
      userInvocable: true,
      modelInvocable: true,
      instructionsBase: `You are ${name}.`,
      source: { kind: 'inline' },
    };
  }

  function buildRegistrySinglePack(agents: AgentContribution[]): PackRegistry {
    // Register all agents under a single pack (named by the first agent's namespace).
    const registry = new PackRegistry();
    const packName = agents[0]!.name.split('.')[0]!;
    registry.register({ name: packName, version: '1.0.0', agents });
    registry.enable([packName]);
    registry.seal();
    return registry;
  }

  /** Register agents across TWO packs — core and aks — to exercise cross-pack asTool resolution. */
  function buildRegistryTwoPacks(
    coreAgents: AgentContribution[],
    aksAgents: AgentContribution[],
  ): PackRegistry {
    const registry = new PackRegistry();
    registry.register({ name: 'core', version: '1.0.0', agents: coreAgents });
    registry.register({ name: 'aks', version: '1.0.0', agents: aksAgents });
    registry.enable(['core', 'aks']);
    registry.seal();
    return registry;
  }

  /** Registry with only the core pack — aks agents are intentionally absent. */
  function buildRegistryCoreOnly(coreAgents: AgentContribution[]): PackRegistry {
    const registry = new PackRegistry();
    registry.register({ name: 'core', version: '1.0.0', agents: coreAgents });
    registry.enable(['core']);
    registry.seal();
    return registry;
  }

  it('T-AT1: injects ask_<specialist> function tools when asTools is declared', () => {
    const aksArchitect = makeAgentWithAsTools('core.aks_architect');
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'core.aks_architect', description: 'Ask the AKS specialist.' },
    ]);

    const registry = buildRegistrySinglePack([triage, aksArchitect]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_aks_architect');
  });

  it('T-AT2: explicit toolName override is respected', () => {
    const azureArchitect = makeAgentWithAsTools('core.azure_architect');
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'core.azure_architect', toolName: 'ask_azure', description: 'Ask Azure.' },
    ]);

    const registry = buildRegistrySinglePack([triage, azureArchitect]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_azure');
    expect(toolNames).not.toContain('ask_core_azure_architect');
  });

  it('T-AT3: multiple asTools entries produce multiple consultation tools', () => {
    const aks = makeAgentWithAsTools('core.aks_specialist');
    const azure = makeAgentWithAsTools('core.azure_specialist');
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'core.aks_specialist', description: 'AKS.' },
      { agent: 'core.azure_specialist', description: 'Azure.' },
    ]);

    const registry = buildRegistrySinglePack([triage, aks, azure]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_aks_specialist');
    expect(toolNames).toContain('ask_core_azure_specialist');
  });

  it('T-AT4: agent with no asTools produces no consultation tools', () => {
    const triage = makeAgentWithAsTools('core.triage', []);
    const registry = buildRegistrySinglePack([triage]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const consultToolNames = builtTriage.tools.filter((t) => t.name.startsWith('ask_'));
    expect(consultToolNames).toHaveLength(0);
  });

  // T-AT5: cross-pack asTool resolution — agent in 'core' pack consults an
  // agent in 'aks' pack. Registry has both packs enabled and sealed.
  it('T-AT5: cross-pack asTool resolution — core.triage consults aks.architect from a separate pack', () => {
    const aksArchitect = makeAgentWithAsTools('aks.architect');
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'aks.architect', description: 'Ask the AKS architect.' },
    ]);

    const registry = buildRegistryTwoPacks([triage], [aksArchitect]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_architect');
  });

  // T-AT6: cross-pack asTool resolution with multiple specialists across packs.
  it('T-AT6: cross-pack — multiple asTools from same external pack are all wired', () => {
    const aksArchitect = makeAgentWithAsTools('aks.architect');
    const aksNetworking = makeAgentWithAsTools('aks.networking');
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'aks.architect', description: 'Cluster design.' },
      { agent: 'aks.networking', description: 'Networking.' },
    ]);

    const registry = buildRegistryTwoPacks([triage], [aksArchitect, aksNetworking]);
    const runner = new Runner(registry);
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_architect');
    expect(toolNames).toContain('ask_aks_networking');
  });

  // T-AT7: graceful fallback — when the specialist pack is not loaded,
  // buildAgentInstance must NOT throw; it must inject an error-returning stub
  // tool so the host agent can surface the unavailability to the user.
  it('T-AT7: missing specialist pack — injects error-stub tool instead of crashing', () => {
    // core.triage declares asTools referencing aks.architect, but aks pack is NOT registered.
    const triage = makeAgentWithAsTools('core.triage', [
      { agent: 'aks.architect', description: 'Ask the AKS architect.' },
    ]);

    const registry = buildRegistryCoreOnly([triage]);
    const runner = new Runner(registry);

    // buildAgentInstance must not throw even though aks.architect is absent.
    const builtTriage = callBuild(runner, 'core.triage') as { tools: Array<{ name: string }> };

    // The stub tool should still be present under the expected name.
    const toolNames = builtTriage.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_architect');
  });

  // T-AT8: circular asTools guard — A declares asTools referencing B, and B
  // declares asTools referencing A. Must resolve without stack overflow (the
  // cache intercepts the second visit to A before the inProgress guard fires).
  it('T-AT8: mutual asTools (A ↔ B) terminates without stack overflow', () => {
    const agentA = makeAgentWithAsTools('core.agent_a', [
      { agent: 'core.agent_b', description: 'Consult B.' },
    ]);
    const agentB = makeAgentWithAsTools('core.agent_b', [
      { agent: 'core.agent_a', description: 'Consult A.' },
    ]);

    const registry = buildRegistrySinglePack([agentA, agentB]);
    const runner = new Runner(registry);

    // Must complete without throwing or blowing the stack.
    const builtA = callBuild(runner, 'core.agent_a') as { tools: Array<{ name: string }> };
    const toolNames = builtA.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_agent_b');
  });
});

describe('#118 Runner.buildAgentInstance — asTools wiring (additional agent pairs)', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
    vi.stubEnv('KICKSTART_CODEX_MODEL', 'gpt-4o-mini');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeAgentWithAsTools(
    name: string,
    asTools: AgentContribution['asTools'] = [],
  ): AgentContribution {
    return {
      name,
      description: `${name} description`,
      model: { envVar: 'KICKSTART_CHAT_MODEL' },
      toolAllowlist: [],
      handoffs: [],
      asTools,
      userInvocable: true,
      modelInvocable: true,
      instructionsBase: `You are ${name}.`,
      source: { kind: 'inline' },
    };
  }

  /** Register all agents under a single pack (pack name = first agent's namespace prefix). */
  function buildSinglePackRegistry(agents: AgentContribution[]): PackRegistry {
    const registry = new PackRegistry();
    const packName = agents[0]!.name.split('.')[0]!;
    registry.register({ name: packName, version: '1.0.0', agents });
    registry.enable([packName]);
    registry.seal();
    return registry;
  }

  /**
   * Register agents across two separate packs.
   * callerPackAgents → registered under callerPack name
   * specialistPackAgents → registered under specialistPack name
   */
  function buildCrossPackRegistry(
    callerPackName: string,
    callerPackAgents: AgentContribution[],
    specialistPackName: string,
    specialistPackAgents: AgentContribution[],
  ): PackRegistry {
    const registry = new PackRegistry();
    registry.register({ name: callerPackName, version: '1.0.0', agents: callerPackAgents });
    registry.register({ name: specialistPackName, version: '1.0.0', agents: specialistPackAgents });
    registry.enable([callerPackName, specialistPackName]);
    registry.seal();
    return registry;
  }

  // T-AT-AKS1: aks.architect → azure.architect
  it('aks.architect injects ask_aks_azure_architect tool when asTools declares azure.architect', () => {
    const azureArchitect = makeAgentWithAsTools('aks.azure_architect');
    const aksArchitect = makeAgentWithAsTools('aks.architect', [
      { agent: 'aks.azure_architect', description: 'Consult for VNET/DNS questions.' },
    ]);

    const registry = buildSinglePackRegistry([aksArchitect, azureArchitect]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'aks.architect') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_azure_architect');
  });

  // T-AT-AKS2: aks.architect → core.codesmith
  it('aks.architect injects ask_aks_core_codesmith tool when asTools declares core.codesmith', () => {
    const codesmith = makeAgentWithAsTools('aks.core_codesmith');
    const aksArchitect = makeAgentWithAsTools('aks.architect', [
      { agent: 'aks.core_codesmith', description: 'Generate infra code mid-diagnosis.' },
    ]);

    const registry = buildSinglePackRegistry([aksArchitect, codesmith]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'aks.architect') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_core_codesmith');
  });

  // T-AT-AZ1: azure.architect → aks.architect (#224 reverse direction)
  it('azure.architect injects ask_aks_architect tool when asTools declares aks.architect', () => {
    const aksArchitect = makeAgentWithAsTools('aks.architect');
    const azureArchitect = makeAgentWithAsTools('azure.architect', [
      {
        agent: 'aks.architect',
        description: 'Consult for AKS topology, networking, workload placement.',
      },
    ]);

    const registry = buildCrossPackRegistry('azure', [azureArchitect], 'aks', [aksArchitect]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'azure.architect') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_aks_architect');
  });

  // T-AT-SYM1: symmetric bidirectional wiring — azure.architect ↔ aks.architect (#224)
  // Both architects declare each other as asTools. Verifies both directions resolve
  // through the *shared* per-turn cache (mutual-recursion path), and that the
  // resulting tools are real consultation tools — not the missing-pack error stub.
  // Asterisk-named arguments are intentionally omitted so the assertions can rely
  // on the asTool() default description as a discriminator vs. the stub fallback.
  it('azure.architect ↔ aks.architect symmetric: shared-cache mutual recursion wires real ask_* tools both ways', () => {
    const aksArchitect = makeAgentWithAsTools('aks.architect', [
      // No description / toolName — let asTool() supply its defaults so the
      // discriminator below is meaningful.
      { agent: 'azure.architect' },
    ]);
    const azureArchitect = makeAgentWithAsTools('azure.architect', [
      { agent: 'aks.architect' },
    ]);

    const registry = buildCrossPackRegistry('azure', [azureArchitect], 'aks', [aksArchitect]);
    const runner = new Runner(registry);

    // Single shared cache: building azure.architect recurses into
    // aks.architect via asTools, which in turn references azure.architect —
    // the back-edge must be satisfied from the cache, exercising the
    // mutual-recursion path. Using two fresh callBuild() calls (as the prior
    // version did) would skip this path entirely.
    const cache = new Map<string, any>();
    const builtAzure = callBuild(runner, 'azure.architect', cache) as {
      tools: Array<{ name: string; description: string; invoke?: unknown; parameters?: unknown }>;
    };

    // Cache invariant: both agents present, populated by recursion, not by
    // separate top-level builds.
    expect(cache.has('azure.architect')).toBe(true);
    expect(cache.has('aks.architect')).toBe(true);

    const builtAks = cache.get('aks.architect') as {
      tools: Array<{ name: string; description: string; invoke?: unknown; parameters?: unknown }>;
    };

    const azureToAks = builtAzure.tools.find((t) => t.name === 'ask_aks_architect');
    const aksToAzure = builtAks.tools.find((t) => t.name === 'ask_azure_architect');
    expect(azureToAks, 'azure.architect should expose ask_aks_architect').toBeDefined();
    expect(aksToAzure, 'aks.architect should expose ask_azure_architect').toBeDefined();

    // Discriminator: the missing-pack stub uses the description
    //   "Ask the <agent> specialist."
    // while the real asTool() default ends with
    //   "specialist a question and return their response."
    // Asserting the latter proves both directions were wired through the
    // consultation runtime, not the error-returning fallback. This catches
    // a regression where shared-cache resolution silently routed the
    // back-edge into the catch-block stub.
    expect(azureToAks!.description).toBe(
      'Ask the aks.architect specialist a question and return their response.',
    );
    expect(aksToAzure!.description).toBe(
      'Ask the azure.architect specialist a question and return their response.',
    );

    // Both wired tools are real, invocable FunctionTools with a `query`
    // parameter — a host LLM call would actually execute them rather than
    // hit a no-op. We can't drive the SDK runner end-to-end in a unit test
    // (it requires a live model), but verifying the shape proves the
    // asTool() factory ran to completion for each direction.
    for (const t of [azureToAks!, aksToAzure!]) {
      expect(typeof t.invoke).toBe('function');
      const params = t.parameters as { properties?: Record<string, unknown> } | undefined;
      expect(params?.properties).toHaveProperty('query');
    }
  });

  // T-AT-CS1: codesmith → reviewer
  it('codesmith injects ask_core_reviewer tool when asTools declares core.reviewer', () => {
    const reviewer = makeAgentWithAsTools('core.reviewer');
    const codesmith = makeAgentWithAsTools('core.codesmith', [
      { agent: 'core.reviewer', description: 'Immediate review of generated code.' },
    ]);

    const registry = buildSinglePackRegistry([codesmith, reviewer]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'core.codesmith') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_reviewer');
  });

  // T-AT-CS2: multiple asTools entries produce multiple consultation tools
  it('agent with multiple asTools entries produces all consultation tools', () => {
    const specialist1 = makeAgentWithAsTools('core.specialist_a');
    const specialist2 = makeAgentWithAsTools('core.specialist_b');
    const caller = makeAgentWithAsTools('core.caller', [
      { agent: 'core.specialist_a', description: 'Ask A.' },
      { agent: 'core.specialist_b', description: 'Ask B.' },
    ]);

    const registry = buildSinglePackRegistry([caller, specialist1, specialist2]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'core.caller') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_specialist_a');
    expect(toolNames).toContain('ask_core_specialist_b');
  });

  // T-AT-TN: toolName override respected
  it('toolName override is respected for asTools entries', () => {
    const reviewer = makeAgentWithAsTools('core.reviewer');
    const codesmith = makeAgentWithAsTools('core.codesmith', [
      { agent: 'core.reviewer', toolName: 'quick_review', description: 'Quick review.' },
    ]);

    const registry = buildSinglePackRegistry([codesmith, reviewer]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'core.codesmith') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('quick_review');
    expect(toolNames).not.toContain('ask_core_reviewer');
  });

  // T-AT-XPACK: cross-pack asTool resolution — caller in pack-aks, specialist in pack-core
  it('cross-pack: aks.architect can consult core.reviewer registered in a different pack', () => {
    const reviewer = makeAgentWithAsTools('core.reviewer');
    const aksArchitect = makeAgentWithAsTools('aks.architect', [
      { agent: 'core.reviewer', description: 'Ask core reviewer for cross-pack quality check.' },
    ]);

    const registry = buildCrossPackRegistry('aks', [aksArchitect], 'core', [reviewer]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'aks.architect') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_reviewer');
  });

  // T-AT-XPACK2: cross-pack with two packs each registering agents; pack-a calls pack-b
  it('cross-pack: pack-a agent successfully calls pack-b agent via asTool lookup', () => {
    const packBSpecialist = makeAgentWithAsTools('packb.specialist');
    const packACaller = makeAgentWithAsTools('packa.caller', [
      { agent: 'packb.specialist', description: 'Consult pack-b specialist.' },
    ]);

    const registry = buildCrossPackRegistry('packa', [packACaller], 'packb', [packBSpecialist]);
    const runner = new Runner(registry);
    const built = callBuild(runner, 'packa.caller') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_packb_specialist');
  });

  // T-AT-MISSING: missing agent in asTools gets a stub tool, not a crash
  it('missing asTools agent gets a stub tool — other tools still wired', () => {
    const realSpecialist = makeAgentWithAsTools('core.real_specialist');
    const caller = makeAgentWithAsTools('core.caller', [
      { agent: 'core.real_specialist', description: 'Ask the real specialist.' },
      { agent: 'core.ghost_agent', description: 'This agent does not exist.' },
    ]);

    const registry = buildSinglePackRegistry([caller, realSpecialist]);
    const runner = new Runner(registry);

    // Should NOT throw — the missing agent entry is replaced with an error-returning stub tool
    // so the host agent can report unavailability to the user instead of crashing pack load.
    const built = callBuild(runner, 'core.caller') as { tools: Array<{ name: string }> };

    const toolNames = built.tools.map((t) => t.name);
    expect(toolNames).toContain('ask_core_real_specialist');
    // Stub tool is wired for the unavailable specialist so the host agent can surface the error.
    expect(toolNames).toContain('ask_core_ghost_agent');
  });
});
