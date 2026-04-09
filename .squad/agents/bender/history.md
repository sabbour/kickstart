# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

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

### 2026-04-08: Kickstart Monorepo Scaffold

- **Rename:** Project renamed from "Imagine" to "Kickstart"
- **Monorepo:** npm workspaces at root with `packages/*` — core, mcp-server, web (web owned by Fry)
- **@kickstart/core:** Conversation engine (FSM with Phase enum: Understand→Clarify→Needs→Plan), A2UI catalog (JSON Schema draft/2020-12 with 7 custom components), K8s + GitHub Actions code generators
- **@kickstart/mcp-server:** MCP server using `@modelcontextprotocol/sdk`, 4 tools (kickstart, generate-manifests, check-status, action), A2UI responses via `application/json+a2ui` MIME type
- **A2UI Catalog:** Custom components: ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard — all extending basic_catalog (Text, Button, TextField, Row, Column, Card)
- **Infrastructure:** `infra/main.bicep` (SWA Standard), `infra/setup-entra.sh` (Entra app reg for CA Global Demos 2605 tenant), `infra/parameters.dev.json`, `.github/workflows/deploy-infra.yml` (OIDC login + Bicep deploy)
- **TypeScript:** ESM (type: module), strict mode, Node16 moduleResolution, project references between packages
- **Deleted:** `js/config.js` (old Imagine auth config with invalid client ID), `docs/github-oauth-setup.md` (replaced by `infra/README.md`)
- **Moved:** `staticwebapp.config.json` → `packages/web/staticwebapp.config.json`
- **Updated:** `deploy-swa.yml` app_location changed from "/" to "packages/web"
- **Key paths:** `packages/core/src/`, `packages/mcp-server/src/`, `infra/`, `packages/web/staticwebapp.config.json`

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
- **Cross-referencing:** All 5 docs link to each other where relevant.
- **Key lesson:** The task description said 7 standard components including "Tabs" but the actual catalog has 6 (no Tabs). Always document from source code, not specs.

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


### 2026-04-08: System prompt emoji rule + demo response cleanup
- **System prompt evolution**: Added Core Rule #1 at the top of system prompt: "Never use emoji. All responses must be text-only, no emoji characters." This is the first rule checked by the LLM during inference, signaling importance.
- **Demo engine response cleanup**: Stripped 8 emojis from hardcoded demo responses across all phases:
  - Discover phase: removed 2 emojis (🎯 goal icon, 🚀 rocket)
  - Design phase: removed 2 emojis (🏗️ architecture, 📊 diagram indicator)
  - Generate phase: removed 2 emojis (⚡ generation, 📝 manifest)
  - Review phase: removed 2 emojis (✅ review, 🎉 completion)
- **No architectural change**: Demo flow behavior identical, just text is emoji-free. All phases still auto-advance correctly.
- **Alignment**: System prompt now enforces emoji ban globally for all LLM responses. Demo engine serves as reference implementation (emoji-free).
- **Test status**: No failures — emoji removal is text-only, does not affect phase transitions or response parsing.
- **Decision context**: Implements user directive from decision inbox: "LLM responses must not contain emojis"

### 2025-07-25: Per-Track Prompt Addendums and Inspirations Endpoint

- **Track addendums:** Added `WEB_APP_ADDENDUM` (~250 words) and `AGENTIC_APP_ADDENDUM` (~300 words) as exported constants in `packages/web/js/prompts.js`. Web-app addendum covers Dockerfiles, CI/CD, database connectivity, scaling, multi-stage builds. Agentic-app addendum covers KAITO for GPU model serving, RAGEngine for managed RAG, LangChain/Semantic Kernel patterns, Azure OpenAI integration.
- **buildSystemPrompt() signature:** Added optional third parameter `track` (string). When `'web-app'` or `'agentic-app'`, the corresponding addendum is appended after the known-info block.
- **Engine wiring:** Demo engine passes track from closure to `buildSystemPrompt()`. API engine updated to accept and forward `track` parameter. `createEngine()` factory passes track to both code paths.
- **Inspirations endpoint:** `GET /api/inspirations` at `packages/web/api/src/functions/inspirations.ts`. Returns `InspirationIdea[]` (title, subtitle, prompt). Uses Azure OpenAI if env vars are configured (temperature 0.9, max 1500 tokens, raw JSON response). Falls back to shuffled hardcoded ideas (mirrored from `app.js` `INSPIRATION_IDEAS`). Graceful degradation — if OpenAI call fails, logs warning and serves fallback.
- **Pattern followed:** Matches `converse.ts` structure — `app.http()` registration, anonymous auth, proper error handling with context logging.
- **No emojis:** LLM generation prompt for inspirations explicitly says "No emoji."

### 2026-04-08: SWA Entra ID Authentication Setup

