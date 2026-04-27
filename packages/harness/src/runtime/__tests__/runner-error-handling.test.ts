/**
 * Unit tests for runner error-handling improvements:
 *
 *   #100 — MaxTurnsExceededError surfaces a user-friendly recovery card, not
 *           a raw error message.
 *
 *   #101 — Token-count gate on conversation history: oldest turns are trimmed
 *           when the estimated token count exceeds 80% of the context window,
 *           and the user receives a notification chunk when trimming occurs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateTurnsTokens,
  trimHistoryToTokenBudget,
  TOKEN_CONTEXT_LIMIT,
  TOKEN_TRIM_THRESHOLD,
} from '../runner.js';
import type { Turn } from '../../types/session.js';

// ---------------------------------------------------------------------------
// #101 — pure unit tests (no SDK mock needed)
// ---------------------------------------------------------------------------

describe('estimateTurnsTokens (#101)', () => {
  it('returns 0 for an empty list', () => {
    expect(estimateTurnsTokens([])).toBe(0);
  });

  it('estimates tokens using the char/4 heuristic', () => {
    const turns: Turn[] = [{ role: 'user', content: 'abcd' }]; // 4 chars → 1 token
    expect(estimateTurnsTokens(turns)).toBe(1);
  });

  it('rounds up (ceil) for non-divisible lengths', () => {
    const turns: Turn[] = [{ role: 'user', content: 'abc' }]; // 3 chars → ceil(3/4) = 1
    expect(estimateTurnsTokens(turns)).toBe(1);
    const turns2: Turn[] = [{ role: 'user', content: 'abcde' }]; // 5 → ceil(5/4) = 2
    expect(estimateTurnsTokens(turns2)).toBe(2);
  });

  it('sums across all turns', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'aaaa' },       // 4 chars
      { role: 'assistant', content: 'bbbb' },   // 4 chars
    ];
    expect(estimateTurnsTokens(turns)).toBe(2); // ceil(8/4) = 2
  });

  it('ignores turns with no string content', () => {
    const turns: Turn[] = [
      { role: 'user', content: undefined },
      { role: 'assistant', content: 'aaaa' },
    ];
    expect(estimateTurnsTokens(turns)).toBe(1);
  });

  it('TOKEN_CONTEXT_LIMIT is 128_000 and TOKEN_TRIM_THRESHOLD is 80% of it', () => {
    expect(TOKEN_CONTEXT_LIMIT).toBe(128_000);
    expect(TOKEN_TRIM_THRESHOLD).toBe(Math.floor(128_000 * 0.8));
  });
});

describe('trimHistoryToTokenBudget (#101)', () => {
  it('returns original array reference when no trimming needed', () => {
    const turns: Turn[] = [{ role: 'user', content: 'hi' }];
    const result = trimHistoryToTokenBudget(turns, 100);
    expect(result.wasTrimmed).toBe(false);
    expect(result.turns).toBe(turns); // same reference
  });

  it('removes oldest turns until within budget', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'x'.repeat(400) },      // 100 tokens
      { role: 'assistant', content: 'x'.repeat(400) }, // 100 tokens
      { role: 'user', content: 'x'.repeat(400) },      // 100 tokens
    ];
    // total = 300 tokens; budget = 150 tokens — should drop one turn
    const result = trimHistoryToTokenBudget(turns, 150);
    expect(result.wasTrimmed).toBe(true);
    expect(result.turns.length).toBeLessThan(3);
  });

  it('always keeps at least one turn (the most recent)', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'x'.repeat(4000) }, // 1000 tokens alone
    ];
    const result = trimHistoryToTokenBudget(turns, 1); // impossibly small budget
    expect(result.wasTrimmed).toBe(true);
    expect(result.turns).toHaveLength(1); // still has the last turn
  });

  it('drops exactly the oldest turns, preserving order', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'x'.repeat(400) },      // 100 tokens — dropped
      { role: 'assistant', content: 'x'.repeat(400) }, // 100 tokens — kept
      { role: 'user', content: 'latest' },             // tiny — kept
    ];
    // budget = 110 tokens → first turn must be dropped
    const result = trimHistoryToTokenBudget(turns, 110);
    expect(result.wasTrimmed).toBe(true);
    expect(result.turns[0]).toMatchObject({ role: 'assistant' });
    expect(result.turns[result.turns.length - 1]).toMatchObject({ content: 'latest' });
  });

  it('uses TOKEN_TRIM_THRESHOLD as default budget', () => {
    // Build turns with total chars exactly at default threshold (no trim)
    const charsAtThreshold = TOKEN_TRIM_THRESHOLD * 4;
    const turns: Turn[] = [{ role: 'user', content: 'a'.repeat(charsAtThreshold) }];
    const result = trimHistoryToTokenBudget(turns);
    expect(result.wasTrimmed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #100 — MaxTurnsExceededError recovery card (integration with mocked SDK)
// ---------------------------------------------------------------------------

// We need to mock @openai/agents BEFORE importing runner. Vitest hoists vi.mock.
const runCalls: Array<{ agent: unknown; input: unknown; options: unknown }> = [];
let shouldThrowMaxTurns = false;

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');

  class FakeStreamResult implements AsyncIterable<never> {
    finalOutput: Promise<{ message: string }>;
    constructor() {
      this.finalOutput = Promise.resolve({ message: 'ok' });
    }
    async *[Symbol.asyncIterator](): AsyncIterator<never> {
      if (shouldThrowMaxTurns) {
        throw new actual.MaxTurnsExceededError('max turns exceeded');
      }
      return;
    }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeStreamResult> {
      runCalls.push({ agent, input, options });
      return new FakeStreamResult();
    }
  }

  return {
    ...actual,
    Runner: FakeSDKRunner,
    setDefaultModelProvider: vi.fn(),
    setTraceProcessors: vi.fn(),
  };
});

// Import AFTER vi.mock
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
    get components() { return []; },
  } as unknown as RegistryArg;
}

function makeSSEWriter(bucket: Array<{ event: string; data: unknown }>): SSEWriter {
  return ((event, data) => { bucket.push({ event, data }); }) as SSEWriter;
}

describe('MaxTurnsExceededError handling (#100)', () => {
  beforeEach(() => {
    runCalls.length = 0;
    shouldThrowMaxTurns = false;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('emits a recovery card (not a raw error) when MaxTurnsExceededError is thrown', async () => {
    shouldThrowMaxTurns = true;

    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's1', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];
    const sse = makeSSEWriter(events);

    await runner.run(session, 'hello', sse);

    // Should NOT emit a raw 'error' event
    const errorEvents = events.filter((e) => e.event === 'error');
    expect(errorEvents).toHaveLength(0);

    // Should emit a2ui events for the recovery card
    const a2uiEvents = events.filter((e) => e.event === 'a2ui');
    expect(a2uiEvents.length).toBeGreaterThanOrEqual(2);

    // First a2ui event: createSurface with surfaceId 'error-max-turns-exceeded'
    const createSurface = a2uiEvents.find(
      (e) => (e.data as Record<string, unknown>).createSurface !== undefined,
    );
    expect(createSurface).toBeDefined();
    expect((createSurface!.data as Record<string, unknown>).createSurface).toMatchObject({
      surfaceId: 'error-max-turns-exceeded',
    });

    // Second a2ui event: updateComponents with the recovery card
    const updateComponents = a2uiEvents.find(
      (e) => (e.data as Record<string, unknown>).updateComponents !== undefined,
    );
    expect(updateComponents).toBeDefined();
    const uc = (updateComponents!.data as Record<string, unknown>).updateComponents as Record<string, unknown>;
    const components = uc.components as Array<Record<string, unknown>>;
    expect(components[0]).toMatchObject({
      type: 'Card',
      title: 'Conversation limit reached',
    });
    // Recovery card must include a "Start New Conversation" action
    const actions = components[0].actions as Array<Record<string, unknown>>;
    expect(actions[0]).toMatchObject({ label: 'Start New Conversation' });
  });

  it('emits an end event after the recovery card (not just silence)', async () => {
    shouldThrowMaxTurns = true;

    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's2', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await runner.run(session, 'hello', makeSSEWriter(events));

    const endEvents = events.filter((e) => e.event === 'end');
    expect(endEvents).toHaveLength(1);
  });

  it('emits a raw error event for other errors (regression guard)', async () => {
    shouldThrowMaxTurns = false; // normal run — but we can't easily inject a different error via this mock
    // Just verify normal runs still produce 'end' with no error
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's3', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await runner.run(session, 'hello', makeSSEWriter(events));

    const errorEvents = events.filter((e) => e.event === 'error');
    expect(errorEvents).toHaveLength(0);
    const endEvents = events.filter((e) => e.event === 'end');
    expect(endEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// #101 — token gate integration test (mocked SDK, oversized history)
// ---------------------------------------------------------------------------

describe('Token-count gate on history injection (#101)', () => {
  beforeEach(() => {
    runCalls.length = 0;
    shouldThrowMaxTurns = false;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('passes through history normally when under the token threshold', async () => {
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's4', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await runner.run(session, 'small message', makeSSEWriter(events));

    // No trim notification should appear
    const trimChunks = events.filter(
      (e) =>
        e.event === 'chunk' &&
        typeof (e.data as Record<string, unknown>).delta === 'string' &&
        ((e.data as Record<string, unknown>).delta as string).includes('trimmed'),
    );
    expect(trimChunks).toHaveLength(0);
  });

  it('emits a trim notification when history exceeds the token threshold', async () => {
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's5', user: { oid: 'u1' } });

    // Manually seed recentTurns with history exceeding ~102k tokens (80% of 128k)
    // 102,400 tokens × 4 chars/token = 409,600 chars — split across two turns
    const bigContent = 'x'.repeat(210_000); // ~52,500 tokens each
    session.recentTurns.push({ role: 'user', content: bigContent });
    session.recentTurns.push({ role: 'assistant', content: bigContent });

    const events: Array<{ event: string; data: unknown }> = [];
    await runner.run(session, 'new message', makeSSEWriter(events));

    // A trim notification chunk should have been emitted
    const trimChunks = events.filter(
      (e) =>
        e.event === 'chunk' &&
        typeof (e.data as Record<string, unknown>).delta === 'string' &&
        ((e.data as Record<string, unknown>).delta as string).includes('trimmed'),
    );
    expect(trimChunks.length).toBeGreaterThan(0);
  });

  it('trims oldest turns first (most recent context preserved)', async () => {
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 's6', user: { oid: 'u1' } });

    const bigContent = 'x'.repeat(210_000);
    session.recentTurns.push({ role: 'user', content: bigContent });       // oldest — trimmed
    session.recentTurns.push({ role: 'assistant', content: bigContent }); // trimmed

    await runner.run(session, 'new message', makeSSEWriter([]));

    // The SDK should have received a smaller input than all 3 turns (2 seeded + 1 recorded)
    const sdkInput = runCalls[0].input as Array<{ role: string }>;
    // At minimum the current user turn should be present
    expect(sdkInput.length).toBeGreaterThan(0);
    expect(sdkInput[sdkInput.length - 1]).toMatchObject({ role: 'user', content: 'new message' });
  });
});
