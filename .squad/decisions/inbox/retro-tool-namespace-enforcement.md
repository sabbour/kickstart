# DP: Enforce pack-scoped tool namespace at authoring time

**Status**: Draft — awaiting @asabbour_microsoft review
**Proposed by**: Leela (squad-lead)
**Category**: ci

## Problem

In PR #401, Bender implemented `core.assess_aks_cluster` in `pack-azure`. The `core.*` prefix is reserved for `pack-core` tools, but nothing prevented the agent from using it. The tool passed unit tests and reviews but failed the `schema-conformance.test.ts` CI check, which enforces that tools registered in a pack are namespaced under that pack's prefix (e.g. `azure.*` in `pack-azure`). This required a follow-up fix commit (`09ddb796`) before the PR could land, adding unnecessary churn and a rebase cycle.

The same pattern was seen earlier: `pack-github` tools were momentarily named with a generic prefix during PR #399's drafting before review caught it. Two incidents in the same phase indicates a systemic gap, not an agent error.

## Proposal

Add a **pre-push lint rule** (or extend the existing conformance test) that verifies tool `name` fields match the expected pack prefix for the pack they are registered in. Specifically:

1. In `packages/pack-azure/src/server-manifest.ts`, add a static assertion (or a Jest/Vitest test in the pack's own test file) that every exported tool's `name` starts with `"azure."`.
2. Mirror the same assertion for `pack-core` (`core.*`), `pack-aks-automatic` (`aks.*`), and `pack-github` (`github.*`).
3. Update Bender's charter (`bender/charter.md`) with an explicit callout: "Tool names in pack-azure must be prefixed `azure.`; using `core.*` in any pack other than `pack-core` will fail CI."
4. Add a one-liner to the `pack-authoring.md` skill: "Name tools `<pack-prefix>.<tool-name>`. The prefix is the pack's registry key (azure, core, aks, github)."

This check is fast (<1 ms, zero imports) and surfaces the error before push rather than after CI runs.

## Impact

- **Bender** — primary implementor of pack tools; needs charter update.
- **Kif** — may want to surface this as a workflow lint step (optional; the pack-level test is sufficient).
- **Hermes** — may want to add this check to the pack conformance layer (already owns `schema-conformance.test.ts`).
- No user-facing changes.

## Alternatives considered

- **Only rely on the existing schema-conformance test**: Already in place and caught this, but only after push. Adding an earlier check in the pack's own test suite surfaces it at `npm test` locally.
- **Prefix enforcement via ESLint custom rule**: Heavier; requires plugin authoring. A Vitest test in each pack is simpler and already consistent with the project's test-everything-in-Vitest approach.
- **Charter-only fix (no CI change)**: Charters drift. A code-level guard is the durable fix; the charter update is a complement, not a substitute.
