---
'@aks-kickstart/pack-core': patch
'@aks-kickstart/web': patch
---

fix(web): align A2UI schema and renderer with v0.9 spec (#984).

Spec: https://a2ui.org/specification/v0.9-a2ui/ and https://a2ui.org/concepts/components/.

**BREAKING within the internal dialect:** `core.emit_ui` envelopes now use the
v0.9 adjacency-list shape (`id`, `component`, `child`, `children`, `text`,
`action`). The legacy top-level `label` / `onClick` / `onChange` / `items` /
`placeholder` / `value` / `disabled` fields have been dropped from both the
tool schema and the Fluent `Button` schema. **Clean break — no back-compat
shim:** any envelope that still uses the legacy dialect is rejected by the
per-component Zod schemas, the component is replaced with `_ErrorComponent`,
and a `[A2UIRegistry]` `console.error` names the non-spec property so the
producer is fixed rather than silently translated.

- `core.emit_ui` schema now accepts only v0.9 fields plus `action: { event: { name, payload? } }`.
- Skill `a2ui-output-discipline` rewritten around the v0.9 adjacency-list example.
- Fluent `Row` / `Column` / `List` overrides switched to flexible (optional children, non-strict) schemas so lone containers no longer fall back to `_ErrorComponent`.
- Fluent `Button` schema is now strict: `label` / `onClick` / `onChange` are rejected. The visible label must be a child `Text` component referenced via `child`; interactions flow through `action.event.name`.
- Null / undefined prop values are dropped before per-component schema parse (empty strings preserved for DateTimeInput and friends).
