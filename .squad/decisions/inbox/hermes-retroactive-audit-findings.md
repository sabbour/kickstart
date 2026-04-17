# Decision: Retroactive Audit Findings for PRs #407–#426

**Author:** Hermes (Tester)
**Date:** 2026-04-17
**Context:** 11 PRs merged without human review during #405 audit session

## Summary

Audited all 11 PRs. Found 52 unresolved Copilot review threads. Created 8 follow-up issues:

### P1 — Runtime Risk
- **#428** — `advancePhase()` throws on invalid phase strings (PRs #412, #418)
- **#429** — System prompt context variables not injected (PR #412)

### P2 — Quality / Correctness
- **#430** — API reference docs: 19 inaccuracies vs implementation (PR #424)
- **#431** — Skill vocabulary: mutable shared arrays + missing public export (PR #416)
- **#432** — Deployment docs: hardcoded subscription/tenant/resource group (PR #408)
- **#435** — Phase docs: deleted test refs, wrong code examples (PRs #421, #426)

### P3 — Tech Debt
- **#433** — Custom component count hardcoded without automated assertion (PR #422)
- **#434** — Cross-doc inconsistency: stale "both kits use legacy" claims (PRs #415, #420, #426)

## Decision

P1 issues (#428, #429) should be prioritized immediately. All merged code PRs had substantive unaddressed review comments — merging without review should not be repeated.

## Tracking Issue

**#436** — Full summary with per-PR breakdown table.
