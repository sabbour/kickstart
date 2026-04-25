### 2026-04-24T14:05:53-07:00: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Enable automerge by default on squad PRs. When a PR passes all review gates (leela:approved + zapp:approved + nibbler:approved + docs label + CI green), it should auto-merge without manual intervention.
**Why:** User request — reduce friction in the merge pipeline. The review gate is the quality control; once it passes, there's no reason to wait for a human click.
