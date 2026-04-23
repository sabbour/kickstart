---
"@aks-kickstart/web": minor
"@aks-kickstart/pack-azure": minor
"@aks-kickstart/pack-aks-automatic": minor
"@aks-kickstart/pack-github": minor
---

Render pack components (azure/aks/github) via the engine.

Each pack now ships a `./client` subpath export (`@aks-kickstart/pack-{azure,aks-automatic,github}/client`) that bundles React renderers, preview fixtures, and a `registerClient(target)` function. Server-only code stays in `./server-manifest`. `./client` is marked `sideEffects: false` so unused renderers tree-shake per route.

`packages/web` now depends on the three packs and calls each pack's `registerClient` at bootstrap (`src/bootstrap/registerPackComponents.ts`), which adapts each `ComponentContribution` into an A2UI-native `ReactComponentImplementation` via a thin `createReactComponent` wrapper. The client registry now includes `azure/*`, `aks/*`, and `github/*` names alongside `core/*`.

The hardcoded `packages/web/src/pages/component-examples.ts` map has been removed. Core previews moved to `packages/web/src/catalog/core-previews.ts`, pack previews are pack-contributed, and the two are composed in `packages/web/src/catalog/component-previews.ts` (consumed by Playground). Pack previews are validated against their Zod schemas as a test gate (Zapp PR-gate condition on the DP).
