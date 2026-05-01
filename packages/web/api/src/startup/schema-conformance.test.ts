/**
 * @file schema-conformance.test.ts
 * @suite Universal OpenAI strict-mode schema conformance — every pack
 *
 * Runs the four shared schema-conformance walkers against EVERY tool and
 * EVERY user action discovered through the real registry/startup path
 * (`getRegistry()` from `./packs.ts`). Replaces the per-pack hand-rostered
 * test suites that pre-#1005 only covered pack-core.
 *
 * Why this lives here (web/api/src/startup):
 *   This is the same code-path Azure Functions uses to register packs at
 *   cold start. Loading packs through `getRegistry()` — rather than
 *   importing each pack's `Pack` manifest into the test directly —
 *   guarantees the test set is fed by the same dependency-ordered, sealed
 *   registry the running service exposes to the model. New packs / new
 *   tools are picked up automatically with no test-roster edit.
 *
 * Helpers (`reportSchemaConformance`, `formatReport`, `getToolJsonSchema`,
 * `getUserActionJsonSchema`) live in
 * `@aks-kickstart/harness/runtime/schema-conformance` so they are also
 * usable by per-pack regression tests targeting specific schema shapes.
 */

import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  reportSchemaConformance,
  reportHasIssues,
  formatReport,
  getToolJsonSchema,
  getUserActionJsonSchema,
  collectUnsupportedFormats,
  rewriteDiscriminatedOneOfToAnyOf,
  walkSchema,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import type { ToolContribution } from '@aks-kickstart/harness';
import { _resetRegistryState, getRegistry } from './packs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Hermetic credential isolation
// ─────────────────────────────────────────────────────────────────────────────
//
// `getRegistry()` runs `getCredentialConfig()` first, which inspects ambient
// environment variables and may throw (e.g. an invalid `AZURE_OPENAI_ENDPOINT`
// from a developer's `.env`). Schema conformance is independent of the LLM
// provider, so we wipe all relevant credential env vars, swap in a single
// placeholder `OPENAI_API_KEY` to satisfy the validator, build the registry,
// and then restore the original environment. The constructed registry is held
// in module scope because `it.each(...)` needs its arrays at collection time.
const REGISTRY_CREDENTIAL_ENV_PATTERNS = [
  /^OPENAI_API_KEY$/,
  /^AZURE_OPENAI_/,
  /^KICKSTART_.*_MODEL$/,
  /^AZURE_CLIENT_ID$/,
  /^AZURE_TENANT_ID$/,
  /^AZURE_CLIENT_SECRET$/,
];

function isRegistryCredentialEnvVar(name: string): boolean {
  return REGISTRY_CREDENTIAL_ENV_PATTERNS.some((pattern) => pattern.test(name));
}

