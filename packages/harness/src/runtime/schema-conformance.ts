/**
 * @module schema-conformance
 *
 * Shared OpenAI strict-mode JSON-schema conformance helpers.
 *
 * Primary validator: `assertStrictlyConformant()` calls
 * `toStrictJsonSchema()` from `openai/lib/transform` — the same function
 * the OpenAI SDK runs before sending schemas to the API. This is the
 * authoritative source for I2 enforcement (all properties must be required).
 * It is NOT a maintained forbidden-pattern list.
 *
 * Secondary walkers (I1, I4, I5, I6) cover invariants that `toStrictJsonSchema()`
 * silently accepts but the API rejects:
 *
 *   I1 — every `{ type: "object" }` node carries a `properties` key.
 *   I4 — every property schema has a `type` key or a combinator.
 *   I5 — no schema node emits `format` values OpenAI rejects (e.g. `uri`).
 *   I6 — no unsupported `oneOf` remains after guarded compatibility rewrites.
 *
 * Note: I2 (optional without nullable) and I3 (additionalProperties) are
 * handled authoritatively by `toStrictJsonSchema()` — I2 throws, I3 is
 * auto-fixed — so the walkers for those are kept only for defence-in-depth
 * in per-pack unit tests that run before the SDK transform.
 */

import { tool } from '@openai/agents';
import type { FunctionTool } from '@openai/agents';
import type { JSONSchema } from 'openai/lib/jsonschema';
import { toStrictJsonSchema } from 'openai/lib/transform';
import type { z, ZodObject } from 'zod';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';

// ─────────────────────────────────────────────────────────────────────────────
// Walker
// ─────────────────────────────────────────────────────────────────────────────
// Authoritative validator (uses OpenAI SDK directly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authoritative I2 enforcement: calls `toStrictJsonSchema()` from the
 * `openai` package — the exact function the SDK runs before the API call.
 *
 * Throws with OpenAI's own error message if any property is `.optional()`
 * without `.nullable()`:
 *
 *   "Zod field at `properties/x` uses `.optional()` without `.nullable()`
 *    which is not supported by the API. See: https://platform.openai.com/..."
 *
 * Pass the schema returned by `getToolJsonSchema()` or
 * `getUserActionJsonSchema()`. The function operates on a deep clone so the
 * original schema node is not mutated.
 */
