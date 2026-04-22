# Leela Session History Summary

**Agent:** Leela (Lead/Architect)
**Span:** 2026-03-15 (earliest session) → 2026-04-22 (latest)
**Total sessions in archive:** 22 (leela-1 through leela-22)
**Status:** Latest: Post-mortem analysis & issue triage for incident #1041

---

## Major Workstreams

### 1. OTel Observability Architecture & DP #1030 (PR #1030, #1034) [MERGED]

- Comprehensive observability pipeline design: `@azure/monitor-opentelemetry` + Application Insights
- Redaction strategy: Proxy-based `RedactingSpanExporter` and `RedactingLogRecordProcessor`
- Externalization approach (later reverted): bundled in `node_modules/`, externalized via esbuild
- Approved with Amendments 1/2/3 after Nibbler code review
- **Architectural learning:** Externalization couples code to deploy-time behavior — introduces fragility

### 2. Production Incident #1041 — Root Cause & DP Revision (leela-19, leela-20)

- **leela-19:** Post-mortem analysis of SWA deploy architecture
  - Clarified: `skip_api_build: true` disables client-side Oryx only; server-side `npm install` still runs
  - Identified: Server-side install can overwrite materialized packages → silent deployment hazard
  - Recommendation: Revert to bundle-inline strategy (DP revision)
  - Documented: `.squad/decisions/inbox/leela-swa-node-modules-deploy-architecture.md`
- **leela-20:** Approved hotfixes (#1051, #1052); filed priority follow-ups
  - #1049 (P0): SWA deploy hard gate (smoke check must fail workflow)
  - #1050 (P2): A2UI emit_ui schema validation (OpenAI strict mode)
  - #1040 (P1): AgentSpanError stacktrace extraction (reaffirmed)

### 3. Episodic DP & Architecture Reviews

- **DP #1030 Amendment #1:** Caching strategy for externalized OTel packages
- **DP #1030 Amendment #2:** Materialization script scope + peerDependencies traversal
- **DP #1030 Amendment #3:** Proxy pattern refinements (RedactingSpanExporter thread safety)
- **MCP Apps DP (nibbler v2.1):** Architecture review + integration with SDK sampling protocol

---

## Architectural Principles Established

1. **Platform-Level Mutation Points:** Deploy infrastructure (SWA server-side install) is a latent hazard. Build contracts must be immune to it.
2. **Bundling as Immunization:** For SWA Functions, bundling everything inline removes dependency on post-deploy install state.
3. **Externalization Trade-offs:** Reduces binary size (benefit) but introduces deploy-time coupling (risk). For SWA, risk outweighs benefit.
4. **Test Specification Gaps:** When DPs say "invert test T1," read all describe-block cases. Multi-case tests can fail partially if only one case is inverted.
5. **CI Guard Atomicity:** Regression guards must be updated in the same PR as contract changes. Never delete guards; invert them.

---

## Decision Authorship

- Decision: Revert #1030 OTel Externalization — Bundle-Everything Strategy
- Decision: Azure/static-web-apps-deploy@v1 Packaging Architecture — Confirmed Behaviors
- Decision: API bundle budget gap (pre-existing, noted for follow-up)
- Contributed to: Zapp DP Security Review, User directives (Lead-tier roles)

---

## Latest Status (2026-04-22)

✅ Incident root cause identified and validated
✅ Bundle-inline architecture confirmed as correct
✅ Follow-up issues prioritized and filed
✅ Pre-existing gaps documented (bundle budget reporting)
✅ Decision log captured

**Next:** Implement follow-ups; extend bundle-budget reporting to API functions.

