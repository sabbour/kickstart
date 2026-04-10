# Decision: OIDC credentials use `secrets.*` not `vars.*`

**Date:** 2026-04-10
**Author:** Bender
**Context:** PR #65 review by @copilot

## Decision

All references to AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_SUBSCRIPTION_ID
in prompt knowledge, workflow generators, and documentation MUST use
`${{ secrets.* }}` — NOT `${{ vars.* }}`.

## Rationale

The existing codebase (deploy-infra.yml, github-actions.ts generator,
demo-scenarios.ts, docs/deployment.md) uniformly uses `secrets.*` for these
values. While GitHub supports both `vars` and `secrets`, mixing them causes
inconsistent generated workflows and confuses the LLM. One convention, enforced
everywhere.

## Scope

Prompt knowledge (kits), workflow generators, documentation, demo scenarios.
