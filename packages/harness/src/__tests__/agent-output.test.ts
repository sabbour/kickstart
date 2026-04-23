import { describe, expect, it } from 'vitest';
import { AgentOutput } from '../types/agent-output.js';

describe('AgentOutput schema', () => {
  it('accepts all allowed intents', () => {
    const intents = ['continue', 'advance', 'revise', 'auto-continue-files'] as const;

    for (const intent of intents) {
      expect(AgentOutput.parse({ message: 'ok', intent })).toEqual({ message: 'ok', intent });
    }
  });

  it('rejects unknown intents', () => {
    expect(() => AgentOutput.parse({ message: 'ok', intent: 'ship-it' })).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => AgentOutput.parse({ message: 'ok', extra: true })).toThrow();
  });

  // #1130 — message is now optional for surface-only turns
  it('accepts output without a message (surface-only turn)', () => {
    const result = AgentOutput.parse({ intent: 'continue' });
    expect(result).toEqual({ intent: 'continue' });
    expect(result.message).toBeUndefined();
  });

  it('accepts output with empty object (no message, no intent)', () => {
    const result = AgentOutput.parse({});
    expect(result).toEqual({});
  });

  it('still accepts output with message present', () => {
    const result = AgentOutput.parse({ message: 'hello', intent: 'continue' });
    expect(result.message).toBe('hello');
  });
});
