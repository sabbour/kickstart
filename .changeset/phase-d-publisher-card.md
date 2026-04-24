---
"@aks-kickstart/web": minor
"@aks-kickstart/pack-core": minor
"@aks-kickstart/pack-github": minor
---

Phase D: github.publisher emits composed PR-creation card with real PR URL.

- SummaryCard now supports a `link` field on items, rendering values as clickable external links with an open-in-new-tab icon.
- Added server-side Zod schema for `github/CreatePRFlow` in `pack-core` rich component schemas.
- Updated `github.publisher.agent.md` with llmHint composition example showing the three-stage PR-creation flow (AuthCard → CreatePRFlow → SummaryCard).
- Added E2E test `phase-d-publisher-pr.spec.ts` covering auth gate, PR card, and result summary transitions on shared surfaces.
