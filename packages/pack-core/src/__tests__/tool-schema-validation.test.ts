/**
 * @file tool-schema-validation.test.ts
 * @suite Tool JSON schema completeness — pack-core
 *
 * Asserts that every tool registered by pack-core produces a JSON schema
 * where EVERY property entry (and nested entry) carries a `type` key or a
 * valid JSON Schema combinator (`oneOf`, `anyOf`, `allOf`, `$ref`).
 *
 * A missing `type` causes the OpenAI Responses API to reject the entire
 * tool list with HTTP 400 — "schema must have a 'type' key" — which breaks
 * all A2UI output (see #966).
 *
 * This test is intentionally structural: it does not invoke the tools; it
 * only walks the JSON schema object produced by the SDK's Zod-to-JSON-Schema
 * converter and flags any property that would cause a 400.
 */

import { describe, it, expect } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import { emitUiTool, fetchWebpageTool, readFileTool, writeFileTool, listFilesTool, validateArtifactsTool } from '../tools/index.js';
import { createSearchComponentsTool } from '../tools/search_components.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively walk a JSON Schema object and collect paths where a schema node
 * is missing `type` AND no combinator (`oneOf`, `anyOf`, `allOf`, `$ref`) is
 * present. These nodes would cause the OpenAI API to reject the tool.
 */
function collectMissingTypes(node: unknown, path: string): string[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];

  const obj = node as Record<string, unknown>;
  const issues: string[] = [];

  const hasTypeOrCombinator =
    'type' in obj ||
    'oneOf' in obj ||
    'anyOf' in obj ||
    'allOf' in obj ||
    '$ref' in obj ||
    'const' in obj;

  // Root node and additionalProperties nodes are exempt from this check.
  if (!hasTypeOrCombinator && path !== 'root' && !path.endsWith('.additionalProperties')) {
    issues.push(path);
  }

  if (obj.properties && typeof obj.properties === 'object') {
    for (const [key, val] of Object.entries(obj.properties as Record<string, unknown>)) {
      issues.push(...collectMissingTypes(val, `${path}.properties.${key}`));
    }
  }
  if (obj.items) {
    issues.push(...collectMissingTypes(obj.items, `${path}.items`));
  }
  if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
    issues.push(...collectMissingTypes(obj.additionalProperties, `${path}.additionalProperties`));
  }
  for (const kw of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(obj[kw])) {
      (obj[kw] as unknown[]).forEach((sub, i) => {
        issues.push(...collectMissingTypes(sub, `${path}.${kw}[${i}]`));
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
  components: [
    { name: 'Button', description: 'A button', schema: {} },
  ],
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

describe('pack-core tool JSON schema completeness', () => {
  for (const { name, contrib } of tools) {
    it(`${name}: every property schema has a type or combinator`, () => {
      const schema = getToolSchema(contrib);
      if (!schema) return; // non-function tools are exempt

      const issues = collectMissingTypes(schema, 'root');
      expect(issues, `Missing type keys in ${name} schema at: ${issues.join(', ')}`).toHaveLength(0);
    });
  }
});
