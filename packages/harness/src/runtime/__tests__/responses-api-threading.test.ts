/**
 * #126 / #114 Phase 3 — Responses API thread ID persistence.
 *
 * Verifies that when KICKSTART_USE_RESPONSES=1:
 *  - Turn 1: full history is sent (no responseId yet) and the returned
 *    `lastResponseId` is stored on the session.
 *  - Turn 2: `previousResponseId` is passed to the SDK instead of full history,
 *    and the session responseId is updated to the new value.
 *
 * When KICKSTART_USE_RESPONSES is off:
 *  - Full history is always sent and `session.responseId` is never touched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Capture every sdkRunner.run() call ───────────────────────────────────────
const runCalls: Array<{ agent: unknown; input: unknown; options: unknown }> = [];
let fakeResponseIdCounter = 0;

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');

  class FakeStreamResult implements AsyncIterable<never> {
    finalOutput: Promise<{ message: string; intent?: string }>;
    lastResponseId: string | undefined;
    constructor(message: string, responseId?: string) {
      this.finalOutput = Promise.resolve({ message });
      this.lastResponseId = responseId;
    }
    async *[Symbol.asyncIterator](): AsyncIterator<never> {
      return;
    }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeStreamResult> {
      runCalls.push({ agent, input, options });
      fakeResponseIdCounter++;
      return new FakeStreamResult(
        `assistant-reply-${runCalls.length}`,
        `resp_${fakeResponseIdCounter}`,
      );
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

function makeSSEWriter(): SSEWriter {
  return ((_event: string, _data: unknown) => {}) as SSEWriter;
}

describe('#126 Responses API thread ID persistence', () => {
  beforeEach(() => {
    runCalls.length = 0;
    fakeResponseIdCounter = 0;
  });

  describe('flag ON (KICKSTART_USE_RESPONSES=1)', () => {
    beforeEach(() => {
      vi.stubEnv('KICKSTART_USE_RESPONSES', '1');
    });

    it('turn 1: sends full history (no previousResponseId) and stores lastResponseId on session', async () => {
      const registry = makeFakeRegistry();
      const runner = new Runner(registry);
      const session = new Session({ sessionId: 's1', user: { oid: 'u1' } });
      const sse = makeSSEWriter();

      expect(session.responseId).toBeUndefined();

      await runner.run(session, 'hello', sse);

      expect(runCalls).toHaveLength(1);
      // First turn: no previousResponseId → full history input
      const opts = runCalls[0].options as Record<string, unknown>;
      expect(opts['previousResponseId']).toBeUndefined();
      // Input should be an array (full history path), not a plain string
      expect(Array.isArray(runCalls[0].input)).toBe(true);
      // Session should now have the response ID from the SDK
      expect(session.responseId).toBe('resp_1');
    });

    it('turn 2: passes previousResponseId and sends only the new message (not full history)', async () => {
      const registry = makeFakeRegistry();
      const runner = new Runner(registry);
      const session = new Session({ sessionId: 's2', user: { oid: 'u1' } });
      const sse = makeSSEWriter();

      // Turn 1
      await runner.run(session, 'first message', sse);
      expect(session.responseId).toBe('resp_1');

      // Turn 2
      await runner.run(session, 'second message', sse);

      expect(runCalls).toHaveLength(2);
      const opts2 = runCalls[1].options as Record<string, unknown>;
      // Should now pass the previous response ID
      expect(opts2['previousResponseId']).toBe('resp_1');
      // Input should be the plain user message string, not the full history array
      expect(runCalls[1].input).toBe('second message');
      // Session should be updated with the newest response ID
      expect(session.responseId).toBe('resp_2');
    });

    it('updates responseId on each turn', async () => {
      const registry = makeFakeRegistry();
      const runner = new Runner(registry);
      const session = new Session({ sessionId: 's3', user: { oid: 'u1' } });
      const sse = makeSSEWriter();

      await runner.run(session, 'turn 1', sse);
      expect(session.responseId).toBe('resp_1');

      await runner.run(session, 'turn 2', sse);
      expect(session.responseId).toBe('resp_2');

      await runner.run(session, 'turn 3', sse);
      expect(session.responseId).toBe('resp_3');

      // Turn 3 should use resp_2 as previousResponseId
      const opts3 = runCalls[2].options as Record<string, unknown>;
      expect(opts3['previousResponseId']).toBe('resp_2');
    });
  });

  describe('flag OFF (KICKSTART_USE_RESPONSES unset)', () => {
    beforeEach(() => {
      vi.stubEnv('KICKSTART_USE_RESPONSES', '');
    });

    it('always sends full history array regardless of session.responseId', async () => {
      const registry = makeFakeRegistry();
      const runner = new Runner(registry);
      const session = new Session({ sessionId: 's4', user: { oid: 'u1' } });
      const sse = makeSSEWriter();

      await runner.run(session, 'turn 1', sse);
      await runner.run(session, 'turn 2', sse);

      // Both turns should use full history array input
      expect(Array.isArray(runCalls[0].input)).toBe(true);
      expect(Array.isArray(runCalls[1].input)).toBe(true);

      // No previousResponseId should ever be passed
      const opts1 = runCalls[0].options as Record<string, unknown>;
      const opts2 = runCalls[1].options as Record<string, unknown>;
      expect(opts1['previousResponseId']).toBeUndefined();
      expect(opts2['previousResponseId']).toBeUndefined();

      // session.responseId must NOT be set
      expect(session.responseId).toBeUndefined();
    });
  });
});
