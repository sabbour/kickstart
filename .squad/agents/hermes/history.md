# Hermes — Tester

## About Me
QA engineer and test infrastructure owner. Expertise in Playwright E2E testing, validation engine architecture, Kubernetes deployment safeguards, and accessibility compliance. Responsible for test coverage, regression detection, and quality gates on all releases.

## Key Files
- `packages/core/src/validation/` — ValidationEngine, 23 validators (DS001-DS020), auto-fix system
- `packages/core/src/__tests__/` — 600+ unit tests for validation, action loop, tool system
- `packages/web/src/__tests__/` — 70+ Playwright E2E tests for full user flows
- `.playwright/` — Playwright config, webServer, browser setup
- `packages/core/src/rules/` — RulesEngine metadata layer for categorized validation reports

## Patterns
- **Validator interface:** execute(content) → ValidationResult, optional autoFix(content) for chainable fixes
- **E2E test helpers:** enterChatViaTrack(), sendMessage(), verifyPhase(), mockApi() for reusable flow setup
- **Accessibility compliance:** WCAG 2.1 AA — roving tabIndex, aria-live, label association, keyboard navigation
- **Kubernetes safeguards:** DS001-DS020 span security/reliability/networking; category-grouped reports; AKS constraint mapping
- **Playwright strict mode:** Use exact getByText strings, scope with containers, avoid ambiguous selectors

## Recent Work
- v0.5.6 validation audit: DS001-DS020 comprehensive coverage, auto-fix testing, cross-validator interaction
- v0.5.0 a11y fixes: roving tabIndex RadioGroup, aria-live regions, external link icons, label association
- v0.4.0 E2E suite: 27+ accessibility tests, keyboard nav testing, live region verification
- v0.3.0 test expansion: tool system TDD, validation engine, action loop verification

## Learnings
- 2026-04-15: For stepwise live artifact streaming reviews, I only clear the QA gate when validation is batch-atomic per step, mandatory-step failures pause instead of auto-skipping, and resume state persists explicit per-step outcomes (#326 Rev 4).

---

**2026-04-15T22:40:15Z — Scribe**: Issue #326 Revision 4 approved. QA gate post on #326#issuecomment-4256166025 logged. Ready for closure.
