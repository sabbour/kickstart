---
"@aks-kickstart/harness": minor
"@aks-kickstart/web": minor
"@aks-kickstart/pack-core": minor
---

**Zod v4 monorepo convergence** — drops the `zod@3.x` bridge packages and migrates all `z.preprocess` callsites to Zod v4-native patterns.

**What changed for users:**
- `TriggerSchema` in `gen-gha-workflow` now narrows its input type from `unknown` to `string | string[]` (**TypeScript API breaking change** — callers casting `as any` to bypass `unknown` can remove the cast; callers relying on the `unknown` input type must update their call sites).
- JSON schemas emitted for pack components (`/api/packs`) now follow JSON Schema draft/2020-12 instead of draft-07. The structural content is equivalent; only the `$schema` URI changes.
- `z.toJSONSchema()` (Zod v4 built-in) replaces `zodToJsonSchema()` from the deprecated `zod-to-json-schema` package.

**What didn't change (runtime equivalence preserved):**
- All numeric fields continue to reject `null`, `undefined`, empty string, and non-numeric strings with a validation error.
- All string-coerce fields continue to reject `undefined` and coerce other primitives via `String()`.
- All A2UI message schemas (`CreateSurfaceMessage`, `UpdateComponentsMessage`, `UpdateDataModelMessage`, `DeleteSurfaceMessage`) continue to inject the `op` discriminant from the envelope key before union dispatch.

**Out of scope (Kif follow-up):**
- CI guardrail enforcing Zod v4 going forward (`.github/workflows/`)
- `.squad/skills/zod-monorepo-split/SKILL.md` correction (Kif applies separately)
