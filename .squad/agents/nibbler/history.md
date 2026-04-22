## Summary (Rolled Up 2026-04-21)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For full learnings, refer to the git history or archived history files.

**Agent:** history.md  
**File rolled at:** 2026-04-21T21:36:58.305470Z  
**Remaining details:** See `.squad/agents/history.md/history-archive.md` for prior entries.

---

# Nibbler — History

## Team Updates

### 2026-04-22 — DP #1041 Test-Plan Approval Passed; 7 Conditions for Bender Implementation

**Status:** ✅ APPROVED WITH CONDITIONS (test-plan review complete)

**7 implementation conditions (N1–N7):**

1. **N1 — T1 Test Inversion (Two Sub-Cases):** `.squad/scripts/verify-api-externals.test.mjs` T1 block has two cases — both must flip. (a) OTel packages WILL be in inputs after bundling → assert present. (b) Replace negative-external assertion with positive "only @azure/functions-core external."
2. **N2 — Build Guard Inversion:** `packages/web/api/scripts/verify-api-externals.mjs` lines 41-49 fail on OTel in inputs (now true after bundling) → invert or remove. Lines 68-82 (require.resolve OTel) become meaningless → remove.
3. **N3 — T2 Rewrite:** `appinsights.test.ts` T2 (lines 56-63) tests module import triggers init; post-IIFE removal, import alone does nothing → rewrite as: (a) import → negative (NOT called), (b) call init → positive (called once), (c) call again → positive (still once, idempotent).
4. **N4 — T12 Rewrite:** T12 tests init error path (useAzureMonitor throws); post-IIFE removal, import doesn't call it → rewrite to explicitly call `initializeAppInsights()` after import, then assert console.error.
5. **N5 — Handler Init Calls:** `health.ts`, `converse.ts`, `packs.ts`, `startup/packs.ts` must each add try/catch-wrapped `initializeAppInsights()` call on first invocation (before business logic).
6. **N6 — Handler Test Assertions:** Handler tests must add assertions that `initializeAppInsights` was called (mock is already wired via test harness; assertions missing).
7. **N7 — Meta.json Evidence Gate:** PR body must include proof scripts (node -e commands) showing (a) OTel bundled (in inputs), (b) only @azure/functions-core external.

**Verification plan:** Implementation PR review will execute meta.json proof scripts and verify T1-T12 test outcomes + handler init coverage.

**Reference logs:**
- DP test-plan review: `.squad/decisions/inbox/nibbler-1041-dp-review.md` (merged into decisions.md)
- Orchestration log: `.squad/orchestration-log/2026-04-22T04:40:00Z-nibbler-17.md`

---

## Project Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, OpenAI Agents SDK
- **Architecture:** Harness + Packs model (v2). See `docs/v2-implementation-brief.md`
- **User:** sabbour
- **Joined:** 2026-04-18

## Learnings

### 2026-04-18: Onboarding context