- **Auth provider:** SWA built-in `azureActiveDirectory` identity provider (Standard tier feature). Config in `staticwebapp.config.json` under `auth.identityProviders.azureActiveDirectory`.
- **Setting references, not values:** `clientIdSettingName: "AZURE_CLIENT_ID"`, `clientSecretSettingName: "AZURE_CLIENT_SECRET"` — these reference SWA app settings, not literal secrets.
- **Tenant:** `d91aa5af-8c1e-442c-b77c-0b92988b387b` (CA Global Demos 2605). OpenID issuer: `https://login.microsoftonline.com/{tenant}/v2.0`.
- **Client ID:** `e71a23c6-aeb4-459a-88fc-07ff96fc9b92` — safe to store in Bicep params and source.
- **Client secret:** Must be set manually via `az staticwebapp appsettings set` or Azure Portal. Never committed.
- **Route auth model:** `/api/*` requires `authenticated` role. Static assets (HTML/CSS/JS) are public. `/login` and `/logout` are convenience redirects to `/.auth/login/aad` and `/.auth/logout`. 401 responses auto-redirect to login.
- **Bicep additions:** `entraClientId` param sets `AZURE_CLIENT_ID` app setting via `Microsoft.Web/staticSites/config` resource. `customDomainHostname` param creates `Microsoft.Web/staticSites/customDomains` resource (requires DNS CNAME pre-verification).
- **deploy-swa.yml unchanged:** SWA deploy action doesn't need auth config — app settings are managed by Bicep/Portal, not the GitHub Action.

### 2026-04-08: Dual-Model Backend (Chat + Codex Responses API)

- **Deployment env vars:** `AZURE_OPENAI_CHAT_DEPLOYMENT` (e.g. `gpt-5.3-chat`) for conversation, `AZURE_OPENAI_CODEX_DEPLOYMENT` (e.g. `gpt-5.3-codex`) for code generation. Fallback: `AZURE_OPENAI_DEPLOYMENT` for backward compatibility (existing single-model setups keep working).
- **Responses API for Codex:** Azure OpenAI Codex endpoint uses `POST /openai/deployments/{deployment}/responses?api-version=2025-03-01-preview`. System prompt in `instructions` field, user messages in `input`. Streaming uses `response.output_text.delta` SSE events (different from Chat Completions `choices[0].delta.content`).
- **New endpoint:** `POST /api/generate` dedicated to code generation. Accepts `prompt` and `type` (dockerfile, kubernetes, pipeline, bicep, generic). Returns streaming code generation with type-specific system instructions. Cleaner separation from conversation flow.
- **Client:** `openai-client.ts` extended with `generateCode(prompt, type)` method. Uses Codex deployment when available, falls back to chat deployment for backward compatibility.
- **Config:** `local.settings.json` updated with `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_CODEX_DEPLOYMENT` examples. Bicep params updated to pass both deployments via SWA app settings.
- **Committed:** 6e4c31d includes openai-client.ts refactor + /api/generate endpoint + updated local.settings.json.
- **Ahmed's model preferences still active:** claude-opus-4.6 for code, claude-haiku-4.5 for non-code (noted for LLM selection logic if needed).
- **Key files:** `packages/web/staticwebapp.config.json`, `infra/main.bicep`, `infra/parameters.dev.json`, `infra/README.md`

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

### 2026-04-08: Virtual Filesystem & File Editor (Phase 2 — Spark)

