---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/web": patch
---

Fix A2UI chat rendering: emit_ui tool schema now uses `component` field (not `type`) with required `id`, and `catalogId` is documented as `"kickstart"`. Previously emitted envelopes fell through to `_ErrorComponent` with "Missing component: root". DebugA2UITree resolves component types via the live client registry.
