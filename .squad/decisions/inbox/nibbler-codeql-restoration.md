# Decision: CodeQL Workflow Restoration

**Date:** 2026-04-20  
**Author:** Nibbler (Code Reviewer & Watchdog)  
**Status:** Implemented

## What Happened

The CodeQL workflow was added in commit `9db4d59` ("ci: add custom CodeQL workflow, skip retro-log PRs") on branch `squad/fix-retro-base-ref`. That branch was **never merged into `main`**, so the file never landed in the default branch. It was not explicitly deleted — it was simply never present on `main`. The file was orphaned on an unmerged branch.

## Restored Workflow

The workflow at `.github/workflows/codeql.yml` has been restored exactly from commit `9db4d59` with no modifications. It:

- Triggers on `push` and `pull_request` targeting `main`, and on a weekly schedule (Mondays at 03:00 UTC)
- Scans `javascript-typescript` and `actions` languages using `codeql-action/init@v3` and `codeql-action/analyze@v3`
- Skips analysis for retro-log PRs — specifically, the `analyze` job is skipped when **all three** conditions are true:
  1. The PR has the `retro-log` label
  2. The head branch starts with `retro-log/pr-`
  3. The PR opener is `github-actions[bot]` or `sabbour-squad-lead[bot]`
- Permissions are scoped correctly: `security-events: write`, `packages: read`, `actions: read`, `contents: read`

## Current GitHub Actions Best Practices

The workflow is consistent with current best practices:
- Uses `actions/checkout@v4` (current stable)
- Uses `github/codeql-action/init@v3` and `analyze@v3` (current stable)
- `build-mode: none` is appropriate for interpreted languages (JS/TS)
- Permissions are least-privilege scoped at the job level
- No pinned SHA digests — consider pinning to digests for supply-chain security (🟡 concern, not a blocker)

## Recommendation

No changes to the restored logic are needed. The retro-log skip condition is intentional and documented. If the team adds new languages in future, the `matrix.language` array should be extended here.
