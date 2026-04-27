/**
 * Unit tests for sanitize-error.ts
 *
 * Covers:
 * - Known SDK error types return friendly messages
 * - OpenAI REST API error classes are handled by constructor name
 * - Model ID stripping
 * - UUID stripping
 * - Quota / rate-limit stripping
 * - Azure endpoint stripping
 * - Generic fallback for empty-after-strip messages
 * - Non-Error values are handled
 */

import { describe, expect, it } from 'vitest';
import { sanitizeError, stripSensitivePatterns } from '../sanitize-error.js';

// ---------------------------------------------------------------------------
// Helpers — fake SDK error classes to avoid importing the full SDK in tests
// ---------------------------------------------------------------------------

vi.mock('@openai/agents', async () => {
  class MaxTurnsExceededError extends Error {
    constructor() { super('Max turns exceeded'); this.name = 'MaxTurnsExceededError'; }
  }
  class ModelBehaviorError extends Error {
    constructor(msg = 'model misbehaved') { super(msg); this.name = 'ModelBehaviorError'; }
  }
  class ToolCallError extends Error {
    constructor() { super('tool call failed'); this.name = 'ToolCallError'; }
  }
  class ToolTimeoutError extends Error {
    constructor() { super('tool timed out'); this.name = 'ToolTimeoutError'; }
  }
  class InputGuardrailTripwireTriggered extends Error {
    constructor() { super('input guardrail'); this.name = 'InputGuardrailTripwireTriggered'; }
  }
  class OutputGuardrailTripwireTriggered extends Error {
    constructor() { super('output guardrail'); this.name = 'OutputGuardrailTripwireTriggered'; }
  }
  class ToolInputGuardrailTripwireTriggered extends Error {
    constructor() { super('tool input guardrail'); this.name = 'ToolInputGuardrailTripwireTriggered'; }
  }
  class ToolOutputGuardrailTripwireTriggered extends Error {
    constructor() { super('tool output guardrail'); this.name = 'ToolOutputGuardrailTripwireTriggered'; }
  }

  return {
    MaxTurnsExceededError,
    ModelBehaviorError,
    ToolCallError,
    ToolTimeoutError,
    InputGuardrailTripwireTriggered,
    OutputGuardrailTripwireTriggered,
    ToolInputGuardrailTripwireTriggered,
    ToolOutputGuardrailTripwireTriggered,
  };
});

import { vi } from 'vitest';

// We need to import after mocking
const { sanitizeError: se, stripSensitivePatterns: ssp } = await import('../sanitize-error.js');

describe('sanitizeError — known SDK error types', () => {
  it('MaxTurnsExceededError → friendly message', async () => {
    const { MaxTurnsExceededError } = await import('@openai/agents');
    const err = new MaxTurnsExceededError();
    expect(se(err)).toBe(
      'The conversation reached its maximum length. Please start a new conversation.',
    );
  });

  it('InputGuardrailTripwireTriggered → safe message', async () => {
    const { InputGuardrailTripwireTriggered } = await import('@openai/agents');
    expect(se(new InputGuardrailTripwireTriggered())).toBe('Request could not be completed.');
  });

  it('OutputGuardrailTripwireTriggered → safe message', async () => {
    const { OutputGuardrailTripwireTriggered } = await import('@openai/agents');
    expect(se(new OutputGuardrailTripwireTriggered())).toBe('Request could not be completed.');
  });

  it('ToolInputGuardrailTripwireTriggered → safe message', async () => {
    const { ToolInputGuardrailTripwireTriggered } = await import('@openai/agents');
    expect(se(new ToolInputGuardrailTripwireTriggered())).toBe('Request could not be completed.');
  });

  it('ToolOutputGuardrailTripwireTriggered → safe message', async () => {
    const { ToolOutputGuardrailTripwireTriggered } = await import('@openai/agents');
    expect(se(new ToolOutputGuardrailTripwireTriggered())).toBe('Request could not be completed.');
  });

  it('ModelBehaviorError → safe message', async () => {
    const { ModelBehaviorError } = await import('@openai/agents');
    expect(se(new ModelBehaviorError())).toBe(
      'The AI model returned an unexpected response. Please try again.',
    );
  });

  it('ToolCallError → safe message', async () => {
    const { ToolCallError } = await import('@openai/agents');
    expect(se(new ToolCallError())).toBe('A tool call failed. Please try again.');
  });

  it('ToolTimeoutError → safe message', async () => {
    const { ToolTimeoutError } = await import('@openai/agents');
    expect(se(new ToolTimeoutError())).toBe('A tool call timed out. Please try again.');
  });
});

