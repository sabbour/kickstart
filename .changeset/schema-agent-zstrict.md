---
"@aks-kickstart/harness": minor
"@aks-kickstart/pack-core": patch
---

Add `z-strict.ts` harness module with OpenAI strict-mode safe Zod helpers.

## New: `@aks-kickstart/harness/runtime/z-strict`

Exports three helpers that replace Zod patterns that violate OpenAI strict-mode:

- **`strictOptional(schema)`** — replaces `.optional()` (I2 violation). Wraps as `.nullable()` so the key stays in `required[]` but the value can be `null`. Pair with `stripNulls()` in `execute()`.
- **`stripNulls(obj)`** — removes `null`-valued keys before passing to `A2UIMessageSchema.parse()` or returning results. Pair with `strictOptional()`.
- **`isHttpsUrl(value)`** — replaces `z.string().url()` (I5 violation: emits `format: "uri"` which OpenAI rejects). Pure runtime HTTPS URL validator.

## Updated: `schema-conformance.ts`

`assertStrictlyConformant()` now validates all 6 strict-mode invariants with improved error messages that name the invariant (I1–I6) and the offending path.

## Updated: `emit_ui.ts`

Removes local `stripNulls` in favour of the harness export.

## Updated: `triage.agent.md`

`core.triage` model upgraded from `envVar: KICKSTART_CHAT_MODEL` to `id: gpt-5.4` to fix TrackPicker shown when intent is clear (Image 1 regression).
