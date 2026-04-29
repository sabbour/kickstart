/**
 * Zod v4 migration equivalence tests for packages/harness.
 *
 * Verifies the 5 a2ui.ts preprocess callsites migrated from z.preprocess to
 * z.unknown().transform().pipe() preserve runtime behaviour.
 *
 * Also verifies zodToJsonSchema → z.toJSONSchema() output compatibility for AgentOutput
 * (Nibbler's compat condition for PR #245).
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CreateSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
  DeleteSurfaceMessageSchema,
  A2UIMessageSchema,
} from '../types/a2ui.js';
import { AgentOutput } from '../types/agent-output.js';
import { collectStrictRequiredViolations } from '../runtime/schema-conformance.js';

// ---------------------------------------------------------------------------
// Group — withDiscriminator preprocess callsites (5 total)
// ---------------------------------------------------------------------------

const A2UI_VERSION = 'v0.9';

describe('CreateSurfaceMessageSchema — Zod v4 migration equivalence', () => {
  it('injects op discriminant from payload key', () => {
    const result = CreateSurfaceMessageSchema.parse({
      version: A2UI_VERSION,
      createSurface: { surfaceId: 's1', catalogId: 'c1' },
    });
    expect(result).toEqual({ version: A2UI_VERSION, createSurface: { surfaceId: 's1', catalogId: 'c1' } });
    expect((result as Record<string, unknown>).op).toBeUndefined();
  });

  it('also works with op already present', () => {
    const result = CreateSurfaceMessageSchema.parse({
      version: A2UI_VERSION,
      op: 'createSurface',
      createSurface: { surfaceId: 's1', catalogId: 'c1' },
    });
    expect(result).toEqual({ version: A2UI_VERSION, createSurface: { surfaceId: 's1', catalogId: 'c1' } });
  });

  it('rejects wrong op', () => {
    expect(() =>
      CreateSurfaceMessageSchema.parse({
        version: A2UI_VERSION,
        updateComponents: { surfaceId: 's1', components: [{}] },
      }),
    ).toThrow();
  });
});

describe('UpdateComponentsMessageSchema — Zod v4 migration equivalence', () => {
  it('injects op discriminant', () => {
    const result = UpdateComponentsMessageSchema.parse({
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 's1',
        components: [{ type: 'text' }],
      },
    });
    expect(result.updateComponents.surfaceId).toBe('s1');
  });
});

describe('UpdateDataModelMessageSchema — Zod v4 migration equivalence', () => {
  it('injects op discriminant', () => {
    const result = UpdateDataModelMessageSchema.parse({
      version: A2UI_VERSION,
      updateDataModel: { surfaceId: 's1', path: '/name', value: 'Alice' },
    });
    expect(result.updateDataModel.value).toBe('Alice');
  });

  it('accepts null value', () => {
    const result = UpdateDataModelMessageSchema.parse({
      version: A2UI_VERSION,
      updateDataModel: { surfaceId: 's1', path: null, value: null },
    });
    expect(result.updateDataModel.value).toBeNull();
  });
});

describe('DeleteSurfaceMessageSchema — Zod v4 migration equivalence', () => {
  it('injects op discriminant', () => {
    const result = DeleteSurfaceMessageSchema.parse({
      version: A2UI_VERSION,
      deleteSurface: { surfaceId: 's1' },
    });
    expect(result.deleteSurface.surfaceId).toBe('s1');
  });
});

describe('A2UIMessageSchema — Zod v4 migration equivalence (5th callsite)', () => {
  it('routes file messages directly', () => {
    const result = A2UIMessageSchema.parse({
      type: 'file',
      name: 'output.yaml',
      content: 'hello: world',
    });
    expect((result as { type: string }).type).toBe('file');
  });

  it('routes createSurface envelope via discriminator injection', () => {
    const result = A2UIMessageSchema.parse({
      version: A2UI_VERSION,
      createSurface: { surfaceId: 's2', catalogId: 'c2' },
    });
    expect(result).toMatchObject({ version: A2UI_VERSION, createSurface: { surfaceId: 's2' } });
  });

  it('rejects malformed message', () => {
    expect(() => A2UIMessageSchema.parse({ garbage: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// zodToJsonSchema → z.toJSONSchema compat check (Nibbler condition)
//
// We assert that z.toJSONSchema(AgentOutput) produces a valid JSON Schema
// that still passes the strict-mode violation checks.
// The output format differs from draft-07 (uses draft/2020-12 by default)
// but the structural validity for OpenAI strict-mode is preserved.
// ---------------------------------------------------------------------------

describe('zodToJsonSchema → z.toJSONSchema compat for AgentOutput (Nibbler condition)', () => {
  it('z.toJSONSchema produces a valid JSON schema object', () => {
    const schema = z.toJSONSchema(AgentOutput, { reused: 'inline' });
    expect(typeof schema).toBe('object');
    expect(schema).toHaveProperty('type', 'object');
  });

  it('has no I2 strict-mode violations with z.toJSONSchema output', () => {
    const jsonSchema = z.toJSONSchema(AgentOutput, { reused: 'inline' });
    const violations = collectStrictRequiredViolations(jsonSchema);
    expect(violations).toEqual([]);
  });

  it('documents schema format change: draft/2020-12 vs draft-07 (non-breaking at runtime)', () => {
    const v4Schema = z.toJSONSchema(AgentOutput, { reused: 'inline' });
    // v4 emits draft/2020-12; old zodToJsonSchema emitted draft-07.
    // The $schema key changes but the structural output is semantically equivalent.
    const schemaStr = JSON.stringify(v4Schema);
    expect(schemaStr).toContain('"type":"object"');
    expect(schemaStr).toContain('"message"');
    expect(schemaStr).toContain('"intent"');
  });
});
