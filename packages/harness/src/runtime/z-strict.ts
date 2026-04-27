/**
 * @module z-strict
 *
 * Strict-mode-safe Zod helpers for OpenAI function tool schemas.
 *
 * OpenAI's Responses API enforces `strict: true` on every function tool's
 * JSON Schema. The standard Zod API has several patterns that are ergonomic
 * in TypeScript but produce non-compliant JSON Schema. This module replaces
 * them with compliant equivalents and centralises `stripNulls()`, which every
 * tool that uses `strictOptional()` needs in its `execute()` body.
 *
 * ## Quick reference
 *
 * | ❌ Do NOT use in tool params | ✅ Use this instead                     | Why                              |
 * |------------------------------|-----------------------------------------|----------------------------------|
 * | `z.record(k, v)`             | Closed `z.object({…}).strict()`         | I1+I3: no `properties`, open map |
 * | `.optional()`                | `strictOptional(schema)`                | I2: missing from `required`      |
 * | `.passthrough()`             | (remove; use `.strict()`)               | I3: `additionalProperties` open  |
 * | `z.unknown()`                | `z.string()` or a typed union           | I4: no `type` key                |
 * | `z.string().url()`           | `.refine(val => isHttpsUrl(val), …)`    | I5: emits `format:"uri"`         |
 * | `.describe()` on shared ref  | Describe only on leaf nodes             | $ref+description sibling         |
 *
 * ## Patterns in detail
 *
 * ### Replace `.optional()` with `strictOptional()`
 *
 * ```ts
 * // ❌ Produces { properties: { name: { type: "string" } }, required: [] }
 * // — `name` missing from `required` → I2 violation.
 * z.object({ name: z.string().optional() })
 *
 * // ✅ All properties appear in required; null signals "absent".
 * // Call stripNulls(input) before A2UIMessageSchema.parse() in execute().
 * z.object({ name: strictOptional(z.string()) })
 * ```
 *
 * ### Replace `z.record()` with a closed object
 *
 * There is **no generic drop-in replacement** for `z.record()` in tool schemas.
 * You must know your key set at authoring time. If the key set is truly open,
 * encode the map as a JSON string and parse it in `execute()`:
 *
 * ```ts
 * // ❌ Open map — I1+I3 violations.
 * z.object({ env: z.record(z.string(), z.string()) })
 *
 * // ✅ Option A — known keys (preferred when feasible).
 * z.object({
 *   env: z.object({ NODE_ENV: z.string(), PORT: z.string() }).strict()
 * })
 *
 * // ✅ Option B — truly open map; encode as JSON string.
 * z.object({ envJson: z.string().describe('JSON-encoded key/value map.') })
 * // Then in execute(): const env = JSON.parse(input.envJson) as Record<string,string>
 * ```
 */

import type { z } from 'zod';

// ── strictOptional ────────────────────────────────────────────────────────────

/**
 * OpenAI strict-mode requires every declared property to be in `required`.
 * Use `strictOptional(schema)` instead of `.optional()` for fields that the
 * model may legitimately omit. The field is declared as `nullable` so the
 * model sets it to `null` when it has no value; call `stripNulls(input)`
 * in `execute()` before downstream validation.
 *
 * @example
 * ```ts
 * const MyToolSchema = z.object({
 *   required_field: z.string(),
 *   optional_field: strictOptional(z.string()),
 * });
 * // execute: const clean = stripNulls(input); myParser.parse(clean);
 * ```
 */
export function strictOptional<T extends z.ZodTypeAny>(schema: T): z.ZodNullable<T> {
  return schema.nullable();
}

// ── stripNulls ────────────────────────────────────────────────────────────────

/**
 * Recursively drop every property whose value is `null`.
 *
 * Under OpenAI strict-mode, the model must emit every declared property — even
 * ones that semantically mean "absent". We use `null` for those and strip them
 * here so downstream Zod schemas that use `.optional()` (server-side, not
 * model-facing) receive `undefined` rather than `null`.
 *
 * Call this on `execute()` input **before** any internal schema parse.
 *
 * @example
 * ```ts
 * execute: async (input) => {
 *   const clean = stripNulls(input);
 *   const parsed = MyInternalSchema.parse(clean);
 *   // …
 * }
 * ```
 */
export function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripNulls(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out as T;
  }
  return value;
}

// ── isHttpsUrl ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when `val` is a syntactically valid `https:` URL.
 *
 * Use with `.refine()` instead of `z.string().url()`. The latter emits
 * `{ type: "string", format: "uri" }` which OpenAI strict-mode rejects (I5).
 *
 * @example
 * ```ts
 * // ❌ z.string().url()   →  format:"uri"  →  rejected by OpenAI
 * // ✅
 * z.string().refine(isHttpsUrl, { message: 'Only HTTPS URLs allowed' })
 * ```
 */
export function isHttpsUrl(val: string): boolean {
  try {
    return new URL(val).protocol === 'https:';
  } catch {
    return false;
  }
}
