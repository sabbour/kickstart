---
"@aks-kickstart/api": patch
---

Revert #1030 OTel externalization: restore bundle-everything strategy to unblock SWA prod deploy.

- `esbuild.config.mjs`: only `@azure/functions-core` is external; OTel/AppInsights packages are bundled inline.
- `src/lib/appinsights.ts`: remove module-load IIFE; `initializeAppInsights()` is now called lazily from each handler body.
- Each function handler (`health`, `packs`, `converse`) calls `initializeAppInsights()` as its first statement (inside try/catch).
- `scripts/materialize-api-externals.mjs` deleted; `postbuild` hook removed.
- `scripts/verify-api-externals.mjs` updated to assert inline bundling.
- Self-contained bundles are immune to SWA server-side `npm install` overwriting `node_modules/`.
