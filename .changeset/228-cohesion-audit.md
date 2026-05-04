---
"@aks-kickstart/pack-azure": patch
"@aks-kickstart/pack-github": patch
"@aks-kickstart/pack-core": patch
---

audit(#228): E2E cohesion fixes — handoff chain, DynamicString coercion

- fix(pack-azure): add `github.publisher` handoff in azure-ops agent so post-deployment flow can reach the publisher
- fix(pack-azure): add `handoffTargets: ['github']` to azure server manifest to authorize cross-pack handoff
- fix(pack-github): add `core.reviewer` handoff in github.publisher so the chain terminates at reviewer not dead-end
- fix(pack-core): add `String()` coercion in SummaryCard, JobToBeDoneTable, ProgressSteps, SteppedCarousel to prevent `[object Object]` renders when LLM emits DataBinding or FunctionCall values for DynamicString fields
