/**
 * Unit tests for #119 — deterministic codesmith→reviewer chain.
 *
 * Covers:
 *  - parseGateVerdict: APPROVED, REJECTED, ambiguous (conservative).
 *  - runChain: 2-step chain; step 2 receives step 1 output; SSE events emitted.
 *  - runChain: chain aborts early when a step is aborted.
 *  - runChain: throws ChainDepthExceeded when steps > CHAIN_MAX_STEPS.
 *  - runWithGate: APPROVED verdict → returns generator output, aborted=false.
 *  - runWithGate: REJECTED verdict → aborted=true, abortReason set.
 *  - runWithGate: ambiguous verdict → treated as rejection.
 *  - run() wires codesmith → reviewer deterministically (chain_step event).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseGateVerdict,
  CHAIN_MAX_STEPS,
  Runner,
} from '../runtime/runner.js';
import { ChainDepthExceeded } from '../errors/index.js';
import { PackRegistry } from '../runtime/registry.js';
import type { AgentContribution } from '../types/agent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    userInvocable: false,
    modelInvocable: true,
    instructionsBase: `You are ${name}.`,
    source: { kind: 'inline' },
  };
}

function buildRegistry(agents: AgentContribution[]): PackRegistry {
  const registry = new PackRegistry();
  registry.register({ name: 'core', version: '1.0.0', agents });
  registry.enable(['core']);
  registry.seal();
  return registry;
}

function makeSession(agentName = 'core.codesmith') {
  return {
    sessionId: 'test-session',
    activeAgent: agentName,
    artifacts: new Map<string, string>([['plan', '# Plan']]),
    recentTurns: [] as any[],
    pendingUserAction: null,
    intent: undefined,
    skillsPulled: new Set<string>(),
    skillsPulledBytes: 0,
    skillsPulledTokens: 0,
    recordTurn: vi.fn(),
    drainA2UIEmissions: vi.fn(() => []),
  } as any;
}

// ---------------------------------------------------------------------------
// parseGateVerdict
// ---------------------------------------------------------------------------

describe('parseGateVerdict (#119)', () => {
  it('returns approved:true for plain APPROVED', () => {
    expect(parseGateVerdict('The code looks good. APPROVED')).toEqual({ approved: true });
  });

  it('returns approved:true for APPROVED (case-insensitive)', () => {
    expect(parseGateVerdict('approved')).toEqual({ approved: true });
  });

  it('returns approved:false for REJECTED with feedback', () => {
    const result = parseGateVerdict('The file is missing error handling. REJECTED: no error handling.');
    expect(result.approved).toBe(false);
    expect(result.feedback).toContain('REJECTED');
  });

  it('returns approved:false for ambiguous output (conservative)', () => {
    const result = parseGateVerdict('The code seems okay but I am not sure.');
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe('Reviewer did not produce a clear verdict.');
  });

  it('returns approved:false when REJECTED appears after APPROVED (last keyword wins)', () => {
    const result = parseGateVerdict('It was almost APPROVED but REJECTED: bad imports.');
    expect(result.approved).toBe(false);
  });

  it('returns approved:true when APPROVED appears after REJECTED', () => {
    // "not REJECTED" prose followed by an explicit APPROVED
    const result = parseGateVerdict('This was nearly REJECTED but ultimately APPROVED');
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runChain — unit tests with mocked runStep
// ---------------------------------------------------------------------------

describe('Runner.runChain (#119)', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('runs steps in order and passes output of step N to step N+1', async () => {
    const registry = buildRegistry([
      makeAgent('core.a'),
      makeAgent('core.b'),
    ]);
    const runner = new Runner(registry);
    const stepOutputs = ['output-from-a', 'output-from-b'];
    let callCount = 0;
    vi.spyOn(runner as any, 'runStep').mockImplementation(async () => ({
      output: stepOutputs[callCount++]!,
      aborted: false,
    }));

    const sseEvents: unknown[] = [];
    const sseWrite = (type: string, data: unknown) => sseEvents.push({ type, data });

    const session = makeSession();
    const result = await runner.runChain(
      [{ agentName: 'core.a' }, { agentName: 'core.b' }],
      session,
      sseWrite as any,
    );

    expect(result.aborted).toBe(false);
    expect(result.finalOutput).toBe('output-from-b');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toEqual({ agentName: 'core.a', output: 'output-from-a' });
    expect(result.steps[1]).toEqual({ agentName: 'core.b', output: 'output-from-b' });

    // chain_step events emitted for each step
    const chainStepEvents = sseEvents.filter((e: any) => e.type === 'chain_step');
    expect(chainStepEvents).toHaveLength(2);
    expect((chainStepEvents[0] as any).data).toEqual({ step: 0, agentName: 'core.a' });
    expect((chainStepEvents[1] as any).data).toEqual({ step: 1, agentName: 'core.b' });

    // step 1 received output from step 0 as input (pass-through)
    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    expect(runStepMock.mock.calls[1][1]).toBe('output-from-a');
  });

  it('aborts early when a step returns aborted:true', async () => {
    const registry = buildRegistry([makeAgent('core.a'), makeAgent('core.b')]);
    const runner = new Runner(registry);
    let callCount = 0;
    vi.spyOn(runner as any, 'runStep').mockImplementation(async () => {
      callCount++;
      return callCount === 1
        ? { output: '', aborted: true, abortReason: 'step-a-failed' }
        : { output: 'should-not-reach', aborted: false };
    });

    const sseWrite = vi.fn();
    const result = await runner.runChain(
      [{ agentName: 'core.a' }, { agentName: 'core.b' }],
      makeSession(),
      sseWrite as any,
    );

    expect(result.aborted).toBe(true);
    expect(result.abortReason).toBe('step-a-failed');
    expect(callCount).toBe(1); // step b never ran
  });

  it('throws ChainDepthExceeded when steps exceed CHAIN_MAX_STEPS', async () => {
    const agents = Array.from({ length: CHAIN_MAX_STEPS + 1 }, (_, i) =>
      makeAgent(`core.agent-${i}`),
    );
    const registry = buildRegistry(agents);
    const runner = new Runner(registry);
    const steps = agents.map((a) => ({ agentName: a.name }));

    await expect(
      runner.runChain(steps, makeSession(), vi.fn() as any),
    ).rejects.toThrow(ChainDepthExceeded);
  });

  it('uses explicit step input instead of previous output when provided', async () => {
    const registry = buildRegistry([makeAgent('core.a'), makeAgent('core.b')]);
    const runner = new Runner(registry);
    vi.spyOn(runner as any, 'runStep').mockResolvedValue({ output: 'irrelevant', aborted: false });

    await runner.runChain(
      [
        { agentName: 'core.a', input: 'explicit-a' },
        { agentName: 'core.b', input: 'explicit-b' },
      ],
      makeSession(),
      vi.fn() as any,
    );

    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    expect(runStepMock.mock.calls[0][1]).toBe('explicit-a');
    expect(runStepMock.mock.calls[1][1]).toBe('explicit-b');
  });
});

// ---------------------------------------------------------------------------
// runWithGate — unit tests
// ---------------------------------------------------------------------------

describe('Runner.runWithGate (#119)', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns finalOutput from generator when reviewer emits APPROVED', async () => {
    const registry = buildRegistry([makeAgent('core.codesmith'), makeAgent('core.reviewer')]);
    const runner = new Runner(registry);
    let callCount = 0;
    vi.spyOn(runner as any, 'runStep').mockImplementation(async () => {
      callCount++;
      return callCount === 1
        ? { output: 'generated-code', aborted: false }
        : { output: 'Looks great. APPROVED', aborted: false };
    });

    const result = await runner.runWithGate(
      { agentName: 'core.codesmith', input: 'Build me a thing' },
      { agentName: 'core.reviewer', gatePrompt: 'Review it.' },
      makeSession(),
      vi.fn() as any,
    );

    expect(result.aborted).toBe(false);
    expect(result.finalOutput).toBe('generated-code');
    expect(result.steps).toHaveLength(2);
  });

  it('aborts with feedback when reviewer emits REJECTED', async () => {
    const registry = buildRegistry([makeAgent('core.codesmith'), makeAgent('core.reviewer')]);
    const runner = new Runner(registry);
    let callCount = 0;
    vi.spyOn(runner as any, 'runStep').mockImplementation(async () => {
      callCount++;
      return callCount === 1
        ? { output: 'bad-code', aborted: false }
        : { output: 'REJECTED: missing error handling.', aborted: false };
    });

    const result = await runner.runWithGate(
      { agentName: 'core.codesmith', input: 'Build me a thing' },
      { agentName: 'core.reviewer', gatePrompt: 'Review it.' },
      makeSession(),
      vi.fn() as any,
    );

    expect(result.aborted).toBe(true);
    expect(result.abortReason).toContain('REJECTED');
    expect(result.finalOutput).toBe('');
  });

  it('treats ambiguous reviewer output as rejection (conservative)', async () => {
    const registry = buildRegistry([makeAgent('core.codesmith'), makeAgent('core.reviewer')]);
    const runner = new Runner(registry);
    let callCount = 0;
    vi.spyOn(runner as any, 'runStep').mockImplementation(async () => {
      callCount++;
      return callCount === 1
        ? { output: 'code', aborted: false }
        : { output: 'I am not entirely sure about this implementation.', aborted: false };
    });

    const result = await runner.runWithGate(
      { agentName: 'core.codesmith', input: 'Build me a thing' },
      { agentName: 'core.reviewer', gatePrompt: 'Review it.' },
      makeSession(),
      vi.fn() as any,
    );

    expect(result.aborted).toBe(true);
    expect(result.abortReason).toBe('Reviewer did not produce a clear verdict.');
  });

  it('passes gatePrompt appended to generator output as reviewer input', async () => {
    const registry = buildRegistry([makeAgent('core.codesmith'), makeAgent('core.reviewer')]);
    const runner = new Runner(registry);
    vi.spyOn(runner as any, 'runStep').mockImplementation(async (_name: string, input: string) => ({
      output: input.includes('gatePrompt') ? 'APPROVED' : 'generated',
      aborted: false,
    }));

    await runner.runWithGate(
      { agentName: 'core.codesmith', input: 'spec' },
      { agentName: 'core.reviewer', gatePrompt: 'gatePrompt text' },
      makeSession(),
      vi.fn() as any,
    );

    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    const reviewerInput: string = runStepMock.mock.calls[1][1];
    expect(reviewerInput).toContain('generated');
    expect(reviewerInput).toContain('gatePrompt text');
  });

  it('aborts immediately when generator step is aborted', async () => {
    const registry = buildRegistry([makeAgent('core.codesmith'), makeAgent('core.reviewer')]);
    const runner = new Runner(registry);
    vi.spyOn(runner as any, 'runStep').mockResolvedValue({
      output: '',
      aborted: true,
      abortReason: 'generator-error',
    });

    const result = await runner.runWithGate(
      { agentName: 'core.codesmith', input: 'spec' },
      { agentName: 'core.reviewer', gatePrompt: 'review' },
      makeSession(),
      vi.fn() as any,
    );

    expect(result.aborted).toBe(true);
    expect(result.abortReason).toBe('generator-error');
    // reviewer never ran
    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    expect(runStepMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// run() — deterministic codesmith→reviewer wiring
// ---------------------------------------------------------------------------

describe('Runner.run() — codesmith→reviewer deterministic chain (#119)', () => {
  beforeEach(() => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-4o-mini');
    vi.stubEnv('KICKSTART_CODEX_MODEL', 'gpt-4o-mini');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('emits chain_step for core.reviewer after codesmith completes', async () => {
    const registry = buildRegistry([
      makeAgent('core.codesmith'),
      makeAgent('core.reviewer'),
    ]);
    const runner = new Runner(registry);

    // Stub runStep so reviewer appears to approve
    vi.spyOn(runner as any, 'runStep').mockResolvedValue({
      output: 'APPROVED',
      aborted: false,
    });

    // Stub the full internal SDK run to simulate codesmith producing output
    // by intercepting the inner try-block via a mock on the SDK runner.
    // We poke the private method path instead:
    const sseEvents: Array<{ type: string; data: unknown }> = [];
    const sseWrite = (type: string, data: unknown) => sseEvents.push({ type, data });

    const session = makeSession('core.codesmith');

    // Bypass the real LLM call by spying on buildAgentInstance to return a
    // minimal stub agent, and mocking getSdkRunner().run() to emit nothing.
    // Since we already stub `runStep`, the real test is whether `run()` calls
    // `runStep` with agentName='core.reviewer' after codesmith completes.
    //
    // To avoid hitting real OpenAI, we mock the whole inner SDK run by
    // intercepting the private run path:
    const { Runner: SDKRunnerClass } = await import('@openai/agents');
    const mockResult = {
      [Symbol.asyncIterator]: async function* () { /* no events */ },
      finalOutput: Promise.resolve({ message: 'Files generated.', intent: 'continue' }),
    };
    vi.spyOn(SDKRunnerClass.prototype, 'run').mockResolvedValue(mockResult as any);

    await runner.run(session, 'build me something', sseWrite as any);

    const chainStepEvents = sseEvents.filter((e) => e.type === 'chain_step');
    expect(chainStepEvents.length).toBeGreaterThanOrEqual(1);
    expect((chainStepEvents[0]?.data as any)?.agentName).toBe('core.reviewer');

    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    expect(runStepMock).toHaveBeenCalledWith(
      'core.reviewer',
      expect.any(String),
      session,
      expect.any(Function),
      undefined,
    );
  });

  it('emits CHAIN_REJECTED error when reviewer rejects', async () => {
    const registry = buildRegistry([
      makeAgent('core.codesmith'),
      makeAgent('core.reviewer'),
    ]);
    const runner = new Runner(registry);

    vi.spyOn(runner as any, 'runStep').mockResolvedValue({
      output: 'REJECTED: missing tests.',
      aborted: false,
    });

    const sseEvents: Array<{ type: string; data: unknown }> = [];
    const sseWrite = (type: string, data: unknown) => sseEvents.push({ type, data });
    const session = makeSession('core.codesmith');

    const { Runner: SDKRunnerClass } = await import('@openai/agents');
    const mockResult = {
      [Symbol.asyncIterator]: async function* () {},
      finalOutput: Promise.resolve({ message: 'Done.', intent: 'continue' }),
    };
    vi.spyOn(SDKRunnerClass.prototype, 'run').mockResolvedValue(mockResult as any);

    await runner.run(session, 'build me something', sseWrite as any);

    const errorEvents = sseEvents.filter((e) => e.type === 'error');
    const chainRejected = errorEvents.find((e) => (e.data as any)?.code === 'CHAIN_REJECTED');
    expect(chainRejected).toBeDefined();
  });

  it('does NOT emit chain_step when active agent is not core.codesmith', async () => {
    const registry = buildRegistry([makeAgent('core.reviewer')]);
    const runner = new Runner(registry);

    vi.spyOn(runner as any, 'runStep');

    const sseEvents: Array<{ type: string; data: unknown }> = [];
    const sseWrite = (type: string, data: unknown) => sseEvents.push({ type, data });
    const session = makeSession('core.reviewer');

    const { Runner: SDKRunnerClass } = await import('@openai/agents');
    const mockResult = {
      [Symbol.asyncIterator]: async function* () {},
      finalOutput: Promise.resolve({ message: 'Done.', intent: 'continue' }),
    };
    vi.spyOn(SDKRunnerClass.prototype, 'run').mockResolvedValue(mockResult as any);

    await runner.run(session, 'review please', sseWrite as any);

    const chainStepEvents = sseEvents.filter((e) => e.type === 'chain_step');
    expect(chainStepEvents).toHaveLength(0);

    const runStepMock = (runner as any).runStep as ReturnType<typeof vi.fn>;
    expect(runStepMock).not.toHaveBeenCalled();
  });
});
