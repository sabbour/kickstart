---
'@aks-kickstart/api': patch
---

Fix persistent HTTP 404 on `/api/health` after SWA deployment.

Root cause: `packages/web/api/.npmrc` sets `workspaces=false` but npm v7+ silently
ignores this when run inside a workspace root (CI log shows
`npm warn config ignoring workspace config`). As a result, `@azure/functions` was
never installed into `packages/web/api/node_modules` — it was hoisted to the repo root
instead. The SWA action uploads only `packages/web/api`, so the Azure Functions worker
could not resolve the import, no function handler registered, and every request
returned 404.

Fix: change `external` in `esbuild.config.mjs` from `["@azure/functions", "bicep-node"]`
to `["@azure/functions-core"]`. Both `@azure/functions` and `bicep-node` are pure
JavaScript; they are now bundled inline. `@azure/functions-core` is a virtual module
injected by the Azure Functions Node.js worker host at runtime — it must remain external.

Also removes the now-redundant "Resolve API workspace dependencies" workflow step and
removes `continue-on-error: true` from the smoke check so failures surface properly.
