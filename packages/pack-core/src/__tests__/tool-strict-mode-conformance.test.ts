/**
 * @file tool-strict-mode-conformance.test.ts
 * @suite OpenAI strict-mode schema conformance — pack-core (#1032)
 *
 * Regression test for #1032 ("Invalid schema for function 'core_emit_ui': In
 * context=(), object schema missing properties."). This happened because
 * `z.record(z.string(), X)` is serialised by
 * `@openai/agents-core/dist/utils/zodJsonSchemaCompat.mjs` (`buildRecordSchema`)
 * as `{ type: 'object', additionalProperties: <X> }` with NO `properties` key,
 * which OpenAI strict mode rejects.
 *
 * OpenAI strict mode (structured-outputs) enforces three invariants on every
 * `{ type: 'object' }` node of a function-tool schema:
 *
 *   #1  `properties` is present (an object, possibly empty). Tested here (T3).
 *   #2  every key in `properties` appears in `required`. Already covered by
 *       `tool-strict-required-conformance.test.ts` (#998).
 *   #3  `additionalProperties: false` is set explicitly. Tested here (T6).
 *
 * The third rule is the missing invariant that would also have caught #1032
 * at CI time (a `z.record` converts to `additionalProperties: <schema>`, not
 * `false`). This file walks every pack-core tool schema and asserts #1 + #3,
 * plus #1032-specific anchors:
 *
 *   - T5: `emit_ui.action.event.payload` retains `anyOf: [..., {type:'null'}]`
 *         after conversion (invariant check that the nullable wrapper
 *         survives — not a regression catch; see DP Amendment #1, N3).
 *   - T4: negative control — a freshly-built tool with `z.record(...)` in its
 *         parameter tree is flagged by the walker (proves we catch the exact
 *         shape that broke #1032).
 *
 * Originally requested by Nibbler (QA) on DP #1032 / Amendment #1.
 */

import { describe, it, expect } from 'vitest';
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { FunctionTool } from '@openai/agents';
import {
  emitUiTool,
  fetchWebpageTool,
  searchKaitoModelsTool,
  readFileTool,
  writeFileTool,
  listFilesTool,
  validateArtifactsTool,
} from '../tools/index.js';
import { createSearchComponentsTool } from '../tools/search_components.js';

// ── Walker helpers ────────────────────────────────────────────────────────────

type SchemaNode = Record<string, unknown>;

function isPlainObject(v: unknown): v is SchemaNode {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Walk a JSON schema and invoke `visit` at every node. `path` names the
 * nesting (e.g. `root.properties.message.anyOf[2].properties.action`).
 */
function walk(node: unknown, path: string, visit: (n: SchemaNode, p: string) => void): void {
  if (!isPlainObject(node)) return;
  visit(node, path);

  if (isPlainObject(node.properties)) {
    for (const [key, val] of Object.entries(node.properties as SchemaNode)) {
      walk(val, `${path}.properties.${key}`, visit);
    }
  }
  if (node.items !== undefined) walk(node.items, `${path}.items`, visit);
  if (isPlainObject(node.additionalProperties)) {
    walk(node.additionalProperties, `${path}.additionalProperties`, visit);
  }
  for (const kw of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(node[kw])) {
      (node[kw] as unknown[]).forEach((sub, i) => walk(sub, `${path}.${kw}[${i}]`, visit));
    }
  }
}

/** T3 — invariant #1: every `type: 'object'` node has a `properties` key. */
function collectMissingProperties(schema: unknown, path = 'root'): string[] {
  const issues: string[] = [];
  walk(schema, path, (n, p) => {
    if (n.type === 'object' && !('properties' in n)) {
      issues.push(`${p} (type=object, no 'properties' key)`);
    }
  });
  return issues;
}

/** T6 — invariant #3: every `type: 'object'` node has `additionalProperties: false`. */
function collectAdditionalPropertiesViolations(schema: unknown, path = 'root'): string[] {
  const issues: string[] = [];
  walk(schema, path, (n, p) => {
    if (n.type === 'object') {
      if (n.additionalProperties !== false) {
        issues.push(
          `${p} (type=object, additionalProperties=${JSON.stringify(n.additionalProperties)}; expected false)`,
        );
      }
    }
  });
  return issues;
}

function getToolSchema(contrib: { tool: unknown }): Record<string, unknown> | null {
  const t = contrib.tool as FunctionTool;
  if (t.type !== 'function') return null;
  return t.parameters as Record<string, unknown>;
}

// ── Pack-core tool roster ─────────────────────────────────────────────────────

