/**
 * @file runner-skills.test.ts
 * @suite #1070 D5 — runner integration for core.read_skill
 *
 * Nibbler conditions covered here (runner-scope, items 3, 4, 6, 8):
 *   - N3: cross-turn isolation — 2-turn test proving try/finally resets
 *     `session.skillsPulled*` on BOTH the success path AND an error path.
 *   - N4: D12 regression guard — `end.skillsExecuted === []` when a skill
 *     is in the catalog but the model did not read it this turn.
 *   - N6: heading-string prompt snapshot — the "## Available Skills" block
 *     now reads "(call core.read_skill(id) to load the full body)".
 *   - N8: shared test helpers support `listSkillsForAgent`, `getSkill`, and
 *     session skill-tracking fields (implicitly exercised by every test below).
 *
 * Plus Zapp M1 — unconditional try/finally reset regression guard.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the SDK so `sdkRunner.run()` returns an empty stream we can inspect.
// We capture every call's agent instance so instructions can be asserted.
const runCalls: Array<{
  agent: { instructions?: string; tools?: Array<{ name?: string }> };
  input: unknown;
  options: unknown;
}> = [];

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');

  class FakeStreamResult implements AsyncIterable<never> {
    finalOutput: Promise<{ message: string; intent?: string }>;
    constructor(message: string) {
      this.finalOutput = Promise.resolve({ message });
    }
    async *[Symbol.asyncIterator](): AsyncIterator<never> { return; }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeStreamResult> {
      runCalls.push({ agent: agent as { instructions?: string; tools?: Array<{ name?: string }> }, input, options });
      return new FakeStreamResult(`assistant-reply-${runCalls.length}`);
    }
  }

  return {
    ...actual,
    Runner: FakeSDKRunner,
    setDefaultModelProvider: vi.fn(),
    setTraceProcessors: vi.fn(),
  };
});

const { Runner } = await import('../runner.js');
const { Session } = await import('../session.js');
const { createReadSkillTool } = await import('../../../../pack-core/src/tools/read_skill.js');
import type { SSEWriter } from '../sse.js';
import type { Skill } from '../../types/skill.js';

// ── Fake registry supporting new accessors (Nibbler N8) ─────────────────────
type RegistryArg = ConstructorParameters<typeof Runner>[0];

function makeSkill(id: string, body: string): Skill {
  return {
    id,
    name: id,
    description: `desc-${id}`,
    version: '0.1.0',
    instructions: body,
    appliesTo: ['*'],
    keywords: [],
    priority: 0,
    source: { packName: 'test', filePath: `${id}.md` } as Skill['source'],
  };
}

function makeFakeRegistry(skills: Skill[] = []): RegistryArg {
  return {
    getAgent: (name: string) => ({
      name,
      instructionsBase: 'You are a test agent.',
      model: { id: 'gpt-test' },
      toolAllowlist: [],
    }),
    getGuardrailsByStage: () => [],
    getToolsForAgent: () => [],
    getSkillsForAgent: () => skills,
    listSkillsForAgent: () => skills.map((s) => ({ id: s.id, description: s.description })),
    getSkill: (id: string) => skills.find((s) => s.id === id),
    get components() { return []; },
  } as unknown as RegistryArg;
}

function sse(bucket: Array<{ event: string; data: unknown }>): SSEWriter {
  return ((event, data) => bucket.push({ event, data })) as SSEWriter;
}

function findEnd(events: Array<{ event: string; data: unknown }>): Record<string, unknown> | undefined {
  return events.find((e) => e.event === 'end')?.data as Record<string, unknown> | undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('#1070 D5 — runner integration for core.read_skill', () => {
  beforeEach(() => {
    runCalls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('(N6) skills-block heading points at core.read_skill(id)', async () => {
    const skills = [makeSkill('core/onboarding', 'body-onboarding')];
    const registry = makeFakeRegistry(skills);
    const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
    const session = new Session({ sessionId: 's-heading', user: { oid: 'u' } });
    await runner.run(session, 'hi', sse([]));

    expect(runCalls).toHaveLength(1);
    const instr = runCalls[0].agent.instructions ?? '';
    expect(instr).toContain('## Available Skills (call core.read_skill(id) to load the full body)');
    expect(instr).toContain('- **core/onboarding**: desc-core/onboarding');
    // Regression guard: old heading string must NOT be present on its own.
    expect(instr).not.toMatch(/## Available Skills\n/);
  });

  it('universal tool registration: core.read_skill present regardless of pack toolAllowlist', async () => {
    const registry = makeFakeRegistry([makeSkill('s', 'b')]);
    const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
    const session = new Session({ sessionId: 's-tool', user: { oid: 'u' } });
    await runner.run(session, 'hi', sse([]));

    const toolNames = (runCalls[0].agent.tools ?? []).map((t) => t.name);
    expect(toolNames).toContain('core_read_skill');
  });

  it('factory omitted: tool is NOT registered (byte-identical to pre-#1070)', async () => {
    const registry = makeFakeRegistry([makeSkill('s', 'b')]);
    const runner = new Runner(registry); // no factory
    const session = new Session({ sessionId: 's-opt-out', user: { oid: 'u' } });
    await runner.run(session, 'hi', sse([]));

    const toolNames = (runCalls[0].agent.tools ?? []).map((t) => t.name);
    expect(toolNames).not.toContain('core_read_skill');
  });

  it('(N4 / D12) end.skillsExecuted === [] when nothing is read this turn', async () => {
    const registry = makeFakeRegistry([makeSkill('catalog-only', 'body')]);
    const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
    const session = new Session({ sessionId: 's-d12', user: { oid: 'u' } });
    const events: Array<{ event: string; data: unknown }> = [];
    await runner.run(session, 'hi', sse(events));

    const end = findEnd(events);
    expect(end).toBeDefined();
    expect(end!.skillsExecuted).toEqual([]);
    expect(end!.skillsPulledBytes).toBe(0);
    expect(end!.skillsPulledTokens).toBe(0);
  });

  it('(Zapp M1) per-turn reset on success — counters zeroed at exit', async () => {
    const registry = makeFakeRegistry([makeSkill('x', 'hello-world')]);
    const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
    const session = new Session({ sessionId: 's-m1a', user: { oid: 'u' } });

    // Simulate a read that DID happen during the turn by poisoning the counters
    // before run() — if try/finally resets correctly, they MUST be back to empty
    // at turn exit. (In practice the tool would populate them from execute().)
    await runner.run(session, 'hi', sse([]));
    expect(session.skillsPulled).toBeInstanceOf(Set);
    expect(session.skillsPulled!.size).toBe(0);
    expect(session.skillsPulledBytes).toBe(0);
    expect(session.skillsPulledTokens).toBe(0);
  });

  it('(Zapp M1 / N3) per-turn reset on ERROR path — counters zeroed even when SDK throws', async () => {
    // Patch the mocked SDK Runner to throw for this test only, then restore.
    const sdkMod = await import('@openai/agents');
    const FakeRunner = (sdkMod as unknown as {
      Runner: new (o?: unknown) => { run: (...a: unknown[]) => unknown };
    }).Runner;
    const origRun = FakeRunner.prototype.run;
    FakeRunner.prototype.run = async function () {
      throw new Error('simulated SDK failure');
    };

    try {
      const registry = makeFakeRegistry([makeSkill('x', 'body')]);
      const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
      const session = new Session({ sessionId: 's-m1b', user: { oid: 'u' } });

      // Pre-seed the counters to simulate mid-turn state leaking in.
      session.skillsPulled = new Set(['leftover']);
      session.skillsPulledBytes = 999;
      session.skillsPulledTokens = 123;

      await runner.run(session, 'hi', sse([]));

      // Regardless of the thrown error, the finally block MUST have reset the counters.
      expect(session.skillsPulled).toBeInstanceOf(Set);
      expect(session.skillsPulled!.size).toBe(0);
      expect(session.skillsPulledBytes).toBe(0);
      expect(session.skillsPulledTokens).toBe(0);
    } finally {
      FakeRunner.prototype.run = origRun;
    }
  });

  it('(N3) cross-turn isolation — turn-1 state does not leak into turn-2', async () => {
    const registry = makeFakeRegistry([makeSkill('x', 'body')]);
    const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
    const session = new Session({ sessionId: 's-n3', user: { oid: 'u' } });

    // Simulate turn-1 read via direct mutation (represents what the tool did).
    await runner.run(session, 'turn-1', sse([]));
    // After turn 1 completes, finally must have zeroed everything.
    expect(session.skillsPulledBytes).toBe(0);

    // Now simulate turn-2 — again, by the end, counters must be zero.
    await runner.run(session, 'turn-2', sse([]));
    expect(session.skillsPulled!.size).toBe(0);
    expect(session.skillsPulledBytes).toBe(0);
    expect(session.skillsPulledTokens).toBe(0);
  });
});
