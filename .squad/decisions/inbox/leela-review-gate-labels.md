### 2026-04-17: Review gate via labels, not GitHub reviews
**By:** Ahmed Sabbour (via Leela)
**What:** Squad PRs use leela:approved + zapp:approved labels as the merge gate, enforced by squad/review-gate status check (squad-review-gate.yml). Required GitHub review approvals removed — authors cannot approve their own PRs.
**Why:** The 1-required-approval branch protection permanently blocked squad agent PRs because agents push as the same GitHub user who owns the repo.
