---
"@aks-kickstart/pack-core": patch
---

fix(pack-core): refactor emit_ui tool schema to per-component discriminated union (#1017)

Root cause: the flat nullable `A2UIComponentSchema` forced every field (`child`, `children`, `text`, `action`) onto every component variant under OpenAI strict-mode. Reasoning models emitting `""` instead of `null` bypassed `stripNulls()`, reaching the client registry with non-spec properties and causing all components to render as `_ErrorComponent`.

Fix: replace the flat schema with a `z.discriminatedUnion('component', [...])` where each variant (Text, Button, Row, Column, Card, Image, TextField, CheckBox, and 18 more) declares only its own applicable fields with `.strict()` to reject extra keys at the tool input boundary. Required fields per Ahmed's directive (Text.text, Image.url, Button.child + action, TextField.label, CheckBox.label + value) are always emitted; no null placeholder cross-contamination.
