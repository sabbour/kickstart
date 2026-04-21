---
"@aks-kickstart/web": minor
"@aks-kickstart/pack-azure": minor
"@aks-kickstart/pack-aks-automatic": minor
"@aks-kickstart/pack-github": minor
---

Reintroduce the Playground **Ideas** tab as curated scenario compositions (#987).

Each pack now ships a `scenarios: readonly PackScenario[]` export from its `./client` subpath — 2–3 curated scenarios per pack, each authored as a full A2UI v0.9 adjacency list (2–4 components mixing `core/*` primitives with pack-contributed components like `azure/*`, `aks/*`, `github/*`). Core primitive scenarios live in `packages/web/src/catalog/core-scenarios.ts`.

The Playground's restored Ideas tab (`packages/web/src/pages/Playground.tsx`) renders each scenario as a live A2UI preview card; clicking a card opens a Preview / JSON dialog, same pattern as the Components tab. Scenarios are static, build-time-trusted fixtures — **no runtime LLM synthesis, no user-supplied envelopes** — so they inherit the same trust boundary as `previews`.

Fixes the original failure modes that got the tab removed in #988 ("Loading…" placeholders, sparse pack coverage, inconsistent visuals) and replaces the previous LLM-generated Ideas flow with deterministic, schema-guarded fixtures. New test file `packages/web/src/__tests__/component-scenarios.test.ts` validates:
- Every scenario has a well-formed adjacency list (no orphan `children`/`child` references).
- Every pack-component descriptor's props parse cleanly against the component's Zod schema (Zapp PR-gate).
- Every scenario resolves through the sealed `ClientComponentRegistry` and produces **zero** `_ErrorComponent`s after `validateAndSanitizeComponents` — the same render-time guard the Chat pipeline relies on (Nibbler PR-gate).
- Each pack contributes ≥2 scenarios; scenario keys are unique and pinned via an inline snapshot.
