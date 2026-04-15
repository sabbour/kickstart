# Decision: Keep non-runtime files and `bicep-node` out of SWA function startup

**Date:** 2026-04-15T16:06:15Z  
**Author:** Bender (Backend Dev)  
**Status:** Implemented

## Context

The live Static Web App was returning 404 for anonymous API routes like `/api/health` and `/api/github-auth/callback` even though the latest `deploy-swa.yml` run succeeded and the frontend auth layer was still active.

The deploy log for commit `d936a67` showed the API build bundling **18 function entrypoints**. One of those files was `packages/web/api/src/functions/converse.test.ts`, and importing the built `dist/functions/converse.test.js` outside Vitest immediately threw `Vitest mocker was not initialized in this environment`. The same startup sweep also failed when `bicep-node` was inlined into `azure-deployments.js`, throwing `Dynamic require of "os" is not supported`.

## Decision

1. **Exclude test/spec files from API entrypoints** — `packages/web/api/esbuild.config.mjs` must not bundle `*.test.ts` or `*.spec.ts` from `src/functions/`.
2. **Keep `bicep-node` external** — the API bundle must leave `bicep-node` in `node_modules` instead of inlining it into the ESM function entrypoints.

## Why

Azure Functions v4 loads every file matched by the `package.json` `main` glob at startup. Any bundled file that throws during import prevents handler registration for the whole managed API, which shows up at the edge as repo-correct routes returning 404.

## Evidence

- Latest SWA deploy log: `✅ Bundled 18 function(s) to dist/functions/`
- `git ls-tree origin/main packages/web/api/src/functions` included `converse.test.ts`
- Reproduced crash by importing the built test bundle:
  - `Vitest mocker was not initialized in this environment. vi.queueMock() is forbidden.`
- Reproduced crash by importing the bundled Azure deployment entrypoint before externalizing `bicep-node`:
  - `Dynamic require of "os" is not supported`

## Consequences

- Managed Functions startup now only imports real runtime entrypoints.
- Azure deployment routes can still use `bicep-node`, but only through the runtime dependency in `node_modules`.
- Future API tests can stay near the functions code, but the build must continue filtering non-runtime files out of the startup glob.
