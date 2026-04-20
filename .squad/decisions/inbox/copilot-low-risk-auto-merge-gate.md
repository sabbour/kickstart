---
title: Low-risk PRs get an opt-in auto-merge gate
date: 2026-04-20
author: Copilot
---

## Context

`Squad Auto Merge` already covered dual-approved PRs, but low-risk chore/config changes still needed the same full approval path and manual merge step. Retro data for issue #784 showed those PRs spend disproportionate time waiting after CI.

## Decision

Add an explicit `squad:chore-auto` label and treat it as a low-risk auto-merge opt-in:

- the review gate turns green with fresh `leela:approved` alone for `squad:chore-auto` PRs
- if the PR title/body/branch/labels look security-sensitive (`security`, `GHSA`, `CVE`, `vulnerability`) or it touches sensitive paths (`.github/workflows/**`, auth, guardrail, security code), `zapp:approved` is still required
- the custom label sync also triggers when `.github/workflows/sync-squad-custom-labels.yml` changes so new low-risk labels are created as part of the rollout merge
- `Squad Auto Merge` reuses the same trusted CI/review-gate checks, XL exclusion, `refactor` exclusion, stale-label clearing, and audit-comment trail

## Why

This keeps the fast path explicit and narrow while preserving the stronger security gate for workflow/auth/guardrail/security changes, even when the PR text looks harmless. Triggering the custom label sync on its own workflow file also makes the rollout self-hosting instead of depending on a later team-file edit or manual dispatch.
