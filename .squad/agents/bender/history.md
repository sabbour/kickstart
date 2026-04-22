# Bender — Backend Dev & Ops

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Bender  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Scope:** Infrastructure, API, OTel/observability, incident response

---

## Key Responsibilities
- `packages/web/api/` — Functions backend, Azure SWA deployment, health checks
- Observability — OTel instrumentation, Application Insights integration
- Production incident response and root-cause analysis

## Recent Milestones (2026-04-21 to 2026-04-22)

### Production 404 Incident (Root Cause ID'd, Fixed)
- **Issue:** PR #1030 deployed broken API (404 empty body on all routes)
- **Root cause:** `@aks-kickstart/harness: "*"` in dependencies; Azure SWA's server-side npm install tries to fetch private workspace pkg from public registry, fails, overwrites OTel externals. Worker crashes before registering routes.
- **Evidence:** 8-step forensic chain documented in decisions-archive.md
- **Fix:** PR #1048 merged — move workspace and bundled deps to devDependencies
- **Status:** Production restored ✅ (2026-04-22T05:40 UTC)

### OTel Externalization Reversal (PR #1051)
- **Task:** Revert PR #1030's incorrect externalization strategy
- **Scope:** Restore `external: ["@azure/functions-core"]` only; bundle OTel inline; lazy-init `initializeAppInsights()`
- **Evidence:** 8 sub-tests (E1–E8) passed; build, bundle, test coverage verified
- **Status:** Implementation complete, awaiting merge

### Canary Reduction for PR #1058
- **Task:** Drop `/api/converse` endpoint from SWA smoke-check canary per ops directive
- **Context:** Converse testing deferred pending DNS/auth flakiness resolution in SWA preview environment
- **Action:** Acted as lead bot to push `.github/workflows/deploy-swa.yml` (Fry's token lacks `workflows:write`)
- **Status:** Merged (e1b6e012) ✅

## Key Learnings
1. **Azure SWA server-side npm install:** Happens during ~30-second post-upload processing, even with `skip_api_build: true`. Must ensure dependencies contain ONLY runtime reqs; build-time/workspace pkgs go to devDependencies.
2. **OTel bundling vs. externals:** Bundling inline reduces attack surface (no external npm pulls at runtime) and avoids SWA install failures. Externalization is risky on managed Function services.
3. **Smoke check gate:** Silent skip (`exit 0` on missing URL) is dangerous. Regression guard (CI grep for `exit 0` in smoke context) prevents future accidental reverts.
4. **Token permissions:** `sabbour-squad-frontend` lacks `workflows:write`. Workflow-touching PRs from Fry require lead bot assist for push.

## Current Queue
- #1049: SWA smoke-test hard gate + PR preview re-enable (DP approved v2, Fry implementing)
- #1040: AgentSpanError stack trace (P1, Fry or Bender ownership pending)

