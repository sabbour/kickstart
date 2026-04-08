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