describe('sanitizeError — OpenAI REST API error classes (by constructor name)', () => {
  function fakeApiError(name: string, message: string): Error {
    const err = new Error(message);
    Object.defineProperty(err, 'name', { value: name });
    Object.defineProperty(err.constructor, 'name', { value: name });
    return err;
  }

  it('AuthenticationError → auth message', () => {
    expect(se(fakeApiError('AuthenticationError', 'Invalid API key'))).toBe(
      'Authentication failed. Please check your configuration.',
    );
  });

  it('PermissionDeniedError → access denied message', () => {
    expect(se(fakeApiError('PermissionDeniedError', 'Forbidden'))).toBe(
      'Access denied. Please check your configuration.',
    );
  });

  it('RateLimitError → busy message', () => {
    expect(se(fakeApiError('RateLimitError', 'Rate limit exceeded: 10000 TPM'))).toBe(
      'Service is currently busy. Please try again later.',
    );
  });

  it('APIConnectionError → connection message', () => {
    expect(se(fakeApiError('APIConnectionError', 'ECONNREFUSED'))).toBe(
      'Unable to connect to the AI service. Please try again.',
    );
  });

  it('APIConnectionTimeoutError → connection message', () => {
    expect(se(fakeApiError('APIConnectionTimeoutError', 'timeout'))).toBe(
      'Unable to connect to the AI service. Please try again.',
    );
  });

  it('InternalServerError → server error message', () => {
    expect(se(fakeApiError('InternalServerError', 'Internal server error'))).toBe(
      'The AI service encountered an error. Please try again.',
    );
  });
});

describe('sanitizeError — pattern stripping', () => {
  it('strips gpt-4 model ID', () => {
    const err = new Error('Model gpt-4 is not available in your region');
    const result = se(err);
    expect(result).not.toContain('gpt-4');
  });

  it('strips gpt-35-turbo model ID', () => {
    const err = new Error('Deployment gpt-35-turbo exceeded quota');
    const result = se(err);
    expect(result).not.toContain('gpt-35-turbo');
  });

  it('strips gpt-4o model ID', () => {
    const err = new Error('gpt-4o is not supported on this endpoint');
    const result = se(err);
    expect(result).not.toContain('gpt-4o');
  });

  it('strips UUID deployment names', () => {
    const err = new Error('Deployment 123e4567-e89b-12d3-a456-426614174000 not found');
    const result = se(err);
    expect(result).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('strips quota exceeded info', () => {
    const err = new Error('quota exceeded for this subscription');
    const result = se(err);
    expect(result.toLowerCase()).not.toContain('quota');
  });

  it('strips rate limit info', () => {
    const err = new Error('Rate limit reached: 10000 TPM');
    const result = se(err);
    expect(result.toLowerCase()).not.toContain('rate limit');
    expect(result).not.toContain('TPM');
  });

  it('strips Azure endpoint URLs', () => {
    const err = new Error(
      'Failed to connect to https://my-resource.openai.azure.com/openai/deployments',
    );
    const result = se(err);
    expect(result).not.toContain('openai.azure.com');
  });

  it('falls back to generic message when stripping leaves nothing', () => {
    const err = new Error('gpt-4o quota exceeded');
    const result = se(err);
    // Either a safe stripped message or the generic fallback
    expect(result).not.toContain('gpt-4o');
    expect(result).not.toContain('quota');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('sanitizeError — non-Error values', () => {
  it('handles string error', () => {
    const result = se('gpt-4 deployment not found');
    expect(result).not.toContain('gpt-4');
  });

  it('handles null', () => {
    expect(se(null)).toBe('An unexpected error occurred. Please try again.');
  });

  it('handles undefined', () => {
    expect(se(undefined)).toBe('An unexpected error occurred. Please try again.');
  });

  it('handles plain object', () => {
    const result = se({ code: 42 });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('stripSensitivePatterns', () => {
  it('redacts gpt model names', () => {
    expect(ssp('using gpt-4 model')).not.toContain('gpt-4');
    expect(ssp('using gpt-4 model')).toContain('[redacted]');
  });

  it('redacts UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(ssp(`deployment ${uuid}`)).not.toContain(uuid);
  });

  it('redacts TPM references', () => {
    expect(ssp('exceeded 10000 TPM')).not.toContain('TPM');
  });

  it('is idempotent on safe strings', () => {
    const safe = 'Something went wrong.';
    expect(ssp(safe)).toBe(safe);
  });
});
