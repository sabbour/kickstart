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
- 2026-04-21: **Bug intake — 2 issues assigned** (#995: Core components tab tight rendering + preview quality; #997: Workspace page black void). Both unassigned, go:needs-research tags.
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
## 2026-04-17 — #477 pack-core Phases A+B (commit c950d61)

Working as **Fry (Frontend Dev)**.

**Phase A — 3 agent files** (`packages/pack-core/src/agents/`):
- `orchestrator.agent.md` (`core.orchestrator`) — main orchestrator; collects requirements, drafts deployment plan, hands off to architect for review or implementer for code gen. Skills: `generate-plan`, `validate-artifacts`. No tools.
- `architect.agent.md` (`core.architect`) — architecture advisor; reviews plans against Azure WAF (Reliability, Security, Cost, OE, Performance). Skills: `architecture-review`. Tools: `fetch_webpage`.
- `implementer.agent.md` (`core.implementer`) — code generator; produces Bicep, Kubernetes manifests, Dockerfile, GitHub Actions workflow. Skills: `generate-files`. Tools: `read_file`, `write_file`, `validate_artifacts`.

**Phase B — 5 skill files** (`packages/pack-core/src/skills/`):
- `generate-plan/SKILL.md` — orchestrator-only; required plan sections, quality criteria, ambiguity handling. Priority 80.
- `validate-artifacts/SKILL.md` — orchestrator + implementer; Bicep, Kubernetes, and GitHub Actions validation rules. Priority 70.
- `architecture-review/SKILL.md` — architect-only; WAF five-pillar checklist with AKS-specific items. Priority 75.
- `generate-files/SKILL.md` — implementer-only; file inventory, Bicep/YAML/workflow code standards, pinned SHA requirement. Priority 85.
- `aks-best-practices/SKILL.md` — all agents (`*`); cross-cutting AKS cluster, workload, security, OpEx, and cost guidance with reference links. Priority 60.

**Hermes test scaffold cherry-picked** from `12579cd` (branch `squad/477-pack-core-test-scaffold`). Tests are `it.todo()` scaffolding; Hermes will activate them in a follow-up pass once the #476 loader and Phase C tools ship.

**Blockers noted for Phase C:**
- `validate_artifacts` tool not yet implemented (Phase C) — referenced in frontmatter but no runtime code yet.
- `#476` registry/loader (`parseAgentFrontmatter`, `PackRegistry`) not yet merged into v2-rewrite — harness types are still stubs.
- Hermes' agent tests expect `core.triage`/`core.codesmith`/`core.reviewer` naming; Phases A+B use `core.orchestrator`/`core.architect`/`core.implementer` per task spec. Will need reconciliation once the loader ships.

## 2026-04-17 — #477 pack-core Phase C (commit bc7f3fd)

Working as **Fry (Frontend Dev)**.

**Naming gap fix:** Updated Hermes' `agents.test.ts` to match DP-approved names (`core.orchestrator`, `core.architect`, `core.implementer`) instead of the Hermes-scaffold placeholders (`core.triage`, `core.codesmith`, `core.reviewer`).

**Agent/skill frontmatter corrected** to match actual `loader-agent.ts` / `loader-skill.ts` schemas:
- Agent: added required `model: { envVar: KICKSTART_MODEL }`, changed `handoffs` from string array to object array `{ label, agent }`, qualified tool names as `core.*`.
- Skills: added required `version: 0.1.0`, moved `appliesTo`/`keywords`/`priority` under `x-kickstart:` namespace.

**Phase C — 6 tool files** (`packages/pack-core/src/tools/`):
- `fetch_webpage.ts` — SSRF guard (non-HTTPS and private IPs rejected), 32k char truncation, 15s timeout.
- `read_file.ts` — workspace-root confinement, null-byte guard, UTF-8 read.
- `write_file.ts` — confinement, mkdirSync recursive, records artifact on SessionCtx.
- `validate_artifacts.ts` — stub returning `valid: true`; TODO marker for real linter (Phase D follow-up).
- `emit_ui.ts` — validates via `A2UIMessageSchema` from `@kickstart/harness`, calls `session.recordA2UIEmission`.
- `search_components.ts` — factory `createSearchComponentsTool(registry: ComponentRegistry)` using a structural interface (avoids depending on unexported `PackRegistry` type).
- `tools/index.ts` barrel.

**Blocker noted:** `PackRegistry` is not yet exported from `@kickstart/harness` index — raised as Phase D pre-condition.

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
