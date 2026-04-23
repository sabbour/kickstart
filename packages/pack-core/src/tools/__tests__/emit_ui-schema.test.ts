/**
 * @file emit_ui-schema.test.ts
 * @suite emit_ui strict-mode schema guard (#1050)
 *
 * Regression tests for the OpenAI strict-mode $ref+description sibling
 * violation that broke every /api/converse call in production.
 *
 * The @openai/agents SDK's mergeJsonSchemaDescriptions injects a `description`
 * field as a sibling to `$ref`, which is illegal in strict-mode JSON Schema.
 * The fix removes container-level .describe() from A2UIActionSchema and all
 * 5 reuse sites, moving guidance into the leaf `event.name` field instead.
 *
 * Tests:
 *   T1 — walker: NO $ref node in the full emitUiTool schema has sibling keys
 *   T2 — inline snapshot: action path in Alert variant has the correct shape
 *   T3 — event.name carries the migrated LLM guidance in its description
 */

import { describe, it, expect } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import { emitUiTool } from '../emit_ui.js';

// ── Walker helpers ────────────────────────────────────────────────────────────

type SchemaNode = Record<string, unknown>;

function isPlainObject(v: unknown): v is SchemaNode {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Walk every node in a JSON schema tree (including $defs, anyOf, allOf,
 * oneOf, items, properties) and call `visit` at each object node.
 */
function walk(node: unknown, path: string, visit: (n: SchemaNode, p: string) => void): void {
  if (!isPlainObject(node)) return;
  visit(node, path);

  if (isPlainObject(node.properties)) {
    for (const [key, val] of Object.entries(node.properties as SchemaNode)) {
      walk(val, `${path}.properties.${key}`, visit);
    }
  }
  if (isPlainObject(node.$defs)) {
    for (const [key, val] of Object.entries(node.$defs as SchemaNode)) {
      walk(val, `${path}.$defs.${key}`, visit);
    }
  }
  if (node.items !== undefined) walk(node.items, `${path}.items`, visit);
  if (isPlainObject(node.additionalProperties)) {
    walk(node.additionalProperties, `${path}.additionalProperties`, visit);
  }
  for (const kw of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(node[kw])) {
      (node[kw] as unknown[]).forEach((sub, i) =>
        walk(sub, `${path}.${kw}[${i}]`, visit),
      );
    }
  }
}

// ── Fixture ───────────────────────────────────────────────────────────────────

const schema = (emitUiTool.tool as FunctionTool).parameters as SchemaNode;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('emit_ui schema — strict-mode $ref-sibling guard (#1050)', () => {
  it('T1: no $ref node has sibling keywords (strict-mode violation)', () => {
    expect(schema).toBeTruthy();
    const violations: string[] = [];
    walk(schema, 'root', (n, p) => {
      if ('$ref' in n && Object.keys(n).length > 1) {
        const siblings = Object.keys(n)
          .filter((k) => k !== '$ref')
          .join(', ');
        violations.push(`${p}: $ref has siblings {${siblings}}`);
      }
    });
    expect(
      violations,
      `$ref nodes with sibling keywords found — OpenAI strict-mode will reject:\n  - ${violations.join('\n  - ')}`,
    ).toHaveLength(0);
  });

  it('T2: component action paths have correct shape — no $ref+description sibling', () => {
    // Walk to the component-level `action` property nodes (Button, Alert,
    // ComboBox, MultiSelect, Toggle). Exclude the `payload.action` field,
    // which shares the same key name but is nested inside the event envelope.
    const componentActionPaths: Array<{ path: string; node: SchemaNode }> = [];
    walk(schema, 'root', (n, p) => {
      if (
        p.endsWith('.properties.action') &&
        // Exclude payload's own `action` key (nested under .payload.anyOf[N].properties.action)
        !p.includes('.payload.')
      ) {
        componentActionPaths.push({ path: p, node: n });
      }
    });

    // Must find the 5 action-bearing variants: Button, Alert, ComboBox, MultiSelect, Toggle.
    expect(
      componentActionPaths.length,
      'Expected at least 5 component action paths (Button, Alert, ComboBox, MultiSelect, Toggle)',
    ).toBeGreaterThanOrEqual(5);

    // None of these nodes may be a $ref with sibling keywords.
    for (const { path, node } of componentActionPaths) {
      if ('$ref' in node) {
        const siblings = Object.keys(node).filter((k) => k !== '$ref');
        expect(
          siblings,
          `${path}: $ref node must not have sibling keys`,
        ).toHaveLength(0);
      }
      // If it's an anyOf (nullable action), the $ref branch within anyOf also must be clean.
      if (Array.isArray(node.anyOf)) {
        for (const branch of node.anyOf as SchemaNode[]) {
          if (isPlainObject(branch) && '$ref' in branch) {
            const siblings = Object.keys(branch).filter((k) => k !== '$ref');
            expect(
              siblings,
              `${path} anyOf branch: $ref node must not have sibling keys`,
            ).toHaveLength(0);
          }
        }
      }
    }
  });

  it('T3: event.name leaf carries migrated LLM guidance', () => {
    // The guidance formerly on the container-level .describe() must survive
    // on the event.name leaf field so the LLM still receives it.
    const namePaths: string[] = [];
    walk(schema, 'root', (n, p) => {
      if (
        p.endsWith('.properties.name') &&
        typeof n.description === 'string' &&
        n.description.includes('never a bare onClick string')
      ) {
        namePaths.push(p);
      }
    });
    expect(
      namePaths.length,
      'event.name must carry the "never a bare onClick string" guidance',
    ).toBeGreaterThan(0);
  });
});
