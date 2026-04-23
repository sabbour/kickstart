---
"@aks-kickstart/pack-core": patch
---

Fix `core.emit_ui` tool schema so the OpenAI Responses API accepts it in
strict mode (#1032). The `action.event.payload` field was serialised by the
`@openai/agents-core` Zod-to-JSON-Schema converter as
`{ type: 'object', additionalProperties: <scalar> }` with no `properties`
key (the `buildRecordSchema` path for `z.record(...)`), which OpenAI strict
mode rejects with:

    400 Invalid schema for function 'core_emit_ui': In context=(), object
    schema missing properties.

This broke every conversation that registers the `emit_ui` tool (i.e. every
core-pack conversation in the Playground and the converse endpoint).

### User-visible change — schema narrowing

`payload` is now a **closed object** with a fixed key set:

    {
      confirmed: boolean | null,
      id:        string  | null,
      value:     string | number | boolean | null,
      action:    string  | null,
      target:    string  | null,
    }

Unused keys MUST be set to `null`; the tool's `stripNulls()` helper
collapses `null` → absent before `A2UIMessageSchema.parse()` as before. The
`a2ui-output-discipline` skill's `SKILL.md` example is updated to teach this
shape.

**Intentional narrowing:** `confirmed` is the only key with existing in-repo
usage (the emit_ui confirm-dialog test fixture). `id` / `value` / `action` /
`target` are added as forward-looking interaction keys; they are NOT present
in current catalog, playground, or skill payloads. Skills or prompts that
dispatch events with payload keys outside this set will have those keys
silently stripped (OpenAI strict + Zod `.strip()` default). Adding new keys
requires a code change plus a test update — if the list grows past ~8
entries, prefer a JSON-string payload parsed in `execute()` instead.

### Regression coverage

Two new structural tests in `packages/pack-core/src/__tests__/`:

- `tool-strict-mode-conformance.test.ts` — walks every pack-core tool
  schema and asserts OpenAI's strict-mode object invariants #1
  (`properties` present) and #3 (`additionalProperties: false`). Includes a
  negative control that builds a transient tool with `z.record(...)` and
  asserts the walker flags it. Also asserts the nullable wrapper on
  `emit_ui.action.event.payload` survives the converter (`anyOf` with
  `type: 'null'`).
- `skill-a2ui-output-discipline.test.ts` — guards the shipped SKILL.md so
  the retired `"payload": { /* optional */ }` placeholder cannot come back.

Closes #1032.