const stubRegistry = {
  components: [{ name: 'Button', description: 'A button', schema: {} }],
};

const tools = [
  { name: 'core.emit_ui', contrib: emitUiTool },
  { name: 'core.fetch_webpage', contrib: fetchWebpageTool },
  { name: 'core.search_kaito_models', contrib: searchKaitoModelsTool },
  { name: 'core.read_file', contrib: readFileTool },
  { name: 'core.write_file', contrib: writeFileTool },
  { name: 'core.list_files', contrib: listFilesTool },
  { name: 'core.validate_artifacts', contrib: validateArtifactsTool },
  { name: 'core.search_components', contrib: createSearchComponentsTool(stubRegistry) },
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pack-core tool OpenAI strict-mode conformance (#1032)', () => {
  // T3 — every object node has `properties`.
  describe('T3: invariant #1 — every object node declares properties', () => {
    for (const { name, contrib } of tools) {
      it(`${name}: no 'type: object' node is missing 'properties'`, () => {
        const schema = getToolSchema(contrib);
        if (!schema) return;
        const issues = collectMissingProperties(schema);
        expect(
          issues,
          `Missing 'properties' on object nodes in ${name}:\n  - ${issues.join('\n  - ')}`,
        ).toHaveLength(0);
      });
    }
  });

  // T6 — every object node has additionalProperties: false.
  describe('T6: invariant #3 — every object node has additionalProperties:false', () => {
    for (const { name, contrib } of tools) {
      it(`${name}: no 'type: object' node omits additionalProperties:false`, () => {
        const schema = getToolSchema(contrib);
        if (!schema) return;
        const issues = collectAdditionalPropertiesViolations(schema);
        expect(
          issues,
          `additionalProperties !== false on object nodes in ${name}:\n  - ${issues.join('\n  - ')}`,
        ).toHaveLength(0);
      });
    }
  });

  // T5 — emit_ui.action.event.payload retains its nullable `anyOf` wrapper.
  //
  // Anchored to the converter's documented behaviour
  // (@openai/agents-core/dist/utils/zodJsonSchemaCompat.mjs / buildNullableSchema:253-256
  // unconditionally wraps inner in `anyOf: [inner, {type:'null'}]`). We walk
  // the real emit_ui schema and assert at least one path to a `payload` key
  // carries the nullable wrapper. This is an invariant lint, not a regression
  // catch — the "nullable dropped" claim from the original DP was retracted
  // in Amendment #1 (N3).
  it('T5: emit_ui — action.event.payload keeps anyOf[..., {type:null}] after conversion', () => {
    const schema = getToolSchema(emitUiTool) as SchemaNode;
    expect(schema).toBeTruthy();

    const nullableHits: string[] = [];
    walk(schema, 'root', (n, p) => {
      if (!p.endsWith('.payload')) return;
      // Nullable fields appear as either `anyOf: [X, {type:'null'}]` or
      // `type: ['object', 'null']`. We accept either form.
      const anyOfHasNull =
        Array.isArray(n.anyOf) &&
        (n.anyOf as SchemaNode[]).some((b) => b.type === 'null');
      const typeArrayHasNull =
        Array.isArray(n.type) && (n.type as unknown[]).includes('null');
      if (anyOfHasNull || typeArrayHasNull) {
        nullableHits.push(p);
      }
    });

    expect(
      nullableHits.length,
      'emit_ui payload should carry a nullable wrapper (anyOf with type:null, or type array including null) somewhere in the schema',
    ).toBeGreaterThan(0);
  });

  // T4 — negative control. A tool with `z.record(...)` in its parameters
  // must be flagged by the walker for invariant #1 AND #3.
  it('T4: negative control — z.record(...) parameter tripwire is detected', () => {
    const badTool = tool({
      name: 'negative_control_record',
      description: 'Intentionally bad shape — z.record does not satisfy strict mode.',
      parameters: z.object({
        // This is the exact shape that broke #1032: open-keyed record.
        bag: z.record(z.string(), z.string()),
      }),
      // eslint-disable-next-line @typescript-eslint/require-await
      execute: async () => 'noop',
    });
    const ft = badTool as FunctionTool;
    const schema = ft.parameters as Record<string, unknown>;

    const missingProps = collectMissingProperties(schema);
    const apViolations = collectAdditionalPropertiesViolations(schema);
    // Either missing properties OR a non-false additionalProperties counts
    // as a tripwire hit; in practice buildRecordSchema yields both.
    expect(
      missingProps.length + apViolations.length,
      'walker must flag z.record(...) as a strict-mode violation',
    ).toBeGreaterThan(0);
  });
});
