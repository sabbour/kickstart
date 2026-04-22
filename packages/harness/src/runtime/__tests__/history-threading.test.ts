/**
 * #1062 Layer 0 — harness multi-turn conversation history regression guard.
 *
 * Nibbler gap 2 (DP v3 test strategy item 8): simulate a 3-turn conversation
 * against a mocked `@openai/agents` Runner and assert that on turn 3 the SDK
 * receives BOTH turn 1 and turn 2 items in its input array (user + assistant
 * alternation), including the button-click event that landed as turn 2's user
 * message. If history threading ever regresses, this test fails.
 *
 * Also codifies:
 *   - Z1: only user/assistant roles replayed to the SDK.
 *   - Z2: sanitized text (not raw userMessage) lands in `session.recentTurns`.
 *   - Feature-flag OFF fallback: SDK still receives only the current message.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the SDK so `sdkRunner.run()` returns an empty stream we can inspect ──
// We capture every call's `input` argument for later assertions.
const runCalls: Array<{ agent: unknown; input: unknown; options: unknown }> = [];

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');

  class FakeStreamResult implements AsyncIterable<never> {
    finalOutput: Promise<{ message: string; intent?: string }>;
    constructor(message: string) {
      this.finalOutput = Promise.resolve({ message });
    }
    async *[Symbol.asyncIterator](): AsyncIterator<never> {
      // No stream events — keeps the test hermetic.
      return;
    }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeStreamResult> {
      runCalls.push({ agent, input, options });
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

// Import AFTER vi.mock so the runner picks up the mocked SDKRunner.
const { Runner } = await import('../runner.js');
const { Session } = await import('../session.js');
import type { SSEWriter } from '../sse.js';

// ── Minimal fake PackRegistry ────────────────────────────────────────────────
type RegistryArg = ConstructorParameters<typeof Runner>[0];

function makeFakeRegistry(): RegistryArg {
  return {
    getAgent: (name: string) => ({
      name,
      instructionsBase: 'You are a test agent.',
      model: { id: 'gpt-test' },
      toolAllowlist: [],
    }),
    getGuardrailsByStage: () => [],
    getToolsForAgent: () => [],
    getSkillsForAgent: () => [],
    get components() {
      return [];
    },
  } as unknown as RegistryArg;
}

function makeSSEWriter(bucket: Array<{ event: string; data: unknown }>): SSEWriter {
  return ((event, data) => {
    bucket.push({ event, data });
  }) as SSEWriter;
}

describe('#1062 Layer 0 — harness conversation history threading', () => {
  beforeEach(() => {
    runCalls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flag ON: turn 3 SDK input contains turn-1 + turn-2 history (regression guard)', async () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '1');

    const registry = makeFakeRegistry();
    const runner = new Runner(registry);
    const session = new Session({ sessionId: 's1', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];
    const sse = makeSSEWriter(events);

    // Turn 1 — human types a message.
    await runner.run(session, 'I want to build a new app', sse);
    // Turn 2 — simulated button-click synthesized prompt.
    await runner.run(session, 'button click: build new', sse);
    // Turn 3 — user types again.
    await runner.run(session, 'use aks automatic', sse);

    expect(runCalls).toHaveLength(3);

    // Turn 1 input: a single user item.
    const t1Input = runCalls[0].input as Array<{ role: string; content: unknown }>;
    expect(Array.isArray(t1Input)).toBe(true);
    expect(t1Input).toHaveLength(1);
    expect(t1Input[0]).toMatchObject({ role: 'user', content: 'I want to build a new app' });

    // Turn 2 input: turn-1 user + turn-1 assistant + turn-2 user.
    const t2Input = runCalls[1].input as Array<{ role: string }>;
    expect(t2Input.map((i) => i.role)).toEqual(['user', 'assistant', 'user']);

    // Turn 3 input: full 5-item conversation.
    const t3Input = runCalls[2].input as Array<{ role: string; content: unknown; status?: string }>;
    expect(t3Input.map((i) => i.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ]);
    expect(t3Input[0]).toMatchObject({ role: 'user', content: 'I want to build a new app' });
    expect(t3Input[2]).toMatchObject({ role: 'user', content: 'button click: build new' });
    expect(t3Input[4]).toMatchObject({ role: 'user', content: 'use aks automatic' });
    expect(t3Input[1]).toMatchObject({
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'assistant-reply-1' }],
    });
  });

  it('flag OFF: SDK receives only the current message (byte-compat fallback)', async () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '0');

    const registry = makeFakeRegistry();
    const runner = new Runner(registry);
    const session = new Session({ sessionId: 's2', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];
    const sse = makeSSEWriter(events);

    await runner.run(session, 'first', sse);
    await runner.run(session, 'second', sse);

    expect(runCalls).toHaveLength(2);
    expect(typeof runCalls[0].input).toBe('string');
    expect(runCalls[0].input).toBe('first');
    expect(typeof runCalls[1].input).toBe('string');
    expect(runCalls[1].input).toBe('second');

    // Turns are still recorded (sanitized) regardless of flag — Z2.
    expect(session.recentTurns.map((t) => t.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('Z2: sanitized text (guardedMessage) is what lands in recentTurns, not raw userMessage', async () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '1');

    const registry = {
      getAgent: (name: string) => ({
        name,
        instructionsBase: 'test',
        model: { id: 'gpt-test' },
        toolAllowlist: [],
      }),
      // Input guardrail that redacts "SECRET123".
      getGuardrailsByStage: (stage: string) => {
        if (stage !== 'input') return [];
        return [
          {
            id: 'test.redact',
            stages: ['input'],
            appliesTo: ['*'],
            evaluate: async (input: { stage: string; userMessage: string }) => {
              if (input.userMessage.includes('SECRET123')) {
                return {
                  verdict: 'redact',
                  redacted: input.userMessage.replace(/SECRET123/g, '[redacted]'),
                };
              }
              return { verdict: 'pass' };
            },
          },
        ];
      },
      getToolsForAgent: () => [],
      getSkillsForAgent: () => [],
      get components() {
        return [];
      },
    } as unknown as RegistryArg;

    const runner = new Runner(registry);
    const session = new Session({ sessionId: 's3', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];
    const sse = makeSSEWriter(events);

    await runner.run(session, 'my password is SECRET123 please help', sse);

    const userTurn = session.recentTurns.find((t) => t.role === 'user');
    expect(userTurn).toBeDefined();
    expect(userTurn!.content).not.toContain('SECRET123');
    expect(userTurn!.content).toContain('[redacted]');

    const sdkInput = runCalls[0].input as Array<{ role: string; content: unknown }>;
    const replayedUser = sdkInput.find((i) => i.role === 'user') as { content: string } | undefined;
    expect(replayedUser?.content).not.toContain('SECRET123');
  });

  it('Z1: tool and system turns in history are dropped from the SDK input', async () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '1');

    const registry = makeFakeRegistry();
    const runner = new Runner(registry);
    const session = new Session({ sessionId: 's4', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];
    const sse = makeSSEWriter(events);

    // Seed the history with non-replayable roles.
    session.recordTurn({ role: 'tool', content: '{"ok":true}' });
    session.recordTurn({ role: 'system', content: 'reminder: be concise' });

    await runner.run(session, 'next user message', sse);

    const sdkInput = runCalls[0].input as Array<{ role: string }>;
    const roles = sdkInput.map((i) => i.role);
    expect(roles).not.toContain('tool');
    expect(roles).not.toContain('system');
    expect(roles).toEqual(['user']);
  });
});