- Team runs at 34 PRs/day velocity — reviews must be fast and decisive
- Retro analysis revealed "review time" was mostly Copilot PR reviewer bot latency (sequential passes 30-90 min apart), not human design debates
- Review gate (#427) uses label-based approval: `leela:approved`, `zapp:approved` — adding `nibbler:approved`/`nibbler:rejected`
- Bot identities: `sabbour-squad-lead[bot]`, `sabbour-squad-frontend[bot]`, `sabbour-squad-backend[bot]`, `sabbour-squad-tester[bot]`
- Key files: `.squad/decisions.md` (team decisions), `docs/v2-implementation-brief.md` (architecture brief)
- Pack boundaries are sacred — changes blurring two packs are flagged
- Zero rework target — catch issues in review so PRs merge on first cycle

### 2026-04-21: Batch review — 4 PRs (parity reviewer role)

First run as full structured reviewer (parity with Leela/Zapp). Patterns observed:

- **#989 (A2UI v0.9 clean break):** strong loud-rejection discipline — Zod `unrecognized_keys` error code is the right hook for "non-spec property" messaging. The `strict()` Button + non-strict containers asymmetry was a deliberate, documented trade-off for mid-stream streaming; accept it, don't flatten. Clean-break PRs need at least three test classes: canonical-shape acceptance, per-edge-case survival, and explicit legacy-dialect rejection. This PR had all three. Approved.
- **#986 (Playground polish):** `mergeClasses` tolerates falsy branches, so `fillContainer && styles.rootFill` is fine — but the codebase mixes `mergeClasses` with template-literal concat. Watch for consistency nits. Opt-in boolean props (`fillContainer = false`) keep the blast radius small; that pattern is reusable for any layout override added to a shared viewer component. Visual polish PRs rarely carry new tests — flag as 🟡 concern but don't block when Playwright E2E is green. Approved.
- **#988 (remove Ideas tab, DRAFT):** deletion PRs need a "grep the deleted symbol across the whole package" pass — `GalleryCardErrorBoundary` class name and a `groupByPack` example comment still reference the deleted concept. Flag doc-comment drift explicitly; TypeScript won't catch it. Comment-only on draft.
- **#990 (inspirations variety, DRAFT):** prompt allow-lists are only as good as the actual registered catalog — ALWAYS grep-verify each listed component name against the registry before approving. Duplicated fallback arrays in two packages with a "keep in sync" doc-comment is a latent drift bug; either centralise or pin with a unit test. Comment-only on draft.

**Cross-cutting takeaway:** after the clean-break landing in #989, legacy-dialect regressions are the class of bug most worth watching — any new LLM-facing prompt or fallback content must name components the client actually renders, or we're back to `_ErrorComponent` banners. #990's allow-list is exactly that risk surface.

---

## 2026-04-21T10:15:00Z — Four-way review gate structural shift + parity directive

**Event:** Ceremony enforcement PR #993 shipped. PR Review Gate is now 4-way: Leela (architecture) + Zapp (security) + Nibbler (code-quality) + Docs reviewer (interim: Scribe).

**Impact on nibbler:**
- ✅ Elevated to full structured-reviewer parity with Leela + Zapp
- ✅ Review outcomes (nibbler:approved / nibbler:rejected) are blocking merge gates
- ✅ Reviews posted via `gh pr review` under lead bot identity (protocol: same as Leela/Zapp)
- ✅ Merge criteria: all four approval labels required (leela + zapp + nibbler + docs)
- 💬 First run as structured reviewer completed: approved #989 + #986, comment-only on #988/#990 (drafts)

**Directive:** "Every PR review must be engaged as full structured gate, not ad-hoc."

## 2026-04-21T10:52:00Z — Batch review: PR #993 + DPs #991/#980

**PR #993 — Ceremony enforcement wiring → APPROVED (`nibbler:approved`)**
- Verified workflow logic end-to-end: `squad-review-gate.yml` precedence (rejection > pending > success), `squad-auto-merge.yml` 3-way preservation matrix + `getDocsBlocker` gating, `squad-visible-trail.cjs` 4-reviewer render.
- Cross-file consistency clean: ceremonies.md ↔ charter ↔ squad.agent.md ↔ pr-workflow SKILL agree on labels, bot-identity protocol, and 6h-sprint recalibration.
- No unit tests for workflow JS (established repo pattern); `no-changeset` correct for governance-only PR.

**DP #991 (pack renderers via engine, Fry) — APPROVED on DP**
- Option A (engine-native) decomposition is sound: dual-entry `./server`/`./client` subpath exports + `registerClient(registry)` + pack-contributed `previews` fixtures. Preserves harness+packs boundary; web → packs dep direction is correct.
- Test strategy nails the failure mode that opened the gap: per-pack schema-vs-fixture parse test prevents drift, plus RTL integration + Playwright on Playground AND chat paths.
- Non-blocking: promote bundle-budget from advisory prose to a concrete KB threshold at measure time; document rollback as single-revert in PR body; confirm pack-authoring doc path before ready-for-review.
- Correctly gated on #989 landing first.

**DP #980 (emit_ui.test.ts explicit-op fixture, Bender) — APPROVED on DP**
- Discriminator-pinning equality assertion is exactly the right coverage shape. Dedicated `describe` block beats parametrized loop for intent clarity.
- Pushed: promote the negative-control fixture (mismatched `op` vs payload key) from optional to required — it's the single most valuable assertion and costs nothing.
- Docs impact: N/A correctly justified (dual-schema design already documented inline at `emit_ui.ts:38-46`).

**Cross-cutting pattern:** first run under the 4-way gate where Nibbler approves at DP stage (not just PR stage). DP-stage code-quality review catches test-design gaps (fixture drift, discriminator pinning) before implementation burns the hour — which is the whole point of the gate.

## 2026-04-21T11:35:00Z — Round 3 review batch (DPs #987/#995/#996/#997/#998 + PRs #1000/#1001)

**DP #998 — Chat broken, core_emit_ui schema regression (Bender, S, 🔴 HIGH) → APPROVED (`nibbler:approved`)**
- Diagnosis correct: OpenAI strict-mode requires every `properties` key to appear in `required`. Fix shape (nullable-required instead of `.optional()`) is idiomatic.
- DP's proposed test — structural invariant `Object.keys(properties).every(k => required.includes(k))` iterated over every `anyOf` branch — is exactly the conformance test that would have caught #989. This was Ahmed's test-gap ask and the DP closes it cleanly.
- Pushed at review: **parametrise the invariant to iterate every tool in pack-core, not just `core_emit_ui`** (promote the "follow-up audit" into this PR — one-loop extension, zero marginal cost). Also asked for vendor-schema-drift test against `server_to_client.json` and a runtime audit of all `.optional()` Zod fields in `pack-core/src/tools/*` to catch sibling regressions before they land.

**DP #987 — Ideas tab (Fry, M) → APPROVED**
- Correctly gated on #991. Non-blocking push: scenarios should ship as a separate `scenarios: Record<ScenarioId, A2UIEnvelope>` export distinct from per-component `previews` so the existing fixture-parses-schema guard stays untouched and scenarios get their own envelope-v0.9 validator.

**DP #995 — Tight core rendering regression (Fry, M) → APPROVED**
- Root-cause-first + consolidate-onto-shared-primitive is the correct fix shape (prevents another #986-class regression). Pushed: DOM assertion thresholds must be named constants imported from the CSS module (not hard-coded in spec) so they don't silently drift.

**DP #996 — AKS `_ErrorComponent` + brittle inspiration chain (Bender, M) → APPROVED with coordination ask**
- Distinct from #991 (skill-chain output vs. pack rendering) but with overlap in the registry-validation layer. Asked Bender to **reuse `validateAndSanitizeComponents`** from #991 (don't invent a parallel validator — two validators drift). Re-repro after #1000 lands because the failure surface will narrow once `azure/*`/`aks/*`/`github/*` resolve in the registry.
- Flagged the "run the skill chain N times" reliability check as a **flake magnet** — must either pin model+seed+temperature=0 for determinism or be moved off PR CI to nightly. Don't let non-deterministic LLM tests block PRs.

**DP #997 — Workspace black void (Fry, S) → APPROVED**
- Classic Monaco-in-flex `min-height: 0` pitfall. Pushed: test must use explicit geometry (`editor.bottom >= viewport.height - N` with named `N`), not a background-color proxy.

**PR #1001 — emit_ui explicit-op fixture → APPROVED (`nibbler:approved`)**
- All three DP asks delivered: discriminator-pinning equality assertion, 4-op-variant parametrised loop, **negative control promoted from optional to required**. Clean code, tight comments, CI green (33/33 pack-core tests, lint clean, Playwright pass).

**PR #1000 — pack rendering via the engine → CHANGES_REQUESTED**
- Substance is excellent. DP-review asks mostly addressed: pack-authoring docs present in `packs-and-skills.md` ✅, single-revert rollback ✅, bundle numbers quoted at measure time 🟡 (no CI gate — follow-up issue asked). `component-previews.test.ts` render-time `_ErrorComponent` guard is the best thing in the PR and forecloses #996's failure mode structurally.
- **Blocked on red CI**: PR body claimed 930/0 locally but `packages/web` `tsc --noEmit` fails with 12× `TS2307` (`Cannot find module '@aks-kickstart/pack-{azure,aks-automatic,github}/client'`) because `./client` subpath exports point at `./dist/client.d.ts` that don't exist when `tsc` runs in CI (vite/vitest aliases mask this locally). Plus 1× `TS2352` Zod cast mismatch in `adaptPackComponent.ts:29`. Gave three concrete remediation options — preferred: TS path mapping in `packages/web/tsconfig.json` paralleling the vite aliases. Zod cast: `as unknown as z.ZodTypeAny` as immediate unblock, or widen `ComponentContribution.propertySchema` in `@aks-kickstart/harness` to `z.ZodTypeAny` for a cleaner long-term fix.

**Lesson for the gate:** "Verification: 930 tests passed" in a PR body is not a substitute for reading the checks panel. CI status check **before** approve is now my default — added to mental checklist. Bot-identity lockout on the author means this costs ~6h round-trip, which is a real velocity tax when CI is red on a substantively-green PR.

**Cross-cutting:** five DP approvals in one batch with consistent code-quality asks on test durability (named constants not magic numbers, determinism pinning for LLM tests, reusing existing validators not inventing parallels). The 4-way gate is functioning as designed — zero of these asks required a second round.

## 2026-04-21T12:20:00Z — Round 4 batch: PRs #1005, #1000 (re-), #1003, #1004

**PR #1005 — chat regression #998 fix (Bender, APPROVED + formal review)**
- Parametrised conformance test walks every pack-core tool (emit_ui, fetch_webpage, read/write/list_files, validate_artifacts, search_components) with recursive descent into `properties`/`items`/`additionalProperties`/`anyOf`/`oneOf`/`allOf`. Catches regressions at any nesting depth — exactly the DP ask.
- Explicit regression assertion pinned to `createSurface.sendDataModel` — the literal field from the 400. Perfect.
- Runtime contract preserved via `stripNulls` before `A2UIMessageSchema.parse`; harness validator untouched. Test fixtures use a `padComponent` helper mirroring the LLM's strict-mode emission shape.
- Sibling sweep for `list_files.ts` in the same PR (Zapp's DP ask). CI fully green, 940 tests.

**PR #1000 — pack rendering via engine, re-approval (Bender revise, APPROVED via label only)**
- Round 3 blocker (TS2307 + TS2352) cleanly resolved: `packages/web/tsconfig.json` + `vite.config.ts` + `vitest.config.ts` all gained matching `@aks-kickstart/pack-{azure,aks-automatic,github}/client` aliases pointing at `src/client.ts`. Zod cast in `adaptPackComponent.ts` uses `as unknown as z.ZodTypeAny` with clear inline comment documenting the zod@3↔zod@4 bridge.
- Bundle-budget gate landed as concrete CI-wired script (`packages/web/scripts/check-bundle-budget.mjs`) via `postbuild` hook. Ceilings (main 260 000 gz vs measured 228 642; Playground 60 000 vs 39 613) sit above current with sane headroom. **Correctly scoped to `index-*.js` + `Playground-*.js` only** — vendor workers (monaco `ts.worker`, mermaid chunks) explicitly excluded by prefix matching and documented in the header. Waiver mechanism via PR description is reasonable.
- Pack-authoring docs present in `docs-site/docs/guides/packs-and-skills.md` (server/client subpath table + `registerClient` pattern). Single-revert rollback confirmed. Full CI green including Playwright.
- Formal `gh pr review --approve` blocked (PR authored by `sabbour` — self-approval); `nibbler:approved` label re-applied (was stripped on synchronize per protocol). Label is the authoritative gate signal.

**PR #1003 — #995 Core tab density + previews (Fry, APPROVED via label)**
- Named-constant geometry delivered exactly: `playground-layout-constants.ts` exports 7 constants, verified consumed by all three sites — CSS (`Playground.tsx` `gridTemplateColumns`/`gap`/`maxWidth`/`compCardPreview`), unit test (`playground-core-tab-rendering.test.ts`), Playwright (`playground.spec.ts`). Grid↔assertions can't drift silently.
- Stable E2E selectors via `data-component-card` / `data-component-has-preview` / `data-testid="component-card-preview"` — better than class selectors.
- Preview-coverage matrix parametrised across all shipped core basic renderers (Video/AudioPlayer/Tabs/Modal/Accordion added) forecloses #986's other half.
- Pre-existing `basic-components.test.tsx` failure confirmed identical on main — not this PR.
- Formal review blocked (self-authored by `sabbour`); label applied.

**PR #1004 — #997 workspace black void (Fry, APPROVED + formal review)**
- min-height:0 chain complete across `#panel-workspace` → `body` → `viewerWrapper` → `rootFill`. Also drops redundant `height: '100%'` on `#panel-workspace` that conflicted with `flex: 1`. Bonus `minWidth: 0` on `viewerWrapper` for symmetry.
- Explicit geometry assertions with named constants (`MAX_EDITOR_BOTTOM_SLACK_PX = 8`, `MIN_CODE_WRAPPER_HEIGHT_PX = 300`) — direct guard, no background-color proxy. Two viewport states (sidebar visible + collapsed) per DP ask. `describe.skip` consistent with existing #772 pattern.

**Cross-cutting round-4 observations:**
- Four PRs approved in one pass, zero rework asks — the DP-stage gate continues to pay off.
- My round-3 learning ("verify CI green before approving") held — confirmed all four PRs have green Lint/Build/Unit Tests + Playwright + Squad CI before pressing approve.
- **Self-authored PR limitation:** GitHub blocks formal review on PRs where the authenticated identity matches the PR author. For PRs authored by `sabbour` (#1000, #1003), only the `nibbler:approved` label path works. The `check-squad-approval` workflow keys on the label, so this is a non-issue operationally — but worth capturing so future Nibbler runs don't loop on the GraphQL error.
- Bundle-budget pattern (concrete ceiling + CI gate + waiver-by-PR-description) is a good template to carry forward for any future "performance overage, but controlled" sign-off.

## 2026-04-21T18:13:04Z — Corrected review: PR #1046 follow-up commit 0eb44a7f

### Learning: Per-commit diff vs full-PR diff — don't conflate them

**Date:** 2026-04-21

**Context:** A previous Nibbler instance (nibbler-15) hallucinated that follow-up commit `0eb44a7f` on PR #1046 introduced a `.funcignore` file and flagged scope creep. This was incorrect. The `.funcignore` was already in the base PR and had been approved in the first round. The follow-up commit was a pure +2/-0 additive change to `.github/workflows/deploy-swa.yml` only.

**Lesson:** When reviewing follow-up commits on an already-approved PR, always inspect the **specific commit's file list** (`gh api /repos/.../commits/{sha} --jq '.files[].filename'`) before claiming scope creep. The full-PR diff view and the per-commit diff view are **different views** — looking at the full diff of a PR that includes a prior commit's files is NOT the same as looking at what the new follow-up commit changed. A prior instance (nibbler-15) failed this check and blocked a production hotfix unnecessarily.

**What 0eb44a7f actually did:** Added `test -d packages/web/api/node_modules/@opentelemetry/api/` check alongside the existing `@azure/monitor-opentelemetry` check in `deploy-swa.yml`, closing the peer-dep CI assertion gap flagged by leela-16 in review round 1. Scope-clean +2/-0 to one file.

**Action taken:** `nibbler:approved` label re-applied to PR #1046. All three approval labels confirmed present: `leela:approved`, `zapp:approved`, `nibbler:approved`.

## 2026-04-21T21:30:00Z — DP review: issue #1041 revert OTel externalization (Leela-19 DP)

**Verdict:** APPROVED WITH CONDITIONS (`nibbler:approved-dp` applied)

### What I reviewed

Leela-19's DP proposes reverting #1030's OTel externalization (restore `external: ["@azure/functions-core"]` only) and making `initializeAppInsights()` lazy (remove module-load IIFE). Read: `appinsights.ts`, `appinsights.test.ts`, `.squad/scripts/verify-api-externals.test.mjs`, `packages/web/api/scripts/verify-api-externals.mjs`, `scripts/check-swa-health.mjs`, leela-1030-externalization-rollback.md, bender-swa-runtime-forensics.md.

### Key findings

**T1 inversion is underspecified:** The DP says "invert T1 to assert no OTel in externals." Correct as a goal, but the T1 describe block has **two** test cases — the DP only covers one. Test case 1 (`"no required-external source leaked into inputs"`) asserts `leaked.toEqual([])`. After bundling, OTel WILL appear in inputs → **this test fails**. Needs flipping to "OTel MUST be in inputs." Test case 2 passes vacuously after bundling (OTel not in imports) but is now testing nothing useful. Additionally, `verify-api-externals.mjs` build guard also fails the build if OTel is in inputs — not mentioned in DP, will crash builds.

**T2 will fail after IIFE removal:** `appinsights.test.ts` T2 asserts `expect(useAzureMonitorMock).toHaveBeenCalledTimes(1)` right after module import (relying on module-load side effect). After IIFE removed, this assertion fails. Must be rewritten.

**T12 will fail after IIFE removal:** T12 relies on module-import triggering `useAzureMonitor()` throw. After IIFE removed, import doesn't call anything → `consoleSpy.toHaveBeenCalledWith(...)` assertion fails. Must be rewritten to explicitly call `initializeAppInsights()`.

**Handler tests missing init assertions:** `health.ts`, `converse.ts`, `packs.ts`, `startup/packs.ts` don't currently call `initializeAppInsights()`. After DP, they must. Handler test mocks already include `initializeAppInsights: vi.fn()` (pre-wired) but no assertions that it was called. The implementation must add both the source call and the test assertion.

**Evidence gate too weak:** `grep -c "useAzureMonitor"` in dist bundles is a crude check. Meta.json-based verification (OTel packages in `inputs`, only `@azure/functions-core` in external list) is definitive and was required in the review.

**Smoke check is sufficient:** `scripts/check-swa-health.mjs` checks `/api/health` for 200 + `{status:"ok"}`. Catches the exact failure mode (worker crash → zero routes → 404 empty body). ✅

### Lesson

When a DP says "invert test T1," always read ALL sub-cases in the describe block, not just the one the DP author named. The T1 describe block had two cases with opposite failure modes under the proposed change — missing one would cause a build breakage mid-implementation. Also: always read the non-test script that shares the same assertion logic (`verify-api-externals.mjs`) when a test for that script is being updated.

---

## 2026-04-21/22 — Incident #1041 Production 404: Code Quality Review (nibbler-18, nibbler-19)

**Sessions:** nibbler-18 (PR #1051 review), nibbler-19 (PR #1052 expedited review, role directive)
**PRs approved:** #1051, #1052
**Directives:** Lead-tier role classification

### PR #1051 Code Quality Review (nibbler-18)

**Reviewed:** OTel externalization revert (hotfix)
**Scope:**
- Evidence gates quality (8 gates sufficient)
- Bundle integrity checks
- Test coverage for new bundled paths
- Regression test additions

**Observations:**
- Evidence gates comprehensive (bundle contents, initialization presence, no externals)
- Smoke check sufficient (catches exact failure mode)
- Tests for bundled OTel initialization present

**Approval:** `nibbler:approved` on #1051 (2026-04-21)

### PR #1052 Expedited Review (nibbler-19)

**Reviewed:** Workflow guard inversion (hotfix)
**Context:** Four-way review gate expedited for production hotfix
**Scope:**
- Guard assertion correctness
- No silent failures in new guard
- Atomicity with #1051

**Observations:**
- Guard correctly inverts contract (NOT externalized + bundled present)
- New assertion rules are fail-closed
- Documentation of inversion rule in decision log sufficient

**Approval:** `nibbler:approved` on #1052 (2026-04-22 05:35 UTC)

### User Directive: Nibbler is a Lead-tier Role (2026-04-21T21:28:01Z)

**From:** Ahmed Sabbour
**Directive:** "nibbler is a lead role"

**Implications:**
- Token resolution: Nibbler's identity must route through `lead` app (`sabbour-squad-lead`)
- Current blocker: `.squad/scripts/resolve-token.mjs` has `nibbler: ['nibbler']` alias, but no `nibbler` app exists → writes fail closed
- Fix: Update alias to `nibbler: ['lead']` so Nibbler can author git writes as `sabbour-squad-lead[bot]`
- Additional: `team.md` lists Nibbler as "Code Reviewer & Watchdog" — consider adding "Lead" to role string for explicit tier classification

**Important:** Does NOT change DP-stage approval gate on #1044: `nibbler:approved` remains a separate label (authorship separate from approval).

**Implementation:** Follow-up PR needed (pending coordinator assignment)

### Incident Assessment

- Code quality checks appropriate for hotfix severity
- Evidence gates quality verified
- Regression test coverage validated
- No new issues introduced

