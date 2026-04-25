---
"@aks-kickstart/harness": patch
"@aks-kickstart/api": patch
---

Fix cross-pack handoff validation to allow handoffs to agents in declared dependency packs (closes #26 cross-pack handoffs).

The registry's `validateHandoffsIntraPackOrThrow()` was incorrectly rejecting ALL cross-pack handoffs. PR #26 added cross-pack handoffs from `aks.architect` and `azure.architect` to `core.codesmith`. Since `core` is listed as a declared dependency of both packs via `dependsOn`, these handoffs should be permitted.

### Changes

- **registry.ts**: Updated `validateHandoffsIntraPackOrThrow()` to allow handoffs to agents in packs listed in `dependsOn` (line 164: `const allowedPacks = new Set([packName, ...(registeredPack.pack.dependsOn ?? [])])`)
- **health.ts**: Added `handoff` detection to `diagnoseProblem()` seal error diagnosis so handoff validation failures are properly categorized (prevents masking as generic `pack-registry-init`)
- **registry.test.ts**: Added test case for dependency handoffs; updated cross-pack rejection test to verify that non-dependency packs are still rejected as expected
