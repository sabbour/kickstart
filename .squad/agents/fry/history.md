# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns. Shipped full Vite+React stack migration, Playground interface, dark mode, accessibility audit, and 20+ fat A2UI components.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/catalog/fluent-components/` — Fluent UI overrides and custom components
- `packages/web/src/pages/` — Landing, Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system, layout classes
- `packages/web/src/components/` — FileEditor, FileTreePanel, DebugPanel, Widgets

## Patterns
- **Fat A2UI components:** Use createReactComponent factory + useState for auth/API state, useAPIConnector hook, context.dispatchAction for actions
- **Streaming UI:** useProgressiveQueue hook for 150ms stagger reveal, progressive bubble state + ref tracking for stale closures
- **Theme system:** ThemeContext with three-state mode (light/dark/system), resolvedTheme pattern for rendering, useSyncExternalStore for matchMedia
- **Validation safeguards:** DS001-DS020 validators with auto-fix capability, badge/severity display in UI, RegexError handling
- **Accessibility:** WCAG 2.1 AA — aria-label on all A2UI components, roving tabIndex for RadioGroup, live regions on dynamic content

## Recent Work
- v2 #474 frontend cut line analysis: seam-cutting pass approach confirmed for Step 1
- v0.6.x: 406 fallback in useStreaming.ts for SDK path; K8s icon catalog expansion; A2UI debug visualization; system-prompt context var injection fix
- v0.5.x: SSE parser fixes, action context enrichment, hash-based routing, ArchitectureDiagram diagram-first contract, theme system

## Active Sprint: v2 (harness + packs)

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
- Delivery order: Phase A (scaffold) → B (agents+skills, parallel) → C (tools, after #475) → D (27 basic components, parallel batches) → E (12 rich, audited) → F (guardrails) → G (playground scenarios) → H (wire manifest)
- Full file manifest: 3 agent.md, 5 SKILL.md, 6 tools, 27 basic + 12 rich components, 3 guardrails, 2 playground scenarios, index.ts
- Registry contract: corePack: Pack shape, which #476 APIs are consumed at startup vs runtime
- emit_ui contract: Zod-discriminated A2UI message union from #475, records to session.a2uiEmissions, no SSE in pack-core
- Porting strategy: basic = mechanical path-rewrite; rich = audit 21 candidates, keep 12 domain-neutral, defer Azure/AKS/GitHub to later packs
- Test plan for Hermes: frontmatter parse, tool Zod rejection, registration smoke, 4-component render smoke, guardrail verdicts
- 5 risks flagged with mitigations (manifest-only-in-playground, v1 bleeding, A2UI union stability, PR size, FileEditor/Monaco)
- 3 open questions for Bender (agent loader mode, SessionCtx.a2uiEmissions location, AuthCard split)

### Awaiting
Leela + Zapp approval before implementation starts.

## Wave 3 — 2026-04-17 Playground Decision Filed

- `fry-playground-component-grouping.md`: GitHub Components + Azure Components moved from `GALLERY_GROUPS` to `COMPONENT_GROUPS` in `Playground.tsx` — they are catalog components, not gallery scenarios. Playground stub connector guard removed; `AzureARMConnector` + `GitHubConnector` always registered unconditionally.
