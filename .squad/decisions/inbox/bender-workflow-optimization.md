# Decision: CI/CD Workflow Optimization

**Author:** Bender (Backend Dev)
**Date:** 2026-04-23
**Status:** Accepted (owner request)

## Context

GitHub Actions usage was burning ~18,000+ minutes/month across squad workflows. The top consumers were Playwright E2E tests (4610 min), heartbeat (2813 min), auto-merge (2509 min), and review-gate (1440 min). Most waste came from three patterns: (1) no concurrency groups causing duplicate runs on rapid-fire events, (2) over-broad trigger types like `edited` causing cascading re-runs on description edits, and (3) workflows firing on all issues/PRs instead of only squad-related ones.

## Decision

1. **Disabled Playwright E2E** via `if: false` — kept the job definition for easy re-enablement.
2. **Added concurrency groups** to 8 workflows keyed on issue/PR number with `cancel-in-progress: true` (except pr-retro which uses `false` to avoid losing entries).
3. **Stripped unnecessary triggers**: removed `edited` from auto-merge, review-gate, and visible-trail; removed `unlabeled` from auto-merge; removed `reopened` from review-gate; removed `synchronize` from visible-trail.
4. **Added squad-label early exit** on heartbeat so non-squad issues/PRs are skipped immediately.
5. **Added path filters** to squad-ci to only run when test/squad source files change.
6. **Fixed pr-retro concurrency** from global `squad-retro-log` to per-PR `squad-retro-${{ PR number }}`.

## Consequences

- Estimated savings: ~8000+ minutes/month.
- No logic changes inside workflow steps — only triggers, concurrency groups, and job-level conditions.
- Playwright E2E can be re-enabled by removing the `if: false` line when needed.
- The `edited` trigger removal is safe because all affected workflows already check conditions via API calls, not event payloads.
