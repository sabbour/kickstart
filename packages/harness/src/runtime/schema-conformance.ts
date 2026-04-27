/**
 * @module schema-conformance
 *
 * Shared OpenAI strict-mode JSON-schema conformance helpers.
 *
 * OpenAI's Responses API enforces strict-mode invariants on every function
 * tool's JSON-schema parameters object. These walkers and collectors are the
 * single source of truth for those checks; they are consumed by the
 * universal pack conformance test (which discovers tools and user actions
 * dynamically through `PackRegistry`) and by per-pack regression tests that
 * cover specific schema shapes (e.g. `core.emit_ui` discriminated unions).
 *
 * The four invariants validated:
 *
 *   I1 — every `{ type: "object" }` node carries a `properties` key
 *        (an object, possibly empty). `z.record(...)` drops it.
 *   I2 — every property declared on an object node appears in `required`.
 *        Optional fields buried inside `z.discriminatedUnion` are the
 *        recurring offender (#998).
 *   I3 — every `{ type: "object" }` node sets `additionalProperties: false`
 *        explicitly. `z.record(...)` and `.passthrough()` produce
 *        `additionalProperties: <schema>` or `{}` instead (#1032).
 *   I4 — every property schema either has a `type` key or one of the
 *        documented combinators (`oneOf` / `anyOf` / `allOf` / `$ref` /
 *        `const`). A bare `{}` node causes the API to 400 with
 *        "schema must have a 'type' key" (#966).
 *
 * Originally lifted from pack-core's three test-local walkers (#998, #1032,
 * #966). Promoted into the harness so every pack — not just pack-core —
 * shares one implementation.
 */

import { tool } from '@openai/agents';
import type { FunctionTool } from '@openai/agents';
import type { z, ZodObject } from 'zod';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';

// ─────────────────────────────────────────────────────────────────────────────
// Walker
// ─────────────────────────────────────────────────────────────────────────────

export type SchemaNode = Record<string, unknown>;

export type SchemaVisitor = (node: SchemaNode, path: string) => void;

