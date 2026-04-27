---
"@aks-kickstart/harness": patch
---

Fix schema violations surfaced under Responses API strict mode (#127)

Audits all tool input schemas across pack-azure, pack-aks-automatic,
pack-github, and pack-core. Fixes I2 (.optional() without .nullable())
and I3 (.passthrough()) violations so every tool schema is accepted by
OpenAI's Responses API when KICKSTART_USE_RESPONSES=1.

Adds per-pack assertStrictlyConformant() regression tests that guard
against regressions at authoring time.
