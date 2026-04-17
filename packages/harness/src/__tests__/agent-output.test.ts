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
});
