# Bender — Backend Dev

## Learnings

### 2026-04-24T00:01:12-07:00 — Issue #5 DP drafting
### 2026-04-23T15:53:28-07:00 — Issue #16 implementation: chat-tier default model

**Task:** Implement issue #16 — default `KICKSTART_CHAT_MODEL` to `gpt-5.4`.

**Key learnings:**
- (2026-04-23T15:53:28-07:00) `packages/harness/src/runtime/model-resolution.ts` is the single resolver for harness agent model refs; the safest default change is chat-tier only, after the legacy `AZURE_OPENAI_CHAT_DEPLOYMENT` fallback and without altering codex-tier behavior.
- (2026-04-23T15:53:28-07:00) The most direct runner-level regression guard is a mocked `@openai/agents` SDK runner that captures the constructed agent instance during `Runner.run()`, letting tests assert both `agent.model` and the emitted `end.model` without touching live network calls.

### 2026-04-21 — Issue #1027 diagnosis + issue reframing

- Audited the Phase A triage slice across `pack-core`, `harness`, and `web` before posting the DP.
- Key finding: prompt/spec/test scaffolding already exists; the remaining proposal centers on keeping schema + catalog hints registry-derived and fixing same-surface `updateComponents` bookkeeping in `useA2UI`.
- Flagged the issue as **Estimate: M** in the DP because it is multi-file and user-visible, but the GitHub issue currently has no `estimate:*` label yet.

### 2026-04-23T22:53:28Z — Issue #16 Implementation Complete

**Task:** Implement approved DP — default `KICKSTART_CHAT_MODEL` to `gpt-5.4`.

**Outcome:** Completed successfully via PR #24.
- Modified `.env.sample` to include `KICKSTART_CHAT_MODEL=gpt-5.4` default.
- Updated `packages/harness/src/runtime/model-resolution.ts` to recognize chat-tier deployments.
- All design reviews (architecture, security, code quality) approved.
- Test strategy amendment (hermes-1) approved.
- Ready for merge to `dev`.

## Summary (History Archived 2026-04-23T22:53:28Z)

Bender owns backend/DevOps and observability infrastructure. Key contributions this session:
- Diagnosed and resolved production 503 caused by malformed SKILL.md (wrong schema format)
- Identified systemic AppInsights telemetry pipeline failure (esbuild bundling + globalThis singleton destruction)
- Reverted OTel externalization that broke all `/api/*` routes in production (4-hour outage)
- Filed decisions on registry failsoft, OTel bundling safeguards, SKILL.md schema enforcement
- Prepared and posted DP for issue #16 (default chat model), leading to PR #24

[Full archive in session store for detailed learnings]
## 2026-04-24T07:01:12Z — Session Close (Scribe)
**Role:** Backend (DP draft + impl)
**Issue:** #5
**Outcomes:**
- DP draft posted and approved by Leela (arch), Zapp (security)
- Backend implementation completed: emit_ui unlock, llmHint triage prompt
- PR #25 opened targeting dev

**Critical Events:**
- Nibbler code review rejection on cross-turn surface scoping (pre-impl)
- Fry amendment: shared surface namespace design (resolved rejection)
- Parallel impl with Fry (frontend)

**Carry-forward:** PR #25 merge pending review gate

