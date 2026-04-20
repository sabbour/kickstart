---
title: Low-risk dual-approved PRs may arm squash auto-merge
date: 2026-04-20
author: Bender
---

## Context

PRs that already had both squad approval labels and green CI were still waiting on a manual merge step, even for small low-risk changes. Retro analysis called out the extra idle time on PRs like #771.

## Decision

Add a `Squad Auto Merge` workflow that arms GitHub squash auto-merge when a PR is:

- open and non-draft
- labeled `leela:approved` and `zapp:approved`
- fully green on the latest status/check rollup, including `CI Gate` and `squad/review-gate`
- not XL (`additions + deletions > 1000`)
- not titled `refactor`

The workflow leaves XL and `refactor` PRs for explicit human merge, and posts an audit comment when it arms auto-merge.

## Why

This removes dead wait time without weakening the review gate. The exclusions keep large or intentionally broad changes on a human-controlled merge path.
