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

### 2026-04-15T15:28:36.991Z — Live `/api/health` smoke gate

- `.github/workflows/deploy-swa.yml` is the right guardrail point for a missing live `/api/health` route because local builds and unit tests can pass while Azure Static Web Apps still deploys a runtime with the route missing.
- For this outage class, a post-deploy probe is more valuable than another local integration test; it should hit `https://kickstart.aks.azure.sabbour.me/api/health`, retry briefly for propagation, and fail unless the response is `200` JSON with `{"status":"ok"}`.
- The smoke logic is easy to validate locally by running the same Node fetch probe against a stub server for the success path and against the live site with `SMOKE_ATTEMPTS=1` for the failure path.
