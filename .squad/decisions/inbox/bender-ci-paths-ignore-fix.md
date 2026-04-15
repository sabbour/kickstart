### 2026-04-15: Removed paths-ignore from CI workflow
**By:** Bender (Backend Dev)
**What:** Removed paths-ignore from .github/workflows/ci.yml so all PRs trigger CI checks, preventing merge deadlocks on docs-only PRs.
**Why:** The protect-main ruleset requires 'Lint, Build & Unit Tests' and 'Playwright E2E Tests', but paths-ignore excluded docs files. Docs-only PRs could never merge.
