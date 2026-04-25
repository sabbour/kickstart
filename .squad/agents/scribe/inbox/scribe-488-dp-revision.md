# Scribe — #488 DP Revision Record

**Date:** 2025-07-24  
**Issue:** https://github.com/azure-management-and-platforms/kickstart/issues/488  
**Revision comment:** https://github.com/azure-management-and-platforms/kickstart/issues/488#issuecomment-4269571214

## Summary

Posted a combined revision comment on issue #488 addressing all conditions from Leela (C1–C6) and Zapp (Z1–Z3). Recheck requests posted for both reviewers.

## Conditions addressed

| ID | Reviewer | Condition | Status |
|----|----------|-----------|--------|
| C1 | Leela | 7 redirect stub `.md` files in `docs/` added to Phase A DELETE inventory | Addressed |
| C2 | Leela | `DEVELOPMENT.md` (root) added to Phase D; grep targets: `STEPWISE_GENERATION_V1` + v1 env vars | Addressed |
| C3 | Leela | `SUMMARY.md` orphan added to Phase A DELETE list | Addressed |
| C4 | Leela | "Update sidebar config / sidebars.ts" steps struck from Phase A and C | Addressed |
| C5 | Leela | `harness-api-reference.md` must reproduce §16 naming table; brief gets archive header | Addressed |
| C6 | Leela | Sequencing gate added to AC: Step 13 runs only after Steps 1–12 merged into v2-rewrite | Addressed |
| Z1 | Zapp | Azure identifier scrub (subscription ID, tenant ID) from `DEVELOPMENT.md` and `infra/README.md` | Addressed |
| Z2 | Zapp | `harness-api-reference.md` must document: default-deny MCP, `requiresSession` exclusions, UserActions off MCP manifest, token map non-serialization, fail-closed guardrails | Addressed |
| Z3 | Zapp | Phase D: preserve "never commit `local.settings.json`" and secrets-out-of-repo guidance in `CONTRIBUTING.md` | Addressed |

## Recheck requests posted

- Leela recheck: https://github.com/azure-management-and-platforms/kickstart/issues/488#issuecomment-4269571849
- Zapp recheck: https://github.com/azure-management-and-platforms/kickstart/issues/488#issuecomment-4269571993
