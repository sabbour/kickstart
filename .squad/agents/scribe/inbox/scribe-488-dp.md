# Scribe session summary — DP for issue #488

**Date:** 2025-07-20
**Issue:** #488 — v2 Step 13: Docs + Cleanup
**Comment posted:** https://github.com/sabbour/kickstart/issues/488#issuecomment-4269543245
**Status:** Proposed — awaiting Leela + Zapp approval

---

## Key files identified

### Delete (7 files)
- `HERMES-271-TEST-PLAN.md` — root, temp artifact
- `QUALITY-DECISION-271.md` — root, temp artifact
- `docs-site/docs/extending/integration-kits.md` — v1 IntegrationKit
- `docs-site/docs/extending/conversation-phases.md` — v1 phase routing
- `docs-site/docs/architecture/fsm.md` — v1 FSM
- `docs-site/docs/architecture/prompt-pipeline.md` — v1 stepwise pipeline
- `docs-site/docs/architecture/skill-injection.md` — v1 skill injection via packages/core

### Create (5 files)
- `docs/harness-api-reference.md` — harness public API
- `docs/pack-authoring-guide.md` — full pack authoring guide
- `docs-site/docs/extending/pack-authoring.md` — Docusaurus pack authoring summary
- `docs-site/docs/architecture/harness.md` — harness primitives, turn lifecycle, SSE taxonomy
- `docs-site/docs/architecture/skill-injection-v2.md` — v2 skill resolution

### Update (major rewrites, 20 files)
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- `docs/architecture.md`, `docs/api-reference.md`, `docs/extending.md`, `docs/v2-implementation-brief.md`
- `docs-site/docs/intro.md`, `docs-site/docs/architecture/overview.md`
- All surviving `docs-site/docs/extending/` and `docs-site/docs/getting-started/` pages

## Deprecated terms to eradicate
`phases`, `stepwise`, `IntegrationKit`, `converse-model-router`, `response-processor`, `KICKSTART_V2`, `KICKSTART_AGENTS_SDK`, `packages/core`
