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

### 2026-04-08 — Carousel clickability + emoji removal + dark mode cleanup
- **Carousel interaction**: Carousel items now fully clickable — clicking a slide/dot automatically submits the item's .text field as a chat message via handleMessage(). No need for separate CTA button.
- **Emoji replacement**: All 18 emoji characters replaced with inline Fluent 2 SVG icons:
  - Copy/clipboard (📋), Eye (👁️), Close/X (❌), Checkmark/tick (✓), Plus/add (➕), Folder (📁), Settings (⚙️), and 11 others
  - SVG icons inlined in A2UI renderer — no external file fetch needed
  - Icons sized to match text baseline (0.9em), colored to match context (dark on light, light on dark)
- **Dark mode removal**: Deleted all @media (prefers-color-scheme: dark) media query blocks:
  - 	heme.css — removed dark palette variables and dark theme overrides
  - landing.css — removed dark carousel styling
  - components.css — removed dark input/button/card overrides
  - Also removed from packages/mcp-server/src/app/kickstart-app.html (MCP App HTML surface)
- **Light theme only**: UI now light theme exclusively. CSS file size reduced by ~120 lines.
- **A2UI renderer update**: enderA2UI() now inlines SVG icons directly into rendered components rather than using emoji placeholders.
- **Files changed**: 8 files (3 CSS, 3 JS, 2 HTML)
- **Tests**: All 118 Playwright E2E tests passing — carousel interaction, icon rendering, layout all verified
- **Alignment**: Fully implements three user directives: no LLM emojis, no UI emojis (use Fluent icons instead), light theme only

