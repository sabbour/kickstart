/**
 * Zod v4 migration equivalence tests for packages/pack-core.
 *
 * Verifies TriggerSchema migration from z.preprocess to union+transform+pipe.
 * Zapp condition: input type narrows to string | string[]; behaviour identical.
 * Nibbler condition: this is a TS API breaking change (unknown → string | string[]).
 *
 * Test matrix: null / invalid-enum / string / array / mixed.
 */

import { describe, expect, it } from 'vitest';
import { TriggerSchema, GenGhaWorkflowInputSchema } from '../skills/gen-gha-workflow/schema.js';

describe('TriggerSchema — Zod v4 migration equivalence', () => {
  it('accepts a single string and normalises to array', () => {
    expect(TriggerSchema.parse('push')).toEqual(['push']);
  });

  it('accepts an array of strings', () => {
    expect(TriggerSchema.parse(['push', 'schedule'])).toEqual(['push', 'schedule']);
  });

  it('accepts all valid enum values', () => {
    const triggers = ['push', 'pull_request', 'workflow_dispatch', 'schedule'] as const;
    for (const t of triggers) {
      expect(TriggerSchema.parse(t)).toEqual([t]);
    }
  });

  it('rejects an invalid enum value', () => {
    expect(() => TriggerSchema.parse('cron')).toThrow();
  });

  it('rejects null', () => {
    // null is not string | string[] — union branches both fail
    expect(() => TriggerSchema.parse(null)).toThrow();
  });

  it('rejects undefined', () => {
    expect(() => TriggerSchema.parse(undefined)).toThrow();
  });

  it('rejects array containing invalid enum', () => {
    expect(() => TriggerSchema.parse(['push', 'invalid'])).toThrow();
  });
});

describe('GenGhaWorkflowInputSchema trigger field', () => {
  const BASE_VALID = {
    name: 'my-workflow',
    trigger: 'push',
    azureTenantId: 'a1234567-89ab-4cde-8f01-234567890abc',
    azureSubscriptionId: 'b2345678-9abc-4def-9012-345678901bcd',
    azureClientId: 'c3456789-abcd-4ef0-a123-456789012cde',
    jobs: [
      {
        name: 'build',
        runsOn: 'ubuntu-latest' as const,
        steps: [{ name: 'checkout', uses: 'actions/checkout@v4' }],
      },
    ],
  };

  it('accepts trigger as string', () => {
    const r = GenGhaWorkflowInputSchema.parse(BASE_VALID);
    expect(r.trigger).toEqual(['push']);
  });

  it('accepts trigger as string[]', () => {
    const r = GenGhaWorkflowInputSchema.parse({ ...BASE_VALID, trigger: ['push', 'workflow_dispatch'] });
    expect(r.trigger).toEqual(['push', 'workflow_dispatch']);
  });

  it('rejects null trigger', () => {
    expect(() => GenGhaWorkflowInputSchema.parse({ ...BASE_VALID, trigger: null })).toThrow();
  });

  it('rejects invalid trigger enum', () => {
    expect(() => GenGhaWorkflowInputSchema.parse({ ...BASE_VALID, trigger: 'invalid' })).toThrow();
  });
});
