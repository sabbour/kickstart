---
name: "release-readiness-triage"
description: "Triage release blockers by checking stale release PRs, duplicate hotfixes, live production failures, and canonical docs drift"
domain: "release-management"
confidence: "high"
source: "earned"
last_updated: 2026-04-19T20:03:58.117-07:00
---

## Context

Use this when deciding whether a release should ship now, which open PRs still matter, and which open issues are real blockers versus cleanup that can wait.

## Patterns

- **Kill stale release branches early.** If a release PR is conflicting, failing CI, and materially behind `main`, do not rehabilitate it by default. Check whether its core payload already landed via a different merge PR, then cut a fresh release path from current `main`.
- **Treat live production 500s as blockers even if the issue tracker is quiet.** A user-visible runtime failure outranks docs/process work until disproven with logs and a production verification.
- **Collapse duplicate hotfix PRs to one branch.** When multiple PRs fix the same runtime bug, keep the smallest green one with the lowest maintenance surface; close the manual duplicate.
- **Scan canonical docs, not just docs-site.** Release docs can still be stale if the brief or README retains migration-era language after a docs cleanup PR has merged.
- **Separate product blockers from process blockers.** Runtime outages and missing startup wiring block the release; docs workflows, checklists, and cadence automation usually do not.

## Kickstart reference

- Superseded release PR: `#737`
- Canonical merged replacement: `#797`
- Duplicate runtime fixes: `#825` vs `#826`
- Runtime blocker area: `packages/web/api/`
- Canonical drift file: `docs/v2-implementation-brief.md`
- Automation follow-up: issue `#792`
