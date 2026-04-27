# OpenAI Strict-Mode Zod Schemas

> Required reading before writing any `tool()` parameter schema or `UserActionContribution` in this repo.

## SCOPE

✅ THIS SKILL COVERS:
- Why OpenAI strict-mode exists and what it enforces
- Forbidden Zod patterns and their compliant replacements
- The harness helpers to use instead
- How to verify your schema passes before opening a PR

❌ THIS SKILL DOES NOT COVER:
- Server-side validation schemas (internal only, not passed to OpenAI)
- Frontend Zod usage

## Confidence

`high` — enforced by CI conformance test since issue #1005. Pattern confirmed across `emit_ui`, all pack tools, all user actions.

---

## Why This Matters

The `@openai/agents` SDK sends every function tool's schema to OpenAI's Responses API with `strict: true`. OpenAI **rejects the request at HTTP 400** if the schema violates its rules. The violations do not surface in TypeScript compilation or local unit tests that mock the API — they only appear in production or when the conformance test runs.

The standard Zod API was designed for TypeScript ergonomics, not for OpenAI strict-mode JSON Schema. Several common Zod patterns silently produce non-compliant output.

---

## The Five Invariants (enforced by CI)

| ID | Rule | Broken By |
|----|------|-----------|
| I1 | Every `{type:"object"}` node must declare `properties` | `z.record()` |
| I2 | Every key in `properties` must appear in `required` | `.optional()` |
| I3 | Every `{type:"object"}` must set `additionalProperties: false` | `z.record()`, `.passthrough()` |
| I4 | Every property schema needs `type` or a combinator | `z.unknown()` |
| I5 | No `format` values OpenAI rejects (e.g. `"uri"`) | `z.string().url()` |
| I6 | No `$ref` node may have sibling keys | `.describe()` on a shared/reused schema |

---

## Forbidden → Allowed Substitution Table

### `.optional()` → `strictOptional()` + `stripNulls()`

OpenAI strict-mode requires every declared property to appear in `required`. `.optional()` keeps the field out of `required`. Use the harness helper instead.

```ts
import { strictOptional, stripNulls } from '@aks-kickstart/harness/runtime/z-strict';

// ❌
const Bad = z.object({ clusterName: z.string().optional() });

// ✅
const Good = z.object({ clusterName: strictOptional(z.string()) });

// In execute(): convert null → absent before internal parse
execute: async (input) => {
  const clean = stripNulls(input);
  const parsed = MyInternalSchema.parse(clean); // internal schema can use .optional()
}
```

### `z.record()` → closed object or JSON-string

`z.record()` produces an open-keyed object with no `properties` key. There is **no generic drop-in**. You must choose based on your key set:

```ts
// ❌
z.object({ env: z.record(z.string(), z.string()) })

// ✅ Option A — key set is known at authoring time
z.object({
  env: z.object({
    NODE_ENV: strictOptional(z.string()),
    PORT: strictOptional(z.string()),
  }).strict()
})

// ✅ Option B — key set is truly open; encode as JSON string, parse in execute()
z.object({
  envJson: z.string().describe('JSON object mapping env var names to values.')
})
// In execute(): const env = JSON.parse(input.envJson) as Record<string, string>
```

**This applies to both input (parameters) and output schemas.** Output schemas that use
`z.record()` or `z.unknown()` also violate I1+I3+I4 when tested with `assertStrictlyConformant()`.
Encode open-keyed fields as JSON strings even in return-value schemas:

```ts
// ❌ Output schema with open map — fails assertStrictlyConformant()
const OutSchema = z.object({
  tags: z.record(z.string(), z.string()).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown(),
});

// ✅ Encode open-keyed fields as nullable JSON strings
const OutSchema = z.object({
  tags: z.string().nullable().describe('JSON-encoded tags, e.g. {"env":"prod"}'),
  properties: z.string().nullable().describe('JSON-encoded resource properties'),
  raw: z.string().describe('JSON-encoded full response'),
});

// In execute(): stringify before returning
return OutSchema.parse({
  tags: data.tags != null ? JSON.stringify(data.tags) : null,
  properties: data.properties != null ? JSON.stringify(data.properties) : null,
  raw: JSON.stringify(data),
});
```

### `.passthrough()` → `.strict()`

`.passthrough()` sets `additionalProperties: {}` instead of `additionalProperties: false`.

```ts
// ❌
z.object({ track: z.string() }).passthrough()

// ✅
z.object({ track: z.string() }).strict()
```

Note: if `.passthrough()` was used to allow the LLM to pass extra keys through for downstream use, the correct fix is to explicitly declare those keys in the schema.

### `z.unknown()` → typed alternative

```ts
// ❌ — produces {}, no type key
z.object({ data: z.unknown() })

// ✅ — use the actual type if known
z.object({ data: z.string() })  // or z.number(), or a z.union([...])

// ✅ — if truly opaque, encode as JSON string
z.object({ dataJson: z.string().describe('JSON-encoded payload.') })
```

### `z.string().url()` → `.refine(isHttpsUrl, …)`

`z.string().url()` emits `{ type: "string", format: "uri" }`. OpenAI rejects `format: "uri"`.

```ts
import { isHttpsUrl } from '@aks-kickstart/harness/runtime/z-strict';

// ❌
z.string().url()

// ✅
z.string().refine(isHttpsUrl, { message: 'Only HTTPS URLs are allowed.' })
```

### `.describe()` on shared schemas → leaf-only descriptions

When a Zod schema is reused across multiple branches, the SDK's `mergeJsonSchemaDescriptions` injects `description` as a sibling to `$ref`, which is invalid.

```ts
// ❌ — ActionSchema reused in 5+ components; .describe() on the container
//     triggers $ref+description sibling violation
const ActionSchema = z.object({ event: z.object({ name: z.string() }) })
  .describe('Action dispatched when activated.');

// ✅ — describe only on the leaf node inside the shared schema
const ActionSchema = z.object({
  event: z.object({
    name: z.string().describe('Action dispatched when activated.'),
  }),
});
```

---

## How to Verify Before Opening a PR

```bash
npx vitest run packages/web/api/src/startup/schema-conformance.test.ts
```

This test loads the live registry and checks every registered tool and user action. If it passes, your schema is compliant. The test runs automatically in CI (`npx vitest run`) — violations block merge.

**If your tool uses a factory function** (e.g. `createMyTool(deps)`), ensure it is registered in the pack's tool list so the conformance test discovers it. Unregistered tools are invisible to the test.

---

## Anti-Patterns That Have Broken Production

| Issue | Pattern | Effect |
|-------|---------|--------|
| #1032 | `z.record()` in `emit_ui` payload | HTTP 400 on every `/api/converse` call |
| #1050 | `.describe()` on shared `ActionSchema` | HTTP 400 — `$ref`+`description` sibling |
| #998  | `.optional()` inside `z.discriminatedUnion` branch | `sendDataModel` missing from `required` → 400 |
| #966  | `z.unknown()` in component schemas | HTTP 400 — "schema must have a 'type' key" |
| #1075 | `z.string().url()` on `SummaryCard` link | HTTP 400 — `format: "uri"` rejected |
