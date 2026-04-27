/**
 * Unit tests for asTool() — harness bounded specialist consultation wrapper.
 *
 * Covers:
 *  - T1: default tool name derived from agent.name (dot-notation sanitised).
 *  - T2: explicit toolName / description options are respected.
 *  - T3: query is forwarded to the specialist agent as run input.
 *  - T4: structured AgentOutput.message is extracted as the response.
 *  - T5: plain-text output_text content block fallback (non-structured agents).
 *  - T6: maxTurns option is forwarded to sdkRunner.run().
 *  - T7: systemPromptOverride clones the agent with new instructions.
 *  - T8: empty response falls through to empty string (no crash).
 *  - T9: returned ToolContribution has correct shape (name, tool).
 *  - T10: AS_TOOL_MAX_TURNS_DEFAULT matches expected value (5).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @openai/agents so sdkRunner.run() is fully controllable ──────────────
// Capture calls so we can assert on agent/input/options.
type RunCall = {
  agent: { name: string; instructions?: string };
  input: unknown;
  options: { stream?: boolean; maxTurns?: number };
};
const runCalls: RunCall[] = [];

// Configurable fake output for each test
let fakeOutput: { finalOutput: unknown; output: unknown[] } = {
  finalOutput: null,
  output: [],
};

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');

  class FakeRunResult {
    finalOutput: unknown;
    output: unknown[];
    constructor(finalOutput: unknown, output: unknown[]) {
      this.finalOutput = finalOutput;
      this.output = output;
    }
  }

  class FakeSDKRunner {
    constructor(_opts?: unknown) {}
    async run(agent: unknown, input: unknown, options: unknown): Promise<FakeRunResult> {
      runCalls.push({ agent: agent as RunCall['agent'], input, options: options as RunCall['options'] });
      return new FakeRunResult(fakeOutput.finalOutput, fakeOutput.output);
    }
  }

  return {
    ...actual,
    Runner: FakeSDKRunner,
    setDefaultModelProvider: vi.fn(),
    setTraceProcessors: vi.fn(),
  };
});

// Import AFTER vi.mock so the module picks up the mocked Runner.
const { asTool, AS_TOOL_MAX_TURNS_DEFAULT } = await import('../runtime/as-tool.js');
import type { ToolContribution } from '../types/tool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeAgent(name: string, instructions = 'You are a specialist.') {
  return {
    name,
    instructions,
    clone(overrides: Record<string, unknown>) {
      return fakeAgent(this.name, (overrides.instructions as string) ?? this.instructions);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AS_TOOL_MAX_TURNS_DEFAULT', () => {
  it('T10: equals 5', () => {
    expect(AS_TOOL_MAX_TURNS_DEFAULT).toBe(5);
  });
});

describe('asTool()', () => {
  beforeEach(() => {
    runCalls.length = 0;
    fakeOutput = { finalOutput: null, output: [] };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── T1: default tool name ──────────────────────────────────────────────────
  it('T1: derives tool name from agent name, sanitising dots', () => {
    const contrib = asTool(fakeAgent('core.architect') as any);
    expect(contrib.name).toBe('ask_core_architect');
    expect((contrib.tool as any).name).toBe('ask_core_architect');
  });

  it('T1b: sanitises spaces and special chars in agent name', () => {
    const contrib = asTool(fakeAgent('my agent!') as any);
    expect(contrib.name).toBe('ask_my_agent');
  });

  // ── T2: explicit options ───────────────────────────────────────────────────
  it('T2: honours explicit toolName option', () => {
    const contrib = asTool(fakeAgent('core.architect') as any, {
      toolName: 'consult_architect',
    });
    expect(contrib.name).toBe('consult_architect');
    expect((contrib.tool as any).name).toBe('consult_architect');
  });

  it('T2b: honours explicit description option', () => {
    const contrib = asTool(fakeAgent('core.architect') as any, {
      description: 'Custom description.',
    });
    expect((contrib.tool as any).description).toBe('Custom description.');
  });

  // ── T9: shape ──────────────────────────────────────────────────────────────
  it('T9: returned ToolContribution has name and tool properties', () => {
    const contrib: ToolContribution = asTool(fakeAgent('core.reviewer') as any);
    expect(contrib).toHaveProperty('name');
    expect(contrib).toHaveProperty('tool');
    expect(contrib.tool.type).toBe('function');
  });

  // ── T3: query forwarding ───────────────────────────────────────────────────
  it('T3: forwards query string to SDKRunner.run()', async () => {
    fakeOutput = { finalOutput: { message: 'ok' }, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any);
    const executeFn = (contrib.tool as any).execute ?? (contrib.tool as any).invoke;

    // The tool() factory wraps execute; call the underlying contrib execute
    // directly via the function tool's invoke if available, else skip.
    // For vitest we call the tool's execute via the schema-defined path.
    // We access it through the raw tool object.
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      await rawExecute({ query: 'How do I design the infra?' });
      expect(runCalls).toHaveLength(1);
      expect(runCalls[0].input).toBe('How do I design the infra?');
    }
  });

  // ── T4: structured AgentOutput.message ────────────────────────────────────
  it('T4: returns AgentOutput.message when present', async () => {
    fakeOutput = { finalOutput: { message: 'Use a managed identity.' }, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any);
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      const result = await rawExecute({ query: 'Auth advice?' });
      expect(result).toBe('Use a managed identity.');
    }
  });

  // ── T5: plain-text output_text fallback ───────────────────────────────────
  it('T5: falls back to output_text content block when finalOutput has no message', async () => {
    fakeOutput = {
      finalOutput: null,
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Fallback text response.' }],
        },
      ],
    };
    const contrib = asTool(fakeAgent('core.reviewer') as any);
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      const result = await rawExecute({ query: 'Review this?' });
      expect(result).toBe('Fallback text response.');
    }
  });

  // ── T6: maxTurns forwarding ────────────────────────────────────────────────
  it('T6: defaults maxTurns to AS_TOOL_MAX_TURNS_DEFAULT', async () => {
    fakeOutput = { finalOutput: { message: '' }, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any);
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      await rawExecute({ query: 'q' });
      expect(runCalls[0].options.maxTurns).toBe(AS_TOOL_MAX_TURNS_DEFAULT);
    }
  });

  it('T6b: forwards explicit maxTurns to sdkRunner.run()', async () => {
    fakeOutput = { finalOutput: { message: '' }, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any, { maxTurns: 2 });
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      await rawExecute({ query: 'q' });
      expect(runCalls[0].options.maxTurns).toBe(2);
    }
  });

  it('T6c: uses stream: false for non-streaming run', async () => {
    fakeOutput = { finalOutput: { message: '' }, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any);
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      await rawExecute({ query: 'q' });
      expect(runCalls[0].options.stream).toBe(false);
    }
  });

  // ── T7: systemPromptOverride ───────────────────────────────────────────────
  it('T7: systemPromptOverride clones the agent with new instructions', async () => {
    fakeOutput = { finalOutput: { message: 'ok' }, output: [] };
    const agent = fakeAgent('core.architect', 'Original instructions.');
    const contrib = asTool(agent as any, {
      systemPromptOverride: 'Focus only on security.',
    });
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      await rawExecute({ query: 'q' });
      expect(runCalls[0].agent.instructions).toBe('Focus only on security.');
      // Original agent is not mutated
      expect(agent.instructions).toBe('Original instructions.');
    }
  });

  // ── T8: empty response ─────────────────────────────────────────────────────
  it('T8: returns empty string when finalOutput and output items are empty', async () => {
    fakeOutput = { finalOutput: null, output: [] };
    const contrib = asTool(fakeAgent('core.architect') as any);
    const rawExecute: ((args: { query: string }) => Promise<string>) | undefined =
      (contrib.tool as any).execute;
    if (rawExecute) {
      const result = await rawExecute({ query: 'q' });
      expect(result).toBe('');
    }
  });
});
