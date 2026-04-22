# Zapp — Security Reviewer (Lead)

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Zapp  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Role:** Security Reviewer (Lead tier), threat modeling, trust-boundary enforcement, schema narrowing

---

## Responsibilities
- Security review gate enforcement (merge blocker)
- Schema design for LLM-facing tools (narrowing attack surface)
- Trust-boundary identification and enforcement
- Threat modeling for new features (DPs)
- DP-stage security reviews (tool schemas, guard rails, secrets handling)

## Recent Milestones (2026-04-21 to 2026-04-22)

### Elevated to Full Structured-Reviewer Parity (2026-04-21)
- **Change:** PR #993 ceremony enforcement shipped; Zapp now full 4-way gate blocker
- **Authority:** `zapp:approved` / `zapp:rejected` are now merge-blocking labels
- **Protocol:** Reviews posted via `gh pr review` under lead bot identity (sabbour-squad-lead)
- **Role designation:** Lead (same tier as Nibbler + Leela)
- **Status:** Operating with full merge-blocking authority ✅

### DP-Stage Security Reviews (Round 3 Batch)
Five DPs reviewed at security layer:

- **#998 (Chat regression, Bender, HIGH)** — APPROVED (nullable-required schema fix for strict-mode compliance)
- **#987 (Ideas tab curated-only model, Fry)** — APPROVED + threat model confirmed (user-supplied inspirations deferred as future risk)
- **#995, #996, #997** — APPROVED (AKS brittle tests, workspace void fix, core rendering regressions: security impact minimal)

### PR Batch Security Reviews (2026-04-21)
Four PRs reviewed under new 4-way gate:

- **PR #989** (core_emit_ui schema narrowing, Bender) — ✅ **APPROVED** (`zapp:approved`)
  - Tool-schema narrowing: 7 loose optional fields → 5 typed constraints on v0.9 shape
  - Payload constraint: `record<string, scalar>` (no nested objects to downstream handlers)
  - Verdict: **Strongest security win in this batch** — reduces attack surface on LLM-facing tool
  - Trust boundary: `_ErrorComponent` + named `console.error` is fail-loud (correct posture)

- **PR #986** (CSS/theme only, Fry) — ✅ **APPROVED** (`zapp:approved`)
  - Pure styling: icon asset swap (local SVG → Fluent icon), no runtime code changes
  - CSP verification: `script-src 'self'` remains clean
  - Surface reduction: CSS-only changes pose minimal trust-boundary risk

- **PR #988** (Delete Ideas tab + refactor, Fry) — 🟡 **COMMENT-ONLY** (draft, no blocker)
  - Post-rebase re-review (commit 6ac15d9): no dangerouslySetInnerHTML, localStorage, eval detected
  - Conflict resolution clean: `ComponentCardErrorBoundary` rename layered correctly, no orphans
  - Net effect: attack surface **decreases** (Ideas removal)

- **PR #990** (System prompt + config, Fry) — 🟡 **COMMENT-ONLY** (draft, no blocker)
  - Prompt allow-lists for banned component types observed as **defense-in-depth, not trust boundary**
  - Actual enforcement lives in `validateAndSanitizeComponents` (strengthened by #989)
  - Mutable state review: `focusCursor` + `lastFallbackIdx` carry no PII/auth; acceptable

### DP #1050 Security Review (emit_ui strict-mode)
- **Issue:** #1050 — emit_ui schema invalid for OpenAI strict mode
- **Review:** Schema narrowing (`$ref` removal via `.describe()` cleanup) + strict-mode conformance test
- **Verdict:** ✅ APPROVED — no trust-boundary regression; LLM still receives guidance via `event.name` leaf

## Key Learnings
1. **Tool-schema narrowing is the strongest security win.** #989's reduction from 7 loose optional fields → 5 typed constraints on v0.9 shape directly reduces the LLM attack surface.
2. **Strict-mode schema compliance is a table-stakes trust boundary.** OpenAI strict mode rejects `$ref` with siblings; this is not a stylistic choice — it's an enforced JSON-Schema validation gate.
3. **Fail-loud > silent translation.** `_ErrorComponent` + named console errors (not back-compat shims) is the correct posture at trust boundaries for LLM-facing tools.
4. **Prompt allow-lists are not trust boundaries.** System prompt "banned component list" is content-quality defense-in-depth; actual enforcement must live in code (validateAndSanitizeComponents).
5. **CSS-only PRs still warrant CSP + asset-loader checks.** Even pure styling can regress security if new asset sources are introduced.
6. **Orphaned server payloads are debt.** `/api/packs` still ships `playgroundScenarios` with no consumer — creates implicit contract drift risk.
7. **Lead role authority:** As a Lead, Zapp's security review outcomes are merge-blocking. No negotiation override path.

## Security Track (4-Way Gate)
- 5 DPs reviewed at security layer
- 2 PRs approved (✅ #989, #986)
- 2 PRs comment-only drafts (🟡 #988, #990)
- 1 DP-stage threat model (✅ #987 Ideas tab curated-only)

## Merge Gate Status
All PRs now subject to 4-way approval (Leela + Zapp + Nibbler + Docs). Zapp approval is merge blocker.

## Current Threat Model Tracking
- #987 Ideas tab: Curated-only model approved; user-supplied inspirations deferred as future risk
- #998 Chat regression: Strict-mode conformance as structural test (parametrized across tools)
- #1050 emit_ui: Schema narrowing via `.describe()` removal