export function assertStrictlyConformant(schema: SchemaNode, toolName: string): void {
  try {
    toStrictJsonSchema(openAIStrictCompatibleSchema(schema) as JSONSchema);
  } catch (e) {
    throw new Error(`[${toolName}] ${(e as Error).message}`, { cause: e });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Walker (secondary checks — I1, I4, I5)
// ─────────────────────────────────────────────────────────────────────────────

export type SchemaNode = Record<string, unknown>;

export type SchemaVisitor = (node: SchemaNode, path: string) => void;

function isPlainObject(value: unknown): value is SchemaNode {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI strict-schema compatibility
// ─────────────────────────────────────────────────────────────────────────────

function hasRequiredConstDiscriminator(
  branch: SchemaNode,
  key: string,
): branch is SchemaNode & { properties: SchemaNode; required: unknown[] } {
  if (branch.type !== 'object') return false;
  if (branch.additionalProperties !== false) return false;
  if (!isPlainObject(branch.properties)) return false;
  if (!Array.isArray(branch.required) || !branch.required.includes(key)) return false;

  const prop = branch.properties[key];
  return isPlainObject(prop) && Object.prototype.hasOwnProperty.call(prop, 'const');
}

function constMapKey(value: unknown): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function isProvablyDiscriminatedOneOf(branches: unknown[]): branches is SchemaNode[] {
  if (branches.length < 2 || !branches.every(isPlainObject)) return false;

  const firstBranch = branches[0] as SchemaNode;
  const firstProperties = isPlainObject(firstBranch.properties) ? firstBranch.properties : {};
  const candidateKeys = Object.keys(firstProperties).filter((key) =>
    hasRequiredConstDiscriminator(firstBranch, key),
  );

  for (const key of candidateKeys) {
    const seen = new Set<string>();
    let safe = true;
    for (const branch of branches as SchemaNode[]) {
      if (!hasRequiredConstDiscriminator(branch, key)) {
        safe = false;
        break;
      }
      const constValue = (branch.properties[key] as SchemaNode).const;
      const seenKey = constMapKey(constValue);
      if (seen.has(seenKey)) {
        safe = false;
        break;
      }
      seen.add(seenKey);
    }
    if (safe && seen.size === branches.length) return true;
  }

  return false;
}

/**
 * OpenAI strict tool schemas currently reject `oneOf`, while Zod v4 emits
 * `oneOf` for discriminated unions. Rewrite only the narrow, provably-safe
 * shape to `anyOf`; leave all other unions untouched so conformance tests still
 * catch unsupported/ambiguous schemas.
 *
 * When both `anyOf` and a safe discriminated `oneOf` exist on the same node,
 * the original semantics are `(anyOf) AND (oneOf)` — a conjunction. Flattening
 * them into a single `anyOf` would silently weaken that to a broad OR.  Instead
 * we preserve the conjunction via `allOf: [{ anyOf: existing }, { anyOf: converted }]`
 * and remove the top-level `anyOf`/`oneOf` from the node.
 */
export function rewriteDiscriminatedOneOfToAnyOf(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => rewriteDiscriminatedOneOfToAnyOf(item));
  }
  if (!isPlainObject(schema)) {
    return schema;
  }

  const rewritten: SchemaNode = {};
  for (const [key, value] of Object.entries(schema)) {
    rewritten[key] = rewriteDiscriminatedOneOfToAnyOf(value);
  }

  if (Array.isArray(rewritten.oneOf) && isProvablyDiscriminatedOneOf(rewritten.oneOf)) {
    const convertedOneOf = rewritten.oneOf;
    delete rewritten.oneOf;
    if (Array.isArray(rewritten.anyOf)) {
      // Preserve conjunction: (existing anyOf) AND (converted oneOf variants).
      const existingAnyOf = rewritten.anyOf;
      delete rewritten.anyOf;
      const existingAllOf = Array.isArray(rewritten.allOf) ? rewritten.allOf : [];
      if (existingAllOf.length > 0) delete rewritten.allOf;
      rewritten.allOf = [...existingAllOf, { anyOf: existingAnyOf }, { anyOf: convertedOneOf }];
    } else if (!('anyOf' in rewritten)) {
      rewritten.anyOf = convertedOneOf;
    } else {
      // anyOf is present but not an array — leave oneOf intact so I6 catches it.
      rewritten.oneOf = convertedOneOf;
    }
  }

  return rewritten;
}

export function openAIStrictCompatibleSchema(schema: SchemaNode): SchemaNode {
  return rewriteDiscriminatedOneOfToAnyOf(schema) as SchemaNode;
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

/**
 * I0 — root schema must be type:"object".
 * Some non-conformant roots arrive without a usable root `type`, e.g.
 * ZodEffects (from .refine(), .transform(), .pipe()) and `$ref`-at-root
 * shapes where the root `type` is missing/undefined. The OpenAI API rejects
 * these with HTTP 400; this catches them in CI before deploy.
 */
export function checkRootIsObject(schema: unknown, toolName: string): string[] {
  const observedType = isPlainObject(schema) ? schema.type : undefined;
  if (observedType !== 'object') {
    return [
      `${toolName}: root schema type is ${observedType === undefined ? 'undefined' : JSON.stringify(observedType)}, expected "object". ` +
        `Did you wrap the input schema with .refine(), .transform(), or .pipe()? These produce ZodEffects which OpenAI rejects.`,
    ];
  }
  return [];
}

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

// OpenAI strict-mode validation rejects these JSON Schema format values. Keep
// this list aligned with observed API validation errors and add a regression
// test whenever a new unsupported format is discovered.
const OPENAI_UNSUPPORTED_FORMATS = new Set(['uri']);

/** I5 — OpenAI strict mode rejects some JSON Schema `format` values. */
export function collectUnsupportedFormats(schema: unknown, rootPath = 'root'): string[] {
  const issues = new Set<string>();

  const recordIssue = (node: SchemaNode, path: string): void => {
    if (typeof node.format === 'string' && OPENAI_UNSUPPORTED_FORMATS.has(node.format)) {
      issues.add(`${path} (format=${JSON.stringify(node.format)})`);
    }
  };

  const scanNode = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        scanNode(item, `${path}[${index}]`);
      });
      return;
    }

    if (!isPlainObject(value)) {
      return;
    }

    recordIssue(value, path);

    for (const [key, child] of Object.entries(value)) {
      if (Array.isArray(child)) {
        child.forEach((item, index) => {
          scanNode(item, `${path}.${key}[${index}]`);
        });
      } else if (isPlainObject(child)) {
        scanNode(child, `${path}.${key}`);
      }
    }
  };

  walkSchema(schema, rootPath, recordIssue);
  scanNode(schema, rootPath);

  return [...issues];
}

