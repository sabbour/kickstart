import { describe, expect, it } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AgentOutput } from '../types/agent-output.js';
import { collectStrictRequiredViolations } from '../runtime/schema-conformance.js';

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

  // #90 — strict-mode: model sends null for absent fields.
  // The model MUST include every declared field; null signals "absent".
  it('accepts null message (surface-only turn — strict-mode null)', () => {
    const result = AgentOutput.parse({ message: null, intent: 'continue' });
    expect(result.message).toBeNull();
    expect(result.intent).toBe('continue');
  });

  it('accepts null intent from strict-mode model output', () => {
    const result = AgentOutput.parse({ message: 'hello', intent: null });
    expect(result.message).toBe('hello');
    expect(result.intent).toBeNull();
  });

  it('accepts fully-null output (all fields absent, strict-mode nulls)', () => {
    const result = AgentOutput.parse({ message: null, intent: null });
    expect(result.message).toBeNull();
    expect(result.intent).toBeNull();
  });

  it('still accepts output with message present', () => {
    const result = AgentOutput.parse({ message: 'hello', intent: 'continue' });
    expect(result.message).toBe('hello');
  });

  // #90 — I2 strict-mode conformance: all properties must be in required[]
  it('has no I2 strict-mode violations (no .optional() without .nullable())', () => {
    const jsonSchema = zodToJsonSchema(AgentOutput, { $refStrategy: 'none' });
    const violations = collectStrictRequiredViolations(jsonSchema);
    expect(violations).toEqual([]);
  });
});