function isPlainObject(value: unknown): value is SchemaNode {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Walk a JSON-schema tree, invoking `visit` at every plain-object node. The
 * `path` argument names the nesting (e.g.
 * `root.properties.message.anyOf[2].properties.action`) so failure messages
 * point at the exact branch.
 */
export function walkSchema(node: unknown, path: string, visit: SchemaVisitor): void {
  if (!isPlainObject(node)) return;
  visit(node, path);

  if (isPlainObject(node.properties)) {
    for (const [key, child] of Object.entries(node.properties as SchemaNode)) {
      walkSchema(child, `${path}.properties.${key}`, visit);
    }
  }
  if (node.items !== undefined) {
    walkSchema(node.items, `${path}.items`, visit);
  }
  if (isPlainObject(node.additionalProperties)) {
    walkSchema(node.additionalProperties, `${path}.additionalProperties`, visit);
  }
  for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(node[keyword])) {
      (node[keyword] as unknown[]).forEach((sub, i) =>
        walkSchema(sub, `${path}.${keyword}[${i}]`, visit),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant collectors
// ─────────────────────────────────────────────────────────────────────────────

/** I1 — every `{ type: "object" }` node declares a `properties` key. */
export function collectMissingProperties(schema: unknown, rootPath = 'root'): string[] {
  const issues: string[] = [];
  walkSchema(schema, rootPath, (node, path) => {
    if (node.type === 'object' && !('properties' in node)) {
      issues.push(`${path} (type=object, no 'properties' key)`);
    }
  });
  return issues;
}

/** I2 — every key in `properties` appears in `required`. */
export function collectStrictRequiredViolations(schema: unknown, rootPath = 'root'): string[] {
  const issues: string[] = [];
  walkSchema(schema, rootPath, (node, path) => {
    if (
      node.type === 'object' &&
      isPlainObject(node.properties) &&
      Object.keys(node.properties).length > 0
    ) {
      const required = Array.isArray(node.required) ? (node.required as unknown[]) : [];
      for (const key of Object.keys(node.properties)) {
        if (!required.includes(key)) {
          issues.push(`${path}.properties.${key} (missing from required)`);
        }
      }
    }
  });
  return issues;
}

/** I3 — every `{ type: "object" }` node sets `additionalProperties: false`. */
export function collectAdditionalPropertiesViolations(
  schema: unknown,
  rootPath = 'root',
): string[] {
  const issues: string[] = [];
  walkSchema(schema, rootPath, (node, path) => {
    if (node.type === 'object' && node.additionalProperties !== false) {
      issues.push(
        `${path} (type=object, additionalProperties=${JSON.stringify(node.additionalProperties)}; expected false)`,
      );
    }
  });
  return issues;
}

/**
 * I4 — every property schema has a `type` key or a valid combinator.
 *
 * The root node and `additionalProperties` nodes are exempt because the
 * SDK is allowed to omit a top-level `type` when sending the schema.
 */
export function collectMissingTypes(schema: unknown, rootPath = 'root'): string[] {
  const issues: string[] = [];
  walkSchema(schema, rootPath, (node, path) => {
    const hasTypeOrCombinator =
      'type' in node ||
      'oneOf' in node ||
      'anyOf' in node ||
      'allOf' in node ||
      '$ref' in node ||
      'const' in node ||
      'enum' in node;
    if (!hasTypeOrCombinator && path !== rootPath && !path.endsWith('.additionalProperties')) {
      issues.push(path);
    }
  });
  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregator
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaConformanceReport {
  /** Display name of the tool/action being checked. */
  name: string;
  /** I1 violations. */
  missingProperties: string[];
  /** I2 violations. */
  strictRequiredViolations: string[];
  /** I3 violations. */
  additionalPropertiesViolations: string[];
  /** I4 violations. */
  missingTypes: string[];
}

export function reportSchemaConformance(name: string, schema: unknown): SchemaConformanceReport {
  return {
    name,
    missingProperties: collectMissingProperties(schema),
    strictRequiredViolations: collectStrictRequiredViolations(schema),
    additionalPropertiesViolations: collectAdditionalPropertiesViolations(schema),
    missingTypes: collectMissingTypes(schema),
  };
}

export function reportHasIssues(report: SchemaConformanceReport): boolean {
  return (
    report.missingProperties.length > 0 ||
    report.strictRequiredViolations.length > 0 ||
    report.additionalPropertiesViolations.length > 0 ||
    report.missingTypes.length > 0
  );
}

export function formatReport(report: SchemaConformanceReport): string {
  const lines: string[] = [`Strict-mode violations in ${report.name}:`];
  if (report.missingProperties.length > 0) {
    lines.push("  I1 — object node missing 'properties':");
    for (const issue of report.missingProperties) lines.push(`    - ${issue}`);
  }
  if (report.strictRequiredViolations.length > 0) {
    lines.push('  I2 — property missing from required:');
    for (const issue of report.strictRequiredViolations) lines.push(`    - ${issue}`);
  }
  if (report.additionalPropertiesViolations.length > 0) {
    lines.push('  I3 — additionalProperties !== false:');
    for (const issue of report.additionalPropertiesViolations) lines.push(`    - ${issue}`);
  }
  if (report.missingTypes.length > 0) {
    lines.push('  I4 — node missing type/combinator:');
    for (const issue of report.missingTypes) lines.push(`    - ${issue}`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the JSON-schema parameters object the SDK has already produced
 * for a `ToolContribution`, or `null` if the tool is not a function tool
 * (e.g. handoff tools have no schema).
 */
export function getToolJsonSchema(contribution: ToolContribution): SchemaNode | null {
  const fnTool = contribution.tool as FunctionTool;
  if (fnTool.type !== 'function') return null;
  return fnTool.parameters as SchemaNode;
}

/**
 * Returns the JSON-schema OpenAI sees for a user action.
 *
 * The runner wraps the action's parameters with
 * `z.object({ input: contrib.parameters }).passthrough()` at runtime, but
 * `.passthrough()` always trips invariant I3. For conformance checking we
 * therefore extract the action's *authored* parameter shape — what the
 * pack maintainer actually controls — by feeding it through the same SDK
 * `tool()` factory the runner uses for the inner schema. This produces the
 * JSON schema the model receives once the runner's outer `input` wrapper is
 * stripped away.
 */
export function getUserActionJsonSchema(contribution: UserActionContribution): SchemaNode {
  const wrapped = tool({
    name: 'schema_conformance_probe',
    description: contribution.description,
    parameters: contribution.parameters as unknown as ZodObject<z.ZodRawShape>,
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async () => 'unused',
  }) as unknown as FunctionTool;
  return wrapped.parameters as SchemaNode;
}
