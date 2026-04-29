# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system

- Changeset: `.changeset/179-github-auth-bridge.md` — `@aks-kickstart/pack-github: minor`, `@aks-kickstart/web: patch`. User-voice body.
- 3 focused commits: bridge module, consumer refactor, changeset.
- `npm test` — 2119 tests pass, 0 failures. `npm run build` — green (TypeScript + Vite + bundle budget all OK).

### Branch / Push
- Pushed to a NEW branch `squad/179-github-auth-bridge` (NOT the stale `squad/179-github-auth-context`) to avoid force-pushing over a merged ref. Decision rationale: the stale ref carried 2 commits that were the unsquashed version of PR #180 (already merged via squash) — any push to that branch would be a non-fast-forward. The "no force-push" rule trumped branch-name aesthetics.
- Base: `dev` (where pack-github currently lives post-#190). Targeting `main` would have lacked the pack-github folder structure.

### PR
- Opened draft PR #235 then promoted to ready-for-review (build + tests green).
- https://github.com/azure-management-and-platforms/kickstart/pull/235
- Post-flight `pr-create` and `commit` both report `login=squad-frontend[bot] type=Bot`. ✅

### Coverage of DR conditions
- Nibbler 🟡 #1 (type-location): ✅ shared types in `auth-bridge.types.ts`.
- Nibbler 🟡 #2 (fail-fast on unset): ✅ throws actionable error; tested.
- Nibbler 🟡 #3 (test-reset helper): ✅ `__resetGitHubAuthHookForTests` exported, used in beforeEach.
- Zapp #1 (single-assignment): ✅ second-call throws; tested.
- Zapp #2 (least-privilege return shape): ✅ no tokens/cookies/headers in `GitHubAuthBridgeValue`.
- Zapp #3 (no auth-payload leakage): ✅ no console calls in bridge module; tested.

### Notes
- Skipped explicit removal of stale `GitHub*` lazy-registrations from `main.tsx` because PR #190 had already removed them — DP v2 step 5 was contingent on residual cleanup, none remained.
- Did not implement Bender's parallel pack-azure bridge as that's out of scope for #179. Decision-inbox note from DP round 6 still stands as the canonical pattern reference.

---

## 2026-04-28 — Phase 1.6 consensus ack (#197)

**Task:** Acknowledge Leela's Phase 1.6 consensus checkpoint on issue #197.

**Action:** Read D1–D14 and AKS Automatic constraint spec v1.1.1 §2.7. Evaluated from frontend/UX perspective. No dissents — all decisions are compatible with the surface layer. Highlighted forward-note for #198: triage handoff payload needs typed fields (`ingressMode`, `kaitoEnabled`, `gpuSku`, `computeTier`, `constraintBucket[]`) to enable typed multi-card R2 composition without heuristic parsing.

**Comment posted:** https://github.com/azure-management-and-platforms/kickstart/issues/197#issuecomment-4337776949 (squad-frontend[bot] ✅)

**Post-flight:** Script exit 3 (comment lookup 404 in script), but manual API verification confirmed `user.login=squad-frontend[bot]`, `user.type=Bot`.

**Learning:** Post-flight-check.mjs may have a URL construction issue for comment endpoints — worth flagging to Kif. Identity confirmed manually via `gh api` as a fallback.

---

### 2026-04-28T17:39:30Z: Phase 1.6 Consensus Checkpoint #197 — Complete

**Ceremony:** phase-1.6-consensus-197  
**Outcome:** 7/7 acks, 0 dissents. Critical-path (Bender+Fry+Zapp+Nibbler) cleared.

All decisions D1–D14 and section 2.7 rules approved. Phase 2.0 critical path (#198 triage rewrite) **officially unblocked**. Orchestration logs written to `.squad/orchestration-log/{ISO8601}-{agent}.md` per ceremony spec.

**For Kif:** Investigate Fry post-flight-check.mjs exit 3 anomaly (identity verified correct, script exit unexpected).


### 2026-04-28T12:12:30Z: Zod v4 migration work incoming — issue #247

**From:** Ralph (halt-and-pivot ceremony), Kif (CI diagnosis)

PR #245 merge blocked on Zod monorepo split. Two files need `z.preprocess` → Zod v4 migration:

1. **Fry owns:** `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` — ~20 `z.preprocess` calls → v4 patterns
2. Bender owns: `packages/pack-core/src/skills/gen-gha-workflow/schema.ts` — 1 `z.preprocess` call

Skill reference: `.squad/skills/zod-monorepo-split/SKILL.md`

Once both files land, Kif will add `"overrides"` and CI will go green for merge.

**Action:** Pick up #247 (Zod v4 migration — web basic-functions) as next task post-current work.

## 2026-04-28 — Zod v4 migration implementation (web)

**Ceremony:** design-review-247-zod-v4  
**Issue:** #247 [Phase 2.0 prerequisite] Zod v4 migration  
**Status:** DR cleared, implementation greenlit

**Your assignment:**
1. Migrate `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` ~20 z.preprocess callsites to Zod v4 equivalents
2. Confirm upstream a2ui contract for null handling (currently rejects null; must not change to accept-null)
3. Include equivalence test matrix covering null/undefined/0/"3"/non-numeric strings/booleans for all numeric callsites
4. Verify zod-to-json-schema@^3.25.1 output byte-equivalence after migration (since packages/web will then depend on zod@4.3.6)
5. Coordinate with Bender (pack-core schema), Kif (overrides + CI guardrail after both land)

**Key requirements from DR:**
- Null-coerce behavioral trap: current code rejects null, proposed `.nullable()` approach would accept null. Pick the right v4 equivalent.
- Changeset body must acknowledge any API surface narrowing or type changes
- String-coerce patterns (7 callsites) are low risk

**Cross-domain note:** Bender taking pack-core backend schema under this migration. Leela coordinating both tracks.

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-08 — packages/web scaffold created
- **Structure**: `packages/web/` contains `index.html`, `css/{theme,core,components}.css`, `js/{app,auth}.js`, `js/framework/{core,components,a2ui-renderer}.js`, `assets/{logo,favicon}.svg`, `package.json`, `staticwebapp.config.json`.
- **Framework pattern**: SPA router is hash-based (core.js `Router`), Navigation pane manager (`Navigation`), Breadcrumbs auto-generate from route path. All exported as ES modules.
- **Component factory pattern**: `createCopilotPanel()`, `createWizard()`, `createCard()`, `createCommandBar()`, `createCodeBlock()`, `createStatusBadge()` — all return DOM elements, not HTML strings.
- **A2UI renderer**: `renderA2UI(schema, ctx)` maps A2UI JSON types to DOM. Custom types registered: `ConversationPhase`, `CodeBlock`, `ResourcePicker`, `DeploymentProgress`, `ArchitectureDiagram`, `CostEstimate`, `HandoffCard`. Extensible via `registerRenderer()`.
- **Auth**: Uses existing Entra config (client ID `7a630e18...`, tenant `72f988bf...`). MSAL loaded via CDN. Auth module pattern: IIFE returning frozen API.
- **CSS tokens**: All colors/spacing/typography use CSS custom properties defined in `theme.css`. Base grid is 4px.
- **Zero build deps**: No npm install needed. Vanilla ES modules + CDN scripts only.
- **Local dev**: `npx serve .` from packages/web (port auto).
- **Copilot panel**: Right-side panel with phase indicator (Understand → Architect → Configure → Deploy), chat bubbles, typing indicator. `onSend` callback wires to conversation engine (placeholder for now).
- **Domain**: kickstart.prototypes.aks.azure.sabbour.me (staging), kickstart.aks.azure.com (future).

### 2025-07-22 — Copilot panel wired to 6-phase conversation engine
- **Engine**: `packages/web/js/engine.js` — client-side conversation state machine mirroring `@kickstart/core` phases in plain JS. 6 phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY (Decision 11).
- **Scripted demo flow**: Each phase has a handler that returns A2UI JSON. Flow auto-advances after user turns; no LLM backend needed yet.
- **New A2UI renderers**: `RepoPicker` (filterable dropdown + "create new"), `WorkflowStatus` (color-coded run list), `CodespaceLink` (CTA card with Codespaces/vscode.dev buttons), `AppOverview` (dashboard widget: app name, runtime badge, service pills, status dot).
- **Phase header updated**: Copilot panel phases changed from 4 (Understand/Architect/Configure/Deploy) to 6 (Discover/Design/Generate/Review/Handoff/Deploy). Landing page cards updated to match.
- **K8s jargon hidden**: No Kubernetes terms in user-facing text for phases 1-4. AKS framed as "app platform" per copilot directive.
- **A2UI rendering pattern**: `copilot.addMessage({ html })` accepts pre-rendered HTML from `renderA2UI()`. Engine calls `onResponse({ a2ui })` and app.js bridges the two.
- **structuredClone**: Used for immutable state transitions in engine.js — works in modern browsers, no polyfill needed.

### 2025-07-25 — API client + API-backed engine wired to Copilot panel
- **api-client.js**: New module at `packages/web/js/api-client.js`. Calls `POST /api/converse` with native `fetch()`. Supports streaming via `ReadableStream` (NDJSON / SSE). Auto-retries on 429/503 with exponential backoff (max 3). Timeouts: 30s standard, 60s streaming. `healthCheck()` pings the endpoint to detect if API is available.
- **Engine refactor**: `engine.js` now exports three factories: `createDemoEngine()` (original scripted flow), `createApiEngine()` (real backend), and `createEngine()` (smart factory — uses API if `apiClient` provided, else demo). Both engines share identical public API shape: `handleMessage`, `getWelcome`, `getCurrentPhase`, `getState`, plus `isDemo` flag.
- **API engine behavior**: `handleMessage` is async, calls `converseStream()`, maps API response `{ sessionId, phase, message, a2ui }` to engine format `{ a2ui, text, systemPrompt }`. Phase transitions driven by comparing API `phase` field to current. Session ID tracked internally.
- **app.js wiring**: `initEngine()` is now async — does `apiClient.healthCheck()` at boot. If API is available, creates API engine with `onStreaming` + `onError` handlers. Otherwise falls back to demo engine and shows a yellow "Demo" badge in the Copilot panel header.
- **Streaming UX**: `updateStreamingBubble()` creates/updates a temporary `.chat-bubble.streaming` element in the message log, replaced by the final response.
- **Error UX**: `showErrorBubble()` renders a red-tinted `.error-bubble` with optional "Retry" button. Retry re-sends the last user message.
- **CSS additions**: `.demo-badge` (yellow pill), `.error-bubble` + `.error-retry-btn` (red alert styling), `.streaming` bubble (left border accent).
- **No build step**: All new code is vanilla ES modules + native APIs. No npm packages added.

### 2025-07-25 — Chat-first UX redesign
- **Layout overhaul**: Removed Portal Prototyper shell (`.portal-shell`, nav-pane, breadcrumbs, command-bar, wizard, content-area, SPA router). Replaced with `.app-shell` — a simple header + three-column flex layout: sessions sidebar | chat (main) | file viewer.
- **Chat is primary**: `createChatUI()` replaced `createCopilotPanel()`. Chat is centered (max-width 760px), takes up the full main area. No toggle button, no close button — it's always visible. Messages container uses `.chat-messages-inner` for centered layout.
- **File viewer sidebar**: New `createFileViewer()` component with tabbed file display, syntax highlighting (dark background), and per-file copy button. Appears via `EventBus.emit('files:generated')` when GENERATE phase produces files. Collapses when hidden.
- **Sessions sidebar**: Left sidebar with session list, toggled from header. Placeholder for future session history.
- **Conversational demo flow**: Discover phase now has 3 turns: (1) ask about app → (2) ask about framework → (3) ask about database/services → advance. Each turn asks ONE question. No multi-field forms.
- **Prompt inspector**: Moved from Copilot panel header to topbar toggle button (`#topbar-inspector-toggle`).
- **Dark mode**: Added `@media (prefers-color-scheme: dark)` block in `theme.css` with full dark palette.
- **CSS class renames**: `.copilot-*` → `.chat-*` (messages, phase, input, textarea, send-btn). Old wizard/command-bar/nav styles removed.
- **Removed components**: `createWizard()`, `createCommandBar()`, `createCopilotPanel()`. Added `createChatUI()`, `createFileViewer()`.
- **No Router needed**: App no longer uses hash-based routing or Navigation/Breadcrumbs — it's a single-page chat experience.
- **Engine files emission**: `generateHandler()` now returns a `files` array alongside `a2ui`, which the app wires to the file viewer via EventBus.

### 2025-07-26 — Landing page added before chat UI
- **Landing page**: `index.html` now shows a `#landing-page` div inside `.chat-main` before the chat starts. Chat UI is hidden until user selects a track or framework.
- **Carousel**: 10 inspiration ideas auto-rotate every 5 seconds with slide/fade transitions and clickable dot indicators. Built with CSS transitions (no library).
- **Track cards**: Two side-by-side cards — "Web App or API" (web-app) and "AI Agent" (agentic-app) — matching Decision D12 tracks. Each has "Get started →" link.
- **Framework pills**: 9 framework quick-start buttons (Next.js, FastAPI, Express.js, Go, Spring Boot, Django, Rust, LangChain Agent, RAG App). Clicking pre-selects the framework AND auto-detects the track (LangChain/RAG → agentic-app, others → web-app).
- **Transition flow**: `transitionToChat()` fades out landing page, removes `body.on-landing` class (which hides sessions toggle), shows chat UI, initializes engine with track/framework, and sends welcome message.
- **Engine params**: `createDemoEngine()` and `createEngine()` now accept optional `track` and `preSelectedFramework`. When framework is pre-selected, `state.turnCount` starts at 1 (skips "which framework?" question) and welcome message says "Great choice — let's build something with {Framework}!".
- **CSS**: New `css/landing.css` — carousel, track cards, framework pills, responsive (stacks cards on mobile). Uses existing Fluent 2 tokens from `theme.css`.
- **Body class pattern**: `body.on-landing` is set in HTML and removed on transition. Used to hide sessions sidebar toggle via CSS.

### 2026-04-08 — Wave 7 Coordination with Bender (MCP App surface)
- **Parallel work**: Bender completed MCP App HTML surface (commit e80b44f) with full A2UI renderer (18 component types), postMessage protocol, and 30 new tests (118 total passing).
- **Dual-surface architecture**: Both web and IDE surfaces now share the same A2UI component catalog. Web uses DOM rendering (ES modules), IDE uses self-contained HTML with inline JS (no external loads allowed in MCP App iframes).
- **Session persistence deferred**: Coordinator researched Cloud Shell storage; found programmatic provisioning not available for first-time users. Demo flows work without persistent storage for Phase 1.
- **Decision conflicts**: Dark mode was implemented as part of chat-first directive (2026-04-08T14:37:00Z) matching reference app styling, but a later directive (2026-04-08T15:05:00Z) requested light-only. Dark mode currently live in d431093; recommend clarifying with user.
- **Files committed**: d431093 (UI redesign), 6f7d7e9 (Squad docs). Orchestration log: fry-wave7.md.

### 2026-04-08 — Clickable carousel, Fluent 2 icons, dark mode removal
- **Clickable carousel**: Each `INSPIRATION_IDEAS` item now has a `prompt` field — a first-person message like "I want to build [title] — [subtitle]." Clicking a carousel slide stores the prompt, transitions to chat, shows it as a user bubble, and auto-sends it after 300ms via `handleUserMessage()`. Carousel stops on click. Hover state: `scale(1.02)` + title turns brand blue + pointer cursor.
- **Emojis → Fluent 2 SVG icons**: Replaced ALL emoji characters across `index.html`, `app.js`, `engine.js`, `a2ui-renderer.js`, and `components.js`. Track cards use 28px Globe/Bot SVGs. Architecture diagram components use 24px inline SVGs (Globe, Cloud, Database, Lightning, ArrowSync). Status indicators (checkmark, dismiss) use 14px SVGs. File viewer folder icon uses 16px SVG. Prompt inspector uses code-bracket SVG. Sessions new-btn uses 16px Add/Plus SVG. All SVGs use `fill="currentColor"` to inherit text color.
- **Dark mode removed**: Deleted `@media (prefers-color-scheme: dark)` blocks from `theme.css` (web) and `kickstart-app.html` (MCP app). Updated MCP test to assert dark mode is NOT present. Light theme only per user directive.
- **CSS adjustment**: `.track-card-icon` changed from `font-size: 28px` to `display: inline-flex; color: var(--color-brand-primary)` to properly hold SVG elements.
# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Core Context

Fry (Frontend Dev) has shipped ~16 major feature/polish work cycles across the Kickstart web surface. The stack evolved from vanilla Portal Prototyper → npm workspaces + React + Fluent UI v9 + A2UI. Key architectural wins:

- **Web scaffold** (2026-04-08): `packages/web/` with hash-based SPA router, component factory pattern, A2UI renderer, Fluent 2 CSS tokens, zero build deps initially.
- **6-phase conversation engine** (2026-07-22): Scripted demo flow (DISCOVER→DESIGN→GENERATE→REVIEW→HANDOFF→DEPLOY), A2UI custom renderers (RepoPicker, WorkflowStatus, CodespaceLink, AppOverview), K8s jargon hidden in phases 1-4.
- **API client + streaming** (2026-07-25): `/api/converse` endpoint, ReadableStream/SSE support, smart fallback to demo mode on API unavailability, streaming UX (temporary chat bubbles), error recovery with Retry.
- **Chat-first UX redesign** (2026-07-25): Removed Portal Prototyper shell, adopted 3-column layout (sessions | chat | file-viewer), file viewer with tabbed display and syntax highlighting, sessions sidebar for history.
- **Fluent UI v9 migration** (2026-04-09): All 22 components (18 basic + 4 custom) migrated to Fluent UI v9. Created override catalog pattern to replace vendor components without modifying source. Zero raw HTML elements; all primitives via Fluent.
- **Component audit trail**: Repeatedly audited for Fluent 2 compliance — spacing tokens, font tokens, color tokens, no hardcoded px/hex/rgb values. This became a pattern: every new component or fix includes audit verification.
- **Playground interface** (2026-04-09): Added tabbed Preview|JSON view, scenario selector, real-time JSON generation for keyword-based scenarios, helper descriptions, all with Fluent UI components.
- **Syntax highlighting** (2026-04-10): Added highlight.js to CodeBlock, registered 10+ languages, VS theme for Fluent 2 compatibility, useMemo optimization.
- **Markdown component** (2026-04-10): Created react-markdown + remark-gfm component, all elements styled with Fluent 2 tokens via makeStyles, code blocks delegate to highlight.js.
- **Session ID bridge** (2026-04-10): Implemented backendSessionId field mapping frontend UI sessions to backend conversation UUIDs. Solved LLM memory loss across messages.

**Build status**: Vite build stable, 302 KB gzipped bundle, zero TypeScript errors.

**Key dependencies**: @fluentui/react-components, react-markdown, remark-gfm, highlight.js, @a2ui/react (adapter).

**Pattern**: All components use `createReactComponent(Api, renderFn)` adapter pattern, `makeStyles` for styling, Fluent tokens exclusively, no framework state (A2UI data model is source of truth).

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->


### 2026-04-08 — packages/web scaffold created
- **Structure**: `packages/web/` contains `index.html`, `css/{theme,core,components}.css`, `js/{app,auth}.js`, `js/framework/{core,components,a2ui-renderer}.js`, `assets/{logo,favicon}.svg`, `package.json`, `staticwebapp.config.json`.
- **Framework pattern**: SPA router is hash-based (core.js `Router`), Navigation pane manager (`Navigation`), Breadcrumbs auto-generate from route path. All exported as ES modules.
- **Component factory pattern**: `createCopilotPanel()`, `createWizard()`, `createCard()`, `createCommandBar()`, `createCodeBlock()`, `createStatusBadge()` — all return DOM elements, not HTML strings.
- **A2UI renderer**: `renderA2UI(schema, ctx)` maps A2UI JSON types to DOM. Custom types registered: `ConversationPhase`, `CodeBlock`, `ResourcePicker`, `DeploymentProgress`, `ArchitectureDiagram`, `CostEstimate`, `HandoffCard`. Extensible via `registerRenderer()`.
- **Auth**: Uses existing Entra config (client ID `7a630e18...`, tenant `72f988bf...`). MSAL loaded via CDN. Auth module pattern: IIFE returning frozen API.
- **CSS tokens**: All colors/spacing/typography use CSS custom properties defined in `theme.css`. Base grid is 4px.
- **Zero build deps**: No npm install needed. Vanilla ES modules + CDN scripts only.
- **Local dev**: `npx serve .` from packages/web (port auto).
- **Copilot panel**: Right-side panel with phase indicator (Understand → Architect → Configure → Deploy), chat bubbles, typing indicator. `onSend` callback wires to conversation engine (placeholder for now).
- **Domain**: kickstart.prototypes.aks.azure.sabbour.me (staging), kickstart.aks.azure.com (future).

### 2025-07-22 — Copilot panel wired to 6-phase conversation engine
- **Engine**: `packages/web/js/engine.js` — client-side conversation state machine mirroring `@kickstart/core` phases in plain JS. 6 phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY (Decision 11).
- **Scripted demo flow**: Each phase has a handler that returns A2UI JSON. Flow auto-advances after user turns; no LLM backend needed yet.
- **New A2UI renderers**: `RepoPicker` (filterable dropdown + "create new"), `WorkflowStatus` (color-coded run list), `CodespaceLink` (CTA card with Codespaces/vscode.dev buttons), `AppOverview` (dashboard widget: app name, runtime badge, service pills, status dot).
- **Phase header updated**: Copilot panel phases changed from 4 (Understand/Architect/Configure/Deploy) to 6 (Discover/Design/Generate/Review/Handoff/Deploy). Landing page cards updated to match.
- **K8s jargon hidden**: No Kubernetes terms in user-facing text for phases 1-4. AKS framed as "app platform" per copilot directive.
- **A2UI rendering pattern**: `copilot.addMessage({ html })` accepts pre-rendered HTML from `renderA2UI()`. Engine calls `onResponse({ a2ui })` and app.js bridges the two.
- **structuredClone**: Used for immutable state transitions in engine.js — works in modern browsers, no polyfill needed.

### 2025-07-25 — API client + API-backed engine wired to Copilot panel
- **api-client.js**: New module at `packages/web/js/api-client.js`. Calls `POST /api/converse` with native `fetch()`. Supports streaming via `ReadableStream` (NDJSON / SSE). Auto-retries on 429/503 with exponential backoff (max 3). Timeouts: 30s standard, 60s streaming. `healthCheck()` pings the endpoint to detect if API is available.
- **Engine refactor**: `engine.js` now exports three factories: `createDemoEngine()` (original scripted flow), `createApiEngine()` (real backend), and `createEngine()` (smart factory — uses API if `apiClient` provided, else demo). Both engines share identical public API shape: `handleMessage`, `getWelcome`, `getCurrentPhase`, `getState`, plus `isDemo` flag.
- **API engine behavior**: `handleMessage` is async, calls `converseStream()`, maps API response `{ sessionId, phase, message, a2ui }` to engine format `{ a2ui, text, systemPrompt }`. Phase transitions driven by comparing API `phase` field to current. Session ID tracked internally.
- **app.js wiring**: `initEngine()` is now async — does `apiClient.healthCheck()` at boot. If API is available, creates API engine with `onStreaming` + `onError` handlers. Otherwise falls back to demo engine and shows a yellow "Demo" badge in the Copilot panel header.
- **Streaming UX**: `updateStreamingBubble()` creates/updates a temporary `.chat-bubble.streaming` element in the message log, replaced by the final response.
- **Error UX**: `showErrorBubble()` renders a red-tinted `.error-bubble` with optional "Retry" button. Retry re-sends the last user message.
- **CSS additions**: `.demo-badge` (yellow pill), `.error-bubble` + `.error-retry-btn` (red alert styling), `.streaming` bubble (left border accent).
- **No build step**: All new code is vanilla ES modules + native APIs. No npm packages added.

### 2025-07-25 — Chat-first UX redesign
- **Layout overhaul**: Removed Portal Prototyper shell (`.portal-shell`, nav-pane, breadcrumbs, command-bar, wizard, content-area, SPA router). Replaced with `.app-shell` — a simple header + three-column flex layout: sessions sidebar | chat (main) | file viewer.
- **Chat is primary**: `createChatUI()` replaced `createCopilotPanel()`. Chat is centered (max-width 760px), takes up the full main area. No toggle button, no close button — it's always visible. Messages container uses `.chat-messages-inner` for centered layout.
- **File viewer sidebar**: New `createFileViewer()` component with tabbed file display, syntax highlighting (dark background), and per-file copy button. Appears via `EventBus.emit('files:generated')` when GENERATE phase produces files. Collapses when hidden.
- **Sessions sidebar**: Left sidebar with session list, toggled from header. Placeholder for future session history.
- **Conversational demo flow**: Discover phase now has 3 turns: (1) ask about app → (2) ask about framework → (3) ask about database/services → advance. Each turn asks ONE question. No multi-field forms.
- **Prompt inspector**: Moved from Copilot panel header to topbar toggle button (`#topbar-inspector-toggle`).
- **Dark mode**: Added `@media (prefers-color-scheme: dark)` block in `theme.css` with full dark palette.
- **CSS class renames**: `.copilot-*` → `.chat-*` (messages, phase, input, textarea, send-btn). Old wizard/command-bar/nav styles removed.
- **Removed components**: `createWizard()`, `createCommandBar()`, `createCopilotPanel()`. Added `createChatUI()`, `createFileViewer()`.
- **No Router needed**: App no longer uses hash-based routing or Navigation/Breadcrumbs — it's a single-page chat experience.
- **Engine files emission**: `generateHandler()` now returns a `files` array alongside `a2ui`, which the app wires to the file viewer via EventBus.

### 2025-07-26 — Landing page added before chat UI
- **Landing page**: `index.html` now shows a `#landing-page` div inside `.chat-main` before the chat starts. Chat UI is hidden until user selects a track or framework.
- **Carousel**: 10 inspiration ideas auto-rotate every 5 seconds with slide/fade transitions and clickable dot indicators. Built with CSS transitions (no library).
- **Track cards**: Two side-by-side cards — "Web App or API" (web-app) and "AI Agent" (agentic-app) — matching Decision D12 tracks. Each has "Get started →" link.
- **Framework pills**: 9 framework quick-start buttons (Next.js, FastAPI, Express.js, Go, Spring Boot, Django, Rust, LangChain Agent, RAG App). Clicking pre-selects the framework AND auto-detects the track (LangChain/RAG → agentic-app, others → web-app).
- **Transition flow**: `transitionToChat()` fades out landing page, removes `body.on-landing` class (which hides sessions toggle), shows chat UI, initializes engine with track/framework, and sends welcome message.
- **Engine params**: `createDemoEngine()` and `createEngine()` now accept optional `track` and `preSelectedFramework`. When framework is pre-selected, `state.turnCount` starts at 1 (skips "which framework?" question) and welcome message says "Great choice — let's build something with {Framework}!".
- **CSS**: New `css/landing.css` — carousel, track cards, framework pills, responsive (stacks cards on mobile). Uses existing Fluent 2 tokens from `theme.css`.
- **Body class pattern**: `body.on-landing` is set in HTML and removed on transition. Used to hide sessions sidebar toggle via CSS.

### 2026-04-08 — Wave 7 Coordination with Bender (MCP App surface)
- **Parallel work**: Bender completed MCP App HTML surface (commit e80b44f) with full A2UI renderer (18 component types), postMessage protocol, and 30 new tests (118 total passing).
- **Dual-surface architecture**: Both web and IDE surfaces now share the same A2UI component catalog. Web uses DOM rendering (ES modules), IDE uses self-contained HTML with inline JS (no external loads allowed in MCP App iframes).
- **Session persistence deferred**: Coordinator researched Cloud Shell storage; found programmatic provisioning not available for first-time users. Demo flows work without persistent storage for Phase 1.
- **Decision conflicts**: Dark mode was implemented as part of chat-first directive (2026-04-08T14:37:00Z) matching reference app styling, but a later directive (2026-04-08T15:05:00Z) requested light-only. Dark mode currently live in d431093; recommend clarifying with user.
- **Files committed**: d431093 (UI redesign), 6f7d7e9 (Squad docs). Orchestration log: fry-wave7.md.

### 2026-04-08 — Clickable carousel, Fluent 2 icons, dark mode removal
- **Clickable carousel**: Each `INSPIRATION_IDEAS` item now has a `prompt` field — a first-person message like "I want to build [title] — [subtitle]." Clicking a carousel slide stores the prompt, transitions to chat, shows it as a user bubble, and auto-sends it after 300ms via `handleUserMessage()`. Carousel stops on click. Hover state: `scale(1.02)` + title turns brand blue + pointer cursor.
- **Emojis → Fluent 2 SVG icons**: Replaced ALL emoji characters across `index.html`, `app.js`, `engine.js`, `a2ui-renderer.js`, and `components.js`. Track cards use 28px Globe/Bot SVGs. Architecture diagram components use 24px inline SVGs (Globe, Cloud, Database, Lightning, ArrowSync). Status indicators (checkmark, dismiss) use 14px SVGs. File viewer folder icon uses 16px SVG. Prompt inspector uses code-bracket SVG. Sessions new-btn uses 16px Add/Plus SVG. All SVGs use `fill="currentColor"` to inherit text color.
- **Dark mode removed**: Deleted `@media (prefers-color-scheme: dark)` blocks from `theme.css` (web) and `kickstart-app.html` (MCP app). Updated MCP test to assert dark mode is NOT present. Light theme only per user directive.
- **CSS adjustment**: `.track-card-icon` changed from `font-size: 28px` to `display: inline-flex; color: var(--color-brand-primary)` to properly hold SVG elements.

## Summary (2026-04-10)
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns. Shipped full Vite+React stack migration, Playground interface, dark mode, accessibility audit, and 20+ fat A2UI components.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system

## Recent Work
- v2 #474: frontend cut line analysis, seam-cutting approach confirmed
- v0.6: SSE parser fixes, K8s icon expansion, A2UI debug visualization
- Shipped: 406 fallback in useStreaming, Playwright test suite
- 2026-04-21: **Bug intake — 2 issues assigned** (#995: Core components tab tight rendering + preview quality; #997: Workspace page black void). Both unassigned, go:needs-research tags.
- v2 #474 frontend cut line analysis: seam-cutting pass approach confirmed for Step 1
- v0.6.x: 406 fallback in useStreaming.ts for SDK path; K8s icon catalog expansion; A2UI debug visualization; system-prompt context var injection fix
- v0.5.x: SSE parser fixes, action context enrichment, hash-based routing, ArchitectureDiagram diagram-first contract, theme system

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

- (2026-04-24T00:01:12-07:00) For cross-turn chat updates, turn-prefix scoping alone is insufficient. Safe frontend pattern is to reserve a stable surface namespace (proposed `shared:`) for chat-persistent surfaces, resolve those through a replay-safe logical→rendered registry, and keep all other surface IDs turn-scoped so existing per-turn file/progress surfaces stay isolated.
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

Posted DP to https://github.com/azure-management-and-platforms/kickstart/issues/477#issuecomment-4268128132

### Covered

## 2026-04-21 — #1018: sparkle.svg 404 + CSP external media fix (PR #1022)


## Summary (History Archived 2026-04-23T22:53:28Z)

Fry owns frontend and A2UI catalog. Key contributions:
- Led #474 Step 1 frontend cutline analysis: preserve shell, delete fixtures, replace in-place seams
- Shipped #446 (Agents SDK UI adaptation) with 406 fallback in useStreaming.ts
- Expanded K8s icon catalog and ArchitectureDiagram security model
- Participated in 4-way review gate — approved 5+ DPs and PRs with consistent pattern discipline
- Identified Playwright race condition (waitForResponse MUST precede page.goto)
- Established safe frontend cut line for v2 nuke: preserve components/contexts/hooks shell

[Full archive in session store for detailed learnings]

## 2026-04-24T07:01:12Z — Session Close (Scribe)
**Role:** Frontend (DP amendment + impl)
**Issue:** #5
**Outcomes:**
- DP amendment: shared surface namespace design (resolved Nibbler rejection)
- Frontend implementation completed: shared namespace integration, useA2UI fix, tests
- PR #25 opened targeting dev

**Critical Events:**
- Submitted design clarification on cross-turn surface scoping
- Nibbler approved amended DP
- Parallel impl with Bender (backend)

**Carry-forward:** PR #25 merge pending review gate

## 2026-04-24T15:04:55Z — Session Close (Scribe)
**Role:** Frontend (org migration design feedback)
**Issue:** #38
**Outcomes:**
- Provided design feedback on org migration scope amendment
- Participated in 4-way review: approved DP v2 by Leela, Zapp, Nibbler
- No code changes required (backend-led org migration)
- PR #40 opened by Bender

**Critical Events:**
- DP v2 scope amendment: production/docs/runtime boundary clarified
- Cross-agent collaboration with Bender on audit findings
- All reviewers gate-clear

**Carry-forward:** PR #40 merge pending code review completion

## 2026-04-28 — PR #239 lockout-substitute revision (issue #237)

Acted as designated revision author after Zapp issued `security:rejected` on PR #239 (original author: Bender, locked out per Reviewer Rejection Protocol).

**Fix:** added `https://management.azure.com` to the `connect-src` directive in `packages/web/public/staticwebapp.config.json`. Surgical single-line edit — no other directive touched, no wildcards introduced. The Playwright CSP smoke mirror in `e2e/browser-telemetry.spec.ts` already contained the entry, so no drift.

**Verification:** `arm-direct-csp.test.ts` (CI invariant guard) green; full vitest suite 2137/2137 passing; web + api builds clean; bundle budgets within ceiling.

**Commit:** b9ca7b34 (squad-frontend[bot]). Comment 4337051908 posted on PR #239 pinging Zapp for re-review. Bender did not contribute.