### 2025-07-27 — IDE launch links on landing page
- **New section**: Added "Or use your IDE" section below framework pills on the landing page with three IDE cards: VS Code (stable), VS Code Insiders, and Claude Code.
- **VS Code URIs**: Both VS Code cards use `vscode:mcp/install?{urlEncodedJson}` (and `vscode-insiders:` scheme) to trigger MCP server installation with `@kickstart/mcp-server` via npx.
- **Claude Code clipboard**: Claude Code card uses `data-copy-command` attribute + click handler that copies `claude mcp add kickstart -- npx -y @kickstart/mcp-server` to clipboard with a 2-second "Copied!" feedback on the card name. Includes `execCommand('copy')` fallback.
- **Inline SVG icons**: VS Code logo (blue #007ACC), VS Code Insiders logo (green #24931E), terminal icon (currentColor) — all 24×24. No external icon files.
- **CSS**: `.landing-ide`, `.ide-cards`, `.ide-card` — horizontal card layout with border, hover shadow, matching the framework pills visual weight. Styled as secondary/tertiary prominence.
- **Files changed**: `packages/web/index.html`, `packages/web/css/landing.css`, `packages/web/js/app.js`.

### 2025-07-27 — 4 critical web UX bug fixes
- **Health check fix**: `healthCheck()` in `api-client.js` now checks `res.ok || res.status === 405` instead of `res.status < 500`. Prevents 404 from undeployed Azure Functions from being treated as "API available".
- **Track/pill prompts**: `initLandingListeners()` in `app.js` now sets `pendingQuickPrompt` when a track card or framework pill is clicked, so the user's intent auto-sends as a chat message after transition. Framework-specific prompts live in a `frameworkPrompts` map.
- **Markdown renderer**: `renderMarkdown()` added to `components.js` — lightweight converter supporting bold, italic, inline code, fenced code blocks, unordered lists, links, paragraphs, and line breaks. Used in `renderMessages()` for assistant text (not HTML) messages and in `updateStreamingBubble()` for partial streaming content.
- **Sessions sidebar UX**: Sidebar now has a close button (X icon in header), active-session indicator dot, "Current conversation" label, and a full-width "New session" button in a footer section. CSS classes: `.sessions-close-btn`, `.session-indicator`, `.sessions-footer`.
- **CSS additions**: `components.css` gained markdown-specific styles for `pre`, `code`, `ul` inside `.chat-bubble.assistant`. `core.css` gained `.sessions-close-btn`, `.session-indicator`, `.sessions-footer`, and refactored `.sessions-new-btn` as full-width button.
- **Files changed**: `packages/web/js/api-client.js`, `packages/web/js/app.js`, `packages/web/js/framework/components.js`, `packages/web/index.html`, `packages/web/css/components.css`, `packages/web/css/core.css`.

### 2025-07-27 — Carousel wired to /api/inspirations endpoint
- **API fetch pattern**: `fetchInspirations()` calls `GET /api/inspirations` with a 2-second `AbortController` timeout. Does NOT use `apiClient` — it is a simple public GET with no auth. Returns parsed JSON array or null on any failure (network, timeout, non-OK status, non-array response).
- **Hot-swap**: `updateCarouselIdeas(ideas)` replaces the `INSPIRATION_IDEAS` array and re-renders slides + dots via `innerHTML`. Preserves current slide index if still valid, otherwise resets to 0. Restarts auto-rotation timer.
- **Non-blocking**: Carousel renders immediately with hardcoded `INSPIRATION_IDEAS` at boot. The API fetch runs in the background and swaps content only if it returns 3+ valid ideas. Page load is never blocked.
- **Event delegation preserved**: Slide click and dot click handlers are on parent containers (`#carousel-viewport`, `#carousel-dots`) using delegation, so replacing `innerHTML` children does not break listeners.
- **Fallback guarantee**: If the API is unavailable (404, network error, timeout, bad data, or fewer than 3 ideas), the hardcoded array stays in place silently. Demo mode works identically to before.
- **`INSPIRATION_IDEAS` changed to `let`**: Was `const`, now `let` so `updateCarouselIdeas()` can reassign it. All existing references (slide click, `nextSlide()`) read the variable by name, so reassignment propagates correctly.
- **Files changed**: `packages/web/js/app.js`.

### 2025-07-27 — SWA CLI local dev setup
- **SWA CLI config**: `swa-cli.config.json` at repo root. `appLocation: packages/web`, `apiLocation: packages/web/api`, `outputLocation: .`, port 4280, apiPort 7071.
- **Dev scripts**: `npm run dev` builds `@kickstart/core` then runs `npx swa start`. `npm run dev:web` serves static files only at port 4280 via `serve`.
- **local.settings.json**: Already existed at `packages/web/api/local.settings.json` with Azure OpenAI settings. Added `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` placeholders for Entra. Already gitignored (line 29 of `.gitignore`).
- **SWA CLI installed**: Added `@azure/static-web-apps-cli` as root devDependency (v2.0.8). Scripts use `npx swa` so no global install required.
- **DEVELOPMENT.md**: Created at repo root — prerequisites, quick start, credential setup, script reference table.
- **Port convention**: SWA CLI dev at 4280, Playwright E2E tests at 4281 (separate `serve` instance via `playwright.config.ts`). No conflict.
- **No Playwright changes**: E2E tests have their own `webServer` config in `playwright.config.ts` — completely independent of SWA CLI.

### 2025-07-28 — Fluent avatar + client-side /login
- **Fluent Avatar**: Replaced `.topbar-avatar` initials span with `<fluent-avatar>` web component. Uses `name` attr for initials fallback, `src` attr for profile photo, `size="28"`, `color="colorful"`. The CDN-loaded `@fluentui/web-components` (line 13 of index.html) provides the element.
- **Profile photo**: `fetchUserPhoto()` helper calls `GET https://graph.microsoft.com/v1.0/me/photo/$value` with the user's `User.Read` access token. Returns blob URL or null. Photo loads async — avatar shows initials immediately, photo replaces when ready.
- **XSS safety**: User name is passed through `escapeHtml()` before injecting into avatar/name HTML attributes.
- **CSS**: Kept `.topbar-avatar` as fallback; added `.topbar-user-name` with `max-width: 140px` + `text-overflow: ellipsis` for long display names.
- **/login route fix**: Removed server-side `/login → /.auth/login/aad` redirect from `staticwebapp.config.json`. Now handled client-side in `boot()` — checks `window.location.pathname === '/login'`, triggers MSAL login if unauthenticated, then `replaceState` to `/`.
- **Auth flow**: `initAuth()` now `await`s `updateAuthUI()` since it's async (fetches photo). No breaking change — `Auth.login().then(updateAuthUI)` still works because `.then()` handles async returns.
- **Files changed**: `packages/web/js/app.js`, `packages/web/css/core.css`, `packages/web/staticwebapp.config.json`.

### 2025-07-28 — Landing page simplification + Fluent 2 adoption
- **Removed sections**: Inspiration carousel (HTML + CSS + JS + API fetch), framework pills (9 buttons), IDE launch links (VS Code/Insiders). ~470 lines deleted across 3 files.
- **Fluent 2 search input**: Replaced custom `<input class="landing-hero-input">` with `<fluent-search id="hero-input" appearance="outline">` web component from CDN-loaded `@fluentui/web-components`. Custom `.landing-hero-input` CSS removed entirely — Fluent handles styling. Sized via `--input-height: 44px` CSS custom property on the wrapper.
- **Fluent 2 typography**: Hero title upgraded from `font-size-800` (32px bold) to `font-size-900` (40px semibold, line-height 52px, letter-spacing -0.02em) — matches Fluent 2 Hero type ramp. Track card title/desc use explicit Fluent 2 `line-height` tokens.
- **JS cleanup**: Removed `INSPIRATION_IDEAS` array, all carousel functions (`initCarousel`, `goToSlide`, `nextSlide`, `resetCarouselTimer`, `stopCarousel`, `fetchInspirations`, `updateCarouselIdeas`), framework pill handlers. `pendingQuickPrompt` moved to landing state section. `transitionToChat()` no longer calls `stopCarousel()`.
- **Hero input binding**: `<fluent-search>` fires standard `keydown` events on the host element. Value accessed via `.value` property (same as native input). No binding changes needed.
- **Landing page flow**: Now hero (title + Fluent search + suggestion pills) → track cards. Two focused entry points, zero visual clutter.
- **User preference**: Ahmed wants clean, focused landing pages. "Too much going on" = remove secondary CTAs. Primary action (search) + secondary navigation (track cards) only.
- **Files changed**: `packages/web/index.html`, `packages/web/css/landing.css`, `packages/web/js/app.js`.

### 2025-07-24 — Spark UX P0 (4 items in 1 commit)
- **Context**: Implemented all 4 "Spark UX P0" items to make Kickstart feel like GitHub Spark.
- **P0-1 Hero Input**: Added `landing-hero` section with centered text input + 4 suggestion pills above carousel. Reuses `pendingQuickPrompt` → `transitionToChat()` flow. CSS uses theme tokens; responsive breakpoints added.
- **P0-2 File Chips**: Created `renderFileChips(files)` in components.js, `FileGeneration` A2UI renderer, engine integration. **Key learning**: A2UI renders to `outerHTML` strings — event listeners are lost. File chip clicks MUST use event delegation on chat container, not direct listeners.
- **P0-3 Sparkle Loader**: Replaced typing dots with gradient-pulsing sparkle animation + phase-aware status text. `setTyping(val, phase)` API — phase is optional for backward compat. Uses `--color-copilot-gradient-start/end` tokens.
- **P0-4 Preview Panel**: Transformed `#file-viewer` into contextual preview panel. Dynamic titles via `PREVIEW_TITLES` map keyed by phase name. `showPreviewContent()` renders ArchitectureDiagram to panel body. Panel header + close button added; file-viewer inner header hidden via CSS.
- **Pattern**: Two engine creation paths (API vs demo) in `initEngine()` — both need identical `onPhaseChange`/`onResponse` wiring.
- **Files changed**: `index.html`, `landing.css`, `components.css`, `app.js`, `engine.js`, `components.js`, `a2ui-renderer.js` (all in `packages/web/`).

- **Carousel Restore (subtle strip)**: Re-added inspiration carousel between suggestion pills and track cards. Key design decisions: crossfade-only (opacity transitions, no translateX sliding), 70px viewport vs old 100px, 6px dots vs 8px, font-size-500/300 vs 600/400. `goToSlide` simplified — just toggles `.active` class for crossfade. `stopCarousel()` wired into `transitionToChat()` to prevent leaked intervals. `fetchInspirations()` kept as fire-and-forget upgrade from hardcoded ideas. **Gotcha**: fluent-search `.value` works same as plain input — no special handling needed for carousel click → chat trigger.

### 2025-07-28 — Landing page redesign: lightbulb input + framework pills
- **Layout reorder**: Title → lightbulb text input → carousel → track cards → "or start with a framework" → framework pills. Removed old suggestion pills between input and carousel — carousel now serves that discovery purpose.
- **Input swap**: Replaced `<fluent-search>` with plain `<input type="text">` inside a relative wrapper. Lightbulb SVG icon absolutely positioned at left (14px inset, 20×20). Input left-padded 42px to clear the icon. Outline border, 44px height, brand-primary focus ring.
- **Title changed**: "What do you want to deploy?" → "What do you want.." (two dots, no question mark). More open-ended/ideation feel.
- **Framework section**: New `.framework-section` with uppercase label ("or start with a framework", font-size-100, letter-spacing 0.08em, neutral-foreground-3) and 9 `.framework-pill` buttons. Pills use `font-weight-regular` (vs old suggestion-pill `semibold`) for lighter feel. Click handler sends "I want to build an app using {name}" as chat prompt.
- **CSS classes**: Removed `.suggestion-pills`, `.suggestion-pill`. Added `.hero-input-icon`, `.landing-hero-input-wrap input`, `.framework-section`, `.framework-separator-label`, `.framework-pills`, `.framework-pill`.
- **JS**: Updated `initLandingListeners()` — removed suggestion pill handler, added framework pill handler with template string prompt. Hero input keydown works identically (plain input `.value` same as fluent-search `.value`).
- **Files changed**: `packages/web/index.html`, `packages/web/css/landing.css`, `packages/web/js/app.js`.

### 2025-07-28 — Landing page placeholder rotation UX
- **App branding**: Changed page title and topbar brand from 'Kickstart' to 'Kickstart on Azure Kubernetes Service (AKS)'. Created white AKS Kubernetes logo SVG (assets/aks-logo-white.svg) with hexagon/helm wheel design.
- **Hero title**: Changed from 'What do you want..' to 'What are you dreaming of building?'.
- **Carousel removal**: Removed entire inspiration carousel section (HTML, CSS, JS) — ~80 lines of CSS, 90+ lines of JS removed.
- **Rotating placeholder**: Replaced carousel with rotating placeholder text inside hero input. Uses INSPIRATION_IDEAS array to cycle through idea titles every 4 seconds. Implemented with position:absolute span (.hero-input-placeholder) that crossfades via opacity transitions.
- **Placeholder behavior**: Shows visible on load, dims to opacity:0.4 on focus, hides completely when input has text. Rotates to next idea with 300ms fade-out, then 4-second delay.
- **Send button**: Added circular send button (hero-send-btn) inside input wrapper, positioned absolute right. Uses right-arrow SVG icon, brand primary color background. Clicking with empty input sends the currently displayed placeholder idea's .prompt field.
- **Input padding adjustment**: Changed from 'padding: 0 var(--spacing-l) 0 42px' to '0 44px 0 42px' to leave room for send button.
- **JS refactor**: Removed initCarousel(), goToSlide(), nextSlide(), resetCarouselTimer(), stopCarousel(), updateCarouselIdeas(), and carousel event listeners. Added initPlaceholderRotation() and stopPlaceholderRotation(). Repurposed carouselIndex and carouselTimer for placeholder rotation.
- **Hero Enter key behavior**: Updated to send current rotating idea if input is empty.
- **Files changed**: packages/web/index.html (carousel HTML removed, placeholder span + send button added), packages/web/css/landing.css (carousel CSS removed, placeholder + send button CSS added), packages/web/js/app.js (carousel functions removed, placeholder rotation added), packages/web/assets/aks-logo-white.svg (new).

### 2025-07-28 — Avatar 404 fix, Copilot send button, recent sessions, footer
- **Avatar 404 fix**: Modified fetchUserPhoto() to check metadata endpoint (`/me/photo`) before fetching binary (`/me/photo/$value`). This prevents browser console 404 errors when user has no profile photo — the metadata call fails silently without noisy network error.
- **Copilot sparkle icon**: Replaced send button arrow SVG with GitHub Copilot sparkle icon (dual-star design). Changed viewBox from "0 0 16 16" and increased size from 16×16 to 20×20.
- **Prompt inspector removal**: Removed topbar button and event listener for prompt inspector toggle. Kept `promptInspectorOn` variable and conditional rendering logic in chat (for future programmatic use).
- **Recent Sessions section**: Added localStorage-backed session history below framework pills. Shows last 5 sessions with title + date. Click handler resumes session by setting pendingQuickPrompt and calling transitionToChat(). Session saved at start of transitionToChat() with generated ID, title (first 100 chars of prompt), and timestamps.
- **Footer**: Added centered footer with version info (git SHA · build date) in monospace font, and disclaimer "Kickstart uses AI. Check for mistakes." Build metadata injected via window.__BUILD_SHA__ and window.__BUILD_DATE__ (defaults to 'dev' and current date). Footer version populated in boot() after renderRecentSessions().
- **CSS additions**: .recent-sessions-section, .recent-sessions-label, .recent-session-item (hover shadow + border), .recent-session-title (ellipsis overflow), .recent-session-date, .landing-footer, .landing-footer-version (monospace), .landing-footer-disclaimer.
- **JS additions**: getSessions(), saveSession() (prepend or update, keep 20 max), renderRecentSessions() (show/hide section, build item HTML, attach click handler). Called in boot() after initPlaceholderRotation().
- **HTML structure**: Hero → track cards → framework pills → recent sessions → footer (all in .landing-inner).
- **Files changed**: packages/web/js/app.js (fetchUserPhoto, recent sessions helpers, transitionToChat session save, boot footer version), packages/web/index.html (removed prompt inspector button, replaced send icon, added recent sessions HTML, added footer, added build metadata script), packages/web/css/landing.css (recent sessions + footer styles).

### 2025-07-27 — "WOW" UX Vision document authored
- **Vision doc**: Wrote `.squad/decisions/inbox/fry-wow-ux-vision.md` — a comprehensive buildable spec for a hybrid UX that goes beyond both GitHub Spark and try-aks (adaptive-ui).
- **Core concept**: "The conversation IS the workspace" — persistent components (architecture diagram, cost estimate, file tree) that live across turns and UPDATE rather than recreate. Three-column layout: Context Rail (240px) | Conversation Stream (flex) | Workspace Panel (380px).
- **New components designed**: QuestionnaireCard (rich radio options with title+description — biggest gap vs try-aks), FileGeneration (real-time file creation list), FileEditor (split-pane tree+code), ArchitectureDiagram (animated SVG with node-by-node entrance), CostEstimate (animated counters), AuthCard, ResourcePicker, PRCreation, ProgressStepper (breadcrumb replacing phase bar), AppCard (persistent context summary).
- **Streaming architecture**: Proposed SSE event types (`text`, `component`, `file_chunk`, `file_complete`, `phase`, `done`) to replace the brittle `~~~a2ui` fenced block pattern. Components appear MID-STREAM, not after.
- **Animation system**: Spring easing for emphasis (`cubic-bezier(0.34, 1.56, 0.64, 1)`), staggered entries (60-100ms), `stroke-dashoffset` for connection line drawing, counter animations for cost values, `prefers-reduced-motion` respect.
- **State model**: Persistent state (AppCard, file tree, architecture, costs, session state) vs ephemeral (streaming buffer, typing indicator, unselected questionnaire options).
- **Implementation phasing**: Phase 1 (~14h) = QuestionnaireCard + ProgressStepper + streaming markdown + entrance animations + SSE events. Phase 2 (~28h) = FileGeneration + FileEditor + file streaming + Context Rail + Workspace Panel. Phase 3 (~34h) = animated ArchitectureDiagram + CostEstimate counters + AuthCard + PRCreation + cross-turn persistence.
- **Key "wow" factors identified**: (1) Watching code write itself line-by-line, (2) living workspace that accumulates across turns, (3) decisions with visible consequences (choose DB → diagram adds node → cost ticks up), (4) progressive complexity emergence, (5) animated cost counters.
- **Current codebase gaps noted**: a2ui-renderer.js only has flat renderers (no state binding, no streaming), components.js FileViewer is tab-based (not split-pane), app.js streaming is plaintext-only (no component events), system-prompt.ts uses `~~~a2ui` fenced blocks (brittle regex extraction).

### 2025-07-29 — Full React chat app built with A2UI v0.9 integration
- **Complete React rewrite**: Replaced vanilla JS app-shell with React 19 component tree. `index.html` now only has `<div id="root">` — all UI rendered by React.
- **Component architecture**: `App.tsx` (root, mode switching) → `Layout.tsx` (app-shell, topbar, sidebars) → `Landing.tsx` (hero input, tracks, pills, carousel) or `ChatShell.tsx` (messages + input). 15 component files total.
- **A2UI v0.9 MessageProcessor**: `useA2UI` hook creates singleton `MessageProcessor<ReactComponentImplementation>` with `basicCatalog`. Surfaces tracked via `onSurfaceCreated`/`onSurfaceDeleted` subscriptions → React state. `processMessages()` returns surfaceIds for linking to chat messages.
- **Demo mode**: 6 rich scenarios (Welcome, Architecture, Design Detail, File Generation, Review, Deploy Success) using all major A2UI components: Text, Button, Card, Column, Row, Tabs, List, ChoicePicker, TextField, Divider. Word-by-word streaming simulation at 40ms/word.
- **Session management**: `useSessions` hook persists to localStorage. CRUD ops for sessions, messages. Recent sessions show on landing with delete confirmation UI.
- **Streaming hook**: `useStreaming` for real API SSE. Falls back to demo mode on API health check failure. Supports abort via AbortController.
- **CSS class reuse**: All components use existing CSS classes (`.app-shell`, `.chat-bubble.user`, `.chat-bubble.assistant`, `.landing-page`, `.track-card`, `.framework-pill`, `.sessions-sidebar`, etc.) — no new CSS files created.
- **Placeholder carousel**: 10 inspiration ideas rotate every 4s with fade animation (CSS `.hero-input-placeholder.visible` class toggle).
- **Build**: `npx vite build` succeeds — 467 modules, 388KB bundle. No TypeScript errors.

### 2025-07-29 — A2UI Phase 2: Fluent 2 styling + custom Kickstart catalog
- **A2UI override CSS**: Created `packages/web/css/a2ui-overrides.css` — comprehensive Fluent 2 styling for all vendored A2UI components using CSS `!important` overrides. Targets buttons, cards, text variants, tabs, inputs, checkboxes, choice pickers, dividers, rows/columns. Uses theme.css design tokens (`--color-brand-primary`, `--shadow-2`, `--radius-large`, etc.).
- **Override strategy**: Scoped to `.a2ui-surface-wrapper` selector prefix. Inline styles from vendored components overridden with `!important`. Tab active state detected via `[style*="font-weight: bold"]` attribute selector. Card containers detected via `[style*="boxShadow"]`.
- **Assistant avatar**: Added AKS Automatic icon (`/assets/icons/compute/aks-automatic.svg`) as `.assistant-avatar` to the left of assistant chat bubbles. Wrapped in `.chat-bubble-row` flex container for horizontal layout.
- **Kickstart catalog**: Created `packages/web/src/catalog/kickstart-catalog.ts` — extends `basicCatalog` with 4 custom components. Registered in `useA2UI` hook replacing `basicCatalog`. Catalog ID changed to `'kickstart'`.
- **Custom components**: RadioGroup (selectable card grid with recommended badge), FormGroup (titled card with step indicator), CodeBlock (dark-themed code with filename header + copy button), ProgressSteps (horizontal step dots with pulse animation).
- **Demo scenarios updated**: Welcome now uses RadioGroup for track selection (3 options with recommended badge). Added CONFIGURE_FORM scenario (FormGroup + ProgressSteps + RadioGroup). Added CODE_PREVIEW scenario (CodeBlock with Dockerfile + deployment.yaml). DEPLOY_SUCCESS now includes ProgressSteps showing completed pipeline.
- **CATALOG_ID**: Changed from basic catalog URL to `'kickstart'` string in demo-scenarios.ts to match the kickstart catalog ID.
- **Build**: `npx vite build` succeeds — 478 modules. No TypeScript errors.
- **Pattern**: Custom components use `createReactComponent` from A2UI adapter, same pattern as vendored components. CSS classes prefixed with `kickstart-` to avoid collisions.

### 2025-07-24 — Docusaurus documentation site created

- **Location**: `docs-site/` at repo root — independent from monorepo workspaces, has its own `package.json` and `node_modules`.
- **Stack**: Docusaurus 3.10 (classic preset), TypeScript, deployed via GitHub Pages to `https://sabbour.github.io/kickstart/`.
- **Config**: `docusaurus.config.ts` — title "Kickstart", Azure blue (#0078d4) primary color, blog disabled, favicon reused from `packages/web/public/assets/favicon.svg`.
- **Docs structure**: 8 pages across 4 sections — intro, Architecture (overview, A2UI integration, JSON envelope), Getting Started (local setup, project structure), Components (custom catalog), Contributing.
- **Landing page**: Hero with "Get Started" CTA + 3-column feature grid (Conversational AI, Rich UI Components, Real Artifacts). Uses emoji instead of SVG illustrations.
- **CI/CD**: `.github/workflows/deploy-docs.yml` — triggers on push to `main` when `docs-site/**` changes, uses `actions/deploy-pages@v4` for GitHub Pages deployment.
- **Build**: `npm run build` succeeds with zero errors. Output in `docs-site/build/`.
- **Gotcha**: Blog must be explicitly disabled (`blog: false`) in preset config to avoid broken links from default blog scaffold.

### 2025-07-28 — A2UI Playground + Mock Streaming + Model Indicator Fix
- **Playground page**: New `packages/web/src/pages/Playground.tsx` — standalone A2UI test harness accessed via `?playground` URL parameter. Shows scenario buttons for all 8 demo scenarios (Welcome, Architecture, Design Detail, Configure Form, Code Preview, File Generation, Review, Deploy Success). Has a JSON editor textarea for pasting raw A2UI messages. Uses `getDemoResponse()` with keyword matching to load specific scenarios. CSS in `packages/web/css/playground.css`.
- **Mock streaming**: New `packages/web/src/services/mock-streaming.ts` + `packages/web/src/hooks/useMockStreaming.ts`. Activated via `?mock` URL param. Intercepts the streaming pipeline, returns canned responses from `demo-scenarios.ts` with word-by-word typing simulation (30-50ms delays). Sets `model: 'gpt-5.3-chat (mock)'` on all responses. Supports abort. Each user message advances through the scenario sequence via `getDemoResponse()`.
- **Model indicator fix**: `useStreaming.ts` now captures `event.model` from SSE stream events and passes it through `onComplete(fullText, model)`. `App.tsx` wires model to `ChatMessage.model` so `ChatMessage.tsx` renders the existing `.model-indicator` span.
- **Mock mode bypass**: When `?mock` is in URL, `isApiAvailable` initializes to `true` (skips health check), so track cards and framework pills work without a backend.
- **URL param pattern**: Module-level `isMockMode()` and `isPlaygroundMode()` called once at App load. Evaluated outside React to avoid re-renders. `playgroundEnabled` triggers a separate Layout render path with just the Playground component.
- **Key insight**: `getDemoResponse()` uses a global `turnCount` variable. For playground, must call `resetDemoState()` before each scenario injection, then burn turn 1 (always returns WELCOME) before using keyword matching for specific scenarios.
- **Sign-in**: Still a placeholder button — noted but not fixed (Phase 3).

### 2025-07-29 — Playground redesign: split-pane + component explorer
- **Split-pane layout**: Replaced single-column playground with a left/right split. Left panel (320px, scrollable) has collapsible scenario sections; right panel (flex: 1, scrollable) shows rendered surfaces and activity log. Fixes the scroll bug — playground renders inside `Layout → .app-shell → .app-layout → .chat-main` (all `overflow: hidden`), so `.playground-page` now uses `height: 100%` + flex layout with `min-height: 0` and independent `overflow-y: auto` on each panel.
- **Scenario file extracted**: New `packages/web/src/pages/playground-scenarios.ts` — contains all scenario definitions (8 Kickstart + 19 built-in controls). Each control scenario has a `generate()` function that creates a unique surface via `uid()` counter, avoiding "Surface already exists" errors on repeated clicks.
- **Built-in control coverage**: 19 scenarios covering Row, Column, List, Card, Tabs, Divider, Text (all variants), Image, Button (3 variants), TextField, CheckBox, ChoicePicker (chips + list), Slider, DateTimeInput, Modal, RadioGroup, FormGroup, CodeBlock, ProgressSteps. All use `catalogId: 'kickstart'`.
- **Component API patterns**: Button uses `child` (component ID) not `text`. Card uses `child`. Tabs uses `tabs: [{title, child}]` not `children`. Modal uses `trigger` + `content` component IDs. These are easy to get wrong.
- **Collapsible sections**: Sidebar sections (Kickstart Scenarios, Layout, Content, Inputs, Custom Controls, Custom JSON) are collapsible with chevron animation. State tracked via `Set<string>`.
- **Responsive**: On viewports < 768px, panels stack vertically with left panel capped at 40vh.
- **Files changed**: `packages/web/src/pages/Playground.tsx` (rewrite), `packages/web/css/playground.css` (rewrite), `packages/web/src/pages/playground-scenarios.ts` (new).
### 2026-04-08 — Fluent UI React v9 migration (Playground + App shell)
- **FluentProvider**: Wrapped both App.tsx return paths (playground + main) in `<FluentProvider theme={webLightTheme}>`. All children now inherit Fluent 2 design tokens.
- **Playground refactored**: Replaced hand-rolled HTML elements with Fluent UI v9 components:
  - `<h1>` → `<Subtitle2>`, custom badge → `<CounterBadge>`, `<button>` → `<Button appearance="primary|outline">`
  - Collapsible sections → `<Accordion multiple>` + `<AccordionItem>` + `<AccordionHeader>` + `<AccordionPanel>` with controlled `openItems` state
  - `<textarea>` → `<Textarea>` (Fluent), `.pg-json-error` → `<MessageBar intent="error">`
  - Surface cards → `<Card appearance="outline">` + `<CardHeader>`
  - Activity log header → `<Body1Strong>`, empty state → `<Text>`
- **makeStyles pattern**: Component-level styles use Griffel `makeStyles()` hook with Fluent `tokens` (colors, spacing, typography, radii). Layout-only CSS kept in `playground.css`.
- **CSS cleanup**: Removed ~250 lines of component CSS (buttons, badges, typography, chevrons, section headers, scenario buttons, JSON editor, surface cards, activity log). Kept layout shell (~80 lines): flex containers, scroll areas, responsive breakpoints.
- **Build**: Vite production build passes — 2539 modules (up from 483 before Fluent tree). No errors.
- **State change**: Accordion `openItems` (string array) replaces old `Set<string>` + separate `jsonSectionOpen` boolean. JSON section is now just another AccordionItem with value `"custom-json"`.
- **Key imports from @fluentui/react-components**: Button, CounterBadge, Card, CardHeader, Accordion/AccordionItem/AccordionHeader/AccordionPanel, Textarea, Text, Subtitle2, Caption1, Body1Strong, MessageBar, MessageBarBody, makeStyles, tokens.

### 2025-07-29 — Fluent 2 font inheritance fix for Playground
- **Root cause**: `FluentProvider` sets `--fontFamilyBase` on its wrapper div, but browsers apply their own default `font-family` to `<button>` elements, overriding CSS inheritance. Raw `<button>` scenario items never picked up Segoe UI Variable.
- **Fix**: Added `fontFamily: tokens.fontFamilyBase` to: `playgroundPage` (root-level cascade), `scenarioBtn` (critical — buttons don't inherit font), `scenarioLabel`, `scenarioDesc`, `logItem`. Also added `font-family: var(--fontFamilyBase)` to `.playground-page` in `playground.css` as fallback.
- **Key lesson**: When mixing raw HTML elements with Fluent UI components inside `FluentProvider`, always explicitly set `fontFamily: tokens.fontFamilyBase` on `<button>`, `<input>`, `<select>`, and `<textarea>` elements — they never inherit font from parent due to browser UA stylesheet. `<span>` and `<div>` do inherit, but being explicit prevents regressions.
- **Monospace already correct**: `jsonTextarea` and `surfaceIdText` already had `fontFamily: tokens.fontFamilyMonospace`.
- **Build**: Vite production build passes — 2539 modules, no errors.

### 2025-07-29 — Full Fluent UI v9 migration of A2UI renderers + custom components
- **Scope**: Migrated ALL 18 A2UI basic catalog renderers + 4 kickstart custom components + `utils.ts` from raw HTML elements to Fluent UI React v9 components.
- **Basic catalog** (in `packages/web/src/vendor/a2ui/react/catalog/basic/components/`):
  - **Button.tsx**: `<button>` → `FluentButton` with `appearance` mapping (primary/transparent/secondary).
  - **Text.tsx**: `<h1>`-`<h5>`, `<caption>`, `<span>` → Title1/Title2/Title3/Subtitle1/Subtitle2/Caption1/Body1.
  - **Card.tsx**: `<div>` with shadow → `FluentCard`.
  - **Tabs.tsx**: `<div>+<button>` → `TabList` + `Tab` with `selectedValue`/`onTabSelect`.
  - **TextField.tsx**: `<input>`, `<textarea>`, `<label>` → `Input`/`Textarea` wrapped in `Field`.
  - **CheckBox.tsx**: `<input type="checkbox">` + `<label>` → `Checkbox` wrapped in `Field`.
  - **Slider.tsx**: `<input type="range">` → `FluentSlider` + `Label` + `Body1`.
  - **ChoicePicker.tsx**: radio/checkbox/chip modes → `FluentRadioGroup`/`Radio`, `Checkbox`, `ToggleButton`, `Input`, `Label`.
  - **Divider.tsx**: `<div>` line → `FluentDivider`.
  - **Modal.tsx**: custom overlay → `Dialog`/`DialogSurface`/`DialogBody`/`DialogContent`/`DialogActions`.
  - **List.tsx**, **Row.tsx**, **Column.tsx**: structural `<div>` kept but styled with `makeStyles` + tokens.
  - **DateTimeInput.tsx**: `<input>` + `<label>` → `Input` in `Field`.
  - **Image.tsx**: `<img>` → `FluentImage` with `fit`/`shape` props.
  - **Icon.tsx**: `<span class="material-symbols-outlined">` → `Body1` with `makeStyles`.
  - **AudioPlayer.tsx**: `<span>` → `Caption1`; `<audio>` kept (no Fluent equivalent).
  - **Video.tsx**: `<video>` kept; styled with `makeStyles` + tokens.
  - **ChildList.tsx**: No changes (structural React.Fragment).
- **Custom components** (in `packages/web/src/catalog/components/`):
  - **RadioGroup.tsx**: raw `<div>` cards → `Card` + `CardHeader` + `Badge` + `Body1`/`Caption1`.
  - **ProgressSteps.tsx**: raw `<div>` dots/labels → `Caption1` + `Badge` + `makeStyles` with tokens for colors.
  - **FormGroup.tsx**: raw `<div>` + `<span>` → `Card` + `CardHeader` + `Subtitle2` + `Badge`.
  - **CodeBlock.tsx**: raw `<div>` + `<button>` → `Card` + `Button` + `Body1`/`Caption1` + `CopyRegular`/`CheckmarkRegular` icons. Kept `<pre>/<code>` styled with `tokens.fontFamilyMonospace`.
- **utils.ts**: Replaced hardcoded pixel values and color strings with Fluent tokens: `LEAF_MARGIN` → `tokens.spacingVerticalS`, `CONTAINER_PADDING` → `tokens.spacingHorizontalL`, `STANDARD_BORDER` → `tokens.colorNeutralStroke1`, `STANDARD_RADIUS` → `tokens.borderRadiusMedium`.
- **Pattern preserved**: All components still use `createReactComponent(Api, renderFn)` adapter pattern. No adapter changes.
- **No inline color/size hardcodes**: All hardcoded `#ccc`, `#666`, `#fff`, `#007bff`, `rgba(...)`, pixel font sizes replaced with tokens.
- **Build**: Vite production build passes — 2539 modules, no errors.

### 2025-07-29 — Fluent UI v9 override catalog (non-vendor)
- **Architecture**: Created `packages/web/src/catalog/fluent-components/` directory with 18 Fluent UI v9 component implementations + `ChildList` utility + `index.ts` barrel. These override the vendor basic catalog components using A2UI's `Catalog` Map overwrite behavior — later entries with the same `.name` replace earlier ones.
- **Override pattern**: Each file imports the same `{Component}Api` from `../../vendor/a2ui/web_core/basic_catalog/index` (ensuring `.name` matches vendor) and uses `createReactComponent` from the adapter. Vendor files are never modified.
- **kickstart-catalog.ts update**: Added `...fluentOverrides` array between `basicCatalog.components` spread and custom components. Order: vendor (18 basic) → fluent overrides (18 same-name replacements) → custom (RadioGroup, FormGroup, CodeBlock, ProgressSteps).
- **Components already Fluent**: Button, Text, Card, Tabs, TextField, CheckBox, Slider were already using Fluent UI v9 in the vendor — override files match those patterns with corrected import paths.
- **Components newly Fluent**: ChoicePicker (RadioGroup/Radio/Checkbox/ToggleButton), Divider (FluentDivider), Modal (Dialog/DialogSurface/DialogBody/DialogContent), DateTimeInput (Input/Field), Image (FluentImage with shape/fit), Icon (makeStyles+tokens), AudioPlayer (Caption1), Video (makeStyles+tokens), Row/Column/List (makeStyles+tokens with ChildList).
- **Custom components verified**: RadioGroup, FormGroup, CodeBlock, ProgressSteps were already migrated to Fluent UI v9 in a prior session — no changes needed.
- **Build**: Vite production build passes — 2559 modules, zero TypeScript errors.


### 2026-04-09 — JSON viewer added to Playground page
- **Feature**: Added tabbed interface to Playground right panel allowing users to switch between "Preview" and "JSON" views for selected scenarios.
- **Implementation**: Used Fluent UI React v9 TabList and Tab components. JSON is displayed in a monospace code block with proper indentation (JSON.stringify with 2 spaces).
- **State management**: Added selectedTab ('preview' | 'json') and selectedScenario (ScenarioDef | null) state. Scenario selection auto-switches to preview tab.
- **JSON generation**: For scenarios with generate() functions, JSON is extracted by calling the function and stringifying the result. For keyword-based scenarios, shows a note explaining they're driven by demo-scenarios.ts.
- **Styling**: Added 	absContainer, jsonViewerContainer, and jsonCodeBlock styles using Fluent UI tokens for colors and spacing. JSON code block uses 	okens.fontFamilyMonospace, colorNeutralBackground3 background, and orderRadiusMedium.
- **Layout**: Tabs sit in a fixed header above the scrollable content area. Both Preview and JSON views maintain the scrolling behavior defined in playground.css.
- **File paths**: packages/web/src/pages/Playground.tsx (main implementation).

### 2026-04-10 — Fixed session memory bug (LLM conversation history)
- **Root cause**: Frontend session IDs (session-{timestamp}-{random}) never matched backend session IDs (UUIDs from randomUUID()), causing backend to create a new session every message.
- **Solution**: Added backendSessionId field to Session type to bridge frontend and backend session ID systems.
- **Streaming hook**: Updated useStreaming.ts to capture sessionId from SSE done event (already in StreamEvent type). Added third parameter to onComplete callback: sessionId?: string.
- **Mock streaming**: Updated useMockStreaming.ts callback signature to match (passes undefined for sessionId).
- **Session management**: Added updateSession() method to useSessions.ts to update session metadata (like backendSessionId).
- **App integration**: In App.tsx, read activeSession.backendSessionId before calling streaming.send(). On first response, store the received sessionId via updateSession(). On subsequent messages, pass the stored backendSessionId to the backend instead of the frontend session ID.
- **Pattern**: Frontend session ID is UI-only; backend session ID (UUID) holds the actual conversation history. The backendSessionId field maps between the two.
- **Key files**: types.ts, useStreaming.ts, useMockStreaming.ts, useSessions.ts, App.tsx.

### 2026-04-10 — Fluent 2 Polish Round — Syntax Highlighting, Markdown Control, Component Audit
- **Part 1: CodeBlock Syntax Highlighting**: Updated `packages/web/src/catalog/components/CodeBlock.tsx` to support syntax highlighting using highlight.js. Installed `highlight.js` package and registered 10+ common languages (JavaScript, TypeScript, Python, Java, C#, JSON, XML/HTML, CSS, Bash, Markdown). Uses `hljs.highlight()` when `props.language` is provided, falls back to `hljs.highlightAuto()` otherwise. Renders highlighted HTML via `dangerouslySetInnerHTML`. Imported `highlight.js/styles/vs.css` theme that complements Fluent 2's neutral palette. Added `useMemo` to avoid re-highlighting on every render.
- **Part 2: Markdown A2UI Component**: Created new custom component at `packages/web/src/catalog/components/Markdown.tsx`. Installed `react-markdown` and `remark-gfm` for GitHub-flavored markdown support. Schema: `{ content: DynamicStringSchema }`. Uses `makeStyles` exclusively — no raw CSS or inline styles. All rendered HTML elements styled with Fluent 2 tokens: headings use `tokens.fontSize*`/`fontWeightSemibold`, body text uses `fontSizeBase300`/`lineHeightBase300`, inline code uses `colorNeutralBackground3` background, code blocks delegate to highlight.js, links use `colorBrandForeground1`, blockquotes have left border with `colorBrandStroke1`, tables use Fluent-style borders/padding, lists use proper spacing with `tokens.spacingVerticalS`. Registered component in `kickstart-catalog.ts` alongside other custom components.
- **Part 3: Fluent 2 Component Audit**: Audited ALL components in `fluent-components/` and `components/` directories plus `Playground.tsx` for Fluent 2 compliance. **Fixed violations**:
  - **Modal.tsx**: Replaced inline styles (`style={{display: 'inline-block'}}`, `style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}`) with `makeStyles` classes using tokens.
  - **Icon.tsx**: Changed hardcoded `fontSize: '24px'` to `tokens.fontSizeBase500`.
  - **Video.tsx**: Moved inline `style={{aspectRatio: '16/9'}}` into `makeStyles` class.
  - **ProgressSteps.tsx**: Added `fontFamily: tokens.fontFamilyBase` to dot styles.
  - **Playground.tsx**: Replaced 7 inline styles (`style={{textTransform: 'uppercase', letterSpacing: '0.04em'}}`, `style={{marginTop: tokens.spacingVerticalXS}}`, `style={{...}}`) with `makeStyles` classes. Changed hardcoded `gap: '2px'` to `gap: tokens.spacingVerticalXXS`. All components now follow the audit checklist: no hardcoded px/hex/rgb values, all spacing/fonts/colors use tokens, no raw HTML elements where Fluent equivalents exist.
- **Build verification**: Ran `npx vite build` from `packages/web/` — build passed with zero TypeScript errors. 2826 modules transformed, 1.08 MB bundle (302 KB gzipped).
- **Pattern**: All three components (CodeBlock, Markdown, and all audited components) use `@fluentui/react-components` primitives, `makeStyles` + tokens for styling, and the A2UI adapter pattern (`createReactComponent`).

### 2025-07-30 — Playground JSON viewer fix for keyword-based scenarios
- **Problem**: `getScenarioJson()` in `Playground.tsx` showed a useless placeholder object for keyword-based Kickstart Scenarios instead of actual A2UI messages. Users saw `{ "note": "This scenario is driven by demo-scenarios.ts keyword: ..." }` in the JSON tab.
- **Fix**: Replaced the placeholder with real demo engine calls — same pattern as `injectScenario()`: `resetDemoState()` + `getDemoResponse()` (with the burn-turn-1 trick for non-welcome keywords). Returns actual `a2uiMessages` JSON. Demo state reset is harmless here since `injectScenario` already ran when user clicked the scenario.
- **UX improvement**: Added a brief scenario help description at the top of the left sidebar explaining the two scenario categories (Kickstart Scenarios vs Basic Controls) and how to use Preview/JSON tabs. Styled with `scenarioHelp` class using Fluent tokens.
- **Build**: Vite build passes, zero errors.

### 2026-04-09 — Polish Round Summary — Session Closure
- **Scenario JSON tab fix**: Fixed `getScenarioJson()` to show real A2UI JSON for keyword-based scenarios instead of placeholder. Decision: `.squad/decisions/inbox/fry-playground-json-viewer.md` (merged to decisions.md).
- **Fluent 2 syntax highlighting**: Installed highlight.js, registered 10+ languages, applied VS theme. CodeBlock now renders syntax-highlighted code with `useMemo` performance optimization. Decision: Part 1 of `.squad/decisions/inbox/fry-fluent2-polish.md`.
- **Markdown component**: Created `Markdown.tsx` using react-markdown + remark-gfm. All elements styled with Fluent 2 tokens via makeStyles. Code blocks delegate to highlight.js. Registered in kickstart-catalog.ts. Decision: Part 2 of fry-fluent2-polish.md.
- **Component audit**: Audited Modal, Icon, Video, ProgressSteps, Playground for Fluent 2 compliance. Removed all inline styles, replaced hardcoded px/hex/rgb with tokens. Zero raw HTML elements. Decision: Part 3 of fry-fluent2-polish.md.
- **Session ID bridge**: Implemented backendSessionId field to map frontend UI session IDs to backend conversation session UUIDs. LLM now has full history across messages. Decision: `.squad/decisions/inbox/fry-session-id-fix.md` (merged to decisions.md).
- **Build status**: `npx vite build` passes, 302 KB gzipped bundle.
- **Dependencies added**: highlight.js, react-markdown, remark-gfm.
- **Git commits**: 54c8573 (scenario JSON fix), e97e8ee (Fluent 2 polish).
- **Decisions merged**: All 5 inbox files (fry-fluent2-polish, fry-playground-json-viewer, fry-scenario-json-fix, fry-session-id-fix) appended to `.squad/decisions.md`.

### 2026-01-XX — Playground Redesign — Gallery Layout (Masonry Cards)

- **Architecture**: Complete redesign from split-pane to masonry card gallery layout. Removed left sidebar accordion + right panel split. New design: top navigation tabs (Gallery / Create) + responsive masonry grid.
  
- **Gallery View**: All scenarios (~23 total) render simultaneously as live A2UI previews in a masonry grid. Uses CSS multi-column layout (`column-count` with responsive breakpoints: 1 col mobile → 2 cols at 640px → 3 cols at 1024px → 4 cols at 1280px). Each card uses `break-inside: avoid` for proper masonry behavior. Variable card heights based on content.

- **Gallery Cards**: Created `GalleryCard` component — memoized, isolated A2UI state per card. Each card has its own `useA2UI()` instance, generating surfaces on mount via `useMemo()`. Structure: label (Caption1, uppercase, muted) + card body (live A2UI surface). Styling: `tokens.colorNeutralBackground1` with 80% opacity, `tokens.borderRadiusXLarge`, `tokens.colorNeutralStroke2` border, shadow on hover (`tokens.shadow4` → `tokens.shadow8` transition).

- **Detail View**: Click any gallery card → opens Fluent UI `Dialog` with full-size surface + tabbed JSON viewer. Dialog has Preview/JSON tabs. Preview shows full surface rendering; JSON shows raw A2UI messages (same `getScenarioJson()` logic as before). Close button uses `Dismiss24Regular` icon.

- **Create Tab**: Moved custom JSON editor from left accordion to separate "Create" tab (TabList at top). Editor has full-width textarea + "Render JSON" button. Rendered custom surfaces display below editor in stacked cards. "Clear All" button in top bar (only visible on Create tab).

- **Search/Filter**: Added `SearchBox` in top bar (Gallery tab only) to filter scenarios by label/description. Uses `useMemo()` for filtered list. Count badge updates dynamically based on filter results.

- **CSS Layout**: `playground.css` now defines masonry grid layout (`.playground-gallery` with `column-count` breakpoints), scroll containers (`.playground-gallery-scroll`, `.playground-create-scroll`), and rendered surfaces wrapper. All component-level styles moved to `makeStyles` in Playground.tsx.

- **Performance**: Each `GalleryCard` wrapped in `React.memo()` since scenarios are static. Batch surface generation happens on mount per card — no re-renders unless dialog state changes.

- **Component Removal**: Removed Accordion, AccordionItem, AccordionHeader, AccordionPanel imports. Removed activity log section. Removed "Load All" button. Removed split-pane CSS rules.

- **Key Files**: 
  - `packages/web/src/pages/Playground.tsx` — Major rewrite (~350 lines, down from ~516)
  - `packages/web/css/playground.css` — Replaced split-pane with masonry grid rules
  - No changes to: `playground-scenarios.ts`, `A2UISurfaceWrapper.tsx`, `useA2UI.ts`

- **Build**: `npx vite build` passes, 2826 modules, 301 KB gzipped. Zero TypeScript errors.

- **User Experience**: Gallery feels like a component showcase (inspired by A2UI Composer). All scenarios visible at once — no need to click through accordion items. Search/filter for quick navigation. Click card → inspect details/JSON in modal.

- **Pattern**: Isolated surface generation per gallery card (each card owns its A2UI state). Main app state manages dialog visibility + selected scenario. Custom JSON editor has separate A2UI instance to avoid cross-contamination.


## Learnings

### Advanced Playground Scenarios (2025-07-28)

Added 12 new scenarios across 4 groups to test A2UI capabilities beyond basic component rendering:

- **Data Binding Scenarios**: Created scenarios showing updateDataModel messages plus components with path bindings like { path: "/data/path" }. Pattern: create surface, update data model, render components with path bindings. Key insight: data model updates must come BEFORE components reference those paths (or components will display undefined until next update). Multi-step sequences test reactive updates.

- **Events & Actions**: Button actions with event structure containing name and context. Context can contain literal values OR path bindings (appName: { path: '/app/name' }). Form submit pattern: gather all field values via context paths in single event. Function call actions use functionCall structure with call name and args — not executed in playground but validates JSON structure.

- **Surface Lifecycle**: Multi-surface scenario returns array with multiple createSurface and updateComponents pairs. Surface update scenario sends updateComponents twice to same surfaceId (replaces components). Delete surface uses deleteSurface message type. Pattern: create A, create B, delete A, only B remains.

- **Dynamic Patterns**: Nested data scopes show path bindings like /services/0/name accessing object properties. Complex dashboard combines tabs plus data binding plus forms all in one scenario (tests deep nesting). Conditional content scenario sets boolean data model value to demonstrate path resolution for non-string types.

- **Type Safety**: All scenarios cast A2uiComponent[] where needed since dynamic values with path property don't match simple string type. Type assertion as A2uiMsg required for message objects to satisfy type checker.

- **Scenario Structure**: Each generate function returns A2uiMsg[]. Data-driven scenarios return arrays mixing createSurface, updateDataModel, updateComponents, deleteSurface messages. Used uid() helper for all surfaceIds. Kept CATALOG_ID constant for all surfaces.

- **Build Verification**: npx vite build completed successfully with zero TypeScript errors (2826 modules, 303 KB gzipped). All new scenarios type-check correctly.