function buildRegistryWithHermeticCredentialEnv(): ReturnType<typeof getRegistry> {
  const originalEnv = new Map<string, string | undefined>();

  for (const name of Object.keys(process.env)) {
    if (!isRegistryCredentialEnvVar(name)) continue;
    originalEnv.set(name, process.env[name]);
    delete process.env[name];
  }
  if (!originalEnv.has('OPENAI_API_KEY')) {
    originalEnv.set('OPENAI_API_KEY', undefined);
  }

  process.env.OPENAI_API_KEY = 'test-key-for-schema-conformance';

  try {
    _resetRegistryState();
    return getRegistry();
  } finally {
    for (const [name, value] of originalEnv.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

const registry = buildRegistryWithHermeticCredentialEnv();

const tools = registry.tools.map((tool) => ({ name: tool.name, contrib: tool }));
const userActions = registry.userActions.map((action) => ({
  name: action.name,
  contrib: action,
}));

describe('OpenAI strict-mode schema conformance — every registered tool', () => {
  it('discovers tools dynamically through the registry (no hand-maintained roster)', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  // Use it.each so every tool surfaces in test output by name and a
  // single failure does not mask others.
  it.each(tools)('$name passes all four strict-mode invariants', ({ name, contrib }) => {
    const schema = getToolJsonSchema(contrib);
    // Non-function tools (e.g. handoff tools) are exempt — they have no
    // JSON-schema parameters object.
    if (schema === null) return;

    const report = reportSchemaConformance(name, schema);
    expect(reportHasIssues(report) ? formatReport(report) : null).toBeNull();
  });
});

describe('OpenAI strict-mode schema conformance — every registered user action', () => {
  it('discovers user actions dynamically through the registry (no hand-maintained roster)', () => {
    expect(userActions.length).toBeGreaterThan(0);
  });

  it.each(userActions)('$name passes all four strict-mode invariants', ({ name, contrib }) => {
    const schema = getUserActionJsonSchema(contrib);
    const report = reportSchemaConformance(name, schema);
    expect(reportHasIssues(report) ? formatReport(report) : null).toBeNull();
  });
});

describe('OpenAI strict-mode schema conformance — unsupported formats', () => {
  it('flags z.string().url() schemas before OpenAI rejects format=uri at runtime', () => {
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        nested: {
          type: 'object',
          properties: {
            callbackUrl: { type: 'string', format: 'uri' },
            ignoredNumericFormat: { type: 'string', format: 123 },
          },
          required: ['callbackUrl', 'ignoredNumericFormat'],
          additionalProperties: false,
        },
      },
      required: ['url', 'nested'],
      additionalProperties: false,
    };

    expect(collectUnsupportedFormats(schema)).toEqual([
      'root.properties.url (format="uri")',
      'root.properties.nested.properties.callbackUrl (format="uri")',
    ]);
  });
});

describe('OpenAI strict-mode schema conformance — oneOf compatibility', () => {
  it('rewrites property-level discriminated oneOf to anyOf with unique required consts', () => {
    const schema = {
      type: 'object',
      properties: {
        message: {
          oneOf: [
            {
              type: 'object',
              properties: { op: { const: 'create' }, value: { type: 'string' } },
              required: ['op', 'value'],
              additionalProperties: false,
            },
            {
              type: 'object',
              properties: { op: { const: 'delete' }, id: { type: 'string' } },
              required: ['op', 'id'],
              additionalProperties: false,
            },
          ],
        },
      },
      required: ['message'],
      additionalProperties: false,
    };

    const rewritten = rewriteDiscriminatedOneOfToAnyOf(schema) as Record<string, unknown>;
    const message = (rewritten.properties as Record<string, Record<string, unknown>>).message;

    expect(message.oneOf).toBeUndefined();
    expect(message.anyOf).toHaveLength(2);
  });

  it('preserves conjunction when a safe discriminated oneOf coexists with existing anyOf', () => {
    // Original semantics: (anyOf) AND (oneOf) — a conjunction, not a broad OR.
    // Flattening into a single anyOf would silently weaken that invariant.
    const schema = {
      anyOf: [{ type: 'null' }],
      oneOf: [
        {
          type: 'object',
          properties: { kind: { const: 'a' } },
          required: ['kind'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { kind: { const: 'b' } },
          required: ['kind'],
          additionalProperties: false,
        },
      ],
    };

    const rewritten = rewriteDiscriminatedOneOfToAnyOf(schema) as Record<string, unknown>;

    // Both top-level keywords must be gone; conjunction lives in allOf.
    expect(rewritten.oneOf).toBeUndefined();
    expect(rewritten.anyOf).toBeUndefined();
    const allOf = rewritten.allOf as Array<Record<string, unknown>>;
    expect(allOf).toHaveLength(2);
    // First arm: the original anyOf preserved as-is.
    expect(allOf[0]).toEqual({ anyOf: [{ type: 'null' }] });
    // Second arm: the converted oneOf variants.
    expect((allOf[1].anyOf as unknown[]).length).toBe(2);
  });

  it('leaves non-discriminated or overlapping oneOf nodes in place', () => {
    const overlapping = {
      oneOf: [
        {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
          additionalProperties: false,
        },
      ],
    };
    const duplicateDiscriminator = {
      oneOf: [
        {
          type: 'object',
          properties: { kind: { const: 'same' } },
          required: ['kind'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { kind: { const: 'same' } },
          required: ['kind'],
          additionalProperties: false,
        },
      ],
    };

    expect((rewriteDiscriminatedOneOfToAnyOf(overlapping) as Record<string, unknown>).oneOf).toHaveLength(2);
    expect((rewriteDiscriminatedOneOfToAnyOf(duplicateDiscriminator) as Record<string, unknown>).oneOf).toHaveLength(2);
    expect(reportSchemaConformance('overlapping_oneof', overlapping).unsupportedOneOf).toEqual([
      'root.oneOf',
    ]);
    expect(reportSchemaConformance('duplicate_discriminator_oneof', duplicateDiscriminator).unsupportedOneOf).toEqual([
      'root.oneOf',
    ]);
  });

  it('registered tool schemas expose no remaining oneOf after safe compatibility rewrite', () => {
    const remainingOneOfPaths: string[] = [];

    for (const { name, contrib } of tools) {
      const schema = getToolJsonSchema(contrib);
      if (schema === null) continue;
      walkSchema(schema, 'root', (node, path) => {
        if (Array.isArray(node.oneOf)) remainingOneOfPaths.push(`${name}: ${path}.oneOf`);
      });
    }

    expect(remainingOneOfPaths).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #98 — Glob-based conformance: cover ALL tool files, not just registered ones
// ─────────────────────────────────────────────────────────────────────────────
//
// The registry-based tests above only cover tools present in `getRegistry()`.
// ~40% of tool files are not registered and bypass that check. This suite
// globs every `packages/pack-*/src/tools/*.ts` file directly and runs
// `assertStrictlyConformant()` on every concrete ToolContribution export,
// regardless of whether it is wired into a Pack.
//
// Factory-function exports (e.g. `createInspectRepoTool`) and pure-helper
// files that export no ToolContribution are skipped automatically.

function isToolContribution(value: unknown): value is ToolContribution {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.tool === 'object' && v.tool !== null;
}

// Vitest runs with process.cwd() set to the monorepo root (where vitest.config.ts lives).
const projectRoot = process.cwd();

const allToolFiles = globSync('packages/pack-*/src/tools/*.ts', { cwd: projectRoot }).filter(
  (f) => !f.includes('.test.') && !f.endsWith('index.ts') && !f.includes('__'),
);

describe('OpenAI strict-mode schema conformance — all tool files (glob, #98)', () => {
  it('glob discovers tool files beyond just registry-registered tools', () => {
    expect(allToolFiles.length).toBeGreaterThan(0);
  });

  it.each(allToolFiles)(
    '%s — every exported ToolContribution passes strict-mode',
    async (relPath) => {
      const absolutePath = resolve(projectRoot, relPath);
      const mod = await import(absolutePath);

      const contribs = Object.values(mod).filter(isToolContribution);

      for (const contrib of contribs) {
        const schema = getToolJsonSchema(contrib);
        if (schema === null) continue; // non-function tools (e.g. handoff) have no schema
        // Use the walker-based report (consistent with the registered-tools suite above)
        // rather than assertStrictlyConformant() — assertStrictlyConformant calls
        // structuredClone() which fails on Vitest-transformed module objects.
        // The walkers still enforce I1–I5, including I2 (.optional() missing from required).
        const report = reportSchemaConformance(contrib.name, schema);
        expect(reportHasIssues(report) ? formatReport(report) : null).toBeNull();
      }
    },
  );
});

describe('OpenAI strict-mode schema conformance — I0: root must be type:object', () => {
  it('rejects a $ref-at-root schema (ZodEffects via zodToJsonSchema CJS produces this)', () => {
    // In some serialization paths (e.g., CJS zod-to-json-schema without the
    // openAi target), ZodEffects produce a $ref schema at root level with no
    // type:"object". The OpenAI API rejects such schemas with HTTP 400.
    const schema = {
      $ref: '#/definitions/OpenAiAnyType',
      definitions: {
        OpenAiAnyType: { type: ['string', 'number', 'integer', 'boolean', 'array', 'null'] },
      },
      $schema: 'https://json-schema.org/draft/2019-09/schema#',
    };
    const report = reportSchemaConformance('test_refine_tool', schema);
    expect(report.i0RootType).toHaveLength(1);
    expect(report.i0RootType[0]).toContain('expected "object"');
    expect(reportHasIssues(report)).toBe(true);
  });

  it('accepts a plain type:object root schema (sanity check)', () => {
    const schema = {
      type: 'object',
      properties: { x: { type: 'string' } },
      required: ['x'],
      additionalProperties: false,
    };
    const report = reportSchemaConformance('test_good_tool', schema);
    expect(report.i0RootType).toHaveLength(0);
  });

  it('flags a root schema with type:"None" directly (OpenAI SDK ZodEffects output)', () => {
    const schema = {
      type: 'None',
      properties: {},
      required: [],
      additionalProperties: false,
    };
    const report = reportSchemaConformance('test_none_tool', schema);
    expect(report.i0RootType).toHaveLength(1);
    expect(report.i0RootType[0]).toContain('"None"');
    expect(report.i0RootType[0]).toContain('expected "object"');
    expect(reportHasIssues(report)).toBe(true);
  });
});
