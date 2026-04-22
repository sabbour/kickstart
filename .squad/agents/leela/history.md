# Leela — Lead Architect

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Leela  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Role:** Lead Architect, ceremony facilitator, architectural gate enforcement

---

## Responsibilities
- DP approval and Design Review facilitation
- Ceremony enforcement (mechanical 4-way gate on all PRs)
- Architecture alignment checks (pack boundaries, surface consistency)
- Post-incident retrospectives and decision capture

## Recent Milestones (2026-04-21 to 2026-04-22)

### Ceremony Gate Enforcement (PR #993 Merged)
- **Change:** Mechanical 4-way approval gate now active on all future PRs
- **Gate:** `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` ∨ `docs:not-applicable`) + green CI
- **Status:** No override path; gate is merge-blocking ✅

### Five DPs Approved in Round 3 (2026-04-21T04:30Z)
- #998 (chat regression, Bender, S, HIGH) — APPROVED + ready for implementation ✅
- #995 (Core component rendering, Fry, M) — APPROVED + ready ✅
- #996 (AKS brittle tests, Bender, M) — APPROVED but depends on #1000
- #997 (workspace black void, Fry, S) — APPROVED + ready ✅
- #987 (Ideas tab, Fry, M) — APPROVED but depends on #991

### PR Review Outcomes (2026-04-21)
- **PR #1000** (pack rendering, #991) — **REJECTED** by Zapp + Nibbler. Red CI (TS2307/TS2352) + missing CI grep guard. Reviewer Rejection Protocol triggered; Fry locked out; bender-1000-revise assigned.
- **PR #1001** (emit_ui fixture) — ✅ **MERGED.** All gates green. Shipped explicit-op discriminator coverage.

### Production 404 Incident Post-Mortem (2026-04-21)
- **Root cause:** PR #1034 reintroduced `@aks-kickstart/harness: "*"` in API dependencies. Azure SWA server-side npm install tries to fetch private workspace pkg, fails, overwrites OTel externals. Worker crashes → no routes → 404.
- **Historical debt:** Same mechanism identified in prior commits (swa-pkg-fix/68e5f875, swa-clean-deps branches) but never merged to main.
- **Forensic chain:** 8-step evidence documented; zip timing disproved `.funcignore` theory, confirmed server-side install overwrite.
- **Fix:** PR #1048 merged — move workspace deps to devDependencies. Production restored ✅

### OTel Reversal Strategy (DP Amendment Approved)
- **Issue:** #1041 — Revert PR #1030's incorrect externalization; restore bundled-inline strategy
- **Scope:** Remove externals (except `@azure/functions-core`), delete `materialize-api-externals.mjs`, lazy-init OTel
- **DP:** Leela + Zapp + Nibbler all approved; implementation dispatched to Bender ✅
- **Status:** PR #1051 ready for merge review

## Key Learnings
1. **Azure SWA platform behavior:** Server-side npm install ALWAYS occurs during post-upload processing (~30s window), regardless of `skip_api_build` client-side flag. Dependency resolution must be runtime-only.
2. **Workspace package governance:** Hardcode `/^@aks-kickstart\/harness$/` into CI allowlist and API package.json audit to prevent accidental runtime dependencies on workspace packages.
3. **Ceremony gate as blocker:** Mechanical 4-way approval eliminates override negotiation; forces thorough review upfront. PR #993 sets new standard.
4. **DP-time security invariants:** Strict-mode schema compliance, ideas-tab threat model, composition retry bounds — all must be enforced at DP approval, not post-hoc.
5. **Historical incident prevention:** PR #1052 grep-based regression guard pattern (verify smoke-gate, verify OTel externals) should be applied retroactively to high-risk previous decisions.

## Active DP Track
- #1050 (emit_ui strict-mode) — DP approved, shipped (Fry, PR #1058) ✅
- #1049 (SWA smoke gate + PR preview) — DP v2 approved, ready for implementation (Fry)
- Five Round-3 DPs under implementation dispatch

## Current Queue
- #1040: AgentSpanError stack-trace fix (P1, pending assignment)
- Production stability: Regression guards + ceremonies now in effect

