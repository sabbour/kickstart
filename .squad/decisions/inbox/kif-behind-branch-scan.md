# Decision: Proactive BEHIND Branch Scan — Mandatory Per-Cycle Protocol

**Date:** 2026-04-27
**Author:** Kif (squad-platform[bot])
**Status:** Accepted
**Context:** User directive — DevOps ownership of branch protection / CI gate process

## Decision

The team will proactively scan all open PRs for `BEHIND` (out of date with base branch) status on every monitoring cycle — immediately after the thread scan and before checking CI or merge readiness. This is a hard gate: a `BEHIND` PR will never auto-merge even if all checks are green, because `strict_required_status_checks_policy: true` is enforced at the repo level.

## Why

Ralph was repeatedly discovering BEHIND PRs only after noticing that auto-merge had stalled. The scan must be explicit and first-class to prevent invisible blocking.

## Protocol

1. `gh pr list --state open --json number,mergeStateStatus --jq '.[] | select(.mergeStateStatus=="BEHIND") | .number'`
2. For each BEHIND PR: `gh api repos/{o}/{r}/pulls/{N}/update-branch -X PUT`
3. HTTP 422 = real conflict → route to implementing agent for manual rebase.

## Scope

This is a DevOps / branch protection concern (Kif's domain).

Documented in:
- `.squad/ceremonies.md` — branch-currency rule as a named hard gate
- `.squad/skills/pr-workflow/SKILL.md` — "Proactive BEHIND Branch Scan (run SECOND)" section
