---
"@kickstart/pack-azure": patch
"@kickstart/pack-aks-automatic": patch
"@kickstart/pack-github": patch
"@kickstart/api": patch
---

Add server-safe pack manifests for `pack-azure`, `pack-aks-automatic`, and `pack-github`, and register them in the web API startup alongside `pack-core`.

- Each domain pack now exports a `server-manifest.ts` that mirrors `pack-core`'s pattern: tools, user-actions, guardrails, and (for github) playground scenarios/stubs are imported directly, while components are listed with placeholder schemas to keep React out of the Functions bundle.
- `packages/web/api/src/startup/packs.ts` registers packs in dependency order (`core` → `azure` → `aks` → `github`) and gates the non-core packs via the `KICKSTART_PACKS` env var (comma-separated list; default: all four enabled). `core` is always registered.
