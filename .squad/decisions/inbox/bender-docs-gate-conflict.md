# Decision: preserve canonical docs gate paths during PR #840 conflict resolution

**Date:** 2026-04-20T09:33:44.947-07:00  
**Author:** Bender (Backend Dev)  
**Status:** Implemented

## Context

Rebasing `squad/810-harden-docs-gate` onto `origin/main` produced conflicts in the docs gate and custom label workflows. Main had already moved API-doc references to the consolidated `docs-site/docs/extending/api-endpoints.md` path and added the rolling `docs:sweep` label, while the PR introduced the explicit `skip-docs` bypass label and hard-gate behavior.

## Decision

Keep the main-branch canonical docs path and existing `docs:sweep` custom label, then layer the PR's `skip-docs` bypass logic on top. Do not restore the legacy `docs/api-reference.md` path or drop the new bypass label during conflict resolution.

## Why

This is the narrowest resolution that preserves both shipped docs consolidation work and the PR's intended gate hardening. It keeps the docs handoff lane aligned with the current docs surface while avoiding scope creep into unrelated workflow behavior.
