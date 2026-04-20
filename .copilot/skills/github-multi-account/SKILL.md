---
name: github-multi-account
description: Repo-specific override for multi-account GitHub guidance in Kickstart.
confidence: high
source: sabbour/kickstart auth hardening
author: kickstart
---

# GitHub Multi-Account — Kickstart Override

This repo does **not** use account-switching aliases for agent-authored writes.

## Rule for `sabbour/kickstart`

For Squad agents, every GitHub write must resolve the role app token first:

```bash
TOKEN=$(node "$TEAM_ROOT/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG")
export GH_TOKEN="$TOKEN"
```

Then:

- use `GH_TOKEN=$TOKEN gh ...` for issue/PR comments, edits, GraphQL mutations, `gh pr create`, `gh pr ready`, and `gh pr merge`
- use `git push https://x-access-token:${TOKEN}@github.com/<owner>/<repo>.git <branch>` for pushes
- stop immediately if token resolution fails

## Forbidden for agent-authored writes here

- `gh auth switch`
- `gh auth token --user ...`
- `ghp` / `ghw` alias flows
- bare `gh` write commands
- `git push origin`

## Human note

If a human wants personal/work aliases for other repos, keep that setup outside the Squad automation path. Do not teach Kickstart agents to depend on those aliases.
