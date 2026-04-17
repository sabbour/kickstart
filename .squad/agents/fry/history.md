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
- v2 DPs authored: #477 (pack-core), #478 (Playground), #479 (Runner+SSE), #480 (Skill resolver), #482 (pack-azure)
- #474 Step 1 web-shell cleanup: 16 `@kickstart/core` imports → `@kickstart/harness`, build green
- #474 cut line analysis filed; seam-cutting approach confirmed

## Active Sprint: v2 (harness + packs)

Steps 1–4a merged. Current chain: **#477** (PR #548, Leela✅/Zapp blocked) → #479 → #480 → domain packs (#482–#488).
Fry's next role: implement #479 (Runner + SSE) once #477/#478 are fully merged.

## Learnings

- (2026-04-17T12:06:45Z) For #474 Step 1, safe frontend cut line: "preserve the shell, delete the fixtures." Treat `kickstart-catalog.ts`, playground demo/stub sources, and `types.ts` as replace-in-place seams.
- (2026-04-17T06:28:51Z) **Playwright race condition:** `waitForResponse` MUST be registered before `page.goto()` — registering after creates race where response arrives before listener.
- (2026-04-17T06:28:51Z) **Auth E2E tests:** Must use `request.post()` (real HTTP) not `page.route()` mock interception.
- (2026-04-17T06:28:51Z) **`addMessage` placement in `converse.ts`:** Must be inside each processing branch, not before — placing before means 406 early-return path mutates session state.
- (2026-04-17T06:28:51Z) **Phase allowlist** should delegate to `normalizeConversationPhase()` from `chat-a2ui.ts`, not maintain a separate set.
- (2026-04-17T03:30:17Z) When `KICKSTART_AGENTS_SDK=true`, backend returns HTTP 406. Correct pattern: inline 406 fallback in `useStreaming.ts`.
- (2026-04-17T03:30:17Z) Playwright SSE route interception: register `**/api/health` and `**/api/converse` BEFORE `page.goto()`.
- (2026-04-17T03:01:07Z) `buildSystemPrompt()` context vars must be explicitly pushed to `parts` as `## Section` blocks — `interpolate()` only substitutes `{{placeholder}}` tokens.
- (2026-04-17T03:01:07Z) `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes; `navigate:` is secondary.
- (2026-04-16T06:38:32Z) New K8s icons: create static SVGs under `packages/web/public/assets/icons/k8s/`, register via `registerDiagramIcons()`, update `ALLOWED_ICON_KEYS`.
- (2026-04-15T15:20:24Z) `ArchitectureDiagram` uses diagram-first contract: raw Mermaid in `diagram`, sanitize before Mermaid render, `%%icon:name%%` expansion after.

## 2026-04-17 — DPs for #477–#480, #482

| Issue | DP | Comment | Status |
|-------|----|---------|--------|
| #477 pack-core | Phases A→H; 40 components; emit_ui via Zod + a2uiEmissions | #issuecomment-4268128132 | APPROVED (Leela+Zapp A/C) |
| #478 Playground | 4-phase; registry-driven gallery; usePlaygroundDispatch | #issuecomment-4268166333 | APPROVED; PR #547 ✅ merged |
| #479 Runner+SSE | 9 SSE events; writeSSE; useStreaming rewrite | #issuecomment-4268255972 | APPROVED (Leela+Zapp A/C) |
| #480 Skill resolver | 4-stage pipeline; estimateTokens; Skill[] | #issuecomment-4268290735 | APPROVED (Leela+Zapp A/C) |
| #482 pack-azure | 6 phases; azureKit port; Zapp C1 pre-addressed | #issuecomment-4268944331 | Leela APPROVE_WITH_CONDITIONS; Zapp BLOCKED |
| #482 DP Revision | Addressed Zapp B1–B5: managed identity model, azureToken storage boundary, arm_get exact regex+denylist, AzurePackDTO redaction contract, KICKSTART_PLAYGROUND gate | #issuecomment-4269070199 | Awaiting Zapp re-review |
| #482 DP Revision B3 | Posted exact anchored ARM_PATH_RE regex + ARM_PATH_DENY denylist + validateArmPath() in response to Zapp B3 re-check failure | https://github.com/sabbour/kickstart/issues/482#issuecomment-4269105863 | Awaiting Zapp B3 sign-off |
| #483 pack-aks-automatic | Phases A→G; 3 agents, 7 skills, safeguards.json (single source of truth), 2 tools, 1 user action, 4 components (ArchitectureDiagram port), 3 guardrails; 5 open questions for Leela+Zapp | https://github.com/sabbour/kickstart/issues/483#issuecomment-4269179983 | Proposed — awaiting Leela + Zapp approval |
| #484 pack-github | Phases A→G; 1 agent (github.publisher), 3 skills, 1 tool (github.api_get + GITHUB_PATH_ALLOWLIST), 6 user actions (login/pick_org/pick_repo/create_repo/create_pr/set_secret), 7 components (port GitHubLoginCard/RepoPicker/Commit/Action + new OrgPicker/RepoInfo/SecretSetter), github-handoff.ts port, 5 open questions for Leela+Zapp | https://github.com/sabbour/kickstart/issues/484#issuecomment-4269229222 | Proposed — awaiting Leela + Zapp approval |
| #483 DP Revision | Addressed Leela C1 (inline skills micro-fix note), C2 (ArchitectureDiagram is a move not a port, Phase E updated), C3 (DeploymentConfirm added to Phase E); Zapp B1 (workload identity / DefaultAzureCredential credential scope), B2 (block > rewrite guardrail precedence rule), B3 (aksPlaygroundStubs fail-closed gate) | https://github.com/sabbour/kickstart/issues/483#issuecomment-4269273327 | Awaiting Leela + Zapp re-review |
