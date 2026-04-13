# Bender — History Archive

Old entries (>7 days)

### 2025-01-21: Azure Static Web Apps Deployment Setup

- **Deployment approach:** Azure Static Web Apps via GitHub Actions (`Azure/static-web-apps-deploy@v1`)
- **App structure:** Static HTML/CSS/JS served from repo root (`app_location: "/"`)
- **No build step:** Portal Prototyper framework is zero-dependency, so `skip_app_build: true`
- **PR previews:** SWA automatically creates staging environments for every PR
- **Secret management:** `AZURE_STATIC_WEB_APPS_API_TOKEN` required in GitHub secrets
- **Config file:** `staticwebapp.config.json` at repo root handles routing, headers, MIME types
- **Custom domains:** Configured via Azure Portal after initial deployment (temp: imagine.prototypes.aks.azure.sabbour.me, future: imagine.aks.azure.com)
- **Security headers:** Enforced at CDN edge via `globalHeaders` in SWA config (nosniff, frame deny, XSS protection)
- **Workflow structure:** Two jobs — `deploy` (on push/PR open) and `close_staging` (on PR close)


### 2025-07-24: Auth Registration Setup

- **Entra App Registration:** "Imagine - AKS Onboarding", App ID `7a630e18-8f49-404e-8454-228b13089c57`, Object ID `1652d168-11ad-4f5c-84c9-4689cceb1284`
- **Tenant:** `72f988bf-86f1-41af-91ab-2d7cd011db47` (Microsoft internal, single-tenant only)
- **Auth flow:** SPA Auth Code Flow with PKCE via MSAL.js — no client secret for the SPA
- **SPA redirect URIs:** localhost:8080, localhost:4280, staging domain, production domain
- **API permissions:** Microsoft Graph `User.Read` + Azure Service Management `user_impersonation` (both delegated)
- **MSFT internal tenant quirk:** `--service-management-reference` is REQUIRED for `az ad app create`. Used `940efe13-531b-418e-bf86-62248ccec86c` (Ahmed's existing service tree reference).
- **Subscription note:** Target subscription `4498459e-01d5-4a3f-b07e-8f1f36598c16` wasn't in the available list, but app registrations are tenant-level, so used `90ab3701-83f0-4ba1-a90a-f2e68683adab` which is in the same tenant.
- **Config file:** `js/config.js` — environment-aware (auto-detects hostname), IIFE pattern, frozen config object
- **GitHub OAuth:** Requires manual creation via GitHub UI. Setup docs at `docs/github-oauth-setup.md`
- **Secret management:** Client IDs in source code (not secrets), client secrets in GitHub Secrets / SWA app settings only
- **Key files:** `js/config.js`, `docs/github-oauth-setup.md`, `.squad/decisions/inbox/bender-auth-setup.md`


### 2025-07-25: 6-Phase Engine with GitHub Catalog and K8s-Delayed Prompts

- **Phase rework:** Replaced 4-phase flow (Understand→Clarify→Needs→Plan) with 6 phases: Discover→Design→Generate→Review→Handoff→Deploy
- **K8s delay principle:** Phases 1-3 never mention Kubernetes. AKS framed as "scalable app platform". K8s terminology only surfaces in Review (if asked) and Deploy (openly). Code comments in generated artifacts use correct K8s names — that's fine, it's code.
- **Ship It pattern enforced:** Every phase prompt says "ONE concept per turn. Never show more than one decision point per response."
- **Catalog additions:** RepoPicker (select/create GitHub repo), WorkflowStatus (GitHub Actions runs), CodespaceLink (deep-link to Codespaces/vscode.dev), AppOverview (app-at-a-glance card, avoids K8s jargon)
- **Component union updated:** All 4 new components added to the `Component` oneOf in `kickstart-catalog.json`
- **mcp-server fix:** Updated `kickstart.ts` to use Phase.Discover + non-K8s welcome message
- **Key files changed:** `packages/core/src/engine/types.ts`, `phases.ts`, `machine.ts`, `packages/core/src/catalog/kickstart-catalog.json`, `packages/mcp-server/src/tools/kickstart.ts`


### 2025-07-25: Layer 2 System Prompt (D10 Three-Layer Architecture)

- **Created:** `packages/core/src/prompts/system-prompt.ts` — Layer 2 of D10's three-layer prompt architecture
- **Persona:** Kickstart = friendly deployment guide. Conversational, confident, never condescending. Target user: dev with an app, no cloud deploy yet.
- **Core rules encoded:** ONE concept per turn, frame AKS as "app platform" never "K8s cluster", progressive disclosure of K8s (zero in Discover/Design/Generate, guarded in Review, open in Deploy), smart defaults over questions, infer don't ask.
- **Deployment Safeguards (D13):** DS001-DS013 defined as typed `DeploymentSafeguard[]`. Errors block deployment, warnings suggest improvements. Auto-fix flags per rule. All user-facing labels avoid K8s terminology — violations are "deployment improvements."
- **`buildSystemPrompt(context)`:** Composes Layer 2 (persona/rules) + Layer 3 (phase prompt from phases.ts) with template variable interpolation. Serializes appDefinition, azureContext, githubContext into phase templates.
- **Barrel exports:** `prompts/index.ts` re-exports types and values. `core/src/index.ts` updated to include all prompt exports.
- **Pre-existing build issue:** `catalog.test.ts` has 4 TS errors (missing node types) unrelated to this change. Prompts compile clean.


### 2025-07-25: MCP Server — System Prompt, Catalog Negotiation, Safeguards

- **kickstart.ts:** Now imports `buildSystemPrompt` and `DEPLOYMENT_SAFEGUARDS` from `@kickstart/core`. Composes dynamic system prompt per phase and injects it as a system message. Maintains engine state in-memory (`Map<string, ConversationState>`). Accepts `A2UICapability` to degrade responses for non-Kickstart clients.
- **a2ui.ts:** Added `KICKSTART_CATALOG_ID` constant, `resolveA2UICapability()` function (kickstart → basic → none tiers), `degradeToBasic()` fallback that wraps custom components in Card+Text for basic_catalog clients. `createA2UIResource()` now returns `null` for clients with no A2UI support — all callers conditionally push resources.
- **generate-manifests.ts:** After generating K8s manifests, runs `validateManifests()` against all 13 DEPLOYMENT_SAFEGUARDS via regex/string matching on YAML content. Builds an A2UI Card with pass/fail per safeguard. Failures framed as "deployment improvements" per user directive. Text fallback always included.
- **index.ts:** Session store has TTL-based cleanup (1 hour, sweep every 10 min via `setInterval().unref()`). `clientCapability` resolved from MCP handshake catalogs and threaded to tool handlers. `deleteEngineState` imported to clean up engine state alongside sessions.
- **Ripple fix:** `action.ts` and `check-status.ts` updated to handle nullable `createA2UIResource()` return.


### 2025-07-25: SWA API Backend + MCP Converse Tool

- **SWA API:** Created `packages/web/api/` — Azure Functions v4 (Node.js) API for the web surface LLM proxy.
- **Converse endpoint:** `POST /api/converse` — accepts `{ sessionId?, message }`, manages sessions, calls Azure OpenAI, returns `{ sessionId, phase, message, a2ui?, systemPrompt? }`. Supports SSE streaming via `Accept: text/event-stream`.
- **OpenAI client:** Fetch-based Azure OpenAI wrapper (`src/lib/openai-client.ts`) — reads `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY` from env vars. Supports both standard and streaming chat completions.
- **Session store:** In-memory Map with 1-hour TTL cleanup (`src/lib/session-store.ts`) — same pattern as MCP server. Stores conversation messages, engine state, and app definition.
- **Workspace setup:** Added `packages/web/api` to root `workspaces` array. API depends on `@kickstart/core` via workspace resolution.
- **MCP converse tool:** `packages/mcp-server/src/tools/converse.ts` — processes user messages through the phase machine, recomposes system prompt per phase, returns A2UI phase indicator. Registered in `index.ts`.
- **Deploy workflow:** Updated `deploy-swa.yml` — added Node.js setup, `npm ci`, pre-builds core+api, sets `api_location: "packages/web/api"`, `skip_api_build: false`.
- **Root test script:** Added `"test": "npx vitest run"` to root `package.json` + `vitest.config.ts` that excludes Playwright e2e specs.
- **Gitignore:** Added `local.settings.json` to `.gitignore` (Azure Functions local dev settings).
- **Key paths:** `packages/web/api/`, `packages/mcp-server/src/tools/converse.ts`, `vitest.config.ts`, `.github/workflows/deploy-swa.yml`


### 2025-07-25: Technical Deep-Dive Documentation

- **Created 5 docs** in `docs/`: `api-reference.md`, `mcp-server.md`, `a2ui-catalog.md`, `prompt-architecture.md`, `deployment.md`
- **API Reference:** Full `POST /api/converse` docs — request/response types, SSE streaming format (NDJSON chunks with final metadata event), error codes, session lifecycle (1h TTL, 10min sweep), OpenAI client config (3 env vars, fetch-based, api-version 2024-08-01-preview)
- **MCP Server:** All 5 tools documented (kickstart, converse, generate-manifests, check-status, action) with parameter tables from actual Zod schemas. A2UI 3-tier catalog negotiation (kickstart→basic→none). MCP config JSON for VS Code, Claude Code, and npx.
- **A2UI Catalog:** All 17 components documented with JSON examples and property tables from `kickstart-catalog.json`. Standard (6): Text, Button, TextField, Row, Column, Card. Kickstart Custom (7): ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard. GitHub (4): RepoPicker, WorkflowStatus, CodespaceLink, AppOverview. Includes step-by-step guide for adding new components.
- **Prompt Architecture:** Three-layer architecture (Layer 1 Azure Skills future, Layer 2 system prompt, Layer 3 phase prompts). All 6 phase prompt summaries with template variables and exit conditions. Full DS001–DS013 safeguard table. `buildSystemPrompt()` flow and `interpolate()` mechanics documented.
- **Deployment:** Bicep template walkthrough, both GitHub Actions workflows (deploy-swa.yml and deploy-infra.yml), OIDC auth for infra, Entra app registration setup, all secrets/env vars, local dev instructions with SWA CLI.


### 2025-07-25: MCP App HTML Surface for IDE

- **Created:** `packages/mcp-server/src/app/kickstart-app.html` — self-contained HTML file with inline CSS (Fluent 2 tokens + dark mode) and JS (A2UI renderer + chat UI + postMessage protocol)
- **Protocol layer:** `packages/mcp-server/src/app/protocol.ts` — typed postMessage protocol with `parseAppMessage()` validator and `handleAppMessage()` router. Three inbound types: `kickstart`, `converse`, `action`. Two outbound types: `response` (with sessionId, phase, a2ui, text), `error`.
- **Server integration:** `index.ts` updated — HTML loaded at startup via `readFileSync`, served as `text/html` resource at `kickstart://app/main`, new `app-message` tool relays postMessage payloads through existing tool handlers.
- **Build:** `package.json` build script chains `tsc && copy HTML to dist/app/` so the HTML file ships alongside compiled JS.
- **A2UI renderer:** All 18 component types ported from web surface's `a2ui-renderer.js` — adapted from ES module DOM API to plain self-contained JS. Components: Text, Button, TextField, Row, Column, Card, Tabs, ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard, RepoPicker, WorkflowStatus, CodespaceLink, AppOverview.
- **Session management:** Session ID stored in JS variable (no localStorage — sandboxed iframe can't access it). Auto-kickstart on load. Session loss on iframe recreation is acceptable for Phase 1.
- **Testing:** 30 new tests — 19 for protocol (parseAppMessage validation, handleAppMessage routing for all message types, A2UI capability tiers), 11 for HTML structure (DOM IDs, postMessage protocol keywords, all renderers, dark mode, Fluent tokens, 6 phases, auto-kickstart).
- **Key files:** `packages/mcp-server/src/app/kickstart-app.html`, `packages/mcp-server/src/app/protocol.ts`, `packages/mcp-server/src/index.ts`

### 2026-04-08 — Wave 7 Coordination with Fry (Chat-first web redesign)
- **Parallel work**: Fry completed chat-first UX redesign (commit d431093) — removed Portal Prototyper shell entirely, made chat the primary 760px-centered full-width experience, added file viewer sidebar (appears on GENERATE), togglable sessions sidebar, 3-turn conversational Discover phase.
- **Dual-surface parity**: Web surface now conversation-first with inline A2UI rendering. IDE surface (MCP App) mirrors this with self-contained HTML renderer (18 component types, no external loads). Both share the same A2UI component catalog definitions.
- **Session persistence deferred**: Coordinator researched Azure Cloud Shell storage; found no way to programmatically provision for first-time users. Demo flows work without persistent storage for Phase 1. No GitHub Gists per user directive.
- **Dark mode decision conflict**: Fry implemented dark mode (`@media prefers-color-scheme: dark`) as part of chat-first directive matching reference app. Later directive requested light-only. Dark mode currently live in d431093; Scribe flagged conflict in decisions.md for user clarification.
- **Files committed**: e80b44f (MCP App HTML surface). Orchestration log: bender-wave7.md.


### 2025-07-25: No-Emoji Rule Enforcement

- **System prompt rule:** Added "No emoji" as Core Rule #1 in `KICKSTART_SYSTEM_PROMPT` (Layer 2). Explicitly prohibits emoji in all LLM output — prose, labels, component fields, generated content. Renumbered existing rules 1-6 → 2-7.
- **Demo responses cleaned:** Removed all emoji from `packages/web/js/engine.js` — welcome messages (wave emoji), architecture icons (globe, cloud, database, lightning, arrows), and file viewer reference (folder emoji). Replaced icon emojis with plain text descriptors (`'app'`, `'cloud'`, `'database'`, `'cache'`, `'cicd'`).
- **No emojis in safeguards:** Verified `DEPLOYMENT_SAFEGUARDS` array and all `friendlyLabel` strings are already emoji-free.
- **Key insight:** Prompt-level enforcement (telling the LLM "don't use emoji") is the primary control. Demo response cleanup is secondary but ensures the scripted flow models the expected emoji-free output style.



### 2025-07-25: Per-Track Prompt Addendums and Inspirations Endpoint

- **Track addendums:** Added `WEB_APP_ADDENDUM` (~250 words) and `AGENTIC_APP_ADDENDUM` (~300 words) as exported constants in `packages/web/js/prompts.js`. Web-app addendum covers Dockerfiles, CI/CD, database connectivity, scaling, multi-stage builds. Agentic-app addendum covers KAITO for GPU model serving, RAGEngine for managed RAG, LangChain/Semantic Kernel patterns, Azure OpenAI integration.
- **buildSystemPrompt() signature:** Added optional third parameter `track` (string). When `'web-app'` or `'agentic-app'`, the corresponding addendum is appended after the known-info block.
- **Engine wiring:** Demo engine passes track from closure to `buildSystemPrompt()`. API engine updated to accept and forward `track` parameter. `createEngine()` factory passes track to both code paths.
- **Inspirations endpoint:** `GET /api/inspirations` at `packages/web/api/src/functions/inspirations.ts`. Returns `InspirationIdea[]` (title, subtitle, prompt). Uses Azure OpenAI if env vars are configured (temperature 0.9, max 1500 tokens, raw JSON response). Falls back to shuffled hardcoded ideas (mirrored from `app.js` `INSPIRATION_IDEAS`). Graceful degradation — if OpenAI call fails, logs warning and serves fallback.
- **Pattern followed:** Matches `converse.ts` structure — `app.http()` registration, anonymous auth, proper error handling with context logging.
- **No emojis:** LLM generation prompt for inspirations explicitly says "No emoji."


### 2025-07-27: SWA + Entra Tenant Investigation

- **Two tenants clarified:**
  - CloudNative (`caglobaldemos2605`): `d91aa5af-8c1e-442c-b77c-0b92988b387b` — SWA lives here, subscription `4498459e-01d5-4a3f-b07e-8f1f36598c16`
  - Microsoft internal: `72f988bf-86f1-41af-91ab-2d7cd011db47` — old Imagine app reg lived here
- **Old app reg dead:** `7a630e18-8f49-404e-8454-228b13089c57` ("Imagine - AKS Onboarding") was in Microsoft internal tenant. Does NOT exist in CloudNative tenant.
- **New app reg confirmed:** `e71a23c6-aeb4-459a-88fc-07ff96fc9b92` ("Kickstart - AKS Onboarding") in CloudNative tenant. Object ID `bf6ab22e-d654-4a27-bb35-6df7631f8023`. Multi-tenant (`AzureADMultipleOrgs`).
- **SWA app settings:** `AZURE_CLIENT_ID` correctly set to `e71a23c6-aeb4-459a-88fc-07ff96fc9b92`. `AZURE_CLIENT_SECRET` is MISSING — must be generated and set.
- **openIdIssuer:** Points to CloudNative tenant — CORRECT for SWA built-in auth.
- **Redirect URI gap:** App has SPA redirect URIs (localhost:4280, localhost:8080, kickstart.aks.azure.sabbour.me, kickstart.aks.azure.com) but NO web platform redirect URIs. SWA built-in auth callback needs web redirects: `https://<hostname>/.auth/login/aad/callback`.
- **SWA hostname:** `proud-mud-0660b8110.6.azurestaticapps.net`, custom domain `kickstart.aks.azure.sabbour.me`
- **decisions.md stale:** Still references old app ID `7a630e18-8f49-404e-8454-228b13089c57` and Microsoft internal tenant. Needs Scribe update.
- **Deployment token retrieved:** Available for `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret.
- **Workflow (`deploy-swa.yml`):** Looks correct — builds core+api, deploys from packages/web with api_location packages/web/api.


### 2025-07-28: SWA Auth Fix — Entra App + Secrets Configured

- **Client secret created:** Generated 2-year credential "SWA Auth Secret" on Entra app `e71a23c6-aeb4-459a-88fc-07ff96fc9b92` (CloudNative tenant).
- **SWA app settings set:** `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` both present on `kickstart-web-dev` SWA.
- **Web redirect URIs added:** `https://proud-mud-0660b8110.6.azurestaticapps.net/.auth/login/aad/callback` and `https://kickstart.aks.azure.sabbour.me/.auth/login/aad/callback` — fixes the missing server-side callback that SWA built-in auth requires.
- **SPA redirect URIs preserved:** localhost:4280, localhost:8080, kickstart.aks.azure.sabbour.me, kickstart.aks.azure.com still intact.
- **GitHub secret set:** `AZURE_STATIC_WEB_APPS_API_TOKEN` on `sabbour/kickstart` — enables deploy workflow.
- **Key insight:** SWA built-in auth uses server-side (Web platform) redirect URIs with `/.auth/login/aad/callback` path, NOT SPA redirects. Missing web redirects cause the "AADSTS50011: redirect URI mismatch" error.


### 2025-07-28: Dual-Model Support (Chat + Codex)

- **Architecture:** Two Azure OpenAI models sharing one endpoint/key — `gpt-5.3-chat` for conversation (Chat Completions API), `gpt-5.3-codex` for code generation (Responses API).
- **Env vars:** `AZURE_OPENAI_CHAT_DEPLOYMENT` and `AZURE_OPENAI_CODEX_DEPLOYMENT` added. `AZURE_OPENAI_DEPLOYMENT` kept as fallback for both. Same `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` for both models.
- **Responses API shape:** `POST {endpoint}/openai/deployments/{codex}/responses?api-version=2025-03-01-preview`. Body uses `input` (non-system messages) + `instructions` (system prompt). Response has `output[].content[].text` where type=`output_text`. Streaming uses `response.output_text.delta` events with `delta` field.


### 2025-07-28: SWA Auth Fix — "Empty stream response" 401 Bug

- **Root cause:** Two independent auth systems fighting each other. MSAL popup set tokens in sessionStorage but never created the SWA session cookie. SWA's route auth (`allowedRoles: ["authenticated"]`) requires a session cookie from `/.auth/login/aad`. Without it, API calls got 401→302 redirect to login page HTML, which `readStream()` parsed as "Empty stream response."
- **Fix:** Rewrote `packages/web/js/auth.js` to use SWA built-in auth for login/logout (full-page redirect to `/.auth/login/aad` and `/.auth/logout`), keeping MSAL only for Graph API token acquisition (profile photos via `User.Read` scope).
- **SWA session state:** `initialize()` now fetches `/.auth/me` to get `clientPrincipal`. `isAuthenticated()` and `getUserInfo()` derive from `clientPrincipal` instead of MSAL's `currentAccount`.
- **MSAL cache change:** Switched from `sessionStorage` to `localStorage` so MSAL tokens survive the full-page redirect cycle.
- **Token fallback chain:** `getToken()` tries: (1) `acquireTokenSilent` with cached MSAL account, (2) `ssoSilent` with `loginHint` from `clientPrincipal.userDetails` (leverages existing Entra session), (3) `acquireTokenPopup` as last resort.
- **login/logout return `new Promise(() => {})`:** Never-resolving promise — page navigates away. Callers using `.then()` chains are unaffected because callbacks never fire (correct behavior).
- **app.js `/login` handler updated:** `Auth.login(); return;` — no `.then()` chain, just redirect and bail out of boot.
- **getUserInfo() parses SWA claims:** Reads `name` claim type for display name, `preferred_username` or email claim for email, falls back to `clientPrincipal.userDetails`.
- **No changes to:** `api-client.js` (relies on SWA cookie), `staticwebapp.config.json` (route auth stays), any config constants.
- **Key lesson:** SWA built-in auth and MSAL are complementary, not alternatives. SWA handles session cookies for API route auth; MSAL handles delegated tokens for external APIs (Graph, ARM). Never use MSAL alone for login when SWA route auth is in play.


### 2025-07-26: B-23 — A2UI Action Dispatch System

- **Problem:** A2UI components fired actions but the handler was `console.log` — a complete no-op. Buttons, forms, and selections did nothing.
- **Solution:** Created `useActionDispatch` hook that routes A2UI `A2uiClientAction` events based on action name prefixes:
  - Default / no prefix → `reply`: translates action to natural language message (`[Action: {name}] {context}`) and re-prompts the LLM (per decision F17)
  - `navigate:` / `nav:` prefix → `navigate`: fires optional local callback then re-prompts LLM with navigation intent
  - `api:` prefix → `api`: stubbed for future ServiceConnector, falls back to LLM re-prompt
- **Architecture:** `useActionDispatch` returns an `ActionHandler` function. `useA2UI` now accepts an optional `actionHandler` via `A2UIOptions`. The handler is stored in a ref inside `useA2UI` so the `MessageProcessor` (created once) always calls the latest handler version. Playground callers pass no handler (falls back to console.log).
- **Key pattern:** Actions re-prompt the LLM (not direct dispatch). The LLM stays in full control of all state transitions. Action context is serialized as `key: value` pairs in the message.
- **Circular dep avoidance:** `useActionDispatch` uses `useRef` for options so it can reference `handleSendMessage` before it's defined in the render function. The closure only executes on user interaction (post-render).
- **Key files:** `packages/web/src/hooks/useActionDispatch.ts` (NEW), `packages/web/src/hooks/useA2UI.ts`, `packages/web/src/App.tsx`


### 2025-07-28: Auto-Continue Middleware (B-21)

- **New file:** `packages/core/src/engine/auto-continue.ts` — pure functions for auto-continuation logic. `shouldAutoContinue(name)` detects `complete:`/`continue:` prefixes. `synthesizeContinuationPrompt(action)` builds LLM-friendly prompt from action name + context. `synthesizeNavigationPrompt(phase, context)` builds phase-transition prompt. `AUTO_CONTINUE_MAX_CONSECUTIVE = 3` constant.
- **Exports wired:** New symbols exported through `engine/index.ts` → `core/src/index.ts` so web surface can import from `@kickstart/core`.
- **useActionDispatch refactor:** Added `auto-continue` and `navigate` as routing categories. `complete:`/`continue:` prefixed actions synthesize completion prompts and call `onAutoContinue`. `navigate:` actions synthesize navigation prompts and auto-continue (phase transitions). Rate limiting: max 3 consecutive auto-continues via `consecutiveRef`; warns and no-ops when exceeded. Now returns `{ handler, resetConsecutiveCount, consecutiveAutoContinueCount }` instead of just the handler. `resetConsecutiveCount()` called by App.tsx on manual sends.
- **UI:** `ChatMessage.isAutoContinue?: boolean` added to types. `ChatMessage.tsx` renders a subtle "Continuing..." indicator (italic, muted) instead of the user bubble for auto-continue messages. CSS class `.chat-bubble.auto-continue` / `.auto-continue-label` added to `components.css`.
- **App.tsx wiring:** `handleSendMessage(text, isAutoContinue = false)` — skips counter reset for auto-continues. Passes `isAutoContinue` flag to `ChatMessage` creation. `onAutoContinue` callback routes to `handleSendMessage(msg, true)`.
- **All 359 tests pass.** Build clean.
- **Key insight:** `useActionDispatch` uses `optionsRef` to always call the latest options — safe to reference `handleSendMessage` before it's defined because the callbacks are only invoked after render.


### 2025-07-29: B-15 — Skill Resolver Middleware

- **skill-resolver.ts** lives in `packages/core/src/engine/` — exports `resolveSkills(phase, kits)` and `formatSkillsSection(skills)`.
- **Priority chain**: `kit.phasePrompts[phase]` > keyword-heuristic filter of `kit.prompts` > include all (unclassified).
- **Discover phase** gets a synthetic tool-listing prompt auto-built from kit.tools so the LLM always knows what it can call.
- **IntegrationKit type** extended with `phasePrompts?: Partial<Record<Phase, string[]>>` — backward compat (flat `prompts` still works).
- **buildSystemPrompt** gains `kitPrompts?: string[]` context field — appended as `## Available Capabilities` after Layer 3 (phase prompt).
- **converse endpoint** now calls `resolveSkills` on every turn and injects the fresh system prompt, so the LLM gets correct capabilities as the phase advances.
- **azure-kit + github-kit** have full `phasePrompts` coverage for all 6 phases.
- 28 new tests, 359 total — zero regressions.


### 2025-07-27: Content Safety Guardrails

- **System prompt hardening:** Added safety clause to all 4 LLM system prompts that generate inspiration ideas (2 in `inspirations.ts`, 2 in `widget-inspirations.ts`). Clause appended to end of existing prompt content — forbids weapons, violence, illegal, adult, gambling content.
- **User input validation:** Created `packages/web/api/src/lib/content-safety.ts` — lightweight LLM pre-flight check on user messages in the converse endpoint. Uses chat deployment with `maxTokens: 10` and `temperature: 0` for fast, deterministic classification.
- **Graceful degradation:** If Azure OpenAI is not configured, the safety check is skipped (returns safe). If the safety check itself throws, it also returns safe — never blocks users due to infrastructure issues.
- **Response format:** Unsafe content returns HTTP 400 with a user-friendly error message guiding them toward appropriate app ideas.
- **Key files:** `packages/web/api/src/lib/content-safety.ts`, `packages/web/api/src/functions/converse.ts`, `packages/web/api/src/functions/inspirations.ts`, `packages/web/api/src/functions/widget-inspirations.ts`


### 2025-07-27: Dedicated /api/playground Endpoint for A2UI Component Generation

- **Problem:** Playground Create tab was calling `/api/converse` which runs the full Kickstart AKS onboarding flow — wrong context for free-form A2UI component design.
- **Solution:** Created `packages/web/api/src/functions/playground.ts` — a standalone Azure Functions HTTP endpoint at `POST /api/playground`.
- **Architecture:** Uses its own in-memory session store (Map-based with 1-hour TTL, same pattern as session-store.ts), separate from the main onboarding session state. No dependency on @kickstart/core engine phases.
- **System prompt:** Custom prompt for A2UI component design: instructs LLM to return JSON `{ message, a2ui }` envelope, documents all available component types (TextBlock, Container, ColumnSet, Chart, Table, Badge, etc.), nesting rules, and guidelines.
- **JSON mode:** Uses `response_format: { type: "json_object" }` to ensure valid JSON from the LLM. Falls back gracefully if LLM returns non-JSON.
- **Frontend wiring:** Updated `Playground.tsx` `handleCreateSend` to call `/api/playground` directly via fetch (non-streaming JSON) instead of `useStreaming` hook (which was SSE-based and hardcoded to `/api/converse`). Replaced `createStreaming.isStreaming` state with simple `createLoading` boolean.
- **A2UI surface rendering:** LLM-returned `a2ui` array components are wrapped as A2UI messages and fed through `createA2ui.processMessages()` — same surface system used by the rest of the app.
- **Content safety:** Reuses existing `checkContentSafety` from `../lib/content-safety.ts`.
- **Key files:** `packages/web/api/src/functions/playground.ts`, `packages/web/src/pages/Playground.tsx`


### 2025-07-26: Widget Inspiration Prompts — Dev/Deploy/Ops Focus

- **Prompt rewrite:** Rewrote system prompts in `widget-inspirations.ts` (both streaming and non-streaming paths) to focus exclusively on Kubernetes/AKS deployment, CI/CD pipelines, container workflows, cloud infrastructure monitoring, and developer productivity for cloud-native apps.
- **One-shot specificity:** Prompts now instruct the LLM to specify which A2UI component types to use, what realistic sample data to show, what interactions to include, and how to lay out the component — so a single AI response can produce a complete working component.
- **Fallback overhaul:** Replaced 12 generic fallback ideas with 12 highly detailed, one-shottable prompts covering: Deployment Rollout Tracker, Namespace Resource Dashboard, Container Image Scanner, CI/CD Pipeline Monitor, Interactive Scaling Panel, Kubernetes Event Stream, Helm Release Manager, Service Endpoint Health, GitOps Sync Status, Pod Log Viewer, AKS Cluster Overview, Secret/ConfigMap Browser.
- **Playground prompt upgrade:** Rewrote `playground.ts` system prompt with explicit "one-shot component design rules", a full worked example (deployment rollout tracker), and guidance on realistic sample data, rich layouts (4-6 component types), meaningful color/status mapping, and interactive controls.
- **Constraints preserved:** Temperature=1 (reasoning model requirement), maxTokens=400 for streaming, maxTokens=300 for non-streaming inspire, safety clauses retained in all prompts.
- **Key files:** `packages/web/api/src/functions/widget-inspirations.ts`, `packages/web/api/src/functions/playground.ts`


### 2025-07-26: Fix #54 — Playground Create Tab "[Loading root...]" Bug

- **Root cause (structural):** `handleCreateSend` in `Playground.tsx` created A2UI messages with `createSurface` + a `body` field, but the A2UI protocol ignores `body` on createSurface messages. No `updateComponents` message was ever sent, so surfaces were created empty — hence "[Loading root...]" (the renderer couldn't find the root component).
- **Root cause (format):** The LLM system prompt in `playground.ts` instructed the LLM to output nested tree format (`{type, id, props, children: [{nested}]}`) with non-catalog type names (TextBlock, Container, ColumnSet, etc.). A2UI expects flat components (`{id, component, ...props, children: ["id-refs"]}`) with catalog names (Text, Column, Row, etc.).
- **Fix (system prompt):** Rewrote the playground system prompt to teach the LLM the flat A2UI format with correct catalog component names, children-by-ID-reference pattern, and mandatory `id: "root"` entry point. Updated the example to show flat format.
- **Fix (frontend):** Replaced broken single-message pattern with proper `createSurface` → `updateComponents` two-message sequence. Added `normalizePlaygroundComponents()` safety-net transformer that handles both flat and nested LLM output, maps unknown type names to catalog equivalents (TextBlock→Text, Container→Column, etc.), converts nested children to ID references, and ensures a root component always exists.
- **A2UI protocol rule:** `createSurface` only creates an empty surface. Components must be added via a separate `updateComponents` message. One component MUST have `id: "root"`.
- **Key files:** `packages/web/src/pages/Playground.tsx`, `packages/web/api/src/functions/playground.ts`


### 2025-07-25: Changesets & Release Strategy (#53)

- **@changesets/cli** and **@changesets/changelog-github** installed as root devDependencies
- **Config:** `.changeset/config.json` — GitHub changelog format, all 3 packages linked (versions stay in sync), access restricted (no npm publish)
- **Scripts:** `npm run changeset`, `npm run changeset:version`, `npm run changeset:status` in root package.json
- **Release flow:** PRs include changesets → merge to main → `npx changeset version` bumps versions + collates CHANGELOG.md → `git tag vX.Y.Z` → `deploy-swa.yml` triggers on `v*` tags
- **CI:** Non-blocking `changeset status` step added to `.github/workflows/ci.yml` (warns if changeset missing, doesn't fail build)
- **Docs:** `RELEASING.md` has the full workflow; `CONTRIBUTING.md` links to it
- **Key files:** `.changeset/config.json`, `RELEASING.md`, `.github/workflows/ci.yml`, `package.json`


### 2025-07-26: /api/action Anonymous Access Route (Issue #23)

- **Gap found:** `POST /api/action` endpoint existed on main (commit `4bbf64c`, B-24) with full implementation — action routing (reply/navigate/api), session handling, LLM re-prompting — but lacked its anonymous access route in `staticwebapp.config.json`.
- **Fix:** Added `/api/action` route with `allowedRoles: ["anonymous"]` to `packages/web/public/staticwebapp.config.json`, matching the pattern used by `/api/converse` and `/api/playground`.
- **SWA route ordering matters:** Anonymous routes for specific endpoints MUST appear before the catch-all `/api/*` authenticated rule. Otherwise the endpoint requires login.
- **Protocol tests:** 22 tests in `packages/mcp-server/src/__tests__/action-endpoint.test.ts` validate `parseAppMessage`/`handleAppMessage` for the action protocol layer.
- **PR:** #77 (draft), closes #23.

### 2025-07-25: ServicePack Security Conditions (Issue #30)

- **Transactional register:** If `onActivate` throws, full rollback — tools, connectors, ownership maps, and kit entry are reverted. Previous kit is restored on re-register rollback.
- **Transactional unregister:** If `onDeactivate` throws, kit stays registered — prevents partially torn-down state.
- **Cycle detection:** DFS-based `detectCycle()` on `register()` catches circular dependency chains (A→B→A, A→B→C→A). Walks existing dependency graph from each declared dep.
- **Auth schema validation:** `validateAuth()` runs before registration — rejects empty provider, empty scopes, scopes with empty strings. Warns on duplicate providers within same kit.
- **Trust model:** Documented on `IntegrationKit` interface and `IntegrationKitRegistry` class JSDoc — kits are trusted first-party code, no sandboxing.
- **ToolRegistry.unregister():** Added to support rollback (previously only APIConnectorRegistry had it).
- **ESLint rule:** `preserve-caught-error` requires `{ cause: err }` on re-thrown errors. Use eslint-disable comment for intentional `console.warn`.
- **Test count:** 61 total (45 original + 16 new for security conditions), all passing.



### 2025-07-26: Existing-Repo Analysis Protocol (#17, PR #110)

- **Issue:** #17 — Add existing-repo analysis protocol to githubKit Discover phase
- **PR:** #110 (draft)
- **New tools:** `github_repo_tree` (recursive file tree + key-file detection), `github_repo_file_read` (file content reader with base64 decode)
- **GitHubConnector additions:** `getTree(owner, repo, ref)` (Git Trees API, recursive), `getFileContent(owner, repo, path, ref)` (Contents API). Full stub/offline support for both.
- **New types:** `GitHubTree`, `GitHubTreeEntry`, `GitHubFileContent` — exported from `connectors/index.ts`
- **Key-file patterns:** 22 well-known files/dirs for deployment readiness detection (Dockerfile, package.json, go.mod, K8s manifests, CI workflows, etc.)
- **Base64 portability:** Used `globalThis.atob()` instead of Node.js `Buffer` — core package targets `lib: ["ES2022", "DOM"]` with no `@types/node`
- **Discover phase prompt:** Replaced single `github_repo_info` call with 4-step analysis protocol (metadata → file tree → read key manifests → summarize readiness). Max 5 file reads to stay within context limits.
- **Registration:** Both tools in `githubKit.tools[]` and `defaultRegistry`. Exports in `tools/index.ts`.
- **Test count:** 465 tests, all passing. Lint clean. Build clean.


### 2025-07-26: Per-Session Artifact Store with Quota Enforcement (#35)

- **Issue:** #35 — feat: Implement artifact store (B-17)
- **PR:** #116 (draft)
- **DP v2:** Posted on issue addressing Zapp's security review and Leela's architecture feedback
- **ToolContext pattern:** Added `ToolContext` interface (required, not optional) with `artifactStore: ArtifactStore`. All 11 core tools updated. Eliminates singleton fallback branches.
- **Quota enforcement:** `ArtifactStoreQuota` interface with `maxArtifacts` (100) and `maxSizeBytes` (10MB). `InMemoryArtifactStore.put()` throws `ArtifactQuotaExceededError` at write time. Running total tracked for O(1) enforcement.
- **Session isolation:** MCP server creates per-session `InMemoryArtifactStore` in `handleKickstart`. No singleton fallback in any tool — strict fail-closed isolation.
- **MCP manifest writing:** `handleGenerateManifests` now writes generated K8s manifests + GitHub Actions workflows to `session.artifactStore`.
- **SessionState:** Added optional `artifactStore?: ArtifactStore` field. Web frontend continues to use `defaultArtifactStore` singleton (one session per page load).
- **Size measurement:** Used `new TextEncoder().encode(content).byteLength` instead of `Buffer` — core package has no `@types/node`.
- **ToolRegistry:** `execute()` now requires `ToolContext` as third parameter, passed through to `tool.execute()`.
- **Tests:** Added quota enforcement tests (count/size limits, update delta, delete tracking), session isolation tests, context injection tests. All 506 tests pass, zero new lint errors.
- **Key decisions respected:** D:2026-04-10 Artifact Store Singleton Pattern — singleton remains for web, per-session is additive for MCP.


### 2025-07-25: Debug Metadata for SSE Streaming (v0.5.2)

- **Feature:** Added opt-in debug metadata to SSE streaming and JSON responses
- **Activation:** `x-kickstart-debug: true` header OR `?debug=true` query param
- **Debug payload:** `{ model, rawContent, renderDecisions[] }` — model deployment name, raw LLM output, and rendering decisions array
- **Backward compatible:** Debug fields only appear when explicitly requested; default responses unchanged
- **New file:** `packages/web/api/src/lib/debug-mode.ts` — `isDebugMode()`, `buildConverseDebugMeta()`, `buildGenerateDebugMeta()`
- **New export:** `getCodexDeploymentName()` in `openai-client.ts` (mirrors existing `getChatDeploymentName()`)
- **Converse endpoint:** Debug in both SSE `done` event and non-streaming JSON response
- **Generate endpoint:** Debug in both SSE `done` event and non-streaming JSON response
- **PR:** #135

### 2026-04-13 — Fix CSP violations: remove CDN script + migrate inline BUILD_SHA to Vite define
- **Problem:** Two CSP `script-src 'self'` violations on deployed SWA: (1) CDN `<script>` for `@fluentui/web-components` (leftover, unused), (2) inline `<script>` setting `window.__BUILD_SHA__`
- **Fix 1 — CDN removal:** Deleted `<script type="module" src="https://unpkg.com/@fluentui/web-components">` from `packages/web/index.html`; removed corresponding E2E route handler in `packages/web/e2e/helpers.ts`
- **Fix 2 — BUILD_SHA migration:** Moved `__BUILD_SHA__` from inline script to Vite `define` in `packages/web/vite.config.ts` (reads `GITHUB_SHA` env var); added type declaration in `packages/web/src/vite-env.d.ts`; updated consumers in `Landing.tsx` and `Playground.tsx` to use the Vite constant directly instead of `(window as any).__BUILD_SHA__`
- **CI cleanup:** Removed entire "Stamp build metadata" step from `.github/workflows/deploy-swa.yml` — both `sed` commands (BUILD_SHA and BUILD_VERSION) were dead code since Vite `define` handles both values at build time
- **Key files:** `packages/web/index.html`, `packages/web/vite.config.ts`, `packages/web/src/vite-env.d.ts`, `packages/web/e2e/helpers.ts`, `.github/workflows/deploy-swa.yml`, `packages/web/src/components/Landing.tsx`, `packages/web/src/pages/Playground.tsx`