/** I6 — OpenAI strict mode rejects `oneOf`; safe discriminated unions are rewritten first. */
export function collectUnsupportedOneOf(schema: unknown, rootPath = 'root'): string[] {
  const issues: string[] = [];
  walkSchema(rewriteDiscriminatedOneOfToAnyOf(schema), rootPath, (node, path) => {
    if (Array.isArray(node.oneOf)) {
      issues.push(`${path}.oneOf`);
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
  /** I0 violations — root schema must be type:"object". */
  i0RootType: string[];
  /** I1 violations. */
  missingProperties: string[];
  /** I2 violations. */
  strictRequiredViolations: string[];
  /** I3 violations. */
  additionalPropertiesViolations: string[];
  /** I4 violations. */
  missingTypes: string[];
  /** I5 violations. */
  unsupportedFormats: string[];
  /** I6 violations. */
  unsupportedOneOf: string[];
}

export function reportSchemaConformance(name: string, schema: unknown): SchemaConformanceReport {
  const compatibleSchema = isPlainObject(schema) ? openAIStrictCompatibleSchema(schema) : schema;
  return {
    name,
    i0RootType: checkRootIsObject(compatibleSchema, name),
    missingProperties: collectMissingProperties(compatibleSchema),
    strictRequiredViolations: collectStrictRequiredViolations(compatibleSchema),
    additionalPropertiesViolations: collectAdditionalPropertiesViolations(compatibleSchema),
    missingTypes: collectMissingTypes(compatibleSchema),
    unsupportedFormats: collectUnsupportedFormats(compatibleSchema),
    unsupportedOneOf: collectUnsupportedOneOf(compatibleSchema),
  };
}

export function reportHasIssues(report: SchemaConformanceReport): boolean {
  return (
    report.i0RootType.length > 0 ||
    report.missingProperties.length > 0 ||
    report.strictRequiredViolations.length > 0 ||
    report.additionalPropertiesViolations.length > 0 ||
    report.missingTypes.length > 0 ||
    report.unsupportedFormats.length > 0 ||
    report.unsupportedOneOf.length > 0
  );
}

export function formatReport(report: SchemaConformanceReport): string {
  const lines: string[] = [`Strict-mode violations in ${report.name}:`];
  if (report.i0RootType.length > 0) {
    lines.push('  I0 — root schema must be type:"object":');
    for (const issue of report.i0RootType) lines.push(`    - ${issue}`);
  }
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
  if (report.unsupportedFormats.length > 0) {
    lines.push('  I5 — unsupported OpenAI JSON Schema format:');
    for (const issue of report.unsupportedFormats) lines.push(`    - ${issue}`);
  }
  if (report.unsupportedOneOf.length > 0) {
    lines.push('  I6 — unsupported OpenAI JSON Schema oneOf:');
    for (const issue of report.unsupportedOneOf) lines.push(`    - ${issue}`);
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
  return openAIStrictCompatibleSchema(fnTool.parameters as SchemaNode);
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
    execute: async () => 'unused',
  }) as unknown as FunctionTool;
  return openAIStrictCompatibleSchema(wrapped.parameters as SchemaNode);
}
