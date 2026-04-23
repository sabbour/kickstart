# Nibbler — Round 4 review decisions

**Date:** 2026-04-21
**Author:** Nibbler (Code Reviewer, Lead-tier)
**Scope:** PRs #1005, #1000 (re-approval), #1003, #1004

## Decisions

### 1. PR #1005 — APPROVED
`core_emit_ui` strict-mode schema regression (#998) fix. Parametrised conformance test walks every pack-core tool at every nesting depth (`anyOf`/`oneOf`/`allOf`/`items`/`additionalProperties`); explicit regression assertion pinned to `createSurface.sendDataModel`; runtime contract preserved via `stripNulls` before `A2UIMessageSchema.parse`; sibling sweep for `list_files.ts` included. CI green (940 tests). Formal review + `nibbler:approved` label.

### 2. PR #1000 — APPROVED (re-approval after revise)
All three round-3 blockers resolved:
- **TS2307 + TS2352**: path aliases aligned across `packages/web/tsconfig.json` + `vite.config.ts` + `vitest.config.ts`; Zod cast narrowed with explicit `as unknown as z.ZodTypeAny` + comment documenting the zod@3/zod@4 bridge.
- **Concrete bundle-budget gate**: `packages/web/scripts/check-bundle-budget.mjs` wired via `postbuild`. Correctly scoped to `index-*.js` + `Playground-*.js` only — vendor workers (monaco `ts.worker`, mermaid lazy chunks) explicitly excluded. Ceilings sit with sane headroom above current measurements. Waiver via PR description `bundle-budget-waiver:` line.
- **Pack-authoring docs**: server/client subpath contract + `registerClient` pattern documented in `docs-site/docs/guides/packs-and-skills.md`.

Single-revert rollback confirmed. Full CI green. `nibbler:approved` label re-applied (was stripped on synchronize).

### 3. PR #1003 — APPROVED
#995 Core-tab density + preview coverage. Named-constant geometry module (`playground-layout-constants.ts`) is the single source of truth consumed by CSS (`Playground.tsx`), unit test (`playground-core-tab-rendering.test.ts`), and Playwright (`playground.spec.ts`). Stable data-attribute selectors on cards. Preview-coverage matrix parametrised across all shipped core basic renderers. `nibbler:approved` label.

### 4. PR #1004 — APPROVED
#997 workspace black void. `min-height: 0` chain complete across all four column-flex links. Explicit geometry assertions use named constants (`MAX_EDITOR_BOTTOM_SLACK_PX`, `MIN_CODE_WRAPPER_HEIGHT_PX`) — no magic numbers, no background-color proxy. Two viewport states. Formal review + `nibbler:approved` label.

## Conventions carried forward

- **Bundle-overage pattern**: concrete ceiling + CI gate + waiver-by-PR-description line is the approved shape for any future "controlled performance overage" sign-off.
- **Self-authored PRs**: GitHub blocks formal `gh pr review --approve` when the authenticated identity matches the PR author. For PRs authored by `sabbour`, only the `nibbler:approved` label path is available. The `check-squad-approval` workflow reads the label, so this is a non-blocking operational limitation — future Nibbler runs should expect the GraphQL "cannot approve own PR" error and fall through to the label path without retrying.
- **Named-constant geometry ask is now proven**: for any layout regression where CSS, unit, and E2E all assert geometry, the single-source-of-truth module pattern (`*-layout-constants.ts` imported by all three) is the approved shape. Applied cleanly in #1003 and #1004.
- **CI-green precheck before approve** remains mandatory after round-3 learning: never approve on PR-body test counts alone; always verify the checks panel.

## Consequences

- Four PRs cleared on the first round-4 pass — continues to validate the DP-stage gate reducing PR-stage rework.
- Bundle-budget script is now the baseline — future pack additions that breach the ceiling must either raise the number in the script (requiring deliberate edit + waiver note) or split into lazy chunks.
