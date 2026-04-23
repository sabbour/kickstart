# Decision: Remove PR Retro Workflow

**Date:** 2026-04-23
**Author:** Bender (Backend Dev)
**Requested by:** Ahmed Sabbour
**Status:** Accepted

## Context

The `squad-pr-retro.yml` workflow ran on every PR close and every push to `main`, collecting retro-log metrics and backfilling revert flags. At ~601 runs/month, this consumed significant CI minutes for data that is no longer needed.

## Decision

Fully remove the PR retro-log system:
- Delete `squad-pr-retro.yml` workflow entirely
- Remove the `classify-trusted-retro-log-pr` job from `ci.yml` and all its downstream references
- Remove `isTrustedRetroLogPr` function and `TRUSTED_RETRO_*` constants from `squad-auto-merge.yml` and `squad-review-gate.yml`
- Remove the retro-log fast-path early return in review-gate

## Consequences

- **Saves ~601 CI min/month** — the workflow no longer exists.
- `.squad/retro-log.md` will stop receiving new entries.
- Revert-backfill detection on pushes to `main` is also removed.
- CI pipeline is simpler: `ci-gate` no longer depends on a classify job.
- Auto-merge and review-gate no longer have a retro-log fast-path.
- To restore, the workflow and all references would need to be re-created from git history.
