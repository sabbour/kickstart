# Decision: Remove PR preview deployments from SWA workflow

**Date:** 2026-04-14
**Author:** Bender (Backend Dev)
**Status:** Implemented

## Context

SWA auth relies on domain filtering — staging preview URLs break login.

## Decision

Removed pull_request trigger, close_staging job, and pull-requests:write permission.

## Consequences

PRs no longer trigger SWA deployments, saving CI minutes.
