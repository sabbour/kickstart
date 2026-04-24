/**
 * Runner integration for issue #16 — default chat model resolution.
 *
 * Covers:
 * - Chat-tier agents use the built-in gpt-5.4 default when Azure is fully configured (endpoint+key) and no override is set
 * - Chat-tier agents fail closed when neither Azure nor explicit model is configured
 * - KICKSTART_CHAT_MODEL still takes precedence when provided
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCalls: Array<{
  agent: { model?: string };
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
    async *[Symbol.asyncIterator](): AsyncIterator<never> {
      return;
    }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeStreamResult> {
      runCalls.push({ agent: agent as { model?: string }, input, options });
      return new FakeStreamResult('assistant-reply');
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
import type { SSEWriter } from '../sse.js';

type RegistryArg = ConstructorParameters<typeof Runner>[0];

function makeFakeRegistry(): RegistryArg {
  return {
    getAgent: (name: string) => ({
      name,
      instructionsBase: 'You are a chat-tier test agent.',
      model: { envVar: 'KICKSTART_CHAT_MODEL' },
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

function sse(bucket: Array<{ event: string; data: unknown }>): SSEWriter {
  return ((event, data) => bucket.push({ event, data })) as SSEWriter;
}

function findEnd(events: Array<{ event: string; data: unknown }>): Record<string, unknown> | undefined {
  return events.find((event) => event.event === 'end')?.data as Record<string, unknown> | undefined;
}

describe('Runner chat-tier model resolution', () => {
  beforeEach(() => {
    runCalls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses gpt-5.4 for chat-tier agents when Azure is fully configured and no override is set', async () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://my.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 'runner-default-chat-model', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await runner.run(session, 'hello', sse(events));

    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].agent.model).toBe('gpt-5.4');
    expect(findEnd(events)?.model).toBe('gpt-5.4');
  });

  it('fails closed when neither Azure nor explicit model is configured', async () => {
    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 'runner-fail-closed', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await expect(runner.run(session, 'hello', sse(events))).rejects.toThrow(
      'Agent model is not configured',
    );

    // Should NOT have called the SDK runner
    expect(runCalls).toHaveLength(0);
  });

  it('uses KICKSTART_CHAT_MODEL when an override is configured', async () => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'custom-model');

    const runner = new Runner(makeFakeRegistry());
    const session = new Session({ sessionId: 'runner-custom-chat-model', user: { oid: 'u1' } });
    const events: Array<{ event: string; data: unknown }> = [];

    await runner.run(session, 'hello', sse(events));

    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].agent.model).toBe('custom-model');
    expect(findEnd(events)?.model).toBe('custom-model');
  });
});
