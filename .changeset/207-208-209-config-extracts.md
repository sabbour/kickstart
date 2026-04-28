---
"@aks-kickstart/web": patch
"@aks-kickstart/harness": patch
"@aks-kickstart/pack-core": patch
---

feat(config): extract handoff-rules / microsoft-skills / recipes catalogs to versioned JSON (#207, #208, #209)

Routing handoff rules, Microsoft Copilot for Azure skill IDs, and UI composition recipes are now extracted into versioned `config/*.json` files (with JSON Schemas) instead of being implied by agent prompt frontmatter or framework-doc prose. This makes the routing model auditable and lets future prompt rewrites validate against the extracted shape.

- **`config/handoff-rules.json` (#207)** — re-extracted verbatim from current `packages/*/src/agents/*.agent.md` frontmatter. Every entry carries `provenance: "extracted"`. The schema now requires the `provenance` field.
- **`config/handoff-rules.proposed.json` (#207)** — companion file capturing wiring proposed by Phase 1 framework docs and Phase 1.6 simulations but not yet present in agent frontmatter (`provenance: "proposed"` / `"derived"` with per-entry source citations). Phase 2 implementation MAY land any subset; the file documents intent.
- **`config/microsoft-skills.json` + schema (#208)** — intent → skill ID map for the `microsoft/GitHub-Copilot-for-Azure` skills loaded via `core.read_skill`, with per-skill `loadWhen` triggers (per D8).
- **`config/recipes.json` + schema (#209)** — UI composition recipes catalog (R1-R20+ named patterns) with `composition`, `fires_when`, sim provenance, and promotion candidates.

No runtime behaviour changes — these are bootstrap data for Phase 3 ingestion. `config/README.md` documents the extracted-vs-proposed split.
