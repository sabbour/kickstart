# Decision: PR + Tagged Release Workflow

**Author:** Leela  
**Date:** 2025-07-27  
**Status:** Accepted  
**Requested by:** Ahmed Sabbour

## Context

The team was pushing directly to main and deploying on every merge. This creates risk — untested code can reach production, and there's no gate for review or rollback control. Ahmed wants a proper flow: PRs for all work, tagged releases for production deploys.

## Decision

### Branch Strategy

All work flows through PRs:

```
squad/{issue}-{slug} → PR to main → merge → tag release → deploy to SWA
```

- **Branch naming:** `squad/{issue-number}-{kebab-case-slug}` (existing convention, now enforced)
- **Main is protected:** Requires a PR to merge. 0 approvers required (agents are the team), but the PR flow gives CI a gate.
- **No direct pushes to main.**

### CI on PRs (`.github/workflows/ci.yml`)

Runs on every PR to main:
1. Lint (`npm run lint`)
2. TypeScript check (`cd packages/web && npx tsc --noEmit`)
3. Build core, API, web
4. Unit tests (`vitest`)
5. Playwright e2e tests

This gives status checks before merge. No deploy happens here.

### SWA Deploy on Tags (`.github/workflows/deploy-swa.yml`)

Production deploys trigger on:
- **Version tags:** `v*` (e.g., `v0.2.0`)
- **Manual dispatch:** `workflow_dispatch` (emergency deploys)

PR preview environments still work — the `pull_request` trigger is preserved for staging builds. Staging environments are closed when PRs close.

### Release Flow

1. Each PR includes a changeset (`npx changeset`) describing the change
2. When ready to release: `npx changeset version` bumps versions + updates CHANGELOG
3. Tag the release: `git tag v0.X.Y && git push --tags`
4. Tag push triggers SWA production deploy automatically

### Who Can Tag Releases

- **Ahmed (human):** Manual releases at any time
- **Ralph (automated):** Can tag releases after N PRs merge (future automation)
- **Philosophy:** Release early, release often

### Infra and Docs Deploys

`deploy-infra.yml` and `deploy-docs.yml` still trigger on push to main (path-scoped). These are lower-risk and don't need the tag gate. Can be revisited later.

## Changes Made

| File | Change |
|------|--------|
| `.github/workflows/deploy-swa.yml` | Trigger changed from `push: branches: [main]` to `push: tags: ['v*']` |
| `.github/workflows/ci.yml` | Removed `push: branches: [main]` trigger; added TypeScript check step |
| Branch protection | Main branch now requires PRs (0 approvers, admins not exempt) |

## Alternatives Considered

- **Deploy on every merge to main:** Current behavior. No release control, no rollback point.
- **GitHub Releases UI:** More ceremony than needed. Tags are sufficient; GitHub Releases can be added later.
- **Required CI status checks on branch protection:** Deferred — need to verify the exact check names after first PR run, then can tighten the rule.