- **VirtualFileSystem service:** In-memory `Map<string, VirtualFile>` with `useSyncExternalStore` compatibility (subscribe + getSnapshot). Path normalization strips leading slashes, collapses duplicates, forward-slashes only. Language detection via extension map + filename map (Dockerfile, Makefile, etc.).
- **Tree generation:** Flat file list → nested `FileTreeNode[]` via path splitting. Directories sorted before files, alphabetical within each group. Auto-expanded by default.
- **FileEditor component:** Three-part panel — FileTree (220px dark sidebar), CodeView (dark VS Code-style code area), wired into Layout as a right column slot.
- **Demo file generation:** `populateDemoFiles()` stagger-writes 6 realistic AKS deployment files (Dockerfile, deployment.yaml, service.yaml, GitHub Actions workflow, Express app, package.json) with a brief `generating` → `complete` animation per file.
- **Layout pattern:** Added `fileEditor` and `hasFiles` props to Layout component. `has-files` CSS class on `.app-layout` enables 3-column mode (Sidebar | Chat | FileEditor).
- **CSS theming:** file-editor.css uses VS Code dark palette (#1e1e1e, #252526, #333333) with project CSS custom properties (spacing, radius, font-family-mono). Generating state uses pulse animation.
- **Key files:** `packages/web/src/services/virtual-fs.ts`, `packages/web/src/components/FileEditor/`, `packages/web/css/file-editor.css`
- **openai-client.ts:** Exports 4 functions — `chatCompletion`, `chatCompletionStream` (Chat Completions API), `codexCompletion`, `codexCompletionStream` (Responses API). Plus `isConfigured()` helper. All types exported.
- **New endpoint:** `POST /api/generate` — code generation endpoint. Accepts `{ prompt, type?, context? }` where type is `dockerfile|kubernetes|pipeline|bicep|generic`. Each type has tailored system instructions. Supports SSE streaming. Uses codex model with temperature 0.2.
- **inspirations.ts:** Updated `isOpenAIConfigured()` to accept `AZURE_OPENAI_CHAT_DEPLOYMENT` as alternative to `AZURE_OPENAI_DEPLOYMENT`.
- **local.settings.json:** Added `AZURE_OPENAI_CHAT_DEPLOYMENT: "gpt-5.3-chat"` and `AZURE_OPENAI_CODEX_DEPLOYMENT: "gpt-5.3-codex"`.
- **Key files:** `packages/web/api/src/lib/openai-client.ts`, `packages/web/api/src/functions/generate.ts`, `packages/web/api/local.settings.json`

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

### 2026-04-09: React/Vite Migration + A2UI v0.9 Vendor (Phase 1a)

- **Vendored A2UI v0.9:** Copied `renderers/react/src/v0_9/` and `renderers/web_core/src/v0_9/` from google/A2UI into `packages/web/src/vendor/a2ui/`. Excluded test files. Included JSON schemas from `specification/v0_9/json/`. Apache 2.0 LICENSE included.
- **Import path rewrite:** All `@a2ui/web_core/v0_9` imports in vendored React files → relative paths. Stripped `.js` extensions from web_core internal imports. Removed `with {type: 'json'}` import assertions (Vite handles JSON natively).
- **A2UI npm dependencies:** `@preact/signals-core`, `date-fns`, `zod`, `zod-to-json-schema` — all required by web_core runtime.
- **React/Vite scaffold:** `packages/web/` now has Vite + React 19 + TypeScript. `vite build` produces ~360KB JS bundle (452 modules). `dist/` is the output directory.
- **Vite config:** `@vitejs/plugin-react`, `@` → `src/` alias, `/api` proxy to `localhost:7071`, `json.stringify: true` for large JSON schema imports.
- **tsconfig:** `moduleResolution: "bundler"`, `jsx: "react-jsx"`, strict mode, `@/*` path alias.
- **index.html updated:** Added `<div id="root">` and `<script type="module" src="/src/main.tsx">`. Old vanilla `js/app.js` script removed (old JS files kept in `js/` for now).
- **App.tsx proof-of-concept:** Renders A2UI minimal catalog (Text + Button in a Column) via `SurfaceModel` + `MessageProcessor` + `A2uiSurface` component. Proves vendor integration works end-to-end.
- **DO NOT TOUCH:** `packages/web/api/` (Azure Functions backend, separate build/deploy). `packages/web/js/`, `css/`, `assets/` kept as-is for now.
- **Key files:** `packages/web/package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/vendor/a2ui/`

### 2026-04-09: JSON Envelope + A2UI v0.9 Backend Rewrite

- **Killed regex extraction:** Removed `~~~a2ui` fenced-block parsing from the LLM response pipeline. Backend now expects pure JSON from the LLM.
- **JSON envelope format:** LLM outputs `{"message":"...","a2ui":[...],"actions":[]}`. `response_format: { type: "json_object" }` enforced in Azure OpenAI calls.
- **New response-processor:** Created `packages/core/src/services/response-processor.ts` — parses JSON envelope, validates A2UI messages (createSurface, updateComponents, updateDataModel, deleteSurface), graceful fallback to plain text on invalid JSON. No regex.
- **System prompt rewrite:** Teaches LLM the full JSON envelope format with all 23 components (18 basic + 5 custom). Includes 2 complete example responses. Flat adjacency list format with id-based references.
- **A2UI v0.9 catalog:** Rewrote `kickstart-catalog.json` — 18 basic components (Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput) + 5 custom (CostEstimate, ArchitectureDiagram, FileEditor, AuthCard, DeploymentProgress). Components use `"component"` field (not `"type"`), flat `"children"` id arrays.
- **Phase prompts:** All 6 phases rewritten with opinionated descriptions and JSON envelope examples. ChoicePicker for selections, Tabs for multi-section views, FileEditor for code, DeploymentProgress for tracking.
- **Typed SSE events:** converse.ts now emits `event: chunk` (raw deltas), `event: message` (parsed text), `event: a2ui` (per-message), `event: done` (metadata), `event: error`.
- **openai-client.ts:** Added `responseFormat` option to `ChatCompletionOptions`, passed as `response_format` in both streaming and non-streaming calls.
- **Tests:** 47 tests pass — 12 catalog (updated for 23 components), 12 phases, 12 machine, 11 new response-processor tests (JSON parsing, fallbacks, malformed messages, edge cases).
- **Key files changed:** `packages/core/src/prompts/system-prompt.ts`, `packages/core/src/services/response-processor.ts` (NEW), `packages/core/src/engine/phases.ts`, `packages/core/src/catalog/kickstart-catalog.json`, `packages/core/src/catalog/index.ts`, `packages/web/api/src/functions/converse.ts`, `packages/web/api/src/lib/openai-client.ts`
