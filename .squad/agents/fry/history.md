# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system

## Recent Work
- v2 #474: frontend cut line analysis, seam-cutting approach confirmed
- v0.6: SSE parser fixes, K8s icon expansion, A2UI debug visualization
- Shipped: 406 fallback in useStreaming, Playwright test suite

## Active Sprint: v2
Sprint 1: #474 (Nuke v1) → #475 → #476. Fry's role: seam-cutting (preserve shell, delete fixtures, replace in-place).

## 2026-04-21 Status
Participating in four-way review gate. Ceremony enforcement tightened with pre-dispatch blocking checkpoint.
Sprint 1 locked: #474 (Nuke v1) → #475 (Harness types) → #476 (Registry + loaders). Fry's role in #474 is seam-cutting: remove mock/demo surfaces first, then hard-delete after introducing temporary replacement exports.

**#474 cut line:**
- **Preserve:** `components/` shell, `contexts/`, streaming hooks, `services/api-client.ts`, `services/virtual-fs.ts`, catalog components/icons, Playground page shell
- **Delete:** `demo-scenarios.ts`, `mock-streaming.ts`, `playground-auth-stub.ts`, `playground-scenarios.ts`, `useMockStreaming.ts`, `useWidgets.tsx` (post cleanup)
- **Replace:** `kickstart-catalog.ts` (registry-driven), `packages/web/src/types.ts` (new contracts first)
- **Compile blockers:** `@kickstart/core` imports (broad), `packages/web/src/types.ts` imports (broad), `Playground.tsx` depends on all three deleted playground sources

## Learnings

