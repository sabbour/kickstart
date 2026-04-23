# Decision: Disable PR Retro Workflow

**Date:** 2026-04-23
**Author:** Bender (Backend Dev)
**Requested by:** Ahmed Sabbour
**Status:** Accepted

## Context

The `squad-pr-retro.yml` workflow runs on every PR close and every push to `main`, collecting retro-log metrics and backfilling revert flags. At ~601 runs/month, this consumes significant CI minutes for data that is no longer needed.

## Decision

Disable the PR retro workflow by adding `if: false` to the `retro` job. The workflow file is preserved (not deleted) so it can be re-enabled if needed later.

Downstream references to retro-log PRs in `ci.yml`, `auto-merge.yml`, `review-gate.yml`, etc. are left untouched — they check for retro-log PRs that will no longer be created, so they are harmless no-ops.

## Consequences

- **Saves ~601 CI min/month** — the workflow will no longer execute.
- `.squad/retro-log.md` will stop receiving new entries.
- Revert-backfill detection on pushes to `main` is also disabled.
- Re-enabling requires removing the `if: false` guard.
