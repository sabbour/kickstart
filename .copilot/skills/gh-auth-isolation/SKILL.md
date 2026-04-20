---
name: "gh-auth-isolation"
description: "Kickstart override for GitHub auth isolation in agent workflows"
domain: "security, github-integration, authentication, multi-account"
confidence: "high"
source: "earned (repo-specific hardening guidance)"
tools:
  - name: "gh"
    description: "GitHub CLI for authenticated operations"
    when: "When accessing GitHub resources requiring authentication"
---

## Kickstart override

In `sabbour/kickstart`, agent-authored GitHub writes are **GitHub App writes**, not human-account writes.

Use this path for every agent-authored write:

```bash
TOKEN=$(node "$TEAM_ROOT/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG")
export GH_TOKEN="$TOKEN"
```

- Issue/PR comments, edits, GraphQL mutations, review-thread resolution, `gh pr ready`, and `gh pr merge` must run as `GH_TOKEN=$TOKEN gh ...`.
- Pushes must use token-authenticated HTTPS: `git push https://x-access-token:${TOKEN}@github.com/<owner>/<repo>.git <branch>`.
- If `resolve-token.mjs --required` fails, stop. Do **not** fall back to ambient `gh`, ambient `git`, `gh auth token --user`, `gh auth switch`, `ghp`, or `ghw`.

## Human-only troubleshooting

If a human is debugging local GitHub CLI setup outside the Squad write path, they may inspect accounts with:

```bash
gh auth status
```

Prefer config-directory isolation for separate personal/work accounts so one shell does not silently flip another shell's identity:

```bash
GH_CONFIG_DIR=~/.config/gh-public gh auth status
```

## Anti-patterns

- ❌ Using `gh auth token --user` for agent-authored writes in this repo.
- ❌ Using `gh auth switch` in a shared multi-agent shell.
- ❌ Teaching agents to `git push origin` or run bare `gh pr create` in this repo.
- ❌ Persisting human-account tokens in remotes, env files, or committed scripts.
