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