- (2026-04-17T12:06:45Z) For #474 Step 1, safe frontend cut line is "preserve the shell, delete the fixtures." Treat `kickstart-catalog.ts`, playground demo/stub sources, and `types.ts` as replace-in-place seams because too many live files depend on them for hard-delete without immediate successors.
- (2026-04-17T06:28:51Z) **Playwright race condition:** `waitForResponse` MUST be registered before `page.goto()` — registering after creates a race where the response arrives before the listener is attached.
- (2026-04-17T06:28:51Z) **Auth E2E tests:** Must use `request.post()` (real HTTP) not `page.route()` mock interception; `page.route()` short-circuits before auth headers are evaluated.
- (2026-04-17T06:28:51Z) **`addMessage` placement in `converse.ts`:** Must be inside each processing branch, not before it — placing before means 406 early-return path mutates session state on no-message turns.
- (2026-04-17T06:28:51Z) **Phase allowlist** should delegate to `normalizeConversationPhase()` from `chat-a2ui.ts`, not maintain a separate set — separate set drifts when `PHASE_ALIASES` is updated.
- (2026-04-17T03:30:17Z) When `KICKSTART_AGENTS_SDK=true`, backend returns HTTP 406 for streaming. Correct pattern: inline 406 fallback in `useStreaming.ts` retrying as non-streaming JSON, not a separate hook.
- (2026-04-17T03:30:17Z) Playwright SSE route interception: register `**/api/health` → 200 and `**/api/converse` → SSE BEFORE `page.goto()`. Use closure counter for multi-turn SSE responses.
- (2026-04-17T03:01:07Z) `buildSystemPrompt()` context vars (`appDefinition`, `azureContext`, `repoInfo`) must be explicitly pushed to `parts` as `## Section` blocks — `interpolate()` only substitutes `{{placeholder}}` tokens, narrative text alone does not inject context.
- (2026-04-17T03:01:07Z) `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes; `navigate:` is secondary. `skill-resolver.ts` phase group constants are module-private `const Set<Phase>`, not exported arrays.
- (2026-04-16T06:38:32Z) New K8s icons: create static SVGs under `packages/web/public/assets/icons/k8s/`, register via `registerDiagramIcons()` in `ensureDiagramIconsRegistered()`, update `ALLOWED_ICON_KEYS` in tandem.
- (2026-04-15T15:20:24Z) `ArchitectureDiagram` uses diagram-first contract: raw Mermaid in `diagram`, all render prep through `architectureDiagramUtils.ts`. Secure path: `sanitizeDiagramInput()` before Mermaid render + `%%icon:name%%` expansion after.

## 2026-04-17 Issue #446 — Agents SDK UI Adaptation (PR #455)

Shipped 406 fallback in `useStreaming.ts`. Added `route-state.spec.ts` with skip-ahead and revisit Playwright scenarios using `page.route()` API interception. Issue closed.

## 2026-04-17T12:06:45Z — #474 Frontend Cut Line Analysis

Analyzed #474 frontend surface. Preserve/delete/replace boundary defined (see Active Sprint above). Decision filed (`fry-474-frontend-cutline.md` → decisions.md).


## 2026-07-16 — #474 Step 1 web-shell cleanup (commit ffa10ee)

Working as Fry (Frontend Dev) on branch `squad/474-step1-nuke-v1`.

### What I did
- Replaced all 16 `@kickstart/core` import strings in `packages/web/src/` with `@kickstart/harness` (same shim, cleaner path)
- Removed v1 kit registration dead code from `main.tsx`: `registerKit(azureKit)` and `registerKit(githubKit)` (no-op stubs, v1 pattern)
- Added `names(): string[] { return []; }` stub to `APIConnectorRegistry` in `packages/harness/src/index.ts` — was missing from Bender's shim, required by `APIConnectorContext.tsx` and `useActionDispatch.ts`
- Removed `@kickstart/core` path alias from `packages/web/vite.config.ts` and `packages/web/tsconfig.json`
- Confirmed `npm run build` passes (19 files changed, build green)

### Files changed
**Modified imports:**
- `packages/web/src/__tests__/azure-auth.test.ts`
- `packages/web/src/services/azure-auth.ts`
- `packages/web/src/services/github-handoff.ts`
- `packages/web/src/hooks/useActionDispatch.ts`
- `packages/web/src/catalog/components/` (7 files: AuthCard, AzureAction, AzureLoginCard, AzureResourceForm, AzureResourcePicker, GitHubAction, GitHubCommit, GitHubRepoPicker)
- `packages/web/src/components/Chat/DebugA2UITree.tsx`
- `packages/web/src/contexts/ArtifactContext.tsx`
- `packages/web/src/contexts/APIConnectorContext.tsx`

**Runtime cleanup:**
- `packages/web/src/main.tsx` — removed v1 registerKit/azureKit/githubKit dead code

**Shim fix:**
- `packages/harness/src/index.ts` — added `names()` to APIConnectorRegistry stub

**Config:**
- `packages/web/vite.config.ts` — removed `@kickstart/core` alias
- `packages/web/tsconfig.json` — removed `@kickstart/core` path

### Remaining blockers for Step 1
- `packages/web/src/types.ts` is `export {}` but imported by many files for A2UI types — needs Step 2 to fully resolve (deleting it would break vite module resolution)
- `packages/core/` shim package directory still exists (kept for compile compat); Step 2 will drop it
- `APIConnectorContext.tsx` and related connector infrastructure is v1 — will be replaced in Steps 5-7

## 2026-07-16 — #477 Design Proposal: v2 Step 4 pack-core

Posted DP to https://github.com/sabbour/kickstart/issues/477#issuecomment-4268128132

### Covered

## Archived History Note

For comprehensive work history prior to 2026-04-20, see git log and .squad/orchestration-log/. Recent sessions tracked above.


## 2026-04-17 — #477 pack-core Phases D–H (commits 92ba022, 833b44d, be1c2da)

Working as **Fry (Frontend Dev)**.

### Phase D — 27 basic Fluent components (commit 92ba022)
Ported 27 basic Fluent renderers from `packages/web/src/catalog/fluent-components/` into `packages/pack-core/src/components/basic/`. Created a minimal vendor shim at `packages/pack-core/src/vendor/a2ui/` (schema/common-types.ts, basic_catalog, simplified adapter, ChildList helper). Vendor shim strips GenericBinder binding machinery — renderer field holds the raw React.FC. Added `@fluentui/react-components`, `@fluentui/react-icons` to peer/devDeps.

### Phase E — 12 rich components + GenerationProgress (commits 833b44d, be1c2da)
Ported 11 domain-neutral rich components from `packages/web/src/catalog/components/` into `packages/pack-core/src/components/rich/`: ArchitectureDiagram, AuthCard (generic injected-callback version, no Azure/GitHub service deps), CodeBlock, DecisionCard, FileEditor, FormGroup, Markdown, ProgressSteps, Questionnaire, RadioGroup, SteppedCarousel, SummaryCard. Created domain-neutral `GenerationProgress.tsx` (removed Azure deployment polling; props-only). Total rich: 13. Added vendor stubs: `sanitize.ts`, `ArtifactContext.tsx`, `MessageTextContext.tsx`. New deps: react-markdown, remark-gfm, highlight.js, @monaco-editor/react, dompurify.

### Agent/skill rename + Phase F-H (commit be1c2da)
**Agent rename**: `core.orchestrator/architect/implementer` → `core.triage/codesmith/reviewer` to match issue spec and Hermes' registration test expectations. Updated all agent frontmatter `name:` fields and cross-references. Rewrote system prompts to be domain-neutral (no AKS/Azure-specific instructions).

**Skills replaced**: Removed 5 AKS-specific skills, created 5 issue-spec behavior skills:
- `collaborator-voice` — tone/voice guidelines, applies to `*`, priority 90
- `a2ui-output-discipline` — emit_ui discipline rules, applies to `*`, priority 85
- `file-generation-batching` — batch write_file rules, applies to `core.codesmith`, priority 80
- `teach-then-ask` — pedagogical interaction pattern, applies to `*`, priority 75
- `phase-acceleration` — when to skip confirmations, applies to `*`, priority 70

**New tool**: `core.list_files` — lists workspace files with 500-file cap, path confinement, recursive option.

**Guardrails (3)**:
- `token-budget` — input stage; blocks at 128k tokens; uses optional extension field for future `SessionCtx.tokenUsage`
- `no-pii-in-logs` — output stage; detects SSN, credit-card, IP-in-log patterns
- `no-secrets-in-artifacts` — tool stage, applies to `core.write_file`; entropy threshold (4.5 bits/char, 20+ char tokens) + named secret patterns (AWS key, GitHub PAT, private key header, Azure SAS, connection strings)

**corePack manifest** (`src/core-pack.ts`): wires `name: 'core'`, `version: '0.1.0'`, `agentsDir`, `skillsDir`, 6 tools, 40 components (27 basic via `fluentOverrides` array + 13 rich), 3 guardrails. Exported from `src/index.ts` as `corePack`.

**Known gaps for follow-up**:
- Registration test expects "exactly 39 components" (has 40 — ArchitectureDiagram is bonus). Test is `it.todo()` so no immediate CI failure.
- `validate_artifacts` tool is still a stub returning `{valid: true}`.
- `search_components` tool retained (also exported) alongside new `list_files`.
- Guardrail `token-budget` and tool `list_files` reference extension fields not in base `SessionCtx` — using safe `as unknown` casts with TODO comments.

## 2026-04-21 — Round 3: Design Reviews + Work Assignments

**Status Update:** DP reviews for #995, #997, #987 all approved. PR #1000 blocked on red CI (TS2307/TS2352). PR #1001 merged.

**Work Assignments (in-flight):**
- **#995** — Core components tab rendering (estimate:M). DP `leela:approved`. Ready for implementation.
- **#997** — Workspace black void (estimate:S). DP `leela:approved`. Ready for implementation.
- **#987** — Ideas tab restoration (estimate:M). DP `leela:approved` but blocked pending #991 merge. Cannot start until PR #1000 is fixed & merged.

**⚠️ Critical Note — PR #1000 Rejection:**
- **PR #1000** (pack rendering engine, #991) was REJECTED by Zapp+Nibbler for missing CI grep rule on `dangerouslySetInnerHTML`/`eval`/`new Function` in pack client code. DP #991 set this as a "same-PR hard-fail" condition. Fry is **LOCKED OUT** from revising this PR per the Reviewer Rejection Protocol.
- **Action:** Bender (or bender-1000-revise agent) will add the missing CI grep step + allow-list comment. Fry can resume #987, #995, #997 work in parallel.

**Other issues remain yours:** #987 (blocked), #995, #997 are assigned and ready to pick up once #1000 is fixed.

## 2026-04-21 — #997 Workspace black void fix (PR #1004)

Working as **Fry (Frontend Dev)**.

**Root cause:** Classic flex `min-height: 0` pitfall in the Playground Workspace chain (`#panel-workspace` → `PlaygroundWorkspace.body` → `.viewerWrapper` → `FileViewer.rootFill`). Column-flex children defaulted to `min-height: auto` (= content min-size), so the editor pane collapsed and the page-body dark background leaked through below the editor as a "black void".

