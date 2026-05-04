# DP: Add TypeScript strict-check pre-merge gate to prevent SWA deployment breakage

**Status**: Draft — awaiting @asabbour_microsoft review
**Proposed by**: Leela (squad-lead)
**Category**: ci

## Problem

PR #399 was a fast-lane hotfix to unblock SWA deployment after a TypeScript type error in `packages/pack-core/src/components/rich/DiffPlan.tsx` reached `dev` and caused the Azure Static Web Apps deployment workflow to fail. The error (`TS2322: Type 'string | { path: string; } | { call: string; ... }' is not assignable to type 'ReactNode'`) was introduced by a legitimate feature change and passed unit tests, but only surfaces during `tsc` strict compilation — which the CI `Squad CI` workflow runs, but only after merge to `dev`.

The result: a broken deployment pipeline on `dev` for ~30 minutes while the hotfix was authored, reviewed (fast-lane), and merged. Two squad cycles were consumed on a class of error that a pre-merge type check would have caught.

This is the third time a TypeScript error in a React component has caused a post-merge SWA failure (previous instances in the v0.5.x sprint). The pattern is: feature PR passes tests (Vitest mocks away tsc) → merges to dev → SWA deploy fails → hotfix PR.

## Proposal

1. **Add a `tsc --noEmit` step to the `CI` workflow** (`.github/workflows/ci.yml`), gated on changes to `packages/pack-core/src/**/*.tsx` and `packages/web/src/**/*.tsx`. This step runs TypeScript strict mode compilation without emitting output, failing the CI check if any type errors exist. This is a Kif-owned change.

2. **Add a note to Fry's charter** under "How I Work": "Before opening a PR that touches `.tsx` files, run `npx tsc --noEmit` in `packages/pack-core` and `packages/web` to confirm no type errors. A type error in a component will fail SWA deployment after merge."

3. **Add the same note to Bender's charter** for any `.tsx` files Bender touches (e.g., when adding component schemas to server-manifest).

4. **Fast-lane exception**: The `tsc --noEmit` check should also run on fast-lane PRs. Fast-lane skips design review but must not skip CI gates. Update `ceremonies.md` to state this explicitly: "Fast-lane PRs skip DP and DR but must pass all CI gates including `tsc --noEmit`."

## Impact

- **Kif** — implements the CI workflow change (estimate: S).
- **Fry** — primary owner of `.tsx` components; charter update is documentation only.
- **Bender** — occasional `.tsx` contributor; charter note is a reminder.
- **SWA deployment reliability** — eliminates the most common post-merge deployment failure class.

## Alternatives considered

- **Type-check in Vitest**: Vitest can be configured with `typecheck: true` to run tsc alongside unit tests. Tried in an earlier sprint but caused slow test runs (~45s added). A dedicated `tsc --noEmit` step in CI is faster and cleaner.
- **Require TS errors to be zero in the PR description**: Honour system only. A CI gate is the durable fix.
- **Downgrade to `strict: false`**: Removes the safety net for the entire codebase. Rejected; strict mode is a hard project standard.
- **Component-level TS isolation** (separate tsconfig per component): Architectural change, out of scope for a process retro. Could be a future Leela/Bender design decision.
