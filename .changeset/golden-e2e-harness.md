---
'@aks-kickstart/web': minor
---

Golden E2E harness — 4-track deterministic test suite with required-for-merge gate

Adds a golden E2E test layer with 4 tracks (web-app, agentic-Foundry, agentic-KAITO, existing-repo-uplift) that replays recorded SSE fixtures through the full Phase A → E flow. Includes:

- Deterministic SSE fixture replay (no live API calls in PR CI)
- Multi-layer fixture scrubbing pipeline (secrets, PII, tokens)
- Hermetic mode with default-deny outbound network
- Fixture freshness metadata with 30-day expiry
- Always-run CI workflow with fail-closed golden-gate job
- Seeded-failure meta-tests to verify the gate blocks
- Fixture recording script for nightly live-model runs
