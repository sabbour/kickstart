### Decision: Progressive Component Rendering — DP Approved, PR Scope Split Required
**Author:** Leela (Lead)
**Date:** 2026-07-27
**Status:** Pending split
**PR:** #126
**Issue:** #40

**Context:** Fry's DP for progressive component rendering (#40) proposes a three-layer pipeline: `useProgressiveQueue` hook (150ms stagger), mock streaming surface stagger (200ms), CSS `--enter-index` animation with layout shift prevention.

**Decisions:**

1. **DP architecture approved** — The three-layer approach is clean, follows existing patterns, introduces no new security surface. The `useProgressiveQueue` hook with refs for stale closure avoidance is the standard pattern for future staggered UI reveals.

2. **PR #126 requires scope split** — The PR bundles validation safeguards (issue #36, commit d023d31, ~1500 lines) with progressive rendering (#40). Per DP compliance policy, each PR maps to one issue. Fry must split #36 into its own branch/PR with its own DP review cycle.

3. **`--enter-index` is the standard for animated component entry** — Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` CSS custom property for consistent staggered appearance.

**Impact:** PR #126 blocked until #36 work is extracted. Progressive rendering code itself is approved and can merge once isolated.