**Fix (layout-only, 3 files):**
- `Playground.tsx` — `#panel-workspace` inline style: add `minHeight: 0`, drop redundant `height: '100%'` (conflicted with `flex: 1`).
- `PlaygroundWorkspace.tsx` — `.body` and `.viewerWrapper` styles: add `minHeight: 0` (+ `minWidth: 0` on wrapper).
- `FileViewer.tsx` — `rootFill` style: add `minHeight: 0`.

**Test:** `packages/web/e2e/workspace-layout.spec.ts` — explicit geometry assertions with named constants (`MAX_EDITOR_BOTTOM_SLACK_PX`, `MIN_CODE_WRAPPER_HEIGHT_PX`), two viewport states. `describe.skip` consistent with existing `playground.spec.ts` (#772 E2E blocker).

**Checks:** lint clean, 335/335 vitest pass, Playwright spec parses (`--list` confirms 2 tests).

**Changeset:** `.changeset/workspace-black-void-997.md` — patch bump `@aks-kickstart/web`.

PR: https://github.com/sabbour/kickstart/pull/1004

## 2026-04-21 — #995: Core components tab density + preview regressions → PR #1003

**Context.** Asabbour reported #986 either regressed or landed incomplete: Core tab still rendered tight (6+ cards/row at 1920px) and mixed real previews with `No preview` placeholders. DP approved by Leela/Zapp/Nibbler with an explicit ask from Nibbler to use named-constant geometry in the test assertions.

**Root cause.**
1. `minmax(260px, 1fr)` + 320px card cap produced 6–7 cards/row at 1920px — looked "tight" and left asymmetric gutters between the 1fr track and the capped card.
2. `COMPONENT_PREVIEWS` missed Core basic components Video / AudioPlayer / Tabs / Modal / Accordion, so those cards fell back to the "No preview" placeholder. That is the "lack of previews" half of the user complaint — Core-only because those renderers happen to cluster in pack-core basic.

**Fix.**
- `packages/web/src/pages/playground-layout-constants.ts` (new) — single source of truth for grid geometry (min col px, max card px, gap, preview/compact min-heights).
- `Playground.tsx` grid styles rewired to consume the constants. `componentGrid` now `minmax(300, 1fr)` with 380px cap + 20px gap; new `compCardPreview` class applies preview min-height.
- `ComponentCard` emits `data-component-card` / `data-component-has-preview` / `data-testid="component-card-preview"` so tests can target without brittle class selectors.
- `component-examples.ts` gains Video, AudioPlayer, Tabs, Modal, Accordion previews.
- New unit suite `playground-core-tab-rendering.test.ts` — asserts (a) every listed core basic renderer has a preview, (b) density math yields 4–5 cards/row at 1280/1920, (c) preview min-height exceeds compact min-height. All thresholds imported, never hard-coded.
- `playground.spec.ts` — added "Components tab Core density + preview quality (#995)" describe with card bounding-box / computed row-gap / missing-preview count assertions using the same named constants. Sits inside the suite-wide `describe.skip` for #772 — specs activate automatically when #772 lifts.

**Validation.**
- `npm run lint`: 0 errors, 59 pre-existing warnings (unchanged from #986 baseline).
- `CI=1 npm test`: 904 passed / 3 skipped / 159 todo. One unrelated pre-existing failure in `pack-core/.../basic-components.test.tsx` (missing `@testing-library/react`, identical on origin/main — out of scope).
- Targeted suite (my new test + `component-examples.test.ts`): 34/34 green.

**PR #1003.** Changeset: web/patch. Rollback: single revert.
