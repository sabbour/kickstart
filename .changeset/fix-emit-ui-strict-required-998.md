---
"@aks-kickstart/pack-core": patch
---

Fix `core.emit_ui` OpenAI strict-mode schema regression (#998): `sendDataModel` (and all sibling optional fields under `createSurface` / `updateDataModel` / component entries) are now declared with `.nullable()` instead of `.nullable().optional()`, so every property in every union branch appears in `required`. emit_ui's runtime path now strips `null` values before validating against the harness `A2UIMessageSchema`. Adds a parametrised pack-core conformance test that walks every tool's JSON schema and fails if any property is missing from `required`. Also sweeps `core.list_files` for the same bug class.
