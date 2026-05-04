---
sidebar_position: 5
---

# Schema Conformance

OpenAI's Responses API enforces `strict: true` on every function tool's JSON Schema. The Zod patterns that are ergonomic in TypeScript do not, by default, produce compliant JSON Schema. Kickstart enforces compliance in two layers: at **authoring time** (`runtime/z-strict.ts`) and at **registration time** (`runtime/schema-conformance.ts`).

---

## Authoring rules — `runtime/z-strict.ts`

| ❌ Don't use in tool params | ✅ Use this | Why |
|---|---|---|
| `z.record(k, v)` | Closed `z.object({…}).strict()` | I1+I3: open map / no `properties` |
| `.optional()` | `strictOptional(schema)` | I2: missing from `required` |
| `.passthrough()` | (remove; use `.strict()`) | I3: `additionalProperties` open |
| `z.unknown()` | `z.string()` or a typed union | I4: no `type` key |
| `z.string().url()` | `.refine(v => isHttpsUrl(v), …)` | I5: emits `format: "uri"` |
| `.describe()` on shared `$ref` | Describe only on leaf nodes | `$ref` + `description` siblings |

`strictOptional(schema)` returns a nullable schema that still appears in `required[]`. Tools that use it must call `stripNulls(input)` in their `execute()` body before passing the value to downstream consumers that want `undefined`-semantics.

---

## Authoritative validation — `runtime/schema-conformance.ts`

`assertStrictlyConformant(schema, toolName)` calls `toStrictJsonSchema()` from `openai/lib/transform` — the **same** function the OpenAI SDK runs before sending schemas to the API. This is the source of truth for I2 enforcement. If any property is `.optional()` without `.nullable()`, the call throws with OpenAI's own message:

> "Zod field at \`properties/x\` uses `.optional()` without `.nullable()` which is not supported by the API."

Kickstart wraps that error with the offending tool name to make grep-debugging trivial.

---

## Walker invariants

The walker is a defence-in-depth layer that catches issues `toStrictJsonSchema()` silently accepts but the API rejects:

| Invariant | Visitor |
|---|---|
| **I1** every `{ type: "object" }` has a `properties` key | `collectMissingProperties` |
| **I2** every property is in `required[]` | `collectStrictRequiredViolations` (also covered authoritatively) |
| **I3** every object has `additionalProperties: false` | `collectAdditionalPropertiesViolations` |
| **I4** every property has a `type` or combinator | `collectMissingTypes` |
| **I5** no `format` value the API rejects (e.g. `uri`) | enforced via the rewriter |
| **I6** no unsupported `oneOf` after rewrite | `collectUnsupportedOneOf` + `rewriteDiscriminatedOneOfToAnyOf` |

Reporting helpers: `reportSchemaConformance`, `reportHasIssues`, `formatReport`. Schema extractors: `getToolJsonSchema(tool)`, `getUserActionJsonSchema(action)`. All of these are exported from `@aks-kickstart/harness`.

---

## Discriminated unions

Kickstart's strict-mode rewriter (`openAIStrictCompatibleSchema`) detects provably discriminated `oneOf` branches — every branch is `{ type: 'object', additionalProperties: false }` and shares a `const`-discriminator property listed in `required[]` — and rewrites them to `anyOf`, which the API accepts.

`hasRequiredConstDiscriminator` and `isProvablyDiscriminatedOneOf` are the predicates that gate the rewrite. Branches that don't qualify are surfaced via `collectUnsupportedOneOf` so the developer fixes the schema rather than silently shipping something the API will reject at runtime.

---

## When this runs

1. **Pack unit tests** call `assertStrictlyConformant(getToolJsonSchema(tool), tool.name)` for every tool and user-action in the pack. Examples:
   - `packages/pack-azure/src/tools/schema-conformance.test.ts`
   - `packages/web/api/src/startup/schema-conformance.test.ts`
2. **Startup wiring** in `packages/web/api/src/startup/` validates the full sealed registry before the API begins serving traffic — fail-fast over a strict-mode crash mid-turn.

The walker functions are also used by the agent-output type itself (`types/agent-output.ts`), which uses `strictOptional()` for `message` and `intent` so the model emits explicit `null`s rather than missing keys.
