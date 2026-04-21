/**
 * @file tool-strict-required-conformance.test.ts
 * @suite OpenAI strict-mode schema conformance — pack-core
 *
 * Regression test for #998 ("Invalid schema for function 'core_emit_ui': ...
 * 'required' is required to be supplied and to be an array including every
 * key in properties. Missing 'sendDataModel'.").
 *
 * OpenAI's Responses API enforces strict-mode function-tool schemas:
 *   For every `{ type: "object", properties: {...} }` node, the `required`
 *   array MUST contain every key in `properties`. Zod's `.optional()` maps
 *   to "not in required", and the @openai/agents strict-mode transform does
 *   NOT re-rewrite optional fields nested inside a `z.discriminatedUnion`.
 *
 * This test walks the JSON schema produced by every pack-core tool and
 * asserts the invariant across EVERY object node (top-level + every nested
 * branch in `anyOf`/`oneOf`/`allOf`/`items`). Parametrised across all pack-
 * core tools so new tools inherit the guarantee automatically.
 *
 * Originally requested by Nibbler (QA) on DP #998.
 */

import { describe, it, expect } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  emitUiTool,
  fetchWebpageTool,
  readFileTool,
  writeFileTool,
  listFilesTool,
  validateArtifactsTool,
} from '../tools/index.js';
import { createSearchComponentsTool } from '../tools/search_components.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Walk a JSON schema. For every node that is `{ type: "object", properties }`,
 * verify every key in `properties` is present in `required`. Collects each
 * violation as a human-readable path so failures name the exact branch.
 */
function collectStrictRequiredViolations(node: unknown, path: string): string[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];

  const obj = node as Record<string, unknown>;
  const issues: string[] = [];

  if (obj.type === 'object' && obj.properties && typeof obj.properties === 'object') {
    const props = obj.properties as Record<string, unknown>;
    const required = Array.isArray(obj.required) ? (obj.required as unknown[]) : [];
    for (const key of Object.keys(props)) {
      if (!required.includes(key)) {
        issues.push(`${path}.properties.${key} (missing from required)`);
      }
    }
  }

  if (obj.properties && typeof obj.properties === 'object') {
    for (const [key, val] of Object.entries(obj.properties as Record<string, unknown>)) {
      issues.push(...collectStrictRequiredViolations(val, `${path}.properties.${key}`));
    }
  }
  if (obj.items) {
    issues.push(...collectStrictRequiredViolations(obj.items, `${path}.items`));
  }
  // `additionalProperties` may be a schema; recurse if it is an object.
  if (
    obj.additionalProperties &&
    typeof obj.additionalProperties === 'object' &&
    !Array.isArray(obj.additionalProperties)
  ) {
    issues.push(
      ...collectStrictRequiredViolations(
        obj.additionalProperties,
        `${path}.additionalProperties`,
      ),
    );
  }
  for (const kw of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(obj[kw])) {
      (obj[kw] as unknown[]).forEach((sub, i) => {
        issues.push(...collectStrictRequiredViolations(sub, `${path}.${kw}[${i}]`));
      });
    }
  }

  return issues;
}

function getToolSchema(contrib: { tool: unknown }): Record<string, unknown> | null {
  const t = contrib.tool as FunctionTool;
  if (t.type !== 'function') return null;
  return t.parameters as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const stubRegistry = {
  components: [{ name: 'Button', description: 'A button', schema: {} }],
};

const tools = [
  { name: 'core.emit_ui', contrib: emitUiTool },
  { name: 'core.fetch_webpage', contrib: fetchWebpageTool },
  { name: 'core.read_file', contrib: readFileTool },
  { name: 'core.write_file', contrib: writeFileTool },
  { name: 'core.list_files', contrib: listFilesTool },
  { name: 'core.validate_artifacts', contrib: validateArtifactsTool },
  { name: 'core.search_components', contrib: createSearchComponentsTool(stubRegistry) },
] as const;

describe('pack-core tool strict-mode `required` conformance (#998)', () => {
  for (const { name, contrib } of tools) {
    it(`${name}: every property of every object node is listed in required`, () => {
      const schema = getToolSchema(contrib);
      if (!schema) return; // non-function tools are exempt

      const issues = collectStrictRequiredViolations(schema, 'root');
      expect(
        issues,
        `Strict-mode violations in ${name} schema:\n  - ${issues.join('\n  - ')}`,
      ).toHaveLength(0);
    });
  }

  it('core.emit_ui: createSurface branch includes sendDataModel in required (regression for #998)', () => {
    const schema = getToolSchema(emitUiTool);
    expect(schema).toBeTruthy();
    // Drill into the discriminated-union branch for createSurface.
    const message = (schema as Record<string, unknown>).properties as Record<string, unknown>;
    const msgSchema = message.message as Record<string, unknown>;
    const branches = (msgSchema.anyOf ?? msgSchema.oneOf) as Array<Record<string, unknown>>;
    const createSurfaceBranch = branches.find((b) => {
      const props = b.properties as Record<string, Record<string, unknown>> | undefined;
      return props?.op?.const === 'createSurface';
    });
    expect(createSurfaceBranch, 'createSurface branch not found').toBeTruthy();
    const csObj = (createSurfaceBranch!.properties as Record<string, Record<string, unknown>>)
      .createSurface;
    expect(csObj.required).toContain('sendDataModel');
  });
});
