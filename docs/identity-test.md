# Identity Test

This file tests Squad's per-role GitHub App identity system.

## Purpose

Each commit to this PR should come from a different bot account,
proving that per-role identity resolution works correctly.

## Expected Commits

| Role | Bot Account | Status |
|------|-------------|--------|
| Frontend | sabbour-squad-frontend[bot] | Done |
| Backend | sabbour-squad-backend[bot] | Done |
| Tester | sabbour-squad-tester[bot] | Done |
| Lead | sabbour-squad-lead[bot] | Done |

## Test Results

- Parallel token resolution (all 4 roles simultaneously) - PASS
- Commits from 4 different bot accounts - PASS
- PR creation as a bot (gh pr create with --repo flag required) - PASS
- PR reviews from 3 different bots in parallel - PASS
- Review addressing and follow-up commit - PASS
