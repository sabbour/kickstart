# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

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
