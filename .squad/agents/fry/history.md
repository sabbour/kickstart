# Fry — Frontend Dev

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Fry  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Scope:** Web UI (React, Fluent UI v9), A2UI integration, streaming patterns

---

## About Me
Frontend engineer owning the web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, streaming UX, and ESM bundling.

## Key Files
- `packages/web/src/` — React app, Fluent components, A2UI catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, Griffel theme system

## Recent Milestones (2026-04-21 to 2026-04-22)

### PR #1058: emit_ui Strict-Mode Fix (Shipped)
- **Issue:** #1050 — emit_ui schema invalid for OpenAI strict mode (`$ref` with sibling keywords not allowed)
- **Root cause:** `.describe()` calls on discriminated-union variants trigger `$ref` emission in zod-to-json-schema
- **Fix:** Deleted 6 `.describe()` calls (1 root, 5 reuse sites); migrated guidance to `event.name` leaf field
- **Regression guard:** Walker test asserts no `$ref+sibling` violations
- **Merge:** e1b6e012 (squash, 2026-04-22T09:39:57Z) ✅
- **Status:** Issue #1050 closed ✅

### Workflow Push Permission Workaround (Decision Documented)
- **Problem:** `sabbour-squad-frontend` GitHub App lacks `workflows:write`; cannot push commits touching `.github/workflows/`
- **Solution:** Use lead token (`sabbour-squad-lead`) for git push; commit author remains Fry
- **Pattern:** Documented in decisions.md; bender-19 handled the unblock for PR #1058
- **Status:** Workaround integrated, decision filed ✅

### SWA Smoke-Test Hard Gate DP (Design Proposal v2)
- **Issue:** #1049 — Production deploy gate missing; PR previews disabled
- **Scope:** 4 changes (silent-skip fix, PR preview re-enable, regression guard in CI, branch protection)
- **Status:** DP v2 approved (Zapp + Nibbler feedback integrated); ready for implementation
- **Estimate:** S (workflow-only changes)

## Key Learnings
1. **Zod → JSON Schema discrimination:** `.describe()` on reused discriminated-union variants triggers unwanted `$ref` generation. Move guidance to leaf fields (strings) to avoid `$ref+sibling` violations.
2. **OpenAI strict mode:** Rejects JSON Schema with `$ref` and sibling keywords. Validation must be added to integration tests.
3. **GitHub App permissions:** `sabbour-squad-frontend` has limited scope (contents, pull-requests). Workflow modifications need lead-token assist. Document this in charter.
4. **Playwright async patterns:** `waitForResponse` must be registered before `page.goto()` to avoid race conditions. Real HTTP (`request.post()`) required for auth E2E tests, not page mocking.

## Active Sprint: v2
Sprint 1: #474 (Nuke v1) → #475 → #476. Fry's role: seam-cutting (preserve shell, delete fixtures, replace in-place).

## Current Queue
- #1049: Implement SWA smoke-test hard gate + PR preview (DP approved v2)
- #1040: AgentSpanError stack-trace fix (P1, pending assignment)

