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
