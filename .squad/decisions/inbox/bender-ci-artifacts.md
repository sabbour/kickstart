# Decision: CI E2E Job Reuses Build Artifacts from lint-build

**Author:** Bender (Backend Dev)
**Date:** 2026-04-14

## Context

The CI workflow had two independent jobs (`lint-build` and `e2e`) that both built `@kickstart/core` and the Vite web app from scratch. This doubled build time on every PR.

## Decision

Use `actions/upload-artifact@v4` / `actions/download-artifact@v4` to share `packages/core/dist/` and `packages/web/dist/` between jobs. The `e2e` job now depends on `lint-build` (`needs: lint-build`) and downloads pre-built artifacts instead of rebuilding.

- Artifact name: `build-output`
- Retention: 1 day (ephemeral, only needed during the workflow run)
- The e2e job still runs `npm ci` (needed for runtime node_modules) and installs Playwright browsers

## Trade-offs

- **Pro:** Eliminates ~2-3 minutes of redundant build time per PR
- **Pro:** E2E tests run against the exact same build artifacts that passed lint + unit tests
- **Con:** E2E job now blocked on lint-build completing (was previously parallel) — net effect is still faster because the build savings outweigh the sequencing cost
- **Con:** If lint-build fails, e2e won't run — but that's actually desirable (fail fast)

## Files Affected

- `.github/workflows/ci.yml`
