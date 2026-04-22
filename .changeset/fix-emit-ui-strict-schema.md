---
"@aks-kickstart/pack-core": patch
---

Fix OpenAI strict-mode tool registration for emit_ui — remove $ref+description sibling violations that broke every /api/converse call in production. (#1050)

Regression is guarded by unit-level schema test (emit_ui-schema.test.ts); live converse canary was considered but dropped in favor of the unit test.
