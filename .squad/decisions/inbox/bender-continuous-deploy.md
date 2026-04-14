# Decision: Continuous SWA deployment from main + version-SHA footer

**Author:** Bender (Backend Dev)
**Date:** 2026-04-14
**PR:** #177

## Context

SWA deployment only triggered on release tags (`v*`) and PRs, meaning changes merged to `main` didn't deploy until a release was cut. Ahmed needed immediate deployment on every merge.

## Decisions

1. **Push-to-main trigger** — `deploy-swa.yml` now triggers on `push → branches: [main]` with path filters (`packages/**`, `package.json`, `package-lock.json`, `tsconfig.json`). Tag-based releases still trigger deployment as before.

2. **Unified version string** — `__BUILD_VERSION__` is now `{semver}-{shortSHA}` (e.g. `0.5.6-abc1234`). Git SHA is resolved via `git rev-parse --short HEAD` at build time, falling back to `GITHUB_SHA` env var, then `dev`.

3. **Footer simplification** — Landing and Playground footers show the unified version string instead of version + SHA separately. Every build is uniquely identifiable.

## Impact

- Every push to `main` that touches package code auto-deploys to SWA
- Release workflow unchanged — tag pushes still work
- Fry: footer components (`Landing.tsx`, `Playground.tsx`) now use `__BUILD_VERSION__` only (SHA embedded)
