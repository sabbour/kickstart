---
title: Monthly docs sweep writes to a rolling Scribe issue
date: 2026-04-20
author: Bender
---

## Context

#831 adds the deferred monthly Docs Sweep automation now that #811 and #813 have landed. The repo already has a weekly pulse issue and a rolling daily pulse issue, so the remaining question is where the monthly docs audit should live.

## Decision

Publish the monthly docs sweep to a dedicated rolling Scribe issue titled `📚 Docs Sweep (rolling)` and label it with `squad:scribe` plus `docs:sweep`.

The workflow targets the canonical docs surface at `docs-site/docs/` and the canonical brief path `docs-site/docs/architecture/v2-implementation-brief.md`. The issue body carries automated docs-health signals and the standing manual checklist; any real drift discovered during the sweep should become focused `process` issues instead of more pulse artifacts.

## Why

This keeps the docs audit persistent and easy to update without creating another weekly-style issue stream. It also cleanly separates docs hygiene from Weekly Pulse, which stays the team’s time-boxed summary artifact.
