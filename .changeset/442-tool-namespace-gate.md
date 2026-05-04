---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/pack-azure": patch
"@aks-kickstart/pack-github": patch
"@aks-kickstart/pack-aks-automatic": patch
---

chore: add CI gate enforcing pack tool name prefixes

Adds a `tool-namespace.test.ts` to each pack that asserts every registered
tool name starts with the correct prefix (`core.`, `azure.`, `github.`, `aks.`).
For `pack-azure`, both the server-manifest tools and the full pack tools array
(which includes client-only tools like `azure.propose_services`) are checked.
Tests run in CI and fail fast if a new tool is added without the proper prefix.

Also updates `pack-authoring.md` to document that the convention is now
CI-enforced.

Closes #442
