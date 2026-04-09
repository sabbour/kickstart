# Squad Decisions

## Active Decisions

### 2025-07-25: 6-phase engine with progressive K8s disclosure
**By:** Bender
**What:** Replaced 4-phase engine (Understand→Clarify→Needs→Plan) with 6 phases (Discover→Design→Generate→Review→Handoff→Deploy). All prompts rewritten to delay Kubernetes exposure — phases 1-3 frame AKS Automatic as "scalable app platform", K8s only surfaces in Review/Deploy. Added 4 GitHub-related A2UI components: RepoPicker, WorkflowStatus, CodespaceLink, AppOverview.
**Why:** User directive — core UX philosophy. Users should feel like they're deploying an app, not configuring Kubernetes. GitHub components needed for repo creation, CI/CD status, and Codespaces handoff flows.

# Decision: Auth Setup for Imagine App

**Author:** Bender (Backend Dev)
**Date:** 2025-07-24
**Status:** Accepted

## Context

Imagine needs two auth providers:
1. **Entra ID** — for Azure sign-in and ARM API calls on behalf of users
2. **GitHub OAuth** — for repo access, code push, and PR creation

The app is a SPA (HTML/CSS/JS) hosted on Azure Static Web Apps.

## Decisions

### 1. Entra ID: SPA Auth Code Flow with PKCE

**Choice:** Authorization Code Flow with PKCE (no client secret for the SPA).

**Why:**
- PKCE is the recommended flow for public clients (SPAs). It eliminates the need for a client secret on the frontend.
- The implicit flow is deprecated by Microsoft for new apps.
- MSAL.js v2+ handles PKCE automatically — zero custom crypto needed.
- ID tokens enabled for sign-in; access tokens requested on-demand for ARM scopes.

**App Registration:**
- **App ID:** `7a630e18-8f49-404e-8454-228b13089c57`
- **Tenant:** `72f988bf-86f1-41af-91ab-2d7cd011db47` (Microsoft internal, single-tenant)
- **SPA redirect URIs:** localhost:8080, localhost:4280, staging domain, production domain
- **Permissions:** Microsoft Graph `User.Read` (delegated) + Azure Service Management `user_impersonation` (delegated)

### 2. GitHub OAuth: Server-Side Code Exchange

**Choice:** Standard GitHub OAuth flow with server-side token exchange.

**Why:**
- GitHub OAuth requires a client secret to exchange the authorization code for an access token. This MUST happen server-side.
- The SPA initiates the redirect but never touches the client secret.
- Token exchange happens in an Azure Function (SWA API) or via SWA's built-in auth.
- Access tokens stored server-side; frontend gets a session cookie.

**Scopes:** `repo`, `user`, `workflow` — minimum needed for generated-code push and PR creation.

### 3. Secret Management

| Item | Where it lives | Secret? |
|---|---|---|
| Entra Client ID | `js/config.js` (source code) | No |
| Entra Tenant ID | `js/config.js` (source code) | No |
| GitHub OAuth Client ID | `js/config.js` (source code) | No |
| GitHub OAuth Client Secret | GitHub repo secrets + SWA app settings | **Yes** |
| User access tokens | Server-side session only | **Yes** |

**Principle:** If it's a client ID or tenant ID, it's public. If it's a secret or token, it lives in environment variables / GitHub Secrets / SWA app settings — never in source code.

### 4. Environment Awareness

The config file (`js/config.js`) auto-detects the current hostname and selects the correct redirect URI. No build step, no env files, no environment variables for the frontend — just runtime hostname detection.

## Consequences

- Frontend devs can run locally on port 8080 or 4280 without changing config
- A backend API (SWA API / Azure Function) is needed before GitHub OAuth works end-to-end
- Admin consent may be needed for the ARM `user_impersonation` scope in the Microsoft tenant
- The GitHub OAuth App must be created manually via the GitHub UI (see `docs/github-oauth-setup.md`)

# Decision: Kickstart Monorepo Architecture

**Date:** 2026-04-08
**Author:** Bender (Backend Dev)
**Status:** Implemented

## Context

Project renamed from Imagine to Kickstart. Codebase restructured from flat HTML/JS to a monorepo with npm workspaces.

## Decision

1. **Monorepo with npm workspaces:** `packages/core`, `packages/web`, `packages/mcp-server`
2. **TypeScript everywhere:** ESM, strict mode, Node16 module resolution, project references
3. **A2UI v0.9 Catalog:** JSON Schema (draft/2020-12) at `packages/core/src/catalog/kickstart-catalog.json` — 7 custom components extending basic_catalog
4. **Conversation engine:** Finite state machine with 4 phases (Understand → Clarify → Needs → Plan), pure transition functions
5. **MCP server:** 4 tools via `@modelcontextprotocol/sdk`, A2UI responses as `application/json+a2ui` embedded resources
6. **IaC:** Bicep for SWA (infra/main.bicep), shell script for Entra app reg (infra/setup-entra.sh)
7. **CI/CD:** deploy-infra.yml (OIDC + Bicep), existing deploy-swa.yml updated for packages/web

## Consequences

- Fry's web package must live at `packages/web/` and include `staticwebapp.config.json`
- Core package must be built before mcp-server (project references handle this)
- Old `js/config.js` and `docs/github-oauth-setup.md` are deleted — auth setup is now in `infra/`

# Decision: Azure Static Web Apps Deployment Strategy

**Date:** 2025-01-21  
**Author:** Bender  
**Status:** Proposed

## Context

Imagine is a static HTML/CSS/JS app built with the Portal Prototyper framework. It requires zero build tooling and should deploy seamlessly to Azure with minimal ops overhead.

## Decision

Deploy via **Azure Static Web Apps** using GitHub Actions and the official `Azure/static-web-apps-deploy@v1` action.

### Key choices:

1. **Deployment method:** GitHub Actions workflow (`.github/workflows/deploy-swa.yml`)
   - Triggers on push to `main` (production)
   - Triggers on PR open/sync (staging environments)
   - Closes staging environments on PR close

2. **App location:** Root directory (`app_location: "/"`)
   - Static assets served directly from repo root
   - No build step required (`skip_app_build: true`, `skip_api_build: true`)
   - Portal Prototyper framework is zero-dependency, so this keeps the structure clean

3. **Secret management:** 
   - Deployment token stored as `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret
   - Must be provisioned from Azure Portal or CLI during SWA resource creation

4. **SWA configuration:** `staticwebapp.config.json` at repo root
   - SPA-style routing fallback to `index.html`
   - Security headers (CSP, frame options, XSS protection)
   - MIME type enforcement
   - Custom domain support via Azure Portal

## Why Azure Static Web Apps?

- **Zero infra management:** No VMs, no Kubernetes, no load balancers to configure
- **Built-in global CDN:** Fast delivery worldwide without separate CDN setup
- **PR staging environments:** Automatic staging URLs for every PR (free preview testing)
- **Free tier sufficient:** No cost for this workload
- **Native GitHub integration:** Workflow is dead simple, secrets are scoped to the repo
- **Custom domain support:** Easy to migrate from temp domain to production domain

**Alternatives considered:**
- Azure Blob Storage + CDN: More manual setup, no PR previews
- GitHub Pages: No Azure-native deployment, can't easily integrate with AKS flow later
- Azure App Service: Overkill for static files, costs more

## Consequences

- **Secret setup required:** Ahmed must create the Azure SWA resource and add the deployment token to GitHub secrets
- **Deployment time:** ~30-60 seconds per deploy (faster than App Service, slower than Blob Storage)
- **Custom domains:** Must be configured separately via Azure Portal after initial deployment
- **No backend API support in this workflow:** If Imagine needs a backend later, we'll add Azure Functions to the SWA resource

## Implementation

Files created:
- `.github/workflows/deploy-swa.yml` — Deployment workflow
- `staticwebapp.config.json` — SWA runtime configuration

Next steps:
1. Ahmed provisions Azure SWA resource in subscription `4498459e-01d5-4a3f-b07e-8f1f36598c16`
2. Ahmed adds deployment token to GitHub repo secrets as `AZURE_STATIC_WEB_APPS_API_TOKEN`
3. Ahmed pushes first `index.html` to trigger initial deployment
4. Ahmed configures custom domain `imagine.prototypes.aks.azure.sabbour.me` in Azure Portal

### 2026-04-08T13:08: Architecture Override — Use A2UI Directly
**By:** Ahmed Sabbour (via Coordinator research)
**Overrides:** Leela Decision 3 ("A2UI Pattern, Not Library")
**Status:** Accepted

**What:** Use A2UI v0.9 directly with a custom Kickstart Catalog instead of adopting only the pattern.

**Why:** New research (conducted after Leela's review) reveals A2UI has deep MCP integration that solves our dual-surface problem at the protocol level:
1. **A2UI over MCP** — MCP servers return A2UI JSON as `application/json+a2ui` embedded resources. Catalog negotiation built into MCP handshake.
2. **Custom Catalogs** — Define a "Kickstart Catalog" (JSON Schema) with AKS-specific components. This is the recommended production approach.
3. **MCP Apps + A2UI** — MCP Apps can embed A2UI renderers internally, giving the IDE surface structured components (not just raw HTML).
4. **Text fallback** — Clients without A2UI support get text responses automatically.
5. **Bidirectional interactivity** — Button actions trigger tool calls back to the server.

**What changes:**
- `@kickstart/core` defines a Kickstart Catalog (JSON Schema extending basic_catalog)
- MCP server returns A2UI embedded resources with `application/json+a2ui` MIME type
- Web surface uses a Lit-based A2UI renderer styled with Fluent 2 / Portal Prototyper CSS
- Both surfaces share ONE catalog definition and ONE set of component schemas
- We save work by not inventing our own UI schema format, transport, negotiation, and action dispatch

**Custom Kickstart Catalog components (extending basic_catalog):**
- ConversationPhase — guided flow phase indicator
- CodeBlock — syntax-highlighted code with copy action
- ResourcePicker — Azure subscription/resource group/region selector
- DeploymentProgress — phase-by-phase deployment status
- ArchitectureDiagram — Mermaid diagram container
- CostEstimate — pricing breakdown card
- HandoffCard — "Continue in Codespaces" deep-link card

**All other Leela decisions (1, 2, 4-8) remain unchanged.**

# Decision: Prompt Strategy & MCP Server Delegation

**Author:** Coordinator  
**Date:** 2025-07-22  
**Status:** Accepted  
**Supersedes:** None  
**Related:** leela-kickstart-architecture Decision 4 (MCP tools first), coordinator-a2ui-override

## Context

Research into microsoft/azure-skills, Azure MCP Server, AKS MCP Server (Azure/aks-mcp),
and the Ship It (adaptive-ui-try-aks) system prompt is complete. The user emphasized:
"It becomes crucial to control the prompt we use to get the outcomes we want."

## Decision 9: Delegate Azure/AKS Operations to Existing MCP Servers

### Do NOT reimplement Azure or AKS tools

Kickstart's MCP server will NOT wrap `az` CLI commands or ARM APIs directly.
Instead, it delegates to:

1. **Azure MCP Server** (`@azure/mcp`) — 200+ structured tools across 40+ Azure services
   (resource inventory, monitoring, pricing, storage, databases, messaging)
2. **AKS MCP Server** (`Azure/aks-mcp`) — Full AKS lifecycle: CRUD clusters, node pools,
   networking, monitoring, diagnostics, kubectl, helm, cilium/hubble

### Kickstart's MCP server owns:

- **Conversation orchestration** — phase state machine, prompt assembly, context management
- **Code generation** — Dockerfiles, K8s manifests, Bicep, CI/CD workflows
- **Validation** — Deployment Safeguards (DS001-DS013), manifest compliance
- **Architecture planning** — Mermaid diagrams, cost estimation
- **Handoff** — GitHub repo creation, Codespaces deep-links

### In web surface:

The web app calls Azure/AKS APIs directly via MSAL-authenticated REST calls
(user's own token). No MCP server in the loop for Azure operations.

### In IDE surface:

The MCP server returns tool results + A2UI embedded resources. When the LLM
needs to interact with Azure, it calls Azure MCP Server / AKS MCP Server tools
(already available in the user's environment via azure-skills plugin).

## Decision 10: Layered Prompt Architecture

### Three prompt layers

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Phase-Specific Prompts                │
│  (one per conversation phase, narrow scope)     │
│  "Ask what the app does. ONE concept per turn." │
├─────────────────────────────────────────────────┤
│  Layer 2: Kickstart System Prompt               │
│  (persona, rules, guardrails, output format)    │
│  "You are Kickstart — a friendly guide..."      │
├─────────────────────────────────────────────────┤
│  Layer 1: Azure Skills (bundled)                │
│  (azure-kubernetes, azure-prepare, azure-deploy │
│   azure-validate, azure-cost, entra-app-reg)    │
│  Provides authoritative Azure domain knowledge  │
└─────────────────────────────────────────────────┘
```

### Layer 1: Azure Skills (bundled, read-only reference)

Bundle the relevant SKILL.md files from microsoft/azure-skills as context:
- `azure-kubernetes/SKILL.md` — AKS Automatic planning, Day-0 checklist
- `azure-prepare/SKILL.md` — Plan-first workflow pattern
- `azure-deploy/SKILL.md` — Deployment execution with validation
- `azure-validate/SKILL.md` — Pre-deployment checks
- `azure-cost/SKILL.md` — Cost optimization guidance

These are NOT injected as system prompts. They are loaded on-demand when the
conversation reaches a relevant phase (e.g., azure-kubernetes loads in PLAN phase).

### Layer 2: Kickstart System Prompt

Adapted from Ship It's BASE_SYSTEM_PROMPT but tailored for Kickstart:

**Persona:** "Kickstart — a friendly guide that gets your app running on AKS Automatic"
**Key rules (from Ship It, proven effective):**
- Frame AKS Automatic as a "scalable app platform", not "managed Kubernetes"
- ONE concept per turn — never show more than one decision point
- Progressive discovery through phases
- All generated K8s manifests MUST pass Deployment Safeguards (DS001-DS013)

**Key differences from Ship It:**
- Dual-surface aware (web vs IDE output formatting)
- A2UI JSON output for structured UI components
- Handoff-to-IDE flow (Ship It doesn't have this)
- No in-browser file viewer (files go to GitHub repo or Codespaces)

### Layer 3: Phase-Specific Prompts

Each conversation phase has its own prompt template with:
- Entry conditions (what state is required)
- Specific questions to ask
- Expected output schema
- Exit conditions (when to advance)
- Dynamic context injection (e.g., generated artifacts summary)

## Decision 11: Conversation Phases (adapted from Ship It)

### 6 phases for v1 (vs Ship It's 8):

| # | Phase     | Purpose                                    | Ship It Equivalent |
|---|-----------|--------------------------------------------|--------------------|
| 1 | DISCOVER  | What is the app? Language/framework?       | UNDERSTAND + CLARIFY |
| 2 | DESIGN    | What services needed? Architecture diagram | NEEDS + PLAN |
| 3 | GENERATE  | Create all deployment artifacts            | BUILD |
| 4 | REVIEW    | Validate manifests, show cost estimate     | REVIEW |
| 5 | HANDOFF   | Push to GitHub, open in Codespaces         | (new — Ship It deploys directly) |
| 6 | DEPLOY    | Optional: deploy from Codespaces/CI        | AZURE |

### Why fewer phases:
Ship It's UNDERSTAND/CLARIFY/NEEDS are all "discovery" — splitting them creates
unnecessary phase transitions. Kickstart collapses them into DISCOVER + DESIGN.

### Why HANDOFF is new:
Ship It deploys directly from the browser. Kickstart's philosophy is "web is the
kickstarter" — users take generated code to GitHub and continue in Codespaces/VSCode.

## Decision 12: Track System (Web App vs Agentic App)

Adopt Ship It's track concept:
- **web-app**: Standard web application deployment (Dockerfile, K8s, Bicep, CI/CD)
- **agentic-app**: AI agent deployment with KAITO/Azure OpenAI, RAGEngine, GPU nodes

Track is determined during DISCOVER phase and controls which addendum prompts
are injected into subsequent phases.

## Decision 13: Deployment Safeguards

Adopt Ship It's DS001-DS013 validation rules verbatim:
- DS001: resources.requests AND limits on every container
- DS002: livenessProbe and readinessProbe on every container
- DS003: runAsNonRoot: true
- DS004: allowPrivilegeEscalation: false
- DS005-DS008: No hostNetwork/hostPID/hostIPC, no privileged containers
- DS009: No :latest image tags
- DS010: readOnlyRootFilesystem: true where possible
- Plus: Gateway API mandatory, Workload Identity mandatory, ACR with AcrPull role

Auto-validation runs after each GENERATE turn. Auto-fix where possible.

## Decision 14: azure-skills Plugin Compatibility

For the IDE surface, recommend users install the azure-skills plugin:
```
/plugin install azure@azure-skills
```

This gives their LLM access to all 24 Azure skills + Azure MCP Server + Foundry MCP.
Kickstart's MCP server then provides the conversation orchestration layer on top.

For the web surface, Kickstart embeds the relevant skill knowledge directly in
its system prompts (Layer 1) since there's no plugin system in the browser.

## Rationale

1. **Don't reinvent the wheel** — Azure MCP Server has 200+ tools, AKS MCP has full
   cluster lifecycle. Reimplementing any of this is wasted effort.
2. **Prompt control is the differentiator** — Kickstart's value is the guided experience,
   not the underlying Azure tooling. The prompts define the UX.
3. **Ship It's patterns are battle-tested** — The 8-phase flow, safeguard validation,
   and "one concept per turn" rule are proven in production.
4. **Layered architecture enables iteration** — Can update Layer 2/3 prompts without
   touching the Azure skills layer. Can swap Azure skills versions independently.

### 2026-04-08: Auth requirements — Entra + GitHub OAuth
**By:** Ahmed Sabbour (via Copilot)
**What:** The app requires an Entra App Registration for Azure connectivity and a GitHub OAuth App for GitHub integration.
**Why:** User requirement — the app needs to connect to both Azure and GitHub on behalf of users.

### 2026-04-08T13:28:00Z: User directive — GitHub catalog components
**By:** Ahmed Sabbour (via Copilot)
**What:** The A2UI Kickstart Catalog needs GitHub-related components (e.g., RepoPicker, BranchSelector, WorkflowStatus, PRStatus, CodespaceLink) — not just Azure/K8s components.
**Why:** User request — the app involves GitHub integration (repo creation, CI/CD, Codespaces handoff) so the catalog must cover that surface too.

### 2026-04-08T13:28:00Z: User directive — Delay Kubernetes exposure
**By:** Ahmed Sabbour (via Copilot)
**What:** The app optimizes for AKS Automatic. Do NOT expose users to Kubernetes concepts early. Frame everything as "app platform" and delay K8s-specific details (manifests, pods, services) as late as possible in the conversation flow. Users should feel like they're deploying an app, not configuring Kubernetes.
**Why:** User request — core UX philosophy. Matches Ship It's "frame AKS Automatic as a scalable app platform, not managed Kubernetes" pattern but goes further: K8s concepts should be progressively disclosed only when necessary.

### 2026-04-08T12:58:00Z: User directive — Project pivot to Kickstart
**By:** Ahmed Sabbour (via Copilot)
**What:**
1. Rename project from "Imagine" to "Kickstart"
2. Create GitHub repo at sabbour/kickstart
3. Delete wrong Entra app registration (created in Microsoft corp tenant) — recreate in CA Global Demos 2605 tenant (caglobaldemos2605.onmicrosoft.com), subscription 4498459e-01d5-4a3f-b07e-8f1f36598c16
4. All IaC (SWA, OAuth App, Entra Registration) must be stored in repo with deployment workflows
5. Dual experience: web-based + IDE-based (VSCode/Claude Code via MCP Apps)
6. If we host the app, we provide the LLM. If running via MCP/MCP Apps, hook into user's LLM.
7. Web part is a kickstarter — users can continue in GitHub Codespaces or vscode.dev/azure
8. Research a2ui.org and MCP Apps for dynamic UI generation approaches
9. Figure out branching/worktree strategy for throughput and conflict reduction
**Why:** User request — foundational architecture pivot

### 2026-04-08: Model preference — Opus default for code work
**By:** Ahmed Sabbour (via Copilot)
**What:** Always use claude-opus-4.6 for anything other than non-code work (docs, planning, triage, changelogs). Non-code tasks use claude-haiku-4.5.
**Why:** User preference — quality-first for all code-producing tasks.

# Decision: Web package scaffold & patterns

**Author:** Fry  
**Date:** 2026-04-08  
**Status:** Implemented

## Context
Created the full `packages/web/` frontend scaffold for Kickstart.

## Decisions
1. **ES modules only** — All JS uses `<script type="module">` with static imports. No bundler needed.
2. **CSS custom properties for theming** — All design tokens live in `theme.css`. Swap that file to re-theme.
3. **Component factory pattern** — Framework components are functions returning DOM elements (not HTML strings). This gives us event binding and testability without a framework.
4. **A2UI renderer is extensible** — `registerRenderer(type, fn)` lets Bender's backend push new component types without frontend changes.
5. **EventBus for decoupling** — Lightweight pub/sub (`EventBus.emit/on`) connects Copilot panel actions to app logic without tight coupling.
6. **Auth reuses existing Entra config** — Same client ID and tenant from the repo-root `js/config.js`, moved into `packages/web/js/auth.js` as an ES module.

## Impact
- Bender: Wire `onSend` callback to conversation API; A2UI JSON from backend renders automatically via `renderA2UI()`.
- Hermes: Can test component factories in isolation (they return DOM elements).
- Leela: CSP header in `staticwebapp.config.json` — review for production tightening.

# Decision: Kickstart Architecture — Foundation Decisions

**Author:** Leela (Lead)
**Date:** 2026-04-08
**Status:** Accepted

## Context

Ahmed is pivoting from "Imagine" to "Kickstart" — a dual-surface AI-guided experience for deploying apps to AKS. Research completed on a2ui, MCP Apps, Portal Prototyper, and the Ship It reference app. These decisions set the architectural foundation.

---

## Decision 1: Monorepo with npm Workspaces

**Choice:** `packages/core`, `packages/web`, `packages/mcp-server`. Use npm workspaces. No Turborepo.

**Why:**
- Three packages is the right split: shared brain (`core`), two thin surfaces (`web`, `mcp-server`).
- npm workspaces gives us cross-package linking, shared `node_modules`, and coordinated versioning with zero additional tooling.
- Turborepo solves a problem we don't have yet (expensive parallel builds across many packages). If build times become painful with 3 packages, we add it later.
- Keep it flat at the root level — `package.json` at repo root declares workspaces.

**Structure:**
```
kickstart/
├── package.json              # workspaces: ["packages/*"]
├── packages/
│   ├── core/                 # TypeScript — conversation engine, API clients, generators
│   ├── web/                  # Vanilla JS — Portal Prototyper chrome, Copilot panel
│   └── mcp-server/           # TypeScript — MCP tools + future MCP App resources
├── infra/                    # Bicep templates + setup scripts
├── .github/workflows/        # CI/CD
└── docs/
```

---

## Decision 2: Web Surface — Vanilla JS (Portal Prototyper), No React

**Choice:** Option (c) — Start vanilla. Add React only if conversation UI complexity demands it.

**Why:**
- Portal Prototyper is zero-dep HTML/CSS/JS. The existing SWA deployment uses `skip_app_build: true`. This is a strength — no build pipeline to break, sub-second deploys, anyone can fork and customize.
- The Copilot panel (where the conversation lives) is the only complex interactive component. It can be built as a vanilla JS web component consuming `@kickstart/core`'s built output.
- React adds: build step, bundle size, framework knowledge requirement. It does NOT add meaningful value for a wizard + Copilot panel layout.
- If the conversation panel grows to need complex state management (rich form rendering, drag-and-drop, etc.), we can introduce React for JUST that panel as a web component. The Portal Prototyper chrome stays vanilla.

**Consequence:** `@kickstart/core` builds to ESM (with TypeScript). The web surface loads it via `<script type="module">` or a thin bundled shim. No Vite, no webpack for the web surface itself.

---

## Decision 3: A2UI Pattern, Not Library

**Choice:** Option (b) — Adopt the a2ui *pattern* (JSON UI schemas) with our own renderers.

**Why:**
- The a2ui library is v0.8 preview from Google. Taking a hard dependency on a preview Google library for an Azure-aligned tool is unnecessary risk.
- The *pattern* is the value: `@kickstart/core` outputs JSON UI schemas describing what the user should see. Each surface (web, MCP) renders those schemas with its own native components.
- This keeps `@kickstart/core` UI-framework-agnostic and testable — you can unit test that the engine produces the right schema without rendering anything.
- Our schema can be simpler than a2ui's full spec. We need: text blocks, forms (select, input, checkbox), code blocks, action buttons, progress indicators, diagrams. That's it for v1.

**Schema contract:** Define in `packages/core/src/ui-schema.ts`. Start minimal, extend as needed.

---

# Decision: Chat-First UX Redesign

**Date:** 2025-07-25  
**Author:** Fry (Frontend Dev)  
**Status:** Accepted  
**Related:** copilot-directive-20260408-chat-first-ux

## Context

The Kickstart web app used a Portal Prototyper pattern (sidebar nav, breadcrumbs, command bar, wizard forms, content area with a toggleable Copilot panel). The AI chat was a secondary sidebar. The goal was to make the AI conversation THE primary experience — following the pattern from `sabbour/adaptive-ui-try-aks`.

## Decision

1. **Remove the portal shell entirely** — no nav-pane, breadcrumbs, command-bar, SPA router, or wizard forms.
2. **Chat UI as the main content area** — centered at 760px max-width, always visible, no toggle.
3. **File viewer as a right sidebar** — appears only when files are generated in GENERATE phase. Tabbed, with copy-per-file.
4. **Sessions sidebar on the left** — toggleable from header. Placeholder for future multi-session support.
5. **Conversational demo flow** — Discover phase asks ONE question per turn (3 turns) instead of presenting multi-field forms.
6. **Dark mode** — via `prefers-color-scheme` media query, no user toggle.
7. **Prompt inspector** — moved from copilot panel header to a topbar toggle button.

## Consequences

- `core.js` still exports Router/Navigation/Breadcrumbs but they're unused — can be removed in a future cleanup.
- All `.copilot-*` CSS classes renamed to `.chat-*` — any external references will break.
- A2UI renderer still renders inside chat messages — no changes needed there.
- The demo flow is now truly conversational: one concept per turn, no multi-field wizards.
- **NOTE (Scribe):** Dark mode implementation (Decision item 6) conflicts with copilot-directive-20260408-no-dark-mode which explicitly requests light theme only. Fry's dark mode was implemented as part of the chat-first UX directive (2026-04-08T14:37:00Z) which emphasized matching the reference app. This directive was accepted first. Dark mode is now live in production (commit d431093). Recommend clarifying with user whether dark mode should remain or be reverted.

---

# Decision: MCP App HTML Surface Architecture

**Author:** Bender (Backend Dev)  
**Date:** 2025-07-25  
**Status:** Accepted  
**Related:** MCP App integration for IDE surfaces

## Context

The Kickstart project needs a dual-surface architecture: web (SWA) and IDE (MCP App HTML). The IDE surface renders inside VS Code/Claude Code as a sandboxed iframe, communicating with the MCP server via postMessage.

## Decisions

### 1. Self-Contained HTML with Inline A2UI Renderer

**Choice:** Single HTML file (`kickstart-app.html`) with all CSS and JS inlined. The A2UI renderer is a port of the web surface's `a2ui-renderer.js`, adapted for plain self-contained JS (no ES module imports).

**Why:** MCP App iframes are sandboxed with no external resource loading. Everything must be in one file. The renderer covers all 18 A2UI component types so the IDE surface has feature parity with the web surface.

### 2. PostMessage Protocol with Typed Validation

**Choice:** Defined a typed protocol layer (`protocol.ts`) with `parseAppMessage()` for validation and `handleAppMessage()` for routing. Messages are validated before processing — invalid messages are silently dropped.

**Why:** The iframe boundary requires strict validation. The typed protocol makes the contract explicit and testable. The handler reuses existing tool functions (handleKickstart, handleConverse, handleAction) — no logic duplication.

### 3. HTML Served as MCP Resource (Not Embedded String)

**Choice:** HTML file loaded from disk at startup via `readFileSync` and served as a `text/html` MCP resource at `kickstart://app/main`. Build script copies HTML to `dist/app/`.

**Why:** Keeps the HTML maintainable as a separate file rather than an escaped string constant. The build-time copy ensures it ships with the compiled JS. Resource URI follows MCP App conventions.

### 4. Auto-Kickstart on Load

**Choice:** The app automatically sends a `kickstart` postMessage when it loads, creating a session without requiring user action first.

**Why:** Reduces friction in the IDE. The user sees the welcome message and phase indicator immediately. They can start typing right away.

## Consequences

- Web and IDE surfaces share the same A2UI component catalog but have independent renderers
- Protocol changes require updating both `protocol.ts` and the inline JS in the HTML file
- Session is lost on iframe recreation (acceptable for Phase 1 per Decision 12)
- 30 new tests added (protocol validation, HTML structure); 118 total tests passing

---

# User Directives (2026-04-08)

## Copilot-Directive-20260408-Chat-First-UX

**By:** Ahmed Sabbour (via Copilot)  
**Date:** 2026-04-08T14:37:00Z  
**Status:** Accepted  
**Related:** Chat-first UX redesign (Fry)

**What:** "I don't want to have static UI with input fields asking about the app name and repo and framework." The web experience must be entirely conversation-driven, matching the reference app at https://aui.prototypes.azure.sabbour.me/try-aks/. The chat IS the primary UI — not a side panel. No wizard steps, no static forms. The AI progressively discovers requirements through natural conversation (one concept per turn). Rich A2UI components (code blocks, diagrams, cost estimates, pickers) appear inline in the chat. A file viewer sidebar shows generated artifacts.

**Why:** User request — the current Portal Prototyper chrome with toggleable Copilot panel deviates from the intended UX. The reference app proves the conversation-first pattern works.

**Impact:** ✅ Implemented by Fry in commit d431093 (chat-first redesign).

---

## Copilot-Directive-20260408-No-Dark-Mode

**By:** Ahmed Sabbour (via Copilot)  
**Date:** 2026-04-08T15:05:00Z  
**Status:** CONFLICT  
**Related:** Chat-first UX redesign (Fry)

**What:** No dark mode colors. Light theme only throughout the web UI.

**Why:** User preference — keep the UI simple with a single light theme.

**CONFLICT:** Fry's chat-first redesign (accepted from directive 2026-04-08T14:37:00Z) implemented dark mode via `prefers-color-scheme` media query as part of the complete overhaul. This directive (issued 28 minutes later) contradicts it. **Scribe note:** Dark mode is currently live in commit d431093. Recommend clarifying with user whether dark mode should remain (appears to match reference app styling) or be reverted to light-only.

---

## Copilot-Directive-20260408-No-Gists

**By:** Ahmed Sabbour (via Copilot)  
**Date:** 2026-04-08T14:48:00Z  
**Status:** Accepted  
**Related:** Session persistence research

**What:** No GitHub Gists for session persistence. Explore Azure Cloud Shell storage as the persistence layer instead.

**Why:** User request — Gists rejected as a persistence mechanism.

**Impact:** Coordinator researched Cloud Shell storage. Finding: Cloud Shell can't be fully provisioned programmatically for first-time users. Session persistence deferred to future phase. Demo flows work without persistent storage.

---

## Copilot-Directive-20260408-Carousel-LLM

**By:** Ahmed Sabbour (via Copilot)  
**Date:** 2026-04-08T14:54:00Z  
**Status:** Pending  
**Related:** Landing page carousel UI

**What:** The inspirational carousel on the landing page should generate its app ideas dynamically using an LLM call, not hardcode them. Each page load gets fresh, creative ideas.

**Why:** User request — keeps the experience dynamic and surprising.

**Impact:** Pending implementation. Requires: LLM integration in web surface or API call from app.js to SWA API endpoint. If using SWA API, add new endpoint for carousel generation. Demo carousel currently hardcoded.

## Decision 4: MCP — Tools First, App UI Later (Progressive)

**Choice:** Option (c) — Progressive. Ship tools in Phase 1, add MCP App UI in Phase 2.

**Why:**
- MCP tools are simpler to ship: define tool schemas, implement handlers, done. Users get value immediately through their existing Copilot/Claude/ChatGPT UI.
- MCP App UI (`ui://` resources) requires HTML rendering in sandboxed iframes, bidirectional JSON-RPC messaging, and a CSS framework that works inside iframes. That's real work.
- The web surface proves the conversation flow first. Once proven, we port the Copilot panel to MCP App UI, reusing the same `@kickstart/core` engine.
- Tools to ship in Phase 1: `kickstart` (start conversation), `generate-manifests` (K8s + GitHub Actions), `check-status` (what's deployed).

---

## Decision 5: Conversation Engine — Hybrid State Machine + LLM

**Choice:** Option (c) — State machine for phase tracking, LLM for natural language within each phase.

**Why:**
- The mega-prompt approach (Ship It) works but is untestable. You can't write a unit test for "does the LLM follow the system prompt correctly?" You can write a test for "does the state machine transition from Clarify to Needs when required fields are populated?"
- State machine gives us: deterministic phase tracking, clear "where am I" / "what's next", retry logic per phase, telemetry hooks, and the ability to save/resume conversations.
- LLM within each phase handles: natural language understanding, generating follow-up questions, interpreting ambiguous user input, producing friendly responses.
- Phases for v1: Understand → Clarify → Needs → Plan. Phases 5-8 (Build → Review → Deploy → Monitor) ship incrementally.

**Implementation:** Finite state machine in `packages/core/src/engine/`. Each phase is a module with: entry conditions, LLM prompt template, exit conditions (required data collected), and output schema.

---

### 2026-04-08T16:49: Entra App Registration resolved

**By:** Ahmed Sabbour (via Copilot)  
**Date:** 2026-04-08T16:49:00Z  
**Status:** Completed

**What:** Entra App Registration created in tenant `d91aa5af-8c1e-442c-b77c-0b92988b387b`:
- App Name: Kickstart - AKS Onboarding
- Client ID: `e71a23c6-aeb4-459a-88fc-07ff96fc9b92`
- Object ID: `bf6ab22e-d654-4a27-bb35-6df7631f8023`
- Tenant ID: `d91aa5af-8c1e-442c-b77c-0b92988b387b`

**Why:** Required for SWA Entra ID authentication. Previously blocked on tenant login.

**Impact:** Unblocks SWA auth configuration (staticwebapp.config.json), Bicep provisioning, and API backend AOAI credential wiring.

---

# Decision: SWA Entra ID Authentication via Built-in Provider

**Author:** Bender (Backend Dev)  
**Date:** 2026-04-08  
**Status:** Accepted

## Context

Kickstart needs Entra ID auth to protect API routes that make Azure ARM calls on behalf of users. Ahmed created the Entra app registration manually.

## Decision

Use SWA's built-in `azureActiveDirectory` identity provider (Standard tier) instead of MSAL.js client-side auth.

**Why:**
- Zero frontend JS needed — SWA handles the OAuth flow, token management, and session cookies automatically via `/.auth/*` endpoints.
- Client secret stays server-side (SWA app setting) — never exposed to the browser.
- `/api/*` routes get the authenticated user's claims via `x-ms-client-principal` header automatically.
- Simpler than wiring MSAL.js + token acquisition + bearer header injection on every API call.

**Trade-off:** Less control over token scopes per-request. If we later need fine-grained scope control (e.g., different scopes for Graph vs ARM), we may need to add MSAL.js alongside or switch to a custom auth flow.

## Auth Model

- Static pages: Public (no auth required — it's a landing page)
- `/api/*`: Requires `authenticated` role
- `/login` → `/.auth/login/aad`
- `/logout` → `/.auth/logout`
- 401 → auto-redirect to login

## App Settings

- `AZURE_CLIENT_ID` — set via Bicep
- `AZURE_CLIENT_SECRET` — set manually (never in source)

---

# Decision: SWA CLI for local development

**Author:** Fry (Frontend Dev)  
**Date:** 2026-04-08  
**Status:** Accepted

## Context

The repo had no unified local dev server. Tests used `npx serve` on port 4281, but developers had no way to run the full stack (static frontend + Azure Functions API) locally.

## Decision

Use Azure Static Web Apps CLI (`swa start`) as the local dev server on port 4280. It proxies `/api/*` to Azure Functions Core Tools, matching the production SWA behavior exactly.

- **Port 4280**: SWA CLI dev server (full stack)
- **Port 4281**: Playwright E2E tests (static only, unchanged)
- **Port 7071**: Azure Functions host (managed by SWA CLI)

## Why

- SWA CLI mirrors production routing (static files + API proxy + auth emulation)
- Zero config needed beyond `swa-cli.config.json`
- `npm run dev:web` still available for frontend-only work (falls back to demo mode)
- Doesn't interfere with existing Playwright test setup

---

## Decision 6: IaC — Bicep for Infra, CLI Scripts for Entra

**Choice:** Bicep for Azure resources (SWA, etc.). Shell scripts for Entra App Registration. No Microsoft.Graph Bicep provider.

**Why:**
- The Microsoft.Graph Bicep resource provider is in preview. Preview + auth infrastructure = bad idea. Entra App Registrations are created once and rarely changed — a well-documented `infra/setup-entra.sh` script is more reliable and debuggable.
- Bicep handles: SWA resource, any future Azure Functions, resource group setup.
- GitHub Actions workflow handles deployment (existing `deploy-swa.yml` pattern, proven).
- Revisit Graph Bicep provider when it GAs.

**Files:**
- `infra/main.bicep` — SWA + resource group
- `infra/setup-entra.sh` — Entra App Registration (az CLI)
- `infra/setup-github-oauth.md` — Manual GitHub OAuth App setup (can't be automated)

---

## Decision 7: Phase 1 Scope

### Ships in Phase 1

| Component | Scope | Owner |
|-----------|-------|-------|
| `@kickstart/core` | Conversation engine (phases 1-4: Understand, Clarify, Needs, Plan), UI schema types, K8s manifest generator, GitHub Actions workflow generator | Bender |
| `packages/web` | Portal Prototyper chrome + Copilot panel, 1 wizard ("Create AKS App"), Entra + GitHub auth flows | Fry |
| `packages/mcp-server` | 3 tools: `kickstart`, `generate-manifests`, `check-status`. No MCP App UI. | Bender |
| `infra/` | Bicep for SWA, Entra setup script, deploy workflow | Bender |
| Tests | Core engine unit tests, auth flow integration tests | Hermes |

### Deferred to Phase 2+

| Feature | Why Deferred |
|---------|-------------|
| Cost estimation engine | Nice-to-have, not blocking the core flow |
| Architecture diagram builder (Mermaid) | Visual polish, not blocking |
| K8s Safeguard validation (13 rules) | Important but can ship after manifests generate correctly |
| MCP App UI (`ui://` resources) | Tools-first is enough for MCP users |
| Conversation phases 5-8 (Build, Review, Deploy, Monitor) | Phase 1 gets users to a plan; execution phases follow |
| React migration | Only if vanilla JS Copilot panel proves insufficient |
| Codespaces deep-link integration | "Continue in IDE" is Phase 2 after web flow works |

---

## Decision 8: Branching Strategy for Team Throughput

**Strategy:** Feature branches per issue with package ownership boundaries.

**Rules:**

---

# Decision: Dual-Model Backend (Chat + Codex)

**Author:** Bender (Backend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

Ahmed configured two Azure OpenAI deployments — `gpt-5.3-chat` for conversation and `gpt-5.3-codex` for code generation. The codex model uses the newer Responses API (not Chat Completions).

## Decisions

### 1. Separate deployment env vars with fallback

`AZURE_OPENAI_CHAT_DEPLOYMENT` and `AZURE_OPENAI_CODEX_DEPLOYMENT` added alongside the existing `AZURE_OPENAI_DEPLOYMENT` (which acts as fallback for both). This is backward-compatible — existing single-model setups keep working.

### 2. Responses API for Codex

The codex model uses `POST /openai/deployments/{deployment}/responses?api-version=2025-03-01-preview` — a different API shape from Chat Completions. System prompt goes in `instructions`, user messages in `input`. Streaming uses `response.output_text.delta` SSE events.

### 3. New `/api/generate` endpoint

Dedicated code generation endpoint with type-specific system instructions (dockerfile, kubernetes, pipeline, bicep, generic). Keeps conversation and code generation concerns cleanly separated.

---

# Decision: Spark-like UX Evolution Roadmap for Kickstart

**Author:** Leela (Lead)
**Date:** 2025-07-25
**Status:** Proposed
**Requested by:** Ahmed Sabbour

## Context

Ahmed wants Kickstart to evolve toward a GitHub Spark-like experience. After reviewing 6 Spark screenshots and auditing our current codebase, here's my gap analysis and prioritized roadmap.

### Current State vs. Spark

| Spark Feature | Kickstart Today | Gap |
|---|---|---|
| Clean landing with hero text + input | Carousel + track cards + framework pills + IDE links | Small — our landing is richer, just needs a text input |
| Split-view: chat left, preview right | Chat left, file-viewer sidebar right (hidden until files exist) | Small — layout exists, needs polish |
| Progressive file generation in chat | Files appear in sidebar only; chat shows no file status | Medium — need in-chat file chips |
| Code view toggle | No code view — file viewer is read-only sidebar | Medium — need a toggle between "preview" and "code" |
| Tabs: Iterate, Theme, Data, Prompts, Assets | Phase stepper (Discover→Deploy) in chat header | Large — but not all tabs are relevant |
| Publish button with URL + visibility | No publish — deployment is GitHub Actions → AKS | Medium — different model, but a "Deploy" CTA is needed |
| Sparkle loading animation | Three-dot typing indicator | Small — cosmetic |
| Suggestion pills below hero input | Framework pills exist but below track cards | Small — reposition |

### Key Insight: Kickstart ≠ Spark

Spark generates full runnable apps and hosts them. Kickstart generates **infrastructure** (Bicep, Dockerfiles, Helm charts, GitHub Actions) and deploys **to AKS**. Our "preview" is the architecture diagram + deployment plan + generated IaC files — not a running app. The UX must reflect this.

## Proposal: Prioritized Increments

### P0 — Must-Have Now (Dramatic Impact, Low Effort)

These changes take our existing layout from "functional prototype" to "feels like Spark" with minimal code:

#### 1. Landing Page: Add Hero Text Input
- Add a prominent text input above the carousel: "Describe the app you want to deploy…"
- Move framework pills directly below the input as suggestion chips (like Spark's pills)
- Keep track cards below as secondary entry points
- This is the single biggest UX win — it makes the landing page feel like Spark's "Dream it" experience
- **Effort:** ~2 hours. Add `<input>` to `index.html`, style in `landing.css`, wire in `app.js`.

#### 2. In-Chat File Generation Chips
- When the engine generates files, show clickable file chips in the chat stream (not just in the sidebar)
- Each chip: file icon + filename + status indicator (generating → done)
- Clicking a chip opens that file in the sidebar viewer
- **Why P0:** This is the most recognizable Spark interaction pattern — seeing files appear progressively in the conversation
- **Effort:** ~4 hours. New CSS class in `components.css`, emit file events from engine, render in `app.js`.

#### 3. Sparkle/Pulse Loading Animation
- Replace the three-dot typing indicator with a branded sparkle or pulse animation
- Add a status label: "Generating architecture…", "Creating deployment plan…", phase-aware text
- **Effort:** ~2 hours. CSS animation in `components.css`, update `createChatUI` in `components.js`.

#### 4. Right Panel as "Preview" (Not Just File Viewer)
- Rename "Generated Files" → contextual title based on phase ("Architecture Plan", "Deployment Preview", "Generated Files")
- When the ArchitectureDiagram A2UI component fires, show it in the right panel instead of only in chat
- This makes the split-view feel like Spark's chat-left/preview-right pattern
- **Effort:** ~3 hours. Modify `file-viewer` to accept both files and A2UI preview content.

### P1 — Next Sprint (Completes the Vision)

#### 5. Code View Toggle
- Add a toggle button in the right panel header: "Preview" | "Code"
- Preview mode: shows the architecture diagram, deployment plan summary, or rendered markdown
- Code mode: shows the raw file tree + code editor (read-only), exactly like Spark's code view
- File tree on the left of the panel, code on the right (sub-split within the right panel)
- **Effort:** ~8 hours. New component in `components.js`, CSS layout work, state management.

#### 6. Deploy CTA Button
- Add a prominent "Deploy" button in the top bar (right side, next to user avatar)
- Disabled until the Review phase completes; pulses/highlights when ready
- Clicking opens a deploy dialog:
  - Target: AKS cluster selector (from user's subscriptions)
  - Status: progress indicators for each deployment step
  - Result: deployed URL, resource group link, "Open in Azure Portal" button
- Maps Spark's "Publish" to Kickstart's "Deploy to AKS" — different mechanics, same feeling of shipping
- **Effort:** ~12 hours. New dialog component, integration with deploy engine phase, backend API calls.

#### 7. Session Persistence + Recent/Favorites
- Spark shows recent apps on the landing page
- Implement session persistence (localStorage initially, API later)
- Show "Recent" section on landing page below the tracks
- **Effort:** ~6 hours. localStorage wrapper, landing page section, session restore logic.

### P2 — Later (Full Parity, Lower Priority)

#### 8. Workspace Tabs (Selective)
Not all Spark tabs make sense for Kickstart:

| Spark Tab | Kickstart Equivalent | Priority |
|---|---|---|
| Iterate | Chat (already exists) | — (done) |
| Theme | Not applicable — we generate infra, not UI | Skip |
| Data | Could map to "data sources" config in future | P2 |
| Prompts | System prompt inspector (already exists as debug toggle) | P2 — promote to a tab |
| Assets | Upload Dockerfiles, existing manifests, architecture docs | P2 |

If we add tabs, they'd be: **Iterate** (chat), **Files** (generated code), **Prompts** (system prompt viewer), **Assets** (upload existing config).

#### 9. "Open Codespace" / "Create Repository" Menu
- Spark's publish menu includes these. Kickstart already has the A2UI components (`CodespaceLink`, `RepoPicker`) but they're not wired to a menu.
- Add a dropdown menu on the Deploy button: "Deploy to AKS", "Create Repository", "Open Codespace"
- **Effort:** ~4 hours per menu item. Depends on GitHub OAuth being wired up.

#### 10. Mermaid Diagram Rendering in Preview
- Architecture diagrams currently render as text/A2UI. Render them as actual Mermaid SVGs in the preview panel.
- **Effort:** ~4 hours. Add mermaid.js CDN import, render in preview panel.

## Architecture Implications

### No Framework Change Required
All P0 and P1 work is achievable in vanilla JS with the existing Portal Prototyper pattern. No React needed. The component factory pattern in `components.js` handles everything.

### File Structure (New/Modified)
```
packages/web/
  index.html          — Add hero input, reorder landing sections
  css/landing.css     — Hero input styles, suggestion pills repositioning
  css/components.css  — File chips, sparkle animation, preview panel modes, deploy button
  js/app.js           — Hero input handler, file chip rendering, preview panel logic
  js/framework/
    components.js     — New: createFileChip(), createPreviewPanel(), createDeployDialog()
    a2ui-renderer.js  — Route ArchitectureDiagram to preview panel
```

### Event Bus Extensions
```
files:generating    — { filename, status: 'generating' }
files:generated     — { files } (already exists)
preview:show        — { type: 'diagram' | 'plan' | 'files', content }
deploy:ready        — { }
deploy:started      — { target }
deploy:progress     — { step, status }
deploy:complete     — { url, resourceGroup }
```

## Recommendation

**Ship P0 as a single PR.** It's ~11 hours of work and transforms the feel of the app. The hero input + file chips + sparkle loading + preview rename are all independent changes that can be developed in parallel by Fry (web) and reviewed by me.

**P1 is one sprint** (~26 hours). The deploy button is the centerpiece — it's what turns "generated files" into "deployed app" and that's the Kickstart value prop.

**P2 is backlog.** Tabs and Codespace integration depend on features we've already deferred (GitHub OAuth, MCP App UI).

## Consequences

- Landing page gains a direct text input — users can skip track selection entirely
- Chat becomes more visual with file chips, reducing reliance on the sidebar for file discovery
- Preview panel becomes a first-class citizen, not a hidden sidebar
- Deploy button creates a clear "call to action" that's missing today
- No new dependencies, no framework migration, no breaking changes
1. `main` is production. Protected. All merges via PR with Leela review.
2. Branch naming: `squad/{issue-number}-{kebab-case-slug}` (e.g., `squad/42-conversation-engine`).
3. **Package ownership minimizes conflicts:**
   - **Fry** owns `packages/web/` — all Portal Prototyper, UI components, styling
   - **Bender** owns `packages/core/` and `packages/mcp-server/` and `infra/`
   - **Hermes** owns `tests/` (top-level test suites) and writes tests alongside any package
   - **Leela** owns `.squad/`, reviews everything
4. **Shared contract files** (`packages/core/src/ui-schema.ts`, `packages/core/src/types.ts`) require Leela review before merge. These are the integration points — breaking them breaks everyone.
5. Agents work on separate issues simultaneously. If two agents need the same file, the issue with lower number merges first.
6. No long-lived feature branches. PRs should be mergeable within one session.

**Why this works:** With 4 agents and clear package boundaries, we get near-zero merge conflicts. The only contention point is the core types/schema, which is deliberately narrow and reviewed by Lead.

---

## Summary

| # | Question | Decision |
|---|----------|----------|
| 1 | Monorepo structure | npm workspaces, 3 packages |
| 2 | Web framework | Vanilla JS (Portal Prototyper), no React |
| 3 | A2UI integration | Pattern only, own renderers |
| 4 | MCP App scope | Tools first, App UI deferred |
| 5 | Conversation engine | Hybrid state machine + LLM |
| 6 | IaC approach | Bicep for infra, CLI scripts for Entra |
| 7 | Phase 1 scope | Core engine + web wizard + MCP tools + auth |
| 8 | Branching strategy | Package ownership, feature branches, Lead reviews |


## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

# Decision: SWA API Backend Architecture

**Author:** Bender (Backend Dev)
**Date:** 2025-07-25
**Status:** Implemented

## Context

The web surface needs an LLM proxy to call Azure OpenAI on behalf of users. API keys can't live in the browser.

## Decision

1. **Azure Functions v4 in SWA:** API lives at `packages/web/api/` as an Azure Functions project. SWA handles routing `/api/*` requests to it.
2. **Fetch-based OpenAI client:** No SDK dependency — direct REST calls to Azure OpenAI API. Lighter, fewer deps, same functionality.
3. **Workspace member:** API added as explicit npm workspace (`packages/web/api`) for `@kickstart/core` resolution. Pre-built in CI before SWA deploy.
4. **Session store pattern:** Same in-memory Map + TTL cleanup pattern used by MCP server. No persistence yet — sessions are ephemeral per deployment.
5. **SSE streaming:** Converse endpoint supports both standard JSON and `text/event-stream` for real-time token streaming.

## Consequences

- API keys must be set in SWA app settings (not in source)
- Sessions are lost on function cold starts (acceptable for Phase 1)
- CI workflow now requires Node.js setup + multi-step build (core → api → SWA deploy)

# Decision: API Client Architecture — Graceful Fallback to Demo Mode

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-25
**Status:** Implemented

## What
The web frontend now auto-detects whether the API backend (`POST /api/converse`) is available at boot via an OPTIONS health check. If available, it uses the real API with streaming support. If not, it falls back to the scripted demo engine and shows a visible "Demo mode" badge.

## Why
- The API backend (Bender's work) may not be deployed yet, or may be down during local dev.
- Users and testers need a clear signal when they're seeing demo vs. real responses.
- The demo flow must always work as a safety net.

## Key Choices
1. **Health check at boot, not per-request** — avoids latency on every message.
2. **Streaming via ReadableStream (NDJSON)** — no EventSource needed since we POST with a body.
3. **Auto-retry on 429/503** — exponential backoff, max 3 retries, so transient failures don't surface as errors.
4. **Error bubbles with Retry** — users can re-send without retyping.

## Consequences
- When the API is deployed, the frontend will automatically switch to API mode on next page load.
- If the API goes down mid-session, individual requests will show error bubbles (not a full crash).

# Decision: Playwright E2E Test Infrastructure for Web UI

**Author:** Hermes (Tester)  
**Date:** 2026-04-08  
**Status:** Accepted

## Context

The `packages/web/` static site had no automated E2E tests. Manual testing was required to verify navigation, copilot panel, conversation flow, A2UI component rendering, and wizard behavior.

## Decision

Adopted Playwright with a lightweight static file server (`serve`) for E2E testing. MSAL authentication and API endpoints are mocked via route interception to enable fully offline, deterministic tests.

## Rationale

- Playwright provides reliable browser automation with built-in assertions
- Route interception (vs `addInitScript`) is the only reliable way to mock CDN-loaded MSAL
- Intercepting `/api/converse` with 503 forces demo mode, ensuring tests run against the deterministic scripted engine
- Port 4281 avoids conflicts with Azure SWA CLI (port 4280)

## Consequences

- Tests depend on demo engine behavior — if prompts change, conversation-flow tests may need updating
- A2UI tests rely on content-based selectors since components lack unique CSS classes
- 38 tests run in ~13s on Chromium only

### 2026-04-08T14:54:55Z: User directive — No LLM emojis
**By:** Ahmed Sabbour (via Copilot)  
**What:** LLM responses must not contain emojis. All AI-generated content (carousel inspirations, chat messages, system prompt outputs) should be emoji-free.  
**Why:** User request — captured for team memory

### 2026-04-08T14:58:40Z: User directive — Replace all emojis with Fluent 2 icons
**By:** Ahmed Sabbour (via Copilot)  
**What:** No emojis anywhere in the website design. Always use Fluent 2 icons instead of emoji characters for all visual indicators, decorations, and iconography throughout the web UI and MCP App surfaces.  
**Why:** User request — captured for team memory

### 2026-04-08T15:05:00Z: User directive — Use Copilot icon for AI indicators
**By:** Ahmed Sabbour (via Copilot)  
**What:** Use the Copilot icon (ssets/icons/fluent/copilot.svg) instead of sparkle icons anywhere an AI/assistant/copilot indicator is needed in the UI.  
**Why:** User request — the Copilot brand icon is the correct visual for AI features, not a generic sparkle.

## Decision: Per-Track System Prompt Addendums

**Author:** Bender (Backend Dev)
**Date:** 2025-07-25
**Status:** Accepted

### Context

The app has two tracks (web-app and agentic-app) but the system prompt was track-agnostic. Users selecting different tracks got identical LLM guidance, missing track-specific deployment patterns.

### Decision

- uildSystemPrompt(phase, knownInfo, track) now accepts an optional 	rack parameter.
- Two addendum constants (WEB_APP_ADDENDUM, AGENTIC_APP_ADDENDUM) are appended to the system prompt when a track is active.
- Web-app addendum focuses on containerization, CI/CD, database connectivity, and scaling. Frames AKS Automatic as "a scalable app platform" per existing rules.
- Agentic-app addendum introduces KAITO (GPU model serving) and RAGEngine (managed RAG) as platform capabilities, plus LangChain/Semantic Kernel patterns and Azure OpenAI integration.
- Addendums are concise (~250-300 words each) to minimize token overhead since they're injected into every LLM call.

### Impact

All code paths (demo engine, API engine) now pass track to the prompt builder. The /api/converse endpoint does not yet forward track from the client — that can be added when the API session model supports it.

## Decision: IDE Launch Links on Landing Page

**Date:** 2025-07-27
**Author:** Fry
**Status:** Accepted

### Context
Users should be able to launch the Kickstart MCP server experience directly from their IDE. The landing page now includes a third section ("Or use your IDE") below framework pills.

### Decision
- VS Code and VS Code Insiders use scode:mcp/install? and scode-insiders:mcp/install? URI schemes to trigger MCP server installation with @kickstart/mcp-server.
- Claude Code has no URI scheme, so its card copies the install command (claude mcp add kickstart -- npx -y @kickstart/mcp-server) to clipboard on click.
- All icons are inline SVGs (brand logos for VS Code, terminal icon for Claude Code). No external icon files.
- The section is styled as tertiary prominence — less visual weight than track cards and framework pills.

## Decision: Landing page before chat

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-26
**Status:** Accepted

### What

Added a landing page shown before the chat UI begins. Users pick a track (web-app or agentic-app) or a framework quick-start pill. The selection configures the engine before the conversation starts.

### Why

- Gives users a clear choice between web-app and agentic-app tracks (per D12)
- Framework pills skip the "which framework?" discovery question for users who already know
- Inspiration carousel introduces what Kickstart can do without requiring immediate input

### Details

- Landing page lives inside .chat-main and is removed on transition
- ody.on-landing class hides the sessions sidebar toggle
- Engine accepts 	rack and preSelectedFramework optional params
- LangChain Agent and RAG App auto-map to agentic-app track; all others to web-app

## Decision: Light-only theme, no dark mode

**By:** Fry  
**Date:** 2026-04-08  
**Status:** accepted

### Context
Dark mode was implemented in the chat-first redesign to match reference app styling. User explicitly requested its removal — "I don't want dark mode colors."

### Decision
Remove all @media (prefers-color-scheme: dark) blocks from web CSS and MCP App HTML. The app is light-theme only. Dark mode CSS variables are deleted, not commented out.

### Consequences
- Users on dark system themes will see the light UI.
- Simplifies CSS maintenance (one theme to maintain).
- If dark mode is ever re-requested, it must be re-implemented from scratch.

## Decision: Lightweight inline markdown renderer for chat bubbles

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-27
**Status:** Accepted

### Context

Assistant text messages from the API can contain markdown (bold, code blocks, lists, links). Previously these were rendered as escaped plain text via scapeHtml(), making responses hard to read.

### Decision

Added enderMarkdown() to components.js — a zero-dependency, regex-based converter that handles the subset of markdown LLMs typically produce: bold, italic, inline code, fenced code blocks, unordered lists, links, paragraphs, and line breaks.

User messages remain escaped plain text. Only assistant messages with msg.text (no msg.html) go through the markdown renderer.

### Why not a library?

The project uses zero build deps (vanilla ES modules). Pulling in marked or markdown-it would add a CDN dependency and ~30KB of code for features we don't need. The subset above covers >95% of LLM output patterns.

### Consequences

- If we need tables, headings, or nested lists in the future, extend enderMarkdown() or swap to a CDN-loaded library.
- Streaming bubbles also render partial markdown via innerHTML — this is safe because the text is HTML-escaped before markdown transforms are applied.

## Decision: SWA + Entra Tenant Alignment

**Author:** Bender (Backend Dev)
**Date:** 2025-07-27
**Status:** Proposed (awaiting Ahmed verification)

### Context

Investigation revealed two Entra app registrations across two tenants:
- **Old:** 7a630e18-8f49-404e-8454-228b13089c57 ("Imagine - AKS Onboarding") in Microsoft internal tenant 72f988bf-86f1-41af-91ab-2d7cd011db47 — no longer accessible from CloudNative.
- **New:** 71a23c6-aeb4-459a-88fc-07ff96fc9b92 ("Kickstart - AKS Onboarding") in CloudNative tenant d91aa5af-8c1e-442c-b77c-0b92988b387b — already wired as AZURE_CLIENT_ID in SWA.

### Decision

1. **Canonical Entra App ID** for Kickstart is 71a23c6-aeb4-459a-88fc-07ff96fc9b92 in the CloudNative tenant.
2. **Old app ID** 7a630e18-8f49-404e-8454-228b13089c57 from decisions.md is stale and should be marked superseded.
3. **openIdIssuer** in staticwebapp.config.json correctly targets CloudNative tenant — no change needed.

### Required Actions (before auth will work)

1. Generate a client secret on the Entra app and set it as AZURE_CLIENT_SECRET in SWA app settings.
2. Add web platform redirect URIs to the Entra app:
   - https://proud-mud-0660b8110.6.azurestaticapps.net/.auth/login/aad/callback
   - https://kickstart.aks.azure.sabbour.me/.auth/login/aad/callback
3. Set AZURE_STATIC_WEB_APPS_API_TOKEN GitHub secret on the repo.

# Decision: Shorten staging domain

**Date:** 2025-07-17
**Author:** Fry (Frontend Dev)
**Status:** Accepted

## Context

The temporary staging domain `kickstart.prototypes.aks.azure.sabbour.me` contained an unnecessary `.prototypes` segment that added no value and made URLs longer.

## Decision

Replace all references with `kickstart.aks.azure.sabbour.me` across infra config, docs, and frontend code. The production domain `kickstart.aks.azure.com` is unchanged.

## Files affected

- `infra/main.bicep` — Bicep param description and comment
- `infra/setup-entra.sh` — Entra redirect URI
- `infra/README.md` — infrastructure docs
- `infra/parameters.dev.json` — dev deployment parameter
- `docs/architecture.md` — domain table
- `docs/deployment.md` — staging domain references
- `packages/web/js/auth.js` — hostname detection and redirect URI
- `packages/web/staticwebapp.config.json` — comment

## Impact

- DNS CNAME and Entra app registration must be updated to match the new domain.
- `.squad/` files were intentionally left untouched (append-only policy).


# Decision: Update Entra App Registration IDs in auth.js

**Date:** 2025-07-17
**Author:** Fry (Frontend Dev)
**Status:** Accepted

## Context

`packages/web/js/auth.js` had hardcoded Entra client and tenant IDs from a different (Microsoft corp) app registration:
- clientId: `7a630e18-…` → wrong
- tenantId: `72f988bf-…` → Microsoft corp tenant, wrong

## Decision

Replaced with Ahmed's actual Entra App Registration values:
- clientId: `e71a23c6-aeb4-459a-88fc-07ff96fc9b92`
- tenantId: `d91aa5af-8c1e-442c-b77c-0b92988b387b`

**No changes needed in:**
- `infra/main.bicep` — uses a `param entraClientId` with no hardcoded IDs.
- `infra/setup-entra.sh` — `TENANT` is `caglobaldemos2605.onmicrosoft.com`, which is the friendly domain for Ahmed's tenant (not the old Microsoft corp tenant). Left as-is.


# Decision: SWA Auth Configuration Fixed

**Date:** 2025-07-28
**Author:** Bender
**Status:** Executed

## Context

SWA built-in auth for `kickstart-web-dev` was failing because:
1. The Entra app (`e71a23c6-aeb4-459a-88fc-07ff96fc9b92`) had no client secret — required by SWA's server-side auth flow.
2. The Entra app had only SPA redirect URIs, but SWA built-in auth needs **Web platform** redirect URIs with the `/.auth/login/aad/callback` path.
3. The `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret was not set.

## Decision

Executed the following fixes:
1. Generated a 2-year client secret ("SWA Auth Secret") on the Entra app.
2. Set `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` as SWA app settings on `kickstart-web-dev`.
3. Added Web redirect URIs for both the default SWA hostname and custom domain.
4. Set `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret on `sabbour/kickstart`.

## Verification

- Entra app now has both SPA redirects (for local dev) and Web redirects (for SWA auth callbacks).
- SWA app settings contain both `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`.
- GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN` confirmed set.

## Impact

- Auth should now work end-to-end on both `proud-mud-0660b8110.6.azurestaticapps.net` and `kickstart.aks.azure.sabbour.me`.
- Client secret expires in ~2 years (July 2027) — will need rotation.
- GitHub Actions deploy workflow can now deploy successfully.



# Decision: JSON Envelope Replaces Regex-Based A2UI Extraction

**Author:** Bender  
**Date:** 2026-04-09  
**Status:** Implemented  

## Context

The LLM response pipeline used regex to extract A2UI blocks from fenced `~~~a2ui` sections inside free-text responses. This was fragile — escaping issues, partial matches, and no structured validation of the A2UI payload.

## Decision

Replace regex extraction with a structured JSON envelope. The LLM now outputs valid JSON:

```json
{"message": "...", "a2ui": [...], "actions": []}
```

Key changes:
- `response_format: { type: "json_object" }` enforced in Azure OpenAI API calls
- New `processResponse()` in `packages/core/src/services/response-processor.ts` parses and validates the envelope
- System prompt teaches the full JSON format with examples
- A2UI messages use v0.9 flat adjacency list: components have `id` + `component`, children are string[] id references
- SSE streaming accumulates chunks, then emits typed events (chunk → message + a2ui + done)

## Consequences

- **Eliminates regex fragility** — JSON parsing is deterministic
- **Graceful fallback** — invalid JSON treated as plain text (no crash)
- **Streaming tradeoff** — can't progressively render `message` field since it's inside JSON; frontend gets loading indicator via `event: chunk` during generation
- **Catalog breaking change** — components use `component` field (not `type`), children are id arrays (not nested objects). 23 components total (18 basic + 5 custom Kickstart)

# Decision: React/Vite Migration + A2UI v0.9 Vendor

**Author:** Bender (Backend Dev)
**Date:** 2026-04-09
**Status:** Accepted

## Context

Kickstart frontend (`packages/web/`) was a vanilla HTML/CSS/JS static site. Ahmed directed: vendor A2UI v0.9 React renderer source directly, migrate to React/Vite, no fork/submodule.

## Decisions

### 1. Vendor A2UI v0.9 source at `src/vendor/a2ui/`

Copied `renderers/react/src/v0_9/` and `renderers/web_core/src/v0_9/` from google/A2UI (Apache 2.0). Rewrote all `@a2ui/web_core` imports to relative paths. Excluded test files. Included JSON schemas from specification.

### 2. React 19 + Vite 6 + TypeScript

- Vite for dev/build (fast HMR, native ESM, JSON import support)
- React 19 with react-jsx transform
- TypeScript strict mode, bundler module resolution
- `/api` proxy to Azure Functions local (port 7071)

### 3. A2UI runtime dependencies

`@preact/signals-core`, `date-fns`, `zod`, `zod-to-json-schema` — required by vendored web_core. Added as direct dependencies.

### 4. Existing vanilla files preserved

`js/`, `css/`, `assets/` directories kept. Old `js/app.js` script tag removed from `index.html`. Cleanup deferred to later phase.

# Decision: SWA Built-in Auth for Login, MSAL for Graph Tokens Only

**Author:** Bender (Backend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

The app had two auth systems (MSAL popup + SWA built-in route auth) that weren't coordinated. MSAL popup login didn't set the SWA session cookie, so `/api/*` calls protected by `allowedRoles: ["authenticated"]` returned 401→302 redirects, causing "Empty stream response" errors.

## Decision

- **Login/logout:** Use SWA's built-in `/.auth/login/aad` and `/.auth/logout` endpoints (full-page redirects). This sets the session cookie that API route auth requires.
- **Graph API tokens:** Keep MSAL for `acquireTokenSilent`/`ssoSilent`/`acquireTokenPopup` — used only for Graph API calls (profile photos, ARM tokens). MSAL cache moved to `localStorage` to survive redirect.
- **Auth state source of truth:** `/.auth/me` → `clientPrincipal`, not MSAL's `currentAccount`.

## Why

- SWA route auth requires its own session cookie — MSAL tokens in sessionStorage don't satisfy it.
- MSAL is still needed for delegated access tokens (Graph, ARM) that SWA doesn't provide.
- Separating concerns: SWA owns the session, MSAL owns the tokens.

## Impact

- `packages/web/js/auth.js` — full rewrite
- `packages/web/js/app.js` — `/login` path handler simplified
- No changes to API, SWA config, or any backend code
- Exported API surface unchanged — all callers work without modification

### 2026-04-09T00:08:52Z: Architecture direction confirmed — A2UI React v0.9
**By:** Ahmed Sabbour (via Copilot)
**What:** Build on whatever Google has in A2UI v0.9 React renderer, extend it with what we need for Kickstart. Can contribute back to Google later, can refactor later if things deviate. Goal: match and exceed try-aks rich capabilities with a "wow" experience. Supersedes all prior rendering architecture decisions (Option C, regex-based extraction, vanilla JS rendering).
**Why:** User confirmation after thorough analysis of A2UI v0.9 spec, discovery of `@a2ui/react` v0.9.0 working renderer, and comparison with adaptive-ui-try-aks reference app.

### 2026-04-08T23:44Z: File generation UX directive
**By:** Ahmed Sabbour (via Copilot)
**What:** The file generation/editing experience should be a hybrid of GitHub Spark and try-aks:
- **From GitHub Spark:** Collapsible "Generating" section with chevron toggle. Files appear one by one in real-time as they're created (not all at once). Status text shows what the AI is currently working on (e.g., "Now I'll create the type definitions..."). Clean, inline in chat.
- **From try-aks:** AI persona icon on the message. Contextual explanation of what files are being generated and why. Clickable file list with icons that opens file viewer/editor. Files listed below the explanation.
- **Combined vision:** A chat message with persona icon, brief explanation text, then a collapsible "Generating" panel that streams file names as they appear. Each file is clickable (opens in file editor panel). Status text at bottom shows current generation step. After generation completes, the section stays collapsed-by-default showing file count, expandable to see the full list.
**Why:** Neither Spark nor try-aks is perfect alone. Spark has better real-time generation feel. Try-aks has better context and file interaction. Combine both.

### 2026-04-08T23:42Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Remove the phase stepper bar (Discover/Design/Generate/Review/Handoff/Deploy dots) entirely. The conversation flow is sufficient — the bar takes up space and adds no value.
**Why:** User feedback — the bar is static, non-interactive, and wastes prime screen real estate.

### 2026-04-09T00:14:33Z: Vendor A2UI, no fork
**By:** Ahmed Sabbour (via Copilot)
**What:** Vendor the A2UI React renderer source directly into kickstart repo. No fork, no submodule, no separate framework repo. One repo for speed. Can extract/fork later if reuse is proven. Supersedes the two-repo fork discussion.
**Why:** User wants to move FAST. Two-repo strategy overcomplicates a prototype. Speed wins.

# Decision: Carousel restored as subtle ambient strip

**Author:** Fry  
**Date:** 2025-07-24  
**Status:** Accepted  

## Context

The inspiration carousel was removed in commit 4767300 as part of landing page simplification. Ahmed requested it back but in a cleaner form.

## Decision

Restored the carousel between suggestion pills and track cards with a deliberately reduced visual footprint:

- **Crossfade only** — no translateX slide animation. Cleaner, less distracting.
- **Compact sizing** — 70px viewport (was 100px), 6px dots (was 8px), font-size-500/300 (was 600/400).
- **No separate section heading** — the carousel is ambient, not a competing section.
- **Same behavior** — auto-rotate every 5s, click populates chat, API fetch with hardcoded fallback.

## Rationale

The old carousel felt like a competing hero section. The subtle strip treatment keeps the landing page hierarchy clear: hero input → ambient inspiration → track cards.

# Landing Page Batch 2 — Avatar, Send Icon, Recent Sessions, Footer

**Agent:** Fry (Frontend Dev)  
**Date:** 2025-07-28  
**Status:** Implemented  
**Commit:** f4fbc3f

## Context

Second batch of landing page improvements requested by Ahmed Sabbour. Five UX polish items + cleanup:

1. Suppress avatar 404 console error
2. Remove unused prompt inspector button from topbar
3. Add footer with build info + AI disclaimer
4. Add Recent Sessions section (localStorage)
5. Replace send arrow with Copilot sparkle icon
6. Cleanup & commit

## Decisions

### Avatar 404 Handling

**Decision:** Check metadata endpoint before fetching binary photo.

**Rationale:** Browser console shows noisy 404 error when user has no profile photo. Can't suppress browser network error, but can avoid the call entirely by checking `/me/photo` metadata first (fails gracefully without binary fetch).

**Implementation:** Modified `fetchUserPhoto()` to call metadata endpoint, return null early if 404, only proceed to `$value` binary fetch if metadata exists.

**Files:** `packages/web/js/app.js`

---

### Copilot Sparkle Icon

**Decision:** Replace send button arrow with GitHub Copilot sparkle icon.

**Rationale:** User requested Copilot branding. Sparkle icon is recognizable GitHub Copilot visual identity (dual-star/sparkle design).

**Implementation:** Swapped SVG path in hero-send-btn. Updated viewBox and size from 16×16 to 20×20 for better visibility.

**Files:** `packages/web/index.html`

---

### Prompt Inspector Removal

**Decision:** Remove topbar button, keep underlying functionality.

**Rationale:** Inspector toggle does nothing useful on landing page. Button clutter. Functionality (prompt inspection in chat) may be useful later for debug, so kept variable and conditional blocks intact.

**Implementation:** Removed `#topbar-inspector-toggle` button HTML and event listener JS. Kept `promptInspectorOn` variable and `if (promptInspectorOn ...)` blocks.

**Files:** `packages/web/index.html`, `packages/web/js/app.js`

---

### Recent Sessions

**Decision:** localStorage-backed session history, max 5 visible, 20 stored.

**Rationale:** Users want to resume recent work. Landing page is prime location for discovery. LocalStorage sufficient (no auth needed). 5 visible keeps UI clean, 20 stored provides buffer.

**Implementation:**  
- `getSessions()` / `saveSession()` helpers (prepend or update existing by ID)  
- `renderRecentSessions()` builds HTML, shows/hides section, attaches click handler  
- Session saved in `transitionToChat()` with generated ID (`session-{timestamp}`)  
- Item format: truncated title + formatted date  
- Click → set `pendingQuickPrompt` and transition to chat  

**Files:** `packages/web/js/app.js` (helpers + boot call), `packages/web/index.html` (section HTML), `packages/web/css/landing.css` (styles with hover effects)

---

### Footer: Build Info + Disclaimer

**Decision:** Centered footer with git SHA + build date (monospace), and "Kickstart uses AI. Check for mistakes."

**Rationale:** User requested transparency about build version (for debugging) and AI disclaimer (compliance/UX expectation-setting).

**Implementation:**  
- Footer HTML added at end of `.landing-inner` (after recent sessions)  
- Build metadata script injected before app.js: `window.__BUILD_SHA__` and `window.__BUILD_DATE__`  
- Defaults: `'dev'` and current date (CI pipeline replaces at deploy time)  
- `boot()` populates `#landing-footer-version` after `renderRecentSessions()`  
- CSS: light gray text (neutral-foreground-4), small font (font-size-100), monospace for version

**Files:** `packages/web/index.html` (footer HTML + metadata script), `packages/web/css/landing.css` (footer styles), `packages/web/js/app.js` (boot footer population)

---

## Outcome

All 6 changes implemented, committed (f4fbc3f), and pushed.

**Verified:**
- Landing page structure: hero → track cards → framework pills → recent sessions → footer
- `boot()` call sequence: initAuth → initLandingListeners → initPlaceholderRotation → renderRecentSessions → footer version
- No orphaned carousel code
- Diff stats: 3 files changed, 297 insertions, 208 deletions

**Next:**  
- CI pipeline should replace `window.__BUILD_SHA__` and `window.__BUILD_DATE__` at SWA deploy time  
- Recent sessions will populate as users interact (localStorage persists across page loads)

# Decision: Landing Page Placeholder Rotation UX

**Date**: 2025-07-28  
**Author**: Fry (Frontend Dev)  
**Status**: Implemented  

## Context

The landing page had a separate carousel section below the hero input that displayed inspiration ideas as title + subtitle with clickable dots. This took up significant vertical space and created two separate interaction points (input + carousel).

## Decision

**Replace the carousel with rotating placeholder text inside the hero input box.**

### Implementation

1. **Removed carousel HTML** — Deleted the entire `landing-carousel` div, `carousel-viewport`, and `carousel-dots` sections from index.html (lines 101-107).

2. **Added placeholder span** — Created `.hero-input-placeholder` as an absolutely positioned sibling of the input, displaying the rotating idea titles. CSS handles crossfade via opacity transitions.

3. **Placeholder rotation logic** — New `initPlaceholderRotation()` function in app.js:
   - Cycles through INSPIRATION_IDEAS array every 4 seconds
   - Crossfades with 300ms fade-out before showing next title
   - Dims to 40% opacity on input focus
   - Hides completely when input has text
   - Stops rotating when transitioning to chat

4. **Send button** — Added circular send button (`.hero-send-btn`) inside input wrapper with right-arrow icon:
   - If input has text → sends that text
   - If input is empty → sends the currently displayed rotating idea's `.prompt` field
   - Enables one-click interaction without typing

5. **Input padding** — Adjusted from `0 var(--spacing-l) 0 42px` to `0 44px 0 42px` to accommodate send button.

### Rationale

- **Reduced visual clutter**: Eliminates 70px of carousel height + dot indicators
- **Single interaction point**: Input and ideas combined into one element
- **Preserved all ideas**: Users still see all INSPIRATION_IDEAS rotate through
- **Faster interaction**: Click send button to use current idea without typing
- **Cleaner code**: Removed ~80 lines of carousel CSS, ~90 lines of carousel JS

### Trade-offs

- **Less context per idea**: Placeholder shows only the `title`, not `subtitle` or visual dot indicators
- **Can't skip to specific idea**: Users can't click dots to jump to a specific idea — they wait for rotation
- **Less explicit clickability**: Rotating placeholder is more subtle than a distinct carousel section

### Files Changed

- `packages/web/index.html` — Removed carousel HTML, added placeholder span + send button
- `packages/web/css/landing.css` — Removed carousel CSS, added placeholder + send button CSS
- `packages/web/js/app.js` — Removed carousel functions, added placeholder rotation logic

### Related Decisions

- Decision D12 (tracks as primary navigation)
- 2025-07-27 "Carousel wired to /api/inspirations endpoint" (now superseded — endpoint no longer used)

## Notes

The `INSPIRATION_IDEAS` array structure (`{ title, subtitle, prompt }`) is preserved. If we add the `/api/inspirations` endpoint back later, the placeholder rotation can easily consume it with a hot-swap pattern similar to the old `updateCarouselIdeas()`.

# Decision: React App Architecture with A2UI v0.9

**Author:** Fry  
**Date:** 2025-07-29  
**Status:** Implemented

## Context
The web frontend needed to be rebuilt as a React app that integrates with the vendored A2UI v0.9 renderer for rendering rich interactive components inline in chat messages.

## Decision
- Used `MessageProcessor` from `web_core` with `basicCatalog` from the React adapter (18 components).
- A2UI surfaces are created per-assistant-message and their IDs are stored in `ChatMessage.surfaceIds[]`.
- Demo mode with 6 hardcoded scenarios showcases all major A2UI component types without needing the backend.
- Word-by-word streaming simulation (40ms/word) gives the appearance of real LLM streaming.
- Existing CSS files are reused — no new stylesheets created.

## Consequences
- The app works fully in demo mode while Bender rewrites the backend.
- When the API is available, `useStreaming` hook connects via SSE automatically.
- A2UI surfaces are interactive — button clicks fire actions to the MessageProcessor.

# Decision: Simplify Landing Page to Hero + Track Cards

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-28
**Status:** Accepted (user-directed)

## Context

Ahmed reviewed the landing page and said "Too much going on here" — 5 stacked sections were competing for attention. The custom search input and typography didn't match Fluent 2.

## Decision

1. **Landing page shows only two sections**: Hero (title + Fluent 2 search + suggestion pills) and track cards (Web App or API, AI Agent). All other sections removed.
2. **Fluent 2 search component**: `<fluent-search>` web component replaces custom `<input>`. Styled by Fluent, not custom CSS.
3. **Fluent 2 typography**: Hero title uses 40px/semibold/-0.02em (Fluent 2 Hero ramp). Track cards use explicit Fluent 2 line-height tokens.
4. **Removed permanently**: Inspiration carousel, framework pills (9 buttons), IDE launch links. These were secondary CTAs that diluted the primary flow.

## Consequences

- Carousel API fetch (`/api/inspirations`) is no longer called — backend endpoint can be deprecated.
- Framework pre-selection removed — users now always go through the conversational discover phase.
- IDE links need a new home if we want them back (e.g., post-deploy handoff or settings).
- Landing page is now ~170 lines of CSS (was ~410).

# Decision: Spark UX P0 patterns

**Date**: 2025-07-24
**Author**: Fry
**Status**: Accepted

## Context
Implemented 4 Spark UX P0 items to align Kickstart with GitHub Spark's feel.

## Decisions
1. **Hero input** lives above the carousel inside `.landing-inner`; reuses `pendingQuickPrompt` → `transitionToChat()` flow.
2. **File chips** use event delegation (not direct listeners) because A2UI renders to `outerHTML` strings which strips DOM events.
3. **Sparkle loader** replaces typing dots; `setTyping(val, phase)` is backward-compatible (phase optional).
4. **Preview panel** reuses `#file-viewer` aside — adds a header overlay and body div; the file-viewer's own header is hidden via CSS. Phase→title mapping in `PREVIEW_TITLES`.
5. Both engine creation paths (API + demo) wire identical `onPhaseChange` + `onResponse` callbacks for preview panel updates.

# Decision: URL-param Feature Flags for Dev/Test Modes

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

We needed a way to test A2UI rendering and the full conversation flow without a running backend. Also needed to fix the model indicator bug and unblock track card / framework pill submissions when no API is available.

## Decision

Use URL query parameters as feature flags:
- `?mock` — Activates mock streaming mode. Bypasses API health check, uses canned demo responses with simulated word-by-word typing. Model set to `gpt-5.3-chat (mock)`.
- `?playground` — Renders a standalone A2UI test harness page instead of the normal app. Lets you inject demo scenarios or paste raw A2UI JSON.
- Both can be combined with other params freely.

## Consequences

- Anyone can test the full conversation flow locally without Azure OpenAI credentials: just add `?mock` to the URL.
- A2UI component rendering can be verified independently with `?playground`.
- No build-time flags, no environment variables — works in any deployment.
- Mock mode intentionally uses `getDemoResponse()` from demo-scenarios.ts, so mock and playground share the same fixture data.

# Decision: "WOW" UX Vision — The Living Workspace

**Date:** 2025-07-27
**Author:** Fry (Frontend Dev)
**Requested by:** Ahmed Sabbour
**Status:** Vision / Proposed

---

## 1. Experience Narrative — End-to-End User Journey

> The conversation IS the workspace. Not a chat that generates artifacts —
> a living surface where the app takes shape in front of your eyes.

### Scene 1: The Spark (Landing → First Turn)

User lands on a clean, confident hero page. A single input field with rotating placeholder text: *"I want to build a movie night picker..."* fades to *"I want to build an AI recipe finder..."*. Below: a row of framework pills (Next.js, FastAPI, Go...) that glow softly on hover with a brand-blue underline slide-in.

User types: **"I want to build a real-time air quality dashboard with a Python API and a React frontend."**

The landing page crossfades out (200ms ease-out). The chat workspace materializes — but it's NOT just a chat. Three regions emerge with a staggered entrance:

```
┌─────────────────────────────────────────────────────┐
│  ▸ Phase Breadcrumb (subtle, top-right)             │
├───────────┬─────────────────────┬───────────────────┤
│           │                     │                   │
│  Context  │    Conversation     │    Workspace      │
│  Rail     │    Stream           │    Panel          │
│  (240px)  │    (flex-1)         │    (380px)        │
│           │                     │                   │
│  · App    │  [assistant msgs]   │  · Architecture   │
│    Card   │  [user msgs]        │    Diagram        │
│  · File   │  [streaming...]     │  · File Editor    │
│    Tree   │                     │  · Cost Est.      │
│           │                     │                   │
│           ├─────────────────────┤                   │
│           │  ┌───────────────┐  │                   │
│           │  │ Message input  │  │                   │
│           │  └───────────────┘  │                   │
└───────────┴─────────────────────┴───────────────────┘
```

**Key:** Context Rail and Workspace Panel are EMPTY at first — they slide in as the conversation produces content. On mobile, they collapse to bottom sheets.

### Scene 2: The Understanding (Discover Phase — Turns 1-3)

Kickstart's first message streams in token-by-token — the text appears character by character with a subtle blinking cursor. Below the text, a **QuestionnaireCard** fades in (not appended as raw JSON — it animates into existence):

```
┌─────────────────────────────────────────────┐
│  How should we handle air quality data?      │
│                                              │
│  ┌ ○ ─────────────────────────────────────┐ │
│  │  Real-time streaming                    │ │
│  │  WebSocket connection to sensors,       │ │
│  │  updates every 5 seconds                │ │
│  └────────────────────────────────────────┘ │
│  ┌ ○ ─────────────────────────────────────┐ │
│  │  Polling interval                       │ │
│  │  Fetch from API every 30-60 seconds,    │ │
│  │  simpler to implement                   │ │
│  └────────────────────────────────────────┘ │
│  ┌ ○ ─────────────────────────────────────┐ │
│  │  Batch historical                       │ │
│  │  Load from CSV/database, best for       │ │
│  │  historical analysis dashboards         │ │
│  └────────────────────────────────────────┘ │
│                                              │
│                          [ Continue → ]      │
└─────────────────────────────────────────────┘
```

When the user clicks an option, the radio card gets a **brand-blue left border** and a subtle scale(1.01) lift. The other options shrink slightly (scale 0.98) and dim (opacity 0.5), then collapse away after 400ms. The selected answer appears as a user bubble: *"Real-time streaming — WebSocket to sensors."*

**Meanwhile, in the Context Rail (left):** An **AppCard** materializes — a small, persistent card that summarizes what Kickstart knows:

```
┌──────────────────────┐
│ 🌐 Air Quality       │
│    Dashboard          │
│ ─────────────────── │
│ Frontend: React       │
│ Backend:  Python API  │
│ Data:     Real-time   │
│ Status:   Discovering │
└──────────────────────┘
```

Each property appears with a typewriter animation as it's learned. The card persists and UPDATES across all turns — it never disappears.

### Scene 3: The Architecture (Design Phase — Turns 4-6)

As the conversation shifts to Design, the **Phase Breadcrumb** updates — a subtle pill at the top transforms:

```
Before:  [ Discover · Design · Generate · Review · Handoff ]
After:   [ ✓ Discover · ● Design · Generate · Review · Handoff ]
```

The checkmark appears with a pop animation (scale 0→1.2→1, 300ms spring). The active dot pulses gently.

Kickstart's response streams in: *"Here's the architecture I'd recommend for your real-time dashboard..."*

Then the **ArchitectureDiagram** assembles itself in the Workspace Panel. Not a static image — nodes appear ONE BY ONE:

```
Timeline:
  0ms    — "React SPA" node fades in (center-top)
  200ms  — Connection line draws downward (stroke-dashoffset animation)
  400ms  — "Python API" node fades in (center)
  600ms  — Two lines fork left and right
  800ms  — "WebSocket Hub" node appears (left)
  1000ms — "PostgreSQL" node appears (right)
  1200ms — "Azure Cache for Redis" node appears (below center)
```

Each node uses this entrance:
```css
@keyframes nodeAppear {
  0% { opacity: 0; transform: scale(0.8) translateY(8px); }
  60% { opacity: 1; transform: scale(1.02) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
/* duration: 400ms, easing: cubic-bezier(0.34, 1.56, 0.64, 1) — spring overshoot */
```

Connection lines animate with `stroke-dasharray` + `stroke-dashoffset`:
```css
.arch-connection {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: drawLine 600ms ease-out forwards;
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```

**Hover on a node** → tooltip with description, cost hint, and "Why this?" link. The connected edges glow brighter.

**In the Context Rail**, below the AppCard, a **FileTree** starts forming — empty at first, just a folder icon with the app name. It'll fill during Generate.

### Scene 4: The Generation (Generate Phase — The "Holy Shit" Moment)

This is where we go beyond both Spark and try-aks.

Kickstart says: *"Let me generate the deployment files for your dashboard..."*

A **FileGeneration** panel appears in the Workspace Panel. But unlike Spark's static list, this is a LIVE generation view:

```
┌─────────────────────────────────────────────┐
│  ▼ Generating Files              3/7 done   │
│  ─────────────────────────────────────────── │
│  ✓ Dockerfile              0.4 KB    0.3s   │
│  ✓ deployment.yaml         1.2 KB    0.8s   │
│  ◉ service.yaml            ░░░░░░░░░        │ ← progress bar, actively writing
│  ○ gateway.yaml                              │
│  ○ .github/workflows/ci.yml                  │
│  ○ hpa.yaml                                  │
│  ○ pdb.yaml                                  │
└─────────────────────────────────────────────┘
```

**The magic:** When the AI generates `service.yaml`, the code STREAMS into the FileEditor in real-time. The user can WATCH the YAML being written line by line:

```
┌─ File Tree ──┬─ service.yaml ────────────────────┐
│  📄 Dockerfile  │  1│ apiVersion: v1               │
│  📄 deployment  │  2│ kind: Service                │
│  📄 service.ya▸ │  3│ metadata:                    │
│  ○ gateway      │  4│   name: air-quality-api█     │ ← cursor blinks here
│  ○ ci.yml       │  5│                              │
│  ○ hpa.yaml     │                                  │
│  ○ pdb.yaml     │  ┌──────────────────────────┐   │
│                  │  │ Edit  Copy  Download     │   │
│                  │  └──────────────────────────┘   │
└──────────────┴──────────────────────────────────┘
```

**Streaming code editor pseudo-code:**
```js
// In the streaming callback, parse SSE chunks for file content
onStreaming({ type: 'file_chunk', filename: 'service.yaml', content: 'apiVersion: v1\n' }) {
  const editor = workspacePanel.getOrCreateEditor(filename);
  editor.appendContent(content);  // appends to <pre><code>
  editor.scrollToBottom();         // auto-scroll follows the cursor
  fileTree.setStatus(filename, 'generating');  // spinner on tree item
}

onStreaming({ type: 'file_complete', filename: 'service.yaml', size: 1247 }) {
  fileTree.setStatus(filename, 'done');     // checkmark on tree item
  fileGeneration.markComplete(filename);     // progress counter updates
}
```

**File tree in Context Rail** grows in real-time too — each new file slides in with:
```css
@keyframes fileSlideIn {
  from { opacity: 0; transform: translateX(-12px); height: 0; }
  to   { opacity: 1; transform: translateX(0); height: 28px; }
}
/* duration: 250ms, easing: ease-out */
```

Clicking a file in the tree switches the editor. Clicking a completed file shows it with full syntax highlighting (via Prism.js or Shiki, loaded lazily).

### Scene 5: The Review (Review Phase)

The conversation shifts to review. The architecture diagram subtly updates — nodes that now have generated files get a green checkmark badge. A **CostEstimate** panel slides into the Workspace below the diagram:

```
┌─────────────────────────────────────────────┐
│  Estimated Monthly Cost                      │
│  ─────────────────────────────────────────── │
│  App Platform (AKS Automatic)    $116.80     │ ← counter animates 0→116.80
│  PostgreSQL Flexible (B1ms)       $12.40     │ ← 200ms delay, then counts up
│  Azure Cache for Redis (C0)        $0.00     │
│  ─────────────────────────────────────────── │
│  Total                           $129.20     │ ← bold, counts up last
│                                              │
│  💡 "Free tier Redis covers prototyping.     │
│     Upgrade to C1 ($40/mo) for production."  │
└─────────────────────────────────────────────┘
```

**Cost counter animation:**
```js
function animateCounter(el, target, duration = 800) {
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = '$' + (target * eased).toFixed(2);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

Items appear staggered (each 150ms after the previous) so the table "builds up" as you watch.

### Scene 6: The Handoff (Handoff Phase)

An **AuthCard** appears inline in the chat:

```
┌─────────────────────────────────────────────┐
│  Connect your GitHub account to create a     │
│  repository for your air quality dashboard.  │
│                                              │
│  ┌─────────────────────────────────────────┐│
│  │  🔑 Sign in with GitHub                 ││
│  └─────────────────────────────────────────┘│
│                                              │
│  Already signed in? Select a repo:          │
│  ┌─────────────────────────────────────────┐│
│  │  🔍 Search repositories...              ││
│  └─────────────────────────────────────────┘│
│  + Create new repository                    │
└─────────────────────────────────────────────┘
```

After repo selection, a **PRCreation** card appears:

```
┌─────────────────────────────────────────────┐
│  Ready to create your pull request           │
│                                              │
│  📁 ahmedsabbour/air-quality-dashboard       │
│  🌿 Branch: kickstart/initial-deploy         │
│                                              │
│  Files to commit:     7 files, 4.2 KB        │
│  ✓ Dockerfile                                │
│  ✓ deployment.yaml                           │
│  ✓ service.yaml                              │
│  ✓ gateway.yaml                              │
│  ✓ .github/workflows/ci.yml                  │
│  ✓ hpa.yaml                                  │
│  ✓ pdb.yaml                                  │
│                                              │
│  [ Create Pull Request →                   ] │
└─────────────────────────────────────────────┘
```

The "Create Pull Request" button, when clicked, shows an inline progress bar that fills over ~3 seconds. On completion, it transforms into a success state with a link to the PR.

### Scene 7: The Persistence

The user can scroll back through the entire conversation and ALL components are still interactive. The file editor still works. The architecture diagram still responds to hover. The cost estimate is still there. The AppCard in the Context Rail shows the full accumulated state.

This is the "never seen before" factor: **the chat is a living document, not a disposable transcript.**

---

## 2. Component Catalog

### 2.1 QuestionnaireCard

**Purpose:** Present a decision point with rich, explanatory options. The #1 gap vs try-aks.

**Schema:**
```json
{
  "type": "Questionnaire",
  "question": "How should we handle data persistence?",
  "hint": "This affects cost and complexity",
  "options": [
    {
      "label": "Managed PostgreSQL",
      "value": "postgresql",
      "description": "Azure Database for PostgreSQL Flexible Server. Automatic backups, scaling, and HA.",
      "icon": "database",
      "recommended": true
    },
    {
      "label": "Cosmos DB",
      "value": "cosmosdb",
      "description": "Multi-model NoSQL. Best for globally distributed apps with flexible schemas."
    },
    {
      "label": "SQLite (embedded)",
      "value": "sqlite",
      "description": "Zero-config file database. Great for prototypes, not recommended for production."
    }
  ],
  "bind": "database",
  "allowCustom": true,
  "customPlaceholder": "Or describe what you need..."
}
```

**Interaction model:**
- Options render as stacked radio cards with `label` (bold) + `description` (muted) + optional `recommended` badge
- Clicking an option: selected card gets `border-left: 3px solid var(--color-brand-primary)` + lift shadow. Others fade to opacity 0.5
- If `allowCustom`: a text input appears below options
- "Continue" button is disabled until a selection is made; enabled with scale-pop animation
- On submit: unselected options collapse away (height → 0, 300ms). Selected option stays visible as a compact summary. User bubble appears with the choice

**CSS:**
```css
.questionnaire-option {
  border: 1px solid var(--color-neutral-stroke-2);
  border-radius: var(--radius-medium);
  padding: var(--spacing-m) var(--spacing-l);
  cursor: pointer;
  transition: all 200ms ease-out;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-m);
}

.questionnaire-option:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-lighter);
}

.questionnaire-option.selected {
  border-left: 3px solid var(--color-brand-primary);
  background: var(--color-brand-lighter);
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.1);
}

.questionnaire-option.dimmed {
  opacity: 0.4;
  pointer-events: none;
  transform: scale(0.98);
  transition: all 300ms ease-out;
}

.questionnaire-option.collapsing {
  max-height: 0;
  padding: 0;
  margin: 0;
  border: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 400ms ease-in;
}
```

### 2.2 FileGeneration

**Purpose:** Real-time file creation progress panel. The "Spark meets IDE" component.

**Schema:**
```json
{
  "type": "FileGeneration",
  "title": "Generating Deployment Files",
  "collapsible": true,
  "expanded": true,
  "files": [
    { "name": "Dockerfile", "status": "done", "size": "0.4 KB", "duration": "0.3s" },
    { "name": "deployment.yaml", "status": "generating", "progress": 0.6 },
    { "name": "service.yaml", "status": "pending" },
    { "name": "gateway.yaml", "status": "pending" }
  ],
  "statusText": "Writing deployment.yaml..."
}
```

**Interaction model:**
- Header is collapsible (chevron rotates 90° on toggle)
- Progress counter: "3/7 done" — the number animates on change
- Each file row: icon + name + status indicator (✓ green / ◉ spinner / ○ gray)
- File rows for `done` files are clickable → opens that file in the FileEditor
- `statusText` updates with typewriter animation to show what the AI is currently doing
- File rows slide in sequentially as new files start generating

**CSS for the generating spinner:**
```css
.file-gen-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-neutral-stroke-2);
  border-top-color: var(--color-brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.file-gen-row {
  animation: fileRowSlideIn 250ms ease-out both;
}

@keyframes fileRowSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.file-gen-row:nth-child(1) { animation-delay: 0ms; }
.file-gen-row:nth-child(2) { animation-delay: 80ms; }
.file-gen-row:nth-child(3) { animation-delay: 160ms; }
/* etc — stagger via nth-child or inline style */
```

### 2.3 FileEditor

**Purpose:** Split-pane code viewer with file tree and editor panel. Replaces the current tab-based FileViewer.

**Schema:**
```json
{
  "type": "FileEditor",
  "files": [
    { "name": "Dockerfile", "language": "dockerfile", "content": "FROM python:3.12-slim\n..." },
    { "name": "k8s/deployment.yaml", "language": "yaml", "content": "apiVersion: apps/v1\n..." }
  ],
  "activeFile": "Dockerfile",
  "readOnly": false
}
```

**Interaction model:**
- Left panel: file tree (collapsible folders, file-type icons from Fluent 2 icon set)
- Right panel: code area with line numbers, monospace font, syntax highlighting
- Header bar: filename, language badge, Edit/Copy/Download action buttons
- During streaming: code appends line-by-line with a blinking cursor at the end
- Copy button: click → "Copied!" with checkmark, resets after 2s
- Download button: creates a Blob and triggers `<a download>` click
- Edit button (future): switches to contenteditable mode with basic editing

**Streaming code append pseudo-code:**
```js
appendContent(newChunk) {
  this.buffer += newChunk;
  const codeEl = this.el.querySelector('.editor-code');
  // Use textContent for perf during streaming (no HTML parsing)
  codeEl.textContent = this.buffer;
  // Scroll to bottom, keeping the cursor visible
  codeEl.parentElement.scrollTop = codeEl.parentElement.scrollHeight;
  // Re-highlight only on complete (file_complete event), not per-chunk
}
```

**CSS:**
```css
.file-editor {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: 40px 1fr;
  border: 1px solid var(--color-neutral-stroke-2);
  border-radius: var(--radius-large);
  overflow: hidden;
  height: 400px;
}

.file-editor-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-m);
  background: var(--color-neutral-background-3);
  border-bottom: 1px solid var(--color-neutral-stroke-2);
  gap: var(--spacing-s);
}

.file-editor-tree {
  overflow-y: auto;
  border-right: 1px solid var(--color-neutral-stroke-2);
  background: var(--color-neutral-background-2);
  padding: var(--spacing-s) 0;
}

.file-tree-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-m);
  cursor: pointer;
  font-size: var(--font-size-200);
  transition: background 120ms ease;
}

.file-tree-item:hover { background: var(--color-neutral-background-3); }
.file-tree-item.active { background: var(--color-brand-lighter); font-weight: var(--font-weight-semibold); }

.file-editor-code {
  overflow: auto;
  background: var(--color-neutral-background-inverted);
  color: #d4d4d4;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-200);
  line-height: 1.6;
  padding: var(--spacing-m);
  white-space: pre;
  tab-size: 2;
}

/* Streaming cursor */
.editor-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-brand-primary);
  animation: cursorBlink 1s step-end infinite;
  vertical-align: text-bottom;
  margin-left: 1px;
}

@keyframes cursorBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

### 2.4 ArchitectureDiagram

**Purpose:** Visual service topology. Nodes animate in, connections draw, interactive on hover.

**Schema:**
```json
{
  "type": "ArchitectureDiagram",
  "title": "Application Architecture",
  "components": [
    { "id": "frontend", "name": "React SPA", "icon": "globe", "description": "Vite + React 18", "x": 50, "y": 10 },
    { "id": "api", "name": "Python API", "icon": "cloud", "description": "FastAPI on port 8000", "x": 50, "y": 40 },
    { "id": "db", "name": "PostgreSQL", "icon": "database", "description": "Flex Server B1ms", "x": 80, "y": 70 },
    { "id": "cache", "name": "Redis", "icon": "lightning", "description": "Azure Cache C0", "x": 20, "y": 70 }
  ],
  "connections": [
    { "from": "frontend", "to": "api" },
    { "from": "api", "to": "db" },
    { "from": "api", "to": "cache" }
  ]
}
```

**Interaction model:**
- Renders as inline SVG (not Mermaid — we need pixel-level control for animations)
- Nodes: rounded rect with icon + label, positioned by % coordinates
- Connections: SVG `<path>` with bezier curves, drawn with stroke-dashoffset animation
- Hover on node: tooltip with description + connected services highlight
- When a new component is added (across turns): the new node animates in, new connections draw
- The diagram in the Workspace Panel PERSISTS and UPDATES — it's not recreated each turn

**Node entrance stagger:**
```js
renderDiagram(schema) {
  const nodes = schema.components;
  nodes.forEach((node, i) => {
    const el = createNodeElement(node);
    el.style.animationDelay = `${i * 200}ms`;
    el.classList.add('node-entering');
    svgContainer.appendChild(el);
  });
  // Connections start after all nodes have appeared
  const connectionDelay = nodes.length * 200 + 100;
  schema.connections.forEach((conn, i) => {
    const path = createConnectionPath(conn);
    path.style.animationDelay = `${connectionDelay + i * 150}ms`;
    svgContainer.appendChild(path);
  });
}
```

### 2.5 CostEstimate

**Purpose:** Monthly cost breakdown with animated counters and contextual tips.

**Schema:**
```json
{
  "type": "CostEstimate",
  "title": "Estimated Monthly Cost",
  "currency": "USD",
  "items": [
    { "name": "App Platform (AKS Automatic)", "sku": "Standard", "cost": 116.80, "tip": "Includes control plane + default node pool" },
    { "name": "PostgreSQL Flexible", "sku": "B1ms", "cost": 12.40, "tip": "Burstable tier, 1 vCore, 2 GB RAM" },
    { "name": "Azure Cache for Redis", "sku": "C0 Basic", "cost": 0.00, "tip": "Free tier for prototyping" }
  ],
  "total": 129.20,
  "footnote": "Prices from Azure Retail Pricing API. Actual costs may vary."
}
```

**Interaction model:**
- Items appear staggered (150ms each) with slide-in from left
- Dollar amounts count up from $0.00 to target over 800ms (ease-out cubic)
- Total counts up AFTER all items have finished (100ms gap)
- Hover on a row: shows the `tip` in a tooltip
- If cost changes across turns (e.g., user adds a service), the new item slides in and the total re-counts from old value to new

**Counter animation (reusable):**
```js
function animateValue(el, from, to, duration = 800) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = `$${current.toFixed(2)}`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
```

### 2.6 AuthCard

**Purpose:** Inline sign-in card for Microsoft or GitHub auth. Clean, non-intrusive.

**Schema:**
```json
{
  "type": "AuthCard",
  "provider": "github",
  "title": "Connect your GitHub account",
  "description": "Required to create a repository and push your deployment files.",
  "state": "signed-out",
  "userName": null,
  "avatarUrl": null
}
```

**Interaction model:**
- `signed-out`: Shows sign-in button with provider logo
- `signing-in`: Button transforms to a loading spinner with "Connecting..."
- `signed-in`: Collapses to a compact bar: avatar + username + green checkmark + "Change account" link
- Supports both `github` and `microsoft` providers with appropriate branding

### 2.7 ResourcePicker

**Purpose:** Azure subscription / resource group / region cascading dropdowns.

**Schema:**
```json
{
  "type": "ResourcePicker",
  "resources": [
    { "name": "subscription", "label": "Subscription", "options": [...], "bind": "subscription" },
    { "name": "resourceGroup", "label": "Resource Group", "dependsOn": "subscription", "options": [], "bind": "resourceGroup" },
    { "name": "region", "label": "Region", "options": [...], "bind": "region", "recommended": "eastus2" }
  ]
}
```

**Interaction model:**
- Cascading: selecting a subscription triggers loading of resource groups
- Loading state: shimmer placeholder inside the dropdown
- Recommended option: highlighted with a "Recommended" badge
- Each dropdown uses the existing searchable dropdown pattern from RepoPicker

### 2.8 RepoPicker (Enhanced)

Already exists but enhance with:
- Organization filter dropdown above the repo search
- Repo visibility badges (public/private)
- "Create new" option creates an inline form (name + visibility + description) that slides down

### 2.9 PRCreation

**Purpose:** File summary + "Create Pull Request" action with progress.

**Schema:**
```json
{
  "type": "PRCreation",
  "repo": "ahmedsabbour/air-quality-dashboard",
  "branch": "kickstart/initial-deploy",
  "baseBranch": "main",
  "files": [
    { "name": "Dockerfile", "size": "0.4 KB", "status": "new" },
    { "name": "k8s/deployment.yaml", "size": "1.2 KB", "status": "new" }
  ],
  "state": "ready",
  "prUrl": null
}
```

**States:**
- `ready`: File list + "Create Pull Request" button (primary, full-width)
- `creating`: Button transforms to progress bar (indeterminate → determinate as steps complete)
- `created`: Button becomes green success state: "PR #42 Created — View on GitHub →"
- `error`: Red state with retry

### 2.10 ProgressStepper (Replacing the Phase Bar)

**Purpose:** Subtle breadcrumb-style progress indicator. NOT the current chunky dot-and-line bar.

**Schema:**
```json
{
  "type": "ProgressStepper",
  "steps": [
    { "id": "discover", "label": "Discover", "status": "completed" },
    { "id": "design", "label": "Design", "status": "active" },
    { "id": "generate", "label": "Generate", "status": "upcoming" }
  ]
}
```

**Visual:** A small, horizontal breadcrumb — like file path breadcrumbs in VS Code:

```
✓ Discover  ›  ● Design  ›  Generate  ›  Review  ›  Handoff
```

**CSS:**
```css
.progress-stepper {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-200);
  color: var(--color-neutral-foreground-3);
  padding: var(--spacing-xs) var(--spacing-m);
}

.stepper-step.completed { color: var(--color-success); }
.stepper-step.active { color: var(--color-brand-primary); font-weight: var(--font-weight-semibold); }
.stepper-step.upcoming { color: var(--color-neutral-foreground-disabled); }

.stepper-separator {
  color: var(--color-neutral-foreground-disabled);
  font-size: 10px;
}

/* Active step has a subtle pulse */
.stepper-step.active::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-brand-primary);
  margin-right: var(--spacing-xs);
  animation: stepperPulse 2s ease-in-out infinite;
}

@keyframes stepperPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 120, 212, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(0, 120, 212, 0); }
}
```

### 2.11 AppCard (Context Rail — Persistent Summary)

**Purpose:** Always-visible summary of what Kickstart knows about the user's app. Grows across turns.

**Schema (internal, not LLM-generated):**
```json
{
  "type": "AppCard",
  "appName": "Air Quality Dashboard",
  "properties": [
    { "key": "Frontend", "value": "React" },
    { "key": "Backend", "value": "Python (FastAPI)" },
    { "key": "Database", "value": "PostgreSQL" },
    { "key": "Data Model", "value": "Real-time streaming" }
  ],
  "phase": "design",
  "completeness": 0.65
}
```

**Interaction model:**
- Each new property animates in with typewriter effect on the value
- Completeness shows as a thin progress bar at the bottom of the card
- Clicking a property opens the relevant turn in the conversation

---

## 3. Streaming Behavior

### 3.1 Text Streaming (Current — Enhanced)

**Current:** `updateStreamingBubble()` shows plaintext with a CSS cursor.
**New:** During streaming, render lightweight markdown in real-time (bold, italic, inline code) but defer block-level elements (lists, code blocks, tables) until the stream completes. This gives the feel of rich text appearing live without the cost of full re-renders per token.

```js
// Streaming markdown renderer — fast path
function renderStreamingMarkdown(text) {
  // Only inline formatting during stream (cheap regex, no block parsing)
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  // Full renderMarkdown() called once on stream complete
}
```

### 3.2 Component Streaming

The `~~~a2ui` block problem: components only appear after the entire message is streamed. Fix this with **progressive A2UI parsing:**

**Protocol change:** Instead of a single `~~~a2ui` block at the end, the server sends a2ui components as structured SSE events:

```
event: text
data: {"content": "Here's the architecture I'd recommend..."}

event: component
data: {"type": "ArchitectureDiagram", "title": "Architecture", "components": [...]}

event: component
data: {"type": "Questionnaire", "question": "Which database?", "options": [...]}

event: text
data: {"content": "\n\nI recommend PostgreSQL for your use case because..."}

event: done
data: {}
```

**Client-side handling:**
```js
onStreamEvent(event) {
  switch (event.type) {
    case 'text':
      appendToStreamingBubble(event.content);
      break;
    case 'component':
      // Render component immediately — don't wait for stream end
      const el = renderA2UI(event.data, ctx);
      el.classList.add('component-entering');
      insertComponentAfterCurrentText(el);
      break;
    case 'file_chunk':
      fileEditor.appendContent(event.filename, event.content);
      fileGeneration.setStatus(event.filename, 'generating');
      break;
    case 'file_complete':
      fileGeneration.setStatus(event.filename, 'done');
      fileEditor.highlightSyntax(event.filename); // deferred highlight
      break;
    case 'done':
      finalizeStreamingBubble(); // convert to full rendered markdown
      break;
  }
}
```

### 3.3 Shimmer/Loading States

While a component is expected but not yet streamed, show a shimmer placeholder:

```css
.component-shimmer {
  height: 120px;
  border-radius: var(--radius-medium);
  background: linear-gradient(
    90deg,
    var(--color-neutral-background-3) 25%,
    var(--color-neutral-background-4) 50%,
    var(--color-neutral-background-3) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 3.4 File Content Streaming

Files stream line-by-line into the FileEditor. Key behaviors:
- Auto-scroll follows the "cursor" (latest line)
- Line numbers update incrementally
- Syntax highlighting is DEFERRED until file completion (Prism.js `highlightElement` is expensive)
- During streaming: monochrome code (white on dark) with blinking cursor at the end
- On completion: full syntax highlighting applies with a subtle fade-in

---

## 4. State Model

### 4.1 Persistent State (Survives Across Turns)

| State | Location | Updated By |
|-------|----------|-----------|
| AppCard properties | Context Rail | Extracted from each AI response |
| File tree | Context Rail | FileGeneration events |
| Architecture diagram | Workspace Panel | ArchitectureDiagram components |
| Cost estimate | Workspace Panel | CostEstimate components |
| Generated file contents | In-memory Map | File streaming events |
| User's form selections | `sessionState` object | Questionnaire/Picker `bind` values |
| Auth tokens | Session storage | AuthCard interactions |
| Current phase | ProgressStepper | Phase change events |

### 4.2 Ephemeral State (Per-Turn Only)

| State | Lifetime |
|-------|----------|
| Streaming text buffer | Cleared on message finalize |
| Typing indicator | Cleared on response start |
| Questionnaire (unselected options) | Collapsed after selection |
| Error bubbles | Dismissed on retry or next turn |

### 4.3 Session State Object

```js
// Central session state — replaces the scattered state management
const sessionState = {
  appName: null,
  framework: null,
  database: null,
  // ... all bind values from Questionnaire/Picker components
  files: new Map(),          // filename → content
  architecture: null,        // latest ArchitectureDiagram schema
  costEstimate: null,        // latest CostEstimate schema
  phase: 'discover',
  phaseIndex: 0,
  authState: {
    github: { token: null, user: null },
    azure: { token: null, subscription: null },
  },
};

// Components update state via bind keys
function updateSessionState(key, value) {
  sessionState[key] = value;
  EventBus.emit('state:changed', { key, value });
  // AppCard listens to this and updates its display
}
```

### 4.4 Cross-Turn Component Updates

When a component type appears in a LATER turn that already exists in the Workspace Panel, we UPDATE rather than recreate:

```js
function handlePersistentComponent(schema) {
  const componentType = schema.type;
  
  if (componentType === 'ArchitectureDiagram') {
    const existing = workspacePanel.querySelector('.arch-diagram');
    if (existing) {
      // Diff old vs new components — animate only the CHANGES
      const oldNodes = existing.dataset.nodeIds.split(',');
      const newNodes = schema.components.map(c => c.id);
      const addedNodes = newNodes.filter(id => !oldNodes.includes(id));
      // Animate only addedNodes in — existing nodes stay put
      addedNodes.forEach(nodeId => {
        const node = schema.components.find(c => c.id === nodeId);
        addNodeWithAnimation(existing, node);
      });
    } else {
      renderFreshDiagram(schema);
    }
  }

  if (componentType === 'CostEstimate') {
    const existing = workspacePanel.querySelector('.cost-estimate');
    if (existing) {
      // Animate from old total to new total
      const oldTotal = parseFloat(existing.dataset.total);
      animateValue(existing.querySelector('.cost-total'), oldTotal, schema.total);
      // Add new line items with slide-in
    } else {
      renderFreshCostEstimate(schema);
    }
  }
}
```

---

## 5. CSS / Animation Notes

### 5.1 Animation Principles

1. **Entrance animations:** Always ease-out (fast start, gentle stop). Use `cubic-bezier(0.33, 1, 0.68, 1)`.
2. **Spring effects** (for emphasis): `cubic-bezier(0.34, 1.56, 0.64, 1)` — slight overshoot.
3. **Exit animations:** ease-in (gentle start, fast end). `cubic-bezier(0.32, 0, 0.67, 0)`.
4. **Duration scale:** Micro (100ms) for hover/focus. Standard (200-300ms) for entries. Elaborate (400-600ms) for diagrams/complex.
5. **Stagger pattern:** 60-100ms between sequential items. Never more than 150ms.
6. **Reduce motion:** Respect `prefers-reduced-motion` — replace all animations with instant opacity transitions.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 5.2 New CSS Custom Properties

```css
:root {
  /* Animation tokens */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-micro: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  
  /* Layout */
  --context-rail-width: 240px;
  --workspace-panel-width: 380px;
  --chat-max-width: 720px;
  
  /* Component surfaces */
  --surface-card: var(--color-neutral-background-1);
  --surface-elevated: var(--color-neutral-background-1);
  --shadow-card: 0 1px 4px rgba(0, 0, 0, 0.08);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

### 5.3 Responsive Breakpoints

```css
/* Desktop: 3-column layout */
@media (min-width: 1200px) {
  .workspace-layout { grid-template-columns: var(--context-rail-width) 1fr var(--workspace-panel-width); }
}

/* Tablet: chat + workspace, context rail collapses to overlay */
@media (max-width: 1199px) and (min-width: 768px) {
  .workspace-layout { grid-template-columns: 1fr var(--workspace-panel-width); }
  .context-rail { position: absolute; left: 0; z-index: 50; }
}

/* Mobile: chat only, everything else is bottom sheet */
@media (max-width: 767px) {
  .workspace-layout { grid-template-columns: 1fr; }
  .workspace-panel { position: fixed; bottom: 0; left: 0; right: 0; max-height: 60vh; border-radius: var(--radius-xlarge) var(--radius-xlarge) 0 0; }
}
```

---

## 6. Implementation Priority

### Phase 1: "Wow in 3 Days" (Maximum impact, minimum code)

| # | Component | Why first | Effort |
|---|-----------|-----------|--------|
| 1 | **QuestionnaireCard** | Biggest UX gap vs try-aks. Transforms "pick a pill" into "guided decision." | 4h |
| 2 | **ProgressStepper** (breadcrumb) | Replaces ugly phase bar. Instant visual upgrade. | 2h |
| 3 | **Streaming text w/ markdown** | Real-time markdown during stream. Feels alive. | 3h |
| 4 | **Component entrance animations** | CSS-only. Add `component-entering` class with fadeIn + translateY. | 1h |
| 5 | **SSE component events** | Server sends `event: component` mid-stream. Components appear during generation, not after. | 4h (backend + frontend) |

**Phase 1 total: ~14h** — delivers a fundamentally different feel.

### Phase 2: "The Living Workspace" (1 week)

| # | Component | Why | Effort |
|---|-----------|-----|--------|
| 6 | **FileGeneration** panel | Real-time file creation list — the Spark-style wow. | 6h |
| 7 | **FileEditor** (split pane) | Replaces FileViewer. Tree + code. | 8h |
| 8 | **File streaming** (line-by-line) | Code appears as it's generated. The "holy shit" moment. | 6h |
| 9 | **Context Rail + AppCard** | Persistent sidebar summarizing learned state. | 4h |
| 10 | **Workspace Panel** layout | 3-column grid, responsive. Architecture + cost live here. | 4h |

**Phase 2 total: ~28h** — delivers the "conversation IS the workspace" promise.

### Phase 3: "Polish & Delight" (1 week)

| # | Component | Why | Effort |
|---|-----------|-----|--------|
| 11 | **ArchitectureDiagram** (animated SVG) | Nodes appear one-by-one. Connections draw. Interactive hover. | 10h |
| 12 | **CostEstimate** (animated counters) | Smooth counter animations, staggered rows. | 4h |
| 13 | **AuthCard** | Inline GitHub/Microsoft sign-in. | 4h |
| 14 | **PRCreation** | File summary + progress + success state. | 6h |
| 15 | **Session state + cross-turn updates** | Components persist and update across turns. | 8h |
| 16 | **`prefers-reduced-motion`** | Accessibility. Must-have. | 2h |

**Phase 3 total: ~34h**

### Phase 4: "Beyond" (Future)

- **ResourcePicker** with cascading Azure dropdowns
- **Real Azure Retail Pricing API** integration for CostEstimate
- **Syntax highlighting** with Shiki (lazy-loaded wasm)
- **Collaborative editing** — user can edit generated files before PR creation
- **Architecture diagram drag-and-drop** — user rearranges services
- **Voice input** — "Add a Redis cache" and watch the diagram update
- **Workspace snapshots** — save and share a workspace state as a URL

---

## 7. The "Never Seen Before" Factor

What makes a developer say "holy shit"?

1. **Watching code write itself.** Not a loading bar. Not a "generating..." message. Actually seeing YAML appear line by line in a syntax-highlighted editor, with a blinking cursor, scrolling down as the AI writes. Nobody does this.

2. **The conversation becomes a living document.** Every component the AI shows — the architecture diagram, the cost estimate, the file tree — STAYS there and UPDATES as the conversation progresses. Scroll back to turn 2 and the diagram is still interactive. This isn't chat. It's a workspace that evolves.

3. **Decisions have weight.** When you pick an option in a Questionnaire, the unchosen options physically collapse and disappear. The architecture diagram adds a node. The cost estimate ticks up. Every choice has visible, immediate consequences across the entire workspace. Cause and effect, beautifully visualized.

4. **Progressive complexity.** Turn 1 is just text and a simple question. By turn 10, you have a full IDE-like workspace with file tree, code editor, architecture diagram, cost panel, and a PR ready to go. You never felt the complexity creep — it emerged naturally.

5. **The counter.** When the total cost counts up from $0.00 to $129.20, dollar by dollar, with each line item staggering in — it's a tiny thing, but it signals that this tool KNOWS what it's doing. It's not just dumping text. It's computing, presenting, and animating your infrastructure costs in real-time.

That's the WOW. Not one feature — the emergent combination of all of them. The whole experience feels like the AI is **building** your app with you, right there in the conversation, and you can see every piece take shape.

---

## Consequences

- **System prompt changes needed:** Move from `~~~a2ui` fenced blocks to structured SSE events. The LLM still outputs JSON component schemas, but the server parses and emits them as typed events.
- **Backend SSE protocol:** Need `event: text`, `event: component`, `event: file_chunk`, `event: file_complete`, `event: phase`, `event: done` event types.
- **File size:** The a2ui-renderer.js will grow from ~18KB to ~30KB with new components. Still zero dependencies.
- **Browser compat:** All CSS used (grid, custom properties, `@keyframes`, `prefers-reduced-motion`) works in Chrome/Edge/Firefox/Safari 15+.
- **Performance:** Streaming code into `textContent` is fast (no HTML parsing). Syntax highlighting is deferred to completion. No per-token DOM thrashing.

# Decision: A2UI Compliance & Rendering Pipeline Audit

**Date:** 2025-07-18
**Author:** Leela (Lead)
**Requested by:** Ahmed Sabbour
**Status:** FINDING — Requires team action

---

## A. A2UI Spec Status — Are We Following It?

**Short answer: No. We invented our own format inspired by the A2UI name, but it does not conform to the canonical google/A2UI spec.**

### What the Canonical Spec Actually Is

The official A2UI specification (google/A2UI, currently v0.10) defines:

- **Flat adjacency-list** of components, each with `id`, `type`, `props`, and optional `children` (by ID reference)
- **Prefixed types**: `a2ui.Container`, `a2ui.Text`, `a2ui.Button`, `a2ui.DatePicker`, `a2ui.Form`, etc.
- **Three envelope messages** over JSONL: `surfaceUpdate`, `dataModelUpdate`, `beginRendering`
- **Streaming via JSONL** (newline-delimited JSON), not fenced blocks in Markdown
- **Data binding** with separate data model, JSON Pointer paths, and expressions
- **Security model**: client owns the widget catalog; agent can only reference pre-approved types

### What Kickstart Actually Implements

| Aspect | Canonical A2UI | Kickstart "A2UI" |
|--------|---------------|-----------------|
| Component format | Flat list, ID references | Nested tree (children inline) |
| Type naming | `a2ui.Button` | `Button` (unprefixed) |
| Transport | JSONL stream | `~~~a2ui` fenced block in Markdown |
| Envelope | surfaceUpdate/dataModelUpdate/beginRendering | None — raw JSON array |
| Data binding | Separate data model with expressions | Props baked into components |
| Standard types | Container, Text, Button, Form, DatePicker, etc. | Custom: DeploymentProgress, ArchitectureDiagram, CostEstimate, etc. |

**Verdict:** Kickstart uses "A2UI" as a branding label for a custom declarative component format. It is *philosophically aligned* (declarative JSON, client-side rendering catalog, LLM-generated) but *structurally incompatible* with the google/A2UI protocol. We should document this explicitly and decide whether to converge toward the spec or continue with our own format (with honest naming).

---

## B. Pipeline Trace — Step-by-Step from LLM to Screen

### Step 1: System Prompt tells LLM to use `~~~a2ui` blocks
**File:** `packages/core/src/prompts/system-prompt.ts` (Section 4-5, lines 102-175)

The LLM is instructed:
> "You can include interactive UI components by appending a ~~~a2ui fenced block at the END of your message. The block must contain a JSON array of component objects."

This is **correct instruction** for the LLM. The prompt also provides examples for Button, Row, Card, CodeBlock, ArchitectureDiagram, CostEstimate, AppOverview, DeploymentProgress, and HandoffCard.

Phase prompts (`packages/core/src/engine/phases.ts`) reinforce this: discover and design prompts say "ALWAYS include a ~~~a2ui block with Button components." Generate prompt shows CodeBlock and DeploymentProgress examples.

### Step 2: Backend receives and processes LLM output
**File:** `packages/web/api/src/functions/converse.ts` (lines 138-207)

SSE streaming path:
1. Streams raw `content` chunks to the client: `data: {"content": "..."}`
2. Accumulates all content into `fullContent`
3. On completion, calls `processLLMResponse(fullContent, engineState.currentPhase)`
4. Sends final `done` event with `cleanText` (stripped text) and `a2ui` (parsed components)

### Step 3: `processLLMResponse` extracts A2UI blocks
**File:** `packages/web/api/src/lib/response-processor.ts` (lines 19-50)

```typescript
const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;
```

**Critical finding:** This regex requires:
- `~~~a2ui` followed by whitespace+newline
- JSON content
- A newline then `~~~` at the **exact end of string** (`$` anchor)

If the LLM outputs any trailing whitespace, extra newlines, or content after the closing `~~~`, the regex **silently fails**. The `?` quantifier in `([\s\S]*?)` is non-greedy, which is correct, but the `$` end anchor is strict.

**Fallback path (lines 45-48):** If no `~~~a2ui` block is found, `inferComponents()` runs phase-based heuristics. These ONLY generate components for `discover` and `design` phases (button rows). For `generate`, `review`, `handoff`, and `deploy` phases, it returns `[]` — **no components at all**.

### Step 4: Frontend streaming receives data
**File:** `packages/web/js/api-client.js` (lines 193-258)

`readStream()` + `mergeChunk()`:
- During streaming, `assembled.message` accumulates raw text (including `~~~a2ui` content)
- When the `done` event arrives, `mergeChunk()` picks up `a2ui` and `cleanText` from the server
- The final `assembled` object has both `message` (raw accumulated text) and `cleanText` (server-cleaned text)

### Step 5: Engine maps API response
**File:** `packages/web/js/engine.js` (lines 392-402)

```javascript
function mapApiResponse(apiRes) {
  return {
    a2ui: apiRes.a2ui ?? null,
    text: apiRes.cleanText ?? apiRes.message ?? null,
    // ...
  };
}
```

**Key:** `text` prefers `cleanText` (A2UI-stripped) over raw `message`. This is correct IF `cleanText` was actually cleaned.

### Step 6: App renders the response
**File:** `packages/web/js/app.js` (lines 498-526)

```javascript
onResponse({ a2ui, text, systemPrompt, model }) {
  chatUI.setTyping(false);
  clearStreamingBubble();

  // 1. Always add text as a chat message
  if (text) {
    chatUI.addMessage({ role: 'assistant', text, model });
  }

  // 2. Render A2UI components separately
  if (a2ui) {
    const components = Array.isArray(a2ui) ? a2ui : [a2ui];
    const nonPhaseComponents = components.filter(c => c.type !== 'ConversationPhase');
    if (nonPhaseComponents.length > 0) {
      const html = renderA2UIMessage(nonPhaseComponents);
      chatUI.addMessage({ role: 'assistant', html });
    }
  }
}
```

**This is the execution point.** Text goes into one bubble (via `renderMarkdown`), A2UI components go into a second bubble (via `renderA2UI`).

### Step 7: Chat renders messages
**File:** `packages/web/js/framework/components.js` (lines 79-92)

```javascript
if (msg.html) {
  content = msg.html;          // A2UI-rendered HTML
} else if (cls === 'user') {
  content = escapeHtml(msg.text); // User text
} else {
  content = renderMarkdown(msg.text); // Assistant text → Markdown
}
```

When the A2UI regex FAILS: `text` = raw LLM output with JSON inside it → `renderMarkdown()` escapes it and shows it as plain text in the chat bubble. That's what Ahmed sees.

### Step 8: Streaming display
**File:** `packages/web/js/app.js` (lines 589-620)

```javascript
function updateStreamingBubble(text) {
  const a2uiIdx = text.indexOf('~~~a2ui');
  const displayText = a2uiIdx >= 0 ? text.substring(0, a2uiIdx).trimEnd() : text;
  const cleanText = displayText.replace(/~+$/, '');
  // ...
  textSpan.textContent = cleanText;
}
```

The streaming bubble correctly hides the `~~~a2ui` portion. But when the stream completes and the final message replaces it — if the regex failed on the server, the full text (with JSON) appears.

---

## C. Rendering Status Table

| Component | Renderer Exists | Has Been Triggered | Conditions to Render |
|-----------|:-:|:-:|---|
| **Text** | Yes | Yes (demo mode) | Any `{type:"Text"}` in A2UI array |
| **Button** | Yes | Yes (heuristic buttons) | Heuristic infers in discover/design phases |
| **TextField** | Yes | Never in practice | Would need explicit A2UI from LLM |
| **Row** | Yes | Yes (wraps heuristic buttons) | Heuristic produces Rows of Buttons |
| **Column** | Yes | Never in practice | Would need explicit A2UI from LLM |
| **Card** | Yes | Only demo mode | Would need explicit A2UI from LLM |
| **Tabs** | Yes | Never in practice | Would need explicit A2UI from LLM |
| **ConversationPhase** | Yes | Always (server adds it) | Filtered OUT of chat — shown in phase bar |
| **CodeBlock** | Yes | Only demo mode | Needs ~~~a2ui extraction to succeed |
| **ResourcePicker** | Yes | Never in practice | Would need LLM to output it in deploy phase |
| **DeploymentProgress** | Yes | Only demo mode | Needs ~~~a2ui extraction to succeed |
| **ArchitectureDiagram** | Yes | Only demo mode | Needs ~~~a2ui extraction to succeed |
| **CostEstimate** | Yes | Only demo mode | Needs ~~~a2ui extraction to succeed |
| **HandoffCard** | Yes | Only demo mode | Needs ~~~a2ui extraction to succeed |
| **RepoPicker** | Yes | Never in practice | Would need LLM in handoff phase |
| **WorkflowStatus** | Yes | Only demo mode | Needs ~~~a2ui extraction |
| **CodespaceLink** | Yes | Only demo mode | Needs ~~~a2ui extraction |
| **AppOverview** | Yes | Only demo mode | Needs ~~~a2ui extraction |
| **FileGeneration** | Yes | Only demo mode | Needs ~~~a2ui extraction |

**Summary:** In API mode, only Button and Row render (via heuristic fallback). All other components exist in the renderer but are NEVER triggered because the `~~~a2ui` extraction regex fails.

---

## D. Root Cause — Why Ahmed Only Sees Buttons

The root cause is a **two-stage failure**:

### Failure 1: The `~~~a2ui` regex doesn't match the LLM output (response-processor.ts line 19)

```typescript
const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;
```

The LLM likely produces output where:
- There's trailing whitespace or newlines after `~~~`
- The closing `~~~` has spaces after it followed by more text
- The LLM uses three backticks (` ```a2ui `) instead of tildes
- The JSON itself contains edge cases that prevent the regex from matching
- There may be multiple `~~~a2ui` blocks or the block is not at the exact end

When this regex fails to match → `components` stays `[]` → falls through to heuristics.

### Failure 2: Heuristic fallback only generates buttons for 2 of 6 phases (response-processor.ts lines 56-67)

```typescript
function inferComponents(text, phase) {
  switch (phase) {
    case "discover": return inferDiscoverComponents(text);
    case "design":   return inferDesignComponents(text);
    default:         return [];  // ← NOTHING for generate/review/handoff/deploy
  }
}
```

For phases 3-6 (generate, review, handoff, deploy), the heuristic returns empty. So:
- `a2ui` = only `[ConversationPhase]` from the server (which gets filtered out in app.js)
- `cleanText` = the FULL raw text (including any JSON the LLM embedded)
- User sees raw JSON text in the chat bubble

### Why buttons DO work:
In discover/design phases, the heuristic text-matching detects questions about language, repo, database, etc. and generates Row+Button components. These bypass the regex entirely. That's why Ahmed sees buttons but nothing else.

---

## E. Fix Recommendations

### Fix 1 (Critical): Make the regex more robust

```typescript
// Current (brittle):
const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;

// Proposed (resilient):
const A2UI_FENCE_RE = /~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;
// OR even more lenient:
const A2UI_FENCE_RE = /~~~a2ui\s*\n([\s\S]*?)\n~~~(?:\s*)$/m;
```

Also add a fallback for backtick-fenced blocks:
```typescript
const BACKTICK_RE = /```a2ui\s*\n([\s\S]*?)\n```\s*$/;
```

### Fix 2 (Critical): Strip raw A2UI JSON from the text when regex fails

Even if the regex doesn't match a perfect block, we should attempt to detect and remove raw JSON that looks like A2UI components from the displayed text. Otherwise users see raw JSON.

### Fix 3 (Important): Extend heuristics to all phases

The `inferComponents` function should have fallback patterns for generate, review, handoff, and deploy phases — not just return empty arrays.

### Fix 4 (Important): Add server-side logging

Log when `processLLMResponse` fails to extract a `~~~a2ui` block so we can see what the LLM is actually outputting and why the regex misses it.

### Fix 5 (Strategic): Decide on A2UI naming

We should either:
- **Option A:** Rename our format to "Kickstart Components" or "KUI" and stop claiming A2UI compliance
- **Option B:** Converge toward the canonical google/A2UI spec (flat adjacency list, prefixed types, JSONL transport)
- **Option C:** Keep calling it "A2UI" but document explicitly where we diverge and why

Ahmed wants clarity on this. My recommendation: **Option A or C** — we don't need full google/A2UI compliance for our use case (we're not a multi-agent platform), but we should be honest about what we're doing.

### Fix 6 (Hardening): Add integration test

Create a test that takes sample LLM outputs (with various `~~~a2ui` block formats) and verifies that `processLLMResponse` extracts them correctly. This would have caught the regex fragility issue.

---

## Priority Order

1. **Fix 1 + Fix 2** — Make extraction work. This unblocks ALL components.
2. **Fix 4** — Add logging so we can see failure patterns in production.
3. **Fix 5** — Decide on naming/positioning (for Ahmed's spec concern).
4. **Fix 3** — Better heuristic fallbacks for robustness.
5. **Fix 6** — Tests to prevent regression.

# Decision: Adopt A2UI v0.9 Properly — Full Compliance Plan

**Author:** Leela (Lead) via Coordinator  
**Date:** 2025-07-27  
**Status:** Proposed  
**Requested by:** Ahmed Sabbour  
**Scope:** Full A2UI protocol compliance — component format, envelope, surfaces, data binding, catalog

---

## Key Finding: v0.9 Is Actually Close to What We Need

After thoroughly studying the full A2UI spec (v0.8, v0.9, v0.10 direction), the critical insight is:

**A2UI v0.9's "prompt-first" philosophy is EXACTLY our use case.** The v0.9 evolution explicitly moved from "structured output" (v0.8) to "embed the schema in the LLM's system prompt and let it generate matching JSON." This is what we should have been doing from the start.

v0.9's flat component format is much simpler than v0.8:
```json
// v0.9 (what we should adopt)
{"id": "title", "component": "Text", "text": "Hello", "variant": "h1"}

// v0.8 (verbose, harder for LLMs)
{"id": "title", "component": {"Text": {"text": {"literalString": "Hello"}, "usageHint": "h1"}}}

// What we have today (non-compliant)
{"type": "Text", "content": "Hello", "variant": "heading"}
```

The gap between our current format and v0.9 is **small** — mostly property renames.

---

## Current Deviations from A2UI v0.9

### 1. Component Shape (SMALL gap)

| Property | Our format | A2UI v0.9 | Fix |
|----------|-----------|-----------|-----|
| Type discriminator | `"type": "Button"` | `"component": "Button"` | Rename `type` → `component` |
| Text content | `"content": "Hello"` | `"text": "Hello"` | Rename property |
| Text styling | `"variant": "heading"` | `"variant": "h1"` | Map values |
| Button label | `"label": "Deploy"` | `"child": "deploy-text-id"` | Use child ID reference |
| Button action | `"action": "deploy"` | `"action": {"event": {"name": "deploy"}}` | Restructure |
| Row/Column children | Inline array of objects | Array of string IDs | Switch to adjacency list |
| Row gap | `"gap": "8px"` | `"justify"`, `"align"` | Use A2UI layout props |
| Card children | `"children": [...]` | `"child": "content-id"` | Single child ID reference |

### 2. Composition Model (MEDIUM gap)

**Current:** Nested tree — children are inline objects:
```json
{"type": "Row", "children": [
  {"type": "Button", "label": "Yes"},
  {"type": "Button", "label": "No"}
]}
```

**A2UI v0.9:** Flat adjacency list — children referenced by ID:
```json
[
  {"id": "root", "component": "Row", "children": ["yes-btn", "no-btn"]},
  {"id": "yes-text", "component": "Text", "text": "Yes"},
  {"id": "yes-btn", "component": "Button", "child": "yes-text", "action": {"event": {"name": "confirm"}}},
  {"id": "no-text", "component": "Text", "text": "No"},
  {"id": "no-btn", "component": "Button", "child": "no-text", "variant": "borderless", "action": {"event": {"name": "cancel"}}}
]
```

**Why this is better for us:**
- Update any component by ID without resending the whole tree
- Stream components incrementally (send root first, children arrive later → progressive rendering)
- The flat structure is what v0.9 was specifically designed for LLMs to generate

### 3. Envelope Messages (LARGE gap — not implemented at all)

**Current:** No envelope. Components are extracted via regex from markdown.

**A2UI v0.9 requires four message types:**
- `createSurface` — initialize a UI region with a surfaceId + catalogId
- `updateComponents` — add/update components in a surface (flat list)
- `updateDataModel` — push data to the surface's data model
- `deleteSurface` — remove a UI region

**Our SSE stream should carry these as JSONL lines:**
```
{"version":"v0.9","createSurface":{"surfaceId":"chat-turn-1","catalogId":"https://kickstart.aks.azure.com/catalog/v1/kickstart.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"chat-turn-1","components":[...]}}
{"version":"v0.9","updateDataModel":{"surfaceId":"chat-turn-1","path":"/app","value":{"runtime":"Node.js"}}}
```

### 4. Data Binding (LARGE gap — not implemented)

**Current:** No data binding. Components are stateless.

**A2UI v0.9:** Components bind to a per-surface data model via JSON Pointers:
```json
{"id": "app-name", "component": "Text", "text": {"path": "/app/name"}}
```

When the data model updates (`updateDataModel` with `path: "/app/name"`, `value: "My Dashboard"`), the Text component automatically reflects the new value.

**This gives us reactive state for free:**
- Cost estimate binds to `/costs/total` — updates when pricing data arrives
- App overview binds to `/app/runtime`, `/app/services` — updates as conversation progresses
- Deployment progress binds to `/deploy/steps` — real-time status

### 5. Surfaces (LARGE gap — not implemented)

**Current:** Single chat stream, everything in one flow.

**A2UI v0.9 surfaces let us model Fry's three-panel layout:**

| Surface | surfaceId | Purpose |
|---------|-----------|---------|
| Chat | `chat` | Conversational messages + inline components |
| Workspace | `workspace` | Architecture diagram, file editor, cost estimate |
| Context | `context` | App card, file tree, persistent info |

Each surface has its own component buffer and data model. The agent can update the workspace diagram without touching the chat.

### 6. Custom Catalog (SMALL gap — mostly done)

**Current:** `kickstart-catalog.json` exists but uses our non-compliant format.

**A2UI v0.9:** Define a catalog as a JSON Schema extending the basic catalog:
```json
{
  "$id": "https://kickstart.aks.azure.com/catalog/v1/kickstart.json",
  "components": {
    "allOf": [
      {"$ref": "basic_catalog.json#/components"},
      {
        "CostEstimate": {
          "type": "object",
          "description": "Azure cost breakdown with animated counters",
          "properties": {
            "items": {"type": "array"},
            "total": {"$ref": "common_types.json#/$defs/DynamicNumber"},
            "currency": {"type": "string", "default": "USD"}
          },
          "required": ["items", "total"]
        },
        "ArchitectureDiagram": { ... },
        "FileGeneration": { ... },
        "AuthCard": { ... },
        "ResourcePicker": { ... },
        "RepoPicker": { ... },
        "DeploymentProgress": { ... }
      }
    ]
  }
}
```

### 7. Actions / Client-to-Server (MEDIUM gap)

**Current:** Custom event delegation with `data-action` attributes.

**A2UI v0.9:** Client sends structured `action` messages:
```json
{
  "version": "v0.9",
  "action": {
    "name": "select_runtime",
    "surfaceId": "chat-turn-3",
    "sourceComponentId": "runtime-btn-nodejs",
    "context": {"runtime": "nodejs"}
  }
}
```

---

## Recommended Architecture: A2UI v0.9 Over SSE

### The Pipeline

```
LLM (system prompt embeds Kickstart catalog)
  → outputs A2UI v0.9 JSON messages
  → server validates & enriches
  → SSE stream to client (each event = one A2UI message)
  → client renderer consumes (component buffer + data model)
```

### How Conversational Text Works

A2UI is a UI protocol — it doesn't have a "chat message" concept. We handle this by:

1. **SSE event types:**
   - `type: "text"` — streaming conversational text (token by token)
   - `type: "a2ui"` — A2UI envelope message (createSurface, updateComponents, etc.)
   - `type: "done"` — turn complete

2. The LLM outputs a JSON envelope: `{ "message": "...", "a2ui": [...] }`
   - `message` streams as text events
   - `a2ui` array items stream as a2ui events
   - Text appears first (streaming), components render as they arrive

### What the Client Needs

A v0.9-compliant client implements:
1. **JSONL parser** — parse each SSE event as a distinct A2UI message
2. **Component buffer** — per-surface `Map<string, Component>`
3. **Data model store** — per-surface reactive JSON state
4. **Widget registry** — maps component type names to our HTML render functions
5. **Surface manager** — lifecycle for chat/workspace/context surfaces

Our existing `a2ui-renderer.js` IS the widget registry. We update the render functions to accept v0.9 property names, but the architecture is the same.

---

## Migration Plan

### Phase 1: Fix Component Format (2-3 days)

1. Update `kickstart-catalog.json` to v0.9 JSON Schema format
2. Rename properties in renderer: `type` → `component`, `content` → `text`, etc.
3. Update system prompt to teach v0.9 format (embed catalog in prompt, per v0.9 philosophy)
4. Switch to `response_format: json_object` — LLM outputs `{ message, a2ui: [...] }`
5. Replace regex extraction with JSON.parse

### Phase 2: Adjacency List + Surfaces (1 week)

1. Implement component buffer (`Map<string, Component>`) in client
2. Switch from nested tree to flat adjacency list
3. Implement surface manager (chat, workspace, context surfaces)
4. Implement data model store with JSON Pointer resolution
5. Implement `createSurface`, `updateComponents`, `updateDataModel` SSE events

### Phase 3: Data Binding + Progressive Rendering (1 week)

1. Bind components to data model paths
2. Reactive updates when data model changes
3. Progressive rendering — render components as they arrive (even if children missing)
4. Component streaming — each component in `updateComponents` rendered incrementally
5. State accumulation across turns via `updateDataModel`

### Phase 4: Custom Catalog + Actions (3-5 days)

1. Publish Kickstart catalog extending basic_catalog
2. Implement proper `action` messages (client → server)
3. Catalog negotiation for MCP surface
4. Validation feedback loop (if LLM generates invalid JSON, send error, retry)

---

## What This Means for Leela's Earlier Decision (Option C)

Option C (structured JSON envelope) is compatible — but now we know the EXACT format:
- The envelope isn't `{ message, components, stateUpdates }` (our invention)
- The envelope is A2UI v0.9 messages: `createSurface`, `updateComponents`, `updateDataModel`
- The conversational text is a separate SSE stream alongside A2UI messages
- State updates use `updateDataModel` with JSON Pointer paths, not `stateUpdates` key-value

**We don't need our own spec. A2UI v0.9 gives us everything.**

---

## What We Keep vs. What Changes

### Keep (unchanged)
- SSE transport (A2UI is transport-agnostic, SSE is supported)
- Portal Prototyper CSS styling
- Phase-based conversation flow
- Demo mode (update to emit v0.9 format)
- MCP server structure (update payload format)

### Keep (evolve)
- `a2ui-renderer.js` → update property names, add component buffer
- `kickstart-catalog.json` → rewrite as v0.9 JSON Schema
- System prompt → embed catalog, teach v0.9 format per "prompt-first" philosophy

### Kill
- `~~~a2ui` fenced blocks
- Regex extraction in `response-processor.ts`
- Nested tree component format
- Heuristic `inferComponents()` fallback
- Our invented envelope format (`{ message, components, stateUpdates }`)

### Add (new)
- Component buffer (Map per surface)
- Data model store (JSON per surface)
- Surface manager (chat/workspace/context)
- Action handler (client → server events)
- JSON Pointer resolution for data binding

# Decision: Adaptive UI Ecosystem — Definitive Capability Map

**Date:** 2025-07-20
**Author:** Leela (Lead)
**Requested by:** Ahmed Sabbour
**Status:** FINDING — Capability audit for Kickstart parity planning

---

## Executive Summary

Full source code audit of 4 repositories: `adaptive-ui-azure-pack`, `adaptive-ui-github-pack`, `adaptive-ui-framework`, and `adaptive-ui` (parent). Every exported component, tool, OAuth flow, API proxy route, and framework feature is documented below with implementation details.

**Totals:**
- **10 pack components** (4 Azure + 6 GitHub)
- **25 built-in framework components**
- **3 LLM-callable tools** (2 Azure + 1 GitHub)
- **1 built-in tool** (fetch_webpage)
- **10 API proxy routes** (LLM, ARM, auth, GitHub OAuth, pricing, Bicep, Google Maps/Flights)
- **2 OAuth flows** (MSAL popup + GitHub Device Code)
- **1 artifact/file system** with PR creation
- **1 LLM adapter** (Chat Completions + Responses API, model routing, tool loop)

---

## A. Azure Pack (`@sabbour/adaptive-ui-azure-pack` v0.4.0)

### A.1 Components

#### `azureLogin` — MSAL Popup Sign-In
- **Auth:** `@azure/msal-browser` PublicClientApplication
- **Client ID:** `6c303fad-f9a9-42a1-b92f-3b615179086c` (Azure CLI well-known)
- **Authority:** `https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47` (Microsoft tenant)
- **Scopes:** `https://management.azure.com/user_impersonation`, `https://graph.microsoft.com/User.Read`
- **Token exchange:** Proxied through `/api/auth-proxy` to bypass CORS
- **State writes:** `__azureToken`, `__azureSubscriptions`, `__azureSelectedSubscription`
- **UX:** Popup login → fetches subscriptions → auto-selects if single → shows picker if multiple → "Continue" button for Adaptive mode

#### `azureResourceForm` — Dynamic ARM Schema Form
- **Props:** `resourceType` (e.g. `"Microsoft.ContainerService/managedClusters"`), `bind`
- **Implementation:** Fetches schema via `fetchResourceTypeSchema()` → queries `/providers/{namespace}?api-version=2021-04-01`
- **Renders:** text/number/boolean/enum fields dynamically from ARM provider metadata
- **State writes:** `{bind}_{propertyName}` for each field
- **Cache:** 5-minute TTL schema cache

#### `azurePicker` — Searchable ARM Dropdown
- **Props:** `api`, `bind`, `label`, `labelKey`, `valueKey`, `filterKey`, `filterValue`, `labelBind`, `itemsPath`, `loadingLabel`
- **Implementation:** Calls ARM REST API, auto-resolves API versions from provider metadata cache
- **Guards:** Detects unresolved `{{state.key}}` interpolation → shows "Waiting for selection..." instead of calling API
- **Uses:** `SearchableDropdown` from core framework
- **Side effect:** Syncs `_activeSubscriptionId` module-level var when subscription picked

#### `azureQuery` / `azQuery` (alias) — ARM API Caller
- **Props:** `api`, `bind`, `method` (GET/PUT/POST/DELETE/PATCH), `body`, `confirm` (shows confirmation dialog), `loadingLabel`, `showResult`
- **Auto-execute:** GET on mount; writes require confirmation dialog
- **Interpolation:** `interpolate()` resolves `{{state.key}}` in `api` path and `body`
- **Graph support:** Auto-acquires Graph token for `https://graph.microsoft.com` URLs
- **Output:** Generates Azure Portal links from ARM paths; tabular display for arrays, JSON for objects
- **Fallback:** Shows inline subscription picker if `_activeSubscriptionId` missing

### A.2 Tools (LLM-callable)

| Tool | Type | Auth | Description |
|------|------|------|-------------|
| `azure_arm_get` | GET only | Bearer token (user) or DefaultAzureCredential (workload identity) | ARM REST API. `{sub-id}` placeholder auto-injected. Response truncated at 8000 chars |
| `azure_pricing` | GET only | None (public API) | Azure Retail Prices API via `/api/pricing-proxy`. Filters: `armSkuName`, `serviceName`, `armRegionName`, `currencyCode`. Returns ≤10 records |

### A.3 Skills Resolver
- **File:** `skills-resolver.ts`
- **Mechanism:** Keyword-triggered ARM PUT body templates
- **Covered services:** AKS, App Service, Container Apps, ACR, Cosmos DB, SQL, Storage, Key Vault, Role Assignments
- **AKS Automatic:** Deep domain knowledge (cluster creation, Gateway API, Workload Identity, Deployment Safeguards, ACR integration)
- **Format:** Static templates, no external fetch

### A.4 Intent Resolvers (defined in system prompt)
| Resolver | Component | Pre-configured API |
|----------|-----------|-------------------|
| `azure-regions` | `azurePicker` | ARM regions endpoint |
| `azure-resource-groups` | `azurePicker` | ARM resource groups |
| `azure-skus` | `azurePicker` | ARM SKUs |
| `azure-subscriptions` | `azurePicker` | ARM subscriptions |

### A.5 Icon System
- **`icon-resolver.ts`**: Maps ARM resource types + keywords → SVG icon URLs (21 Azure service icons)
- **`diagram-icons.ts`**: Registers 27 Azure + 15 Kubernetes resource icons for Mermaid diagrams via `registerDiagramIcons()`. Syntax: `%%icon:azure/service-name%%`

### A.6 Settings UI
- `AzureSettings.tsx`: Sign-in/sign-out button injected into settings panel
- Shows account name + username when signed in

---

## B. GitHub Pack (`@sabbour/adaptive-ui-github-pack` v0.4.0)

### B.1 Components

#### `githubLogin` — OAuth Device Flow Sign-In
- **Client ID:** `Ov23liG3k61qLZnRjBGu` (default, configurable in settings)
- **Scopes:** `repo workflow read:user read:org`
- **Flow:** POST `/api/github-oauth/device/code` → display user code + verification URI → poll `/api/github-oauth/access_token` every 5s (max 60 attempts = 5 min)
- **Storage:** Token in `localStorage['adaptive-ui-github-token']`
- **State writes:** `__githubToken`, `__githubUser`
- **Auto-validate:** On mount, checks existing token validity; auto-continues after sign-in
- **CORS:** Dev uses Vite proxy, prod uses `/api/` SWA Functions or user-configured CORS proxy

#### `githubQuery` — GitHub API Caller
- **Props:** `api`, `bind`, `method`, `body`, `confirm` (string = button label), `loadingLabel`, `showResult`
- **Smart fix:** Auto-rewrites `/orgs/<user>/repos` → `/user/repos` for personal accounts (checks `__githubOrgIsPersonal`)
- **Auto-continues** after successful writes

#### `githubRepoInfo` — Rich Repository Card
- **Props:** `repo` (owner/repo string, supports interpolation)
- **Displays:** Name, description, language, stars, forks, issues with avatar

#### `githubPicker` — Searchable Dropdown from GitHub API
- **Props:** `api`, `bind`, `label`, `labelKey`, `valueKey`, `descriptionKey`, `labelBind`, `loadingLabel`, `includePersonal`
- **Auto-paginate:** Up to 300 items (per_page=100)
- **Persistence:** Org/repo selections saved to localStorage across sessions
- **State writes:** `__githubOrgIsPersonal` flag
- **Auto-continues** after selection

#### `githubCreatePR` — Create PR with All Generated Artifacts
- **Props:** `title`, `baseBranch`, `owner`, `repo`, `commitToSameBranch`
- **Implementation:** Calls `createPullRequest()` from core framework's `FilesPanel`
- **Artifact source:** `useSyncExternalStore(subscribeArtifacts, getArtifacts)`
- **Filters:** Excludes `.mmd` files (Mermaid diagrams)
- **Branch naming:** `adaptive-ui/{timestamp}`
- **Features:** Auto-detects default branch, supports updating existing PRs (tracks `__githubPRBranch`, `__githubPRUrl`, `__githubPROwner`, `__githubPRRepo`), initializes empty repos, checkbox for direct-to-base-branch commit

#### `githubSetSecret` — Set GitHub Actions Repository Secrets
- **Props:** `secretName`, `secretValue`, `owner`, `repo`, `confirm`, `bind`
- **Encryption:** `tweetnacl-sealedbox-js` for libsodium sealed box encryption
- **Flow:** GET public key → encrypt with sealed box → PUT encrypted secret
- **Dependencies:** `tweetnacl`, `tweetnacl-sealedbox-js`, `tweetnacl-util`

### B.2 Tools (LLM-callable)

| Tool | Type | Auth | Description |
|------|------|------|-------------|
| `github_api_get` | GET only | Bearer token (user PAT or OAuth) | GitHub REST API with auto-pagination (up to 200 items). Slims repos→essential fields, orgs→login+desc, issues→number+title+state. Truncated at 30000 chars |

### B.3 Intent Resolvers (defined in system prompt)
| Resolver | Component | Pre-configured API |
|----------|-----------|-------------------|
| `github-orgs` | `githubPicker` | `/user/orgs` |
| `github-repos` | `githubPicker` | `/orgs/{org}/repos` |

### B.4 Auth System (`auth.ts`)
- **Two methods:** OAuth Device Flow or PAT (Personal Access Token)
- **Token inspection:** `inspectStoredToken()` → returns scopes, `hasWorkflowScope`, `tokenPreview`
- **Persistence:** Org/repo selections stored in localStorage across sessions
- **CORS handling:** Dev = Vite proxy, prod = `/api/` SWA Functions or user CORS proxy

### B.5 Settings UI (`GitHubSettings.tsx`)
- OAuth App Client ID input (pre-filled with default)
- Device code display with user code + verification URI
- Connected state: shows user, token inspection (scopes, workflow scope check)
- Disconnect button

---

## C. Core Framework (`@sabbour/adaptive-ui-core`)

### C.1 Built-in Components (25 total)

| # | Component | Category | Description |
|---|-----------|----------|-------------|
| 1 | `text` | Text | Semantic text with variants (h1-h4, body, caption, code) |
| 2 | `button` | Action | Interactive button; primary/secondary/danger/ghost variants |
| 3 | `input` | Input | Text or textarea field with form binding |
| 4 | `select` | Input | Searchable dropdown with filtered options |
| 5 | `combobox` | Input | Dropdown allowing custom values |
| 6 | `questionnaire` | Guided | Stepped question card with radio + freeform text |
| 7 | `image` | Content | Sanitized image with error fallback |
| 8 | `container` | Layout | Flex column wrapper |
| 9 | `columns` | Layout | Grid multi-column layout with custom widths |
| 10 | `card` | Layout | Padded container with optional click handler |
| 11 | `list` | Data | Array items rendered via `itemTemplate` |
| 12 | `table` | Data | Data rows with configurable/inferred columns |
| 13 | `form` | Input | Form wrapper with submit handler |
| 14 | `tabs` | Layout | Tab navigation with panels |
| 15 | `progress` | Feedback | Horizontal progress bar with percentage |
| 16 | `alert` | Feedback | Colored alert box (info/success/warning/error) |
| 17 | `chatInput` | User Input | Text input with send button + prompt history |
| 18 | `markdown` | Content | Simple markdown rendering |
| 19 | `radioGroup` | Input | Radio button group with descriptions |
| 20 | `multiSelect` | Input | Checkbox group; comma-separated values |
| 21 | `toggle` | Toggle | On/off switch; stores 'true'/'false' string |
| 22 | `slider` | Input | Range slider with live value display |
| 23 | `divider` | Layout | Horizontal line with optional label |
| 24 | `badge` | Feedback | Inline colored pill (blue/green/red/yellow/gray/purple) |
| 25 | `accordion` | Layout | Collapsible sections |
| 26 | `codeBlock` | Content | Syntax-highlighted code with Copy + Save buttons |
| 27 | `link` | Action | Anchor tag with optional external icon |

### C.2 Component Registry (`registry.ts`)
- **Interface:** `ComponentPack { name, displayName, components, systemPrompt, initialize?, resolveSkills?, settingsComponent?, tools? }`
- **API:** `registerPack()`, `resolvePackSkills()`, pack prompt management
- Dynamic pack loading — packs self-register their components + system prompts + tools

### C.3 Artifact / File System (`artifacts.ts`)
- **In-memory + localStorage** virtual filesystem
- **Operations:** `save`, `upsert`, `remove`, `clear`, `download` (individual or all)
- **Session-scoped** persistence (localStorage key: `adaptive-ui-artifacts`)
- **Language → extension** mapping for auto-naming
- **External store pattern:** `subscribeArtifacts`, `getArtifacts` → React `useSyncExternalStore` compatible

### C.4 PR Creation (`FilesPanel.tsx`)
- **`createPullRequest()`**: Creates branch `adaptive-ui/{timestamp}` from base → commits each artifact file → opens PR
- **`updatePullRequestBranch()`**: Updates files on an existing PR branch
- **Retry logic:** Up to 3 attempts per file commit (handles GitHub eventual consistency 404/409/422)
- **Empty repo handling:** Auto-initializes with README if repo has no commits
- **Direct commit mode:** `commitToSameBranch` option bypasses PR branch creation
- **Standalone FilesPanel:** Also has a built-in "⬢ PR" button that reads GitHub token/org/repo from localStorage

### C.5 File Viewer (`FileViewer.tsx`)
- **Two editor modes:** `prism` (default lightweight Prism.js) and `monaco` (VS Code-like, lazy-loaded)
- **Mermaid diagrams:** `.mmd` files rendered via registered diagram renderer
- **Edit features:** In-editor editing with Save/Cancel, Ctrl+S shortcut, Tab→2 spaces
- **Syntax languages:** bicep, json, yaml, bash, dockerfile, hcl/terraform, typescript, javascript, python, css, sql, markdown, html, xml
- **Actions:** Copy, Download, Edit

### C.6 Tool System (`tools.ts`)
- **`registerTool(name, description, parameters, handler)`**: Makes function callable by LLM
- **Built-in tool:** `fetch_webpage` with SSRF protection (domain allowlist)
- **Tool call loop:** LLM requests tool → adapter executes → sends result back → up to 5 rounds
- **Pack tools:** Each pack registers its own tools at initialization time

### C.7 Schema (`schema.ts`)
- **`AdaptiveUISpec`:** `{ version, title, layout, state, agentMessage, theme, diagram }`
- **`ConversationTurn`:** `{ id, userMessage, userData, agentSpec, timestamp }`
- **24+ node types** defined with full TypeScript interfaces
- **Actions:** `setState`, `navigate`, `submit`, `dismiss`, `continue`
- **Validation** for spec structure

### C.8 LLM Adapter (`llm-adapter.ts`)
- **APIs supported:** Chat Completions (`/v1/chat/completions`) and Responses API (`/responses`)
- **Model routing:** Task-based router with `code`, `planning`, `default` slots; classifies via LLM call
- **Default model:** `gpt-4o` fallback; configurable per-app
- **System prompt assembly:** Base ADAPTIVE_UI_SYSTEM_PROMPT + COMPACT_PROMPT + pack prompts + optional suffix
- **Skill injection:** New skills from `resolvePackSkills()` added as one-time user context message
- **Tool loop:** Max 5 rounds; retries with `response_format: { type: 'json_object' }` if non-JSON after tools
- **JSON repair:** 7-stage repair pipeline (strip fences, extract balanced JSON, escape newlines, close truncated brackets, etc.)
- **Context compaction:** Triggers when >100k prompt tokens; keeps last 6 messages, summarizes older
- **Retry logic:** Exponential backoff for 429, 502-504 errors; max 3 attempts
- **No streaming:** All requests are request/response (no SSE streaming)

### C.9 Conversation Orchestrator (`AdaptiveApp.tsx`)
- **Turn-based conversation:** Manages `ConversationTurn[]` with agent specs and user responses
- **State management:** React context with dispatch; per-spec theme cascading via CSS variables
- **History persistence:** Optional localStorage persistence via `persistKey`
- **Rewind & reissue:** Pop last turn, optionally switch models mid-conversation
- **Settings panel:** LLM mode toggle (hosted proxy vs BYO API key), model selection, pack-specific settings injection
- **Token tracking:** Per-request and cumulative; `lastRequestUsage` exposed for cost tracking
- **Activity indicator:** Shows live HTTP request log (method + URL)

### C.10 Compact JSON Notation (`compact.ts`)
- Shorthand JSON format for LLM output compression
- Reduces token count by ~30-50% for component specs

### C.11 Session Management (`SessionsSidebar.tsx`)
- Multi-session sidebar with session list
- Session persistence, rename, delete
- ~32KB of UI code

---

## D. API Proxy (`api/src/functions/proxy.ts`)

Single Azure Functions catch-all handler (`httpTrigger`, route `{*path}`).

| # | Route | Purpose | Auth |
|---|-------|---------|------|
| 1 | `/api/llm-proxy` | LLM proxy. Injects API keys from env (`LLM_PROXY_API_KEY`, `LLM_PROXY_MODELS_CONFIG`). Supports Azure OpenAI, Azure AI Foundry, Chat Completions + Responses API. Exponential backoff retry. | Server-side API key |
| 2 | `/api/llm-proxy/models` | Returns available model list from proxy config | None |
| 3 | `/api/arm-proxy` | ARM API proxy. Forwards user Bearer token or falls back to `DefaultAzureCredential` (workload identity/managed identity) | User token or managed identity |
| 4 | `/api/auth-proxy` | Rewrites to `login.microsoftonline.com` — CORS bypass for MSAL token exchange | Passthrough |
| 5 | `/api/github-oauth/device/code` | Proxies to `github.com/login/device/code` | None (public) |
| 6 | `/api/github-oauth/access_token` | Proxies to `github.com/login/oauth/access_token` | None (public) |
| 7 | `/api/pricing-proxy` | Proxies to `prices.azure.com` | None (public) |
| 8 | `/api/bicep-compile` | Compiles Bicep → ARM JSON using `az bicep build` | None |
| 9 | `/api/gmaps-key` | Returns Google Maps API key from env | None |
| 10 | `/api/gflights-proxy` | Proxies to `google.com` for flights data | None |

**SSRF Protection:** `ALLOWED_TARGETS` allowlist for external fetch.
**Dependencies:** `@azure/functions` v4, `@azure/identity`.

---

## E. Parent Repo (`adaptive-ui`)

- **Workspace:** Git submodules for framework + 5 packs + 3 demo apps
- **Demo apps:** `adaptive-ui-solution-architect`, `adaptive-ui-trip-notebook`, `adaptive-ui-try-aks`
- **Tooling:** `workspacectl.mjs` — release/sync/doctor/contract commands
- **Deployment:** Azure Static Web App with linked Functions API
- **SWA landing page:** `swa/index.html`

---

## F. Gap Analysis — What Kickstart Needs to Build for Parity

### F.1 Must-Have (Core capabilities that make the system work)

| Capability | A2UI Has | Kickstart Equivalent Needed |
|------------|----------|---------------------------|
| **Component registry with dynamic pack loading** | `registerPack()`, `ComponentPack` interface | Pack system that loads Azure/GitHub components at runtime |
| **LLM adapter with tool loop** | Chat Completions + Responses API, 5-round tool loop, JSON repair | LLM integration with tool calling support |
| **Artifact/file system** | In-memory + localStorage virtual FS, save/upsert/remove/clear/download | File management for generated code |
| **PR creation from artifacts** | `createPullRequest()`, `updatePullRequestBranch()` with retry logic | GitHub integration to push generated files |
| **Azure MSAL auth** | Popup login, multi-subscription picker, ARM + Graph tokens | Azure sign-in for ARM operations |
| **GitHub OAuth** | Device code flow, PAT support, token inspection | GitHub auth for repo operations |
| **ARM API calling** | `azureQuery` with interpolation, auto-execute GET, confirmation for writes | Azure resource management |
| **GitHub API calling** | `githubQuery` with personal account auto-fix | GitHub resource management |
| **Searchable dropdowns** | `azurePicker` / `githubPicker` with auto-pagination, API version resolution | Dynamic data-driven selectors |
| **System prompt + pack prompt injection** | Base prompt + pack prompts + skill injection | LLM context management |

### F.2 Should-Have (Significant UX/DX features)

| Capability | A2UI Has | Notes |
|------------|----------|-------|
| **25 built-in components** | text, button, input, select, combobox, questionnaire, image, container, columns, card, list, table, form, tabs, progress, alert, chatInput, markdown, radioGroup, multiSelect, toggle, slider, divider, badge, accordion, codeBlock, link | Kickstart needs most of these |
| **Skills resolver** | Keyword-triggered ARM body templates for 9 Azure services | Domain knowledge injection |
| **ARM schema introspection** | `fetchResourceTypeSchema()` for dynamic forms | Makes `azureResourceForm` work |
| **Mermaid diagram support** | Icon registration, diagram renderer, `.mmd` artifacts | Architecture visualization |
| **Monaco editor** | Lazy-loaded VS Code-like editing in browser | Code editing UX |
| **Context compaction** | Auto-summarize when >100k tokens, keep last 6 messages | Long conversation support |
| **Model routing** | Task-based (code/planning/default) with LLM classification | Cost optimization |
| **GitHub secret setting** | `githubSetSecret` with sealed box encryption | CI/CD setup |
| **Session persistence** | Multi-session sidebar, localStorage, rename/delete | Conversation management |

### F.3 Nice-to-Have (Polish features)

| Capability | Notes |
|------------|-------|
| **Compact JSON notation** | Reduces LLM output tokens ~30-50% |
| **Rewind & model switching** | Pop last turn, switch models mid-conversation |
| **Token usage tracking** | Per-request + cumulative |
| **Activity indicator** | Live HTTP request log |
| **Prompt history** | ArrowUp/Down navigation in chat input |
| **Icon system** | 21 Azure + 15 K8s icons for diagrams |
| **Bicep compilation** | Server-side Bicep→ARM JSON via `az bicep build` |
| **Google Maps/Flights proxies** | Trip notebook demo features |

### F.4 Key Architectural Differences to Note

1. **A2UI uses nested JSON specs** (agent returns full UI layout as JSON); Kickstart currently uses `~~~a2ui` fenced blocks in markdown
2. **A2UI has no streaming** — full request/response; Kickstart has SSE streaming but the A2UI extraction breaks
3. **A2UI packs are npm packages** that self-register; Kickstart components are built-in
4. **A2UI state is global key-value** (`{{state.key}}` interpolation); Kickstart has similar but with phase-based state
5. **A2UI artifacts are browser-side only** (localStorage); no server-side file storage

---

## G. OAuth Flow Details (for Security Review)

### Azure MSAL Flow
1. User clicks "Sign in with Azure"
2. `msalInstance.loginPopup({ scopes })` — opens popup to `login.microsoftonline.com`
3. Popup redirects back with auth code
4. MSAL exchanges code for token (via `/api/auth-proxy` CORS bypass)
5. Token stored in MSAL cache (sessionStorage)
6. `acquireTokenSilent()` refreshes silently; falls back to `acquireTokenPopup()`
7. ARM token scope: `https://management.azure.com/user_impersonation`
8. Graph token scope: `https://graph.microsoft.com/User.Read`

### GitHub Device Code Flow
1. App POSTs to `/api/github-oauth/device/code` with `client_id` + `scope`
2. Server proxies to `github.com/login/device/code`
3. Response: `device_code`, `user_code`, `verification_uri`, `interval`
4. App displays user code + link to `https://github.com/login/device`
5. App polls `/api/github-oauth/access_token` every 5s with `device_code` + `client_id` + `grant_type=urn:ietf:params:oauth:grant-type:device_code`
6. On success: token stored in `localStorage['adaptive-ui-github-token']`
7. Token validated via `GET /user` API call

### GitHub PAT Flow (Alternative)
1. User pastes PAT in settings
2. App validates via `GET /user` with Bearer token
3. Token stored in same localStorage key

---

## H. Recommendations for Kickstart

1. **Start with the core loop:** Component registry → LLM adapter → artifact system → PR creation. This is the minimum viable path.
2. **Port the pack system:** The `ComponentPack` interface is clean and extensible. Adopting it means Azure/GitHub packs can be developed independently.
3. **Reuse auth code:** The MSAL and GitHub Device Code implementations are self-contained and can be extracted with minimal changes.
4. **Decide on spec format:** Either adopt A2UI's nested JSON spec approach (which works well for declarative UIs) or fix the `~~~a2ui` extraction regex (see prior audit `leela-a2ui-audit.md`).
5. **Prioritize the 10 pack components over the 25 built-ins:** The pack components (Azure/GitHub login, picker, query, PR creation) are what make the product unique. The 25 built-ins are commodity UI primitives.

# Decision: Pragmatic A2UI v0.9 React Adoption

**Author:** Leela (Lead)  
**Date:** 2026-04-08  
**Status:** Proposed  
**Supersedes:** `.squad/decisions/inbox/leela-rendering-architecture.md` (Option C — now obsolete)

## Context

Ahmed asked: "Given that A2UI v0.9 isn't officially released yet (milestone is 46% complete), can we do anything to stay closely aligned to it but also not get blocked? adaptive-ui seemed to be ahead of its time, including the React rendering which I think might make sense to bring back here."

**Discovery:** The `@a2ui/react` package (v0.9.0) already has a working v0.9 renderer at `renderers/react/src/v0_9/`. The code exists, it's Apache 2.0 licensed, and it's production-ready.

**Current state:**
- Vanilla JS frontend with manual DOM manipulation (`packages/web/`)
- `~~~a2ui` fenced blocks extracted via regex — breaks constantly
- `a2ui-renderer.js` — 17 render functions (vanilla JS, NOT React)
- Only renders buttons reliably — everything else fails silently when regex fails

**Proven pattern:**
- `adaptive-ui-try-aks` is React/Vite/TypeScript, outputs structured JSON (not fenced blocks), renders via React engine
- `@a2ui/react` provides the EXACT architecture we need — it exists today

## Decision

**Adopt `@a2ui/react` v0.9 directly. Migrate frontend to React/Vite. Kill the regex. Output structured JSON from LLM.**

## Rationale

### 1. The Code Already Exists (Apache 2.0)

`@a2ui/react` v0.9 renderer includes:

**18 Basic Catalog Components (ALL implemented):**
Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput

**Architecture:**
- `A2uiSurface.tsx` — Renders a surface by resolving component tree from root
- `adapter.tsx` — `createReactComponent()` factory with `GenericBinder` + `useSyncExternalStore`
- `DeferredChild` — lazy component resolution (shows "[Loading ...]" if child not yet in buffer)
- Two-context performance optimization (ComponentContext + SurfaceModel)
- `SurfaceModel` from `@a2ui/web_core/v0_9` — manages component buffer + data model

**Component implementation pattern:**
```tsx
export const Button = createReactComponent(ButtonApi, ({props, buildChild}) => {
  return (
    <button style={style} onClick={props.action} disabled={props.isValid === false}>
      {props.child ? buildChild(props.child) : null}
    </button>
  );
});
```

**Custom component registration:**

---

# Decision: Fluent UI React v9 for Playground + App Shell

**Author:** Fry (Frontend Dev)  
**Date:** 2025-07-27  
**Status:** Accepted

## Context

The Playground and App shell used hand-rolled HTML/CSS for all interactive components (buttons, collapsible sections, badges, text areas, cards). The `@fluentui/react-components` (v9) package was already installed but not wired up.

## Decision

- Wrap the entire app in `<FluentProvider theme={webLightTheme}>` at the App.tsx level so all descendant components inherit Fluent 2 design tokens.

---

### 2026-04-09T04:01:38Z: No raw HTML elements — Fluent UI React v9 only
**By:** Ahmed Sabbour (via Copilot)  
**What:** No raw HTML elements (`<button>`, `<span>`, `<div>` for UI controls, `<input>`, etc.) anywhere in the project. Always use Fluent UI React v9 components from `@fluentui/react-components`. This applies to both the app UI AND the A2UI component renderers.  
**Why:** User directive — ensures consistent Fluent 2 design system compliance across the entire application, including rendered A2UI surfaces.
**Status:** Accepted
- Replace Playground's hand-rolled elements with Fluent UI v9 components: Button, Accordion, Card, Textarea, MessageBar, CounterBadge, and Fluent typography (Subtitle2, Caption1, Body1Strong, Text).
- Use Griffel `makeStyles()` with Fluent `tokens` for component-level styling; keep layout-only CSS (flex containers, scroll areas, responsive breakpoints) in `playground.css`.

## Consequences

- Bundle size increased (2539 → was 483 modules) due to Fluent UI tree — expected and acceptable.
- Future components anywhere in the app can now use Fluent tokens and components without additional setup.
- playground.css shrank from ~376 lines to ~80 lines (layout-only).
- The Accordion's controlled `openItems` API replaces the previous Set-based toggle pattern.
```tsx
const registry = ComponentRegistry.getInstance();
registry.register('CostEstimate', { component: MyCostEstimate });
```

**Usage:**
```tsx
import { A2UIProvider, A2UIRenderer, useA2UI } from '@a2ui/react';

function App() {
  const { processMessages } = useA2UI();
  return (
    <A2UIProvider onAction={handleAction}>
      <A2UIRenderer surfaceId="main" />
    </A2UIProvider>
  );
}
```

### 2. Alignment Without Blockage

**Ahmed's concern:** How to stay aligned with A2UI v0.9 without getting blocked by an incomplete milestone?

**Answer:** The code exists TODAY (Apache 2.0). We use it. When v0.9 ships officially, we update the dependency. We're aligned because we're using the actual v0.9 code.

**Options:**
- **Vendor the code** (copy into our repo, full control, zero upstream dependency risk)
- **Use npm package** (cleaner, updates easier, but depends on Microsoft maintaining the package)

**Recommendation:** Start with npm package. If v0.9 release stalls, vendor it. Either way, we're not blocked.

### 3. Frontend Migration from Vanilla JS to React/Vite

**Current state:** `packages/web/` is vanilla JS + Portal Prototyper CSS  
**Target state:** React/Vite SPA + Portal Prototyper CSS (it's just CSS classes)

**Why React/Vite:**
- `adaptive-ui-try-aks` is React/Vite — proven pattern by same team
- A2UI React renderer is React — obvious choice
- SWA supports React SPAs natively (no build config changes needed)
- Portal Prototyper CSS still works (it's just CSS classes, framework-agnostic)
- Vite = instant dev server, HMR, TypeScript support out-of-box
- React = component model matches A2UI component model perfectly

**Migration effort:** ~1 week (Fry's domain). Vite scaffold, port UI components, wire SSE client.

### 4. Structured JSON (No More Regex)

**Old pattern (broken):**
```
Here's your design:

~~~a2ui
{ "surfaceId": "main", "components": [...] }
~~~

Any text here breaks regex extraction.
```

**New pattern (robust):**
```json
{
  "message": "Here's your design:",
  "a2ui_messages": [
    { "surfaceId": "main", "components": [...] }
  ]
}
```

**LLM config:**
- `response_format: { type: "json_object" }` (OpenAI/Azure OpenAI)
- System prompt defines JSON schema with `message` (string) + `a2ui_messages` (array)
- Backend parses JSON, forwards A2UI messages via SSE
- Client calls `processMessages()` directly

**Benefits:**
- Regex eliminated — parsing CANNOT fail
- Incremental JSON streaming for progressive text rendering
- State updates included in envelope (future: data binding)
- Component streaming (components appear one-by-one like Spark files)

## What We Get for FREE

By adopting `@a2ui/react`:

1. **18 basic components** — no custom rendering code needed
2. **Surface model** with component buffer — progressive rendering works out-of-box
3. **Data binding** via JSON Pointers — reactive state updates (`{{state.runtime}}`)
4. **Component registry** — extensibility built-in
5. **Theme system** — consistent styling across components
6. **Two-context optimization** — prevents unnecessary re-renders
7. **DeferredChild** — lazy loading for components not yet in buffer
8. **Action handling** — `onAction` callback for all component interactions

## What We STILL Need to Build

Our custom value-add (Kickstart-specific features):

1. **Custom Kickstart catalog components** (register via `createReactComponent`):
   - `CostEstimate` — monthly Azure cost breakdown
   - `ArchitectureDiagram` — React SVG-based diagrams (port from try-aks)
   - `FileEditor` — Monaco-based inline file editing
   - `AuthCard` — Azure + GitHub login status/actions
   - `WorkflowStatus` — GitHub Actions run display
   - `RepoPicker` — GitHub repo selector
   - `CodespaceLink` — "Open in Codespaces" CTA
   - `AppOverview` — app metadata + deployment links

2. **Chat UI wrapper** — A2UI surfaces embedded in chat messages (not full-screen app like try-aks)

3. **SSE streaming integration** — convert SSE events → `processMessages()` calls

4. **System prompt rewrite** — teach LLM v0.9 JSON envelope format + Kickstart catalog

5. **Port features from try-aks:**
   - `ArchitectureDiagram.tsx` (16KB — React SVG-based diagrams)
   - `diagram-builder.ts` (7.5KB — diagram construction)
   - `k8s-validator.ts` (16KB — K8s manifest validation)
   - Azure auth integration (MSAL already in our stack)
   - GitHub auth integration (OAuth already in our stack)
   - Cloud Shell integration (Azure CLI tunnel pattern)

6. **File system integration** — generated files displayed in right panel + downloadable

## Phased Migration Plan

### Phase 1: React/Vite Foundation + A2UI Integration (1 week)
**Owner:** Fry  
**Goal:** Kill the regex. Get basic A2UI rendering working.

**Tasks:**
- Scaffold React/Vite app in `packages/web/`
- Install `@a2ui/react` (or vendor if needed)
- Port chat UI shell (topbar, sidebar, input) to React
- Wire SSE client → `processMessages()` calls
- Update system prompt for JSON envelope format
- Delete `a2ui-renderer.js` (17 render functions no longer needed)
- Test basic components (Button, Text, Card, TextField)

**Success criteria:** LLM outputs JSON → A2UI components render → no regex failures

### Phase 2: Custom Kickstart Catalog (1-2 weeks)
**Owner:** Fry + Bender  
**Goal:** Build Kickstart-specific components.

**Tasks:**
- Implement `CostEstimate` (table + chart, uses Azure Pricing API)
- Implement `FileEditor` (Monaco + download button)
- Implement `AuthCard` (Azure + GitHub login state)
- Implement `WorkflowStatus` (GitHub Actions run display)
- Implement `RepoPicker` (dropdown + search)
- Implement `CodespaceLink` (CTA button)
- Implement `AppOverview` (metadata card)
- Register all components in ComponentRegistry
- Update system prompt with Kickstart catalog examples

**Success criteria:** All 6 phases render Kickstart components correctly

### Phase 3: Port try-aks Features (2-3 weeks)
**Owner:** Fry + Bender  
**Goal:** Rich interactive features from try-aks.

**Tasks:**
- Port `ArchitectureDiagram.tsx` + `diagram-builder.ts` (Azure architecture SVGs)
- Port `k8s-validator.ts` (validate Helm/manifests before deploy)
- Integrate Azure login (MSAL already configured)
- Integrate GitHub login (OAuth already configured)
- Integrate Cloud Shell (Azure CLI tunnel for kubectl/helm)
- File system integration (right panel file viewer + download)

**Success criteria:** Architecture diagrams render, K8s validation works, auth flows complete

### Phase 4: Rich Experience Features (1-2 weeks)
**Owner:** Bender + Fry  
**Goal:** Data binding, multi-surface layout, streaming.

**Tasks:**
- Data binding via JSON Pointers (`{{state.clusterName}}` → reactive updates)
- Multi-surface layout (split chat + preview like Spark)
- Component streaming (components appear one-by-one during LLM response)
- State management (conversation state persisted, resumable)
- Auto-continue for phase transitions (LLM self-prompts next phase)

**Success criteria:** Reactive state updates work, progressive rendering smooth, UX feels alive

## Migration Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| A2UI v0.9 never ships officially | Vendor the code — Apache 2.0 license allows it. We own the dependency. |
| React migration breaks Portal Prototyper CSS | CSS classes are framework-agnostic. No breakage expected. Test early. |
| SSE → `processMessages()` integration issues | try-aks already does structured JSON streaming. Copy the pattern. |
| LLM struggles with JSON envelope format | OpenAI models excel at structured output. Test with few-shot examples. Fallback: structured outputs API. |
| Custom components don't match A2UI patterns | `createReactComponent()` is the blessed pattern. Follow it strictly. |

## Key Files Touched

**Phase 1:**
- `packages/web/package.json` — add React, Vite, `@a2ui/react`
- `packages/web/vite.config.ts` — Vite config (SWA proxy, env vars)
- `packages/web/src/main.tsx` — React entry point
- `packages/web/src/App.tsx` — chat shell + A2UIProvider
- `packages/core/src/prompts/system-prompt.ts` — JSON envelope instructions
- `packages/core/src/services/response-processor.ts` — JSON parse (delete regex)
- DELETE `packages/web/js/a2ui-renderer.js` — no longer needed

**Phase 2:**
- `packages/web/src/components/kickstart/` — CostEstimate, FileEditor, AuthCard, etc.
- `packages/web/src/registry.ts` — ComponentRegistry initialization
- `packages/core/src/catalog/kickstart-catalog.json` — Kickstart component schemas
- `packages/core/src/prompts/phases.ts` — updated examples with Kickstart components

**Phase 3:**
- `packages/web/src/components/diagrams/` — ArchitectureDiagram, diagram-builder
- `packages/web/src/services/k8s-validator.ts` — K8s validation logic
- `packages/web/src/services/azure-auth.ts` — MSAL integration (already exists)
- `packages/web/src/services/github-auth.ts` — OAuth integration (already exists)
- `packages/web/src/services/cloud-shell.ts` — Azure CLI tunnel

**Phase 4:**
- `packages/core/src/state/` — state management engine
- `packages/core/src/services/data-binding.ts` — JSON Pointer binding
- `packages/web/src/hooks/useA2UIStreaming.ts` — SSE → processMessages hook
- `packages/core/src/prompts/auto-continue.ts` — phase transition logic

## Alternatives Considered

### Option A: Stick with Vanilla JS + Fix Regex
**Rejected.** Regex is fundamentally brittle. LLM output is unpredictable. We're fighting the architecture.

### Option B: Build Our Own React Renderer
**Rejected.** Duplicate work. A2UI React renderer already exists and solves the exact problem.

### Option C: Use A2UI v0.8 (stable)
**Rejected.** v0.8 is old, lacks features we need (data binding, component buffer, streaming). v0.9 is the future.

### Option D: Switch to Adaptive UI Framework
**Rejected.** adaptive-ui is proprietary to try-aks. A2UI is the blessed Microsoft open-source path. We align with the ecosystem.

## Decision Impact

### Immediate (Phase 1)
- Regex failures eliminated — rendering is now deterministic
- Frontend migration effort (~1 week)
- System prompt rewrite (~2 days)

### Medium-term (Phases 2-3)
- Custom Kickstart components unlocked (diagrams, cost, validation)
- try-aks features ported (auth, Cloud Shell, file system)
- Rich interactive UX (Spark-like experience)

### Long-term (Phase 4+)
- Data binding enables reactive UX (state changes → UI updates automatically)
- Component streaming = progressive reveal (Spark-like)
- Auto-continue = conversational AI feels autonomous
- Multi-surface layout = chat + preview (Spark-like)

## Next Steps

1. **Bender:** Install `@a2ui/react` in `packages/web`, verify it builds
2. **Fry:** Scaffold React/Vite app, port chat shell
3. **Bender:** Rewrite system prompt for JSON envelope
4. **Hermes:** Update test harness for JSON response format
5. **Leela:** Review progress after Phase 1 (1 week checkpoint)

## Superseded Decisions

This decision **supersedes** `.squad/decisions/inbox/leela-rendering-architecture.md` (Option C — Structured JSON Envelope).

**What changed:** We discovered the React renderer exists. The previous decision assumed we'd keep vanilla JS rendering and only fix extraction. Now we're adopting the React renderer entirely — cleaner, faster, more maintainable.

**What remains valid:** Structured JSON envelope (no regex) is still the right call. We're just rendering with React instead of vanilla JS.

## References

- **A2UI React renderer source:** `@a2ui/react/renderers/react/src/v0_9/`
- **adaptive-ui-try-aks:** React/Vite/TypeScript app with structured JSON rendering (proven pattern)
- **A2UI v0.9 milestone:** https://github.com/microsoft/a2ui/milestone/2 (46% complete)
- **Apache 2.0 license:** https://github.com/microsoft/a2ui/blob/main/LICENSE

---

**This is the path. The code exists. We use it. We ship.**

# Decision: Rendering Architecture — Kill the Regex, Adopt Structured Responses

**Author:** Leela (Lead)  
**Date:** 2025-07-25  
**Status:** Proposed  
**Requested by:** Ahmed Sabbour  
**Scope:** Full rendering pipeline — LLM output format, server processing, client rendering, state management

---

## Context

Ahmed asked the hard question: *"Why did we shift to A2UI instead of using our proprietary adaptive-ui framework? When you're seeing regex failing, does adaptive-ui use regex as well?"*

The answer to the second question is simple: **No. adaptive-ui uses zero regex.** The entire LLM response IS a JSON spec. The renderer consumes it directly. That's why it works reliably.

I audited the full pipeline end-to-end. Here's what I found.

## Root Cause Analysis

### The Pipeline Today

```
LLM → markdown text + ~~~a2ui JSON block → regex extraction → text + components → render separately
```

**File: `response-processor.ts` line 19:**
```ts
const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;
```

This regex requires `~~~` at the **exact end of the string**. If the LLM adds a trailing newline, a space, a sentence, or anything after the closing fence — silent failure. The JSON shows as raw chat text. This is the root cause of broken rendering.

### Why It's Architecturally Wrong (Not Just a Bug)

Fixing the regex is fixing the wrong problem. The design has four structural flaws:

1. **Mixed channels.** The LLM is asked to produce *both* conversational prose *and* structured UI in one text blob. LLMs are inherently unreliable at maintaining exact formatting constraints in freeform text. This will always be brittle.

2. **Components are afterthoughts.** The system prompt says "put text FIRST, then ~~~a2ui at the END." Components aren't the primary interaction medium — they're decorations on markdown. This is backwards. In adaptive-ui, the UI spec IS the response.

3. **No streaming of components.** In `converse.ts:148-196`, text streams to the user chunk-by-chunk. Components only appear AFTER the full response completes and regex runs. The user stares at text, then components pop in all at once. This is why adaptive-ui felt snappier — the spec renders the moment the response completes.

4. **Heuristic fallback covers 2 of 6 phases.** `inferComponents()` only handles `discover` and `design`. Generate, Review, Handoff, and Deploy get zero components when the regex fails. Those are the phases where components matter most (CodeBlocks, DeploymentProgress, CostEstimate, HandoffCard).

### How adaptive-ui (try-aks) Avoids All of This

```
LLM → AdaptiveUISpec JSON → direct render (no extraction)
```

- The LLM outputs `{ version, title, agentMessage, state, layout, diagram }` — a single JSON object
- `agentMessage` is the conversational text
- `layout` is the component tree
- `state` holds accumulated user choices with `{{state.key}}` binding
- `onComplete: { type: "sendPrompt" }` enables auto-continue loops
- **No regex. No extraction. No heuristics. It just works.**

---

## Decision: Option C — Structured JSON Envelope, Phased Migration

### Architecture Choice

**Not A** (fix regex) — band-aid on a structural problem.  
**Not B** (full JSON like adaptive-ui) — loses text streaming, which is a key UX win.  
**Not D** — nothing better exists in the codebase.  
**Yes C** — but refined into a phased plan that ships incrementally.

### Target Response Format

The LLM outputs a JSON object via OpenAI's `response_format: { type: "json_object" }`:

```json
{
  "message": "What kind of app are you building? A quick description is all I need.",
  "components": [
    {
      "type": "Row",
      "gap": "8px",
      "wrap": true,
      "children": [
        { "type": "Button", "label": "Web API", "action": "reply", "data": { "text": "I'm building a web API" } },
        { "type": "Button", "label": "Full-stack app", "action": "reply", "data": { "text": "I'm building a full-stack app" } }
      ]
    }
  ],
  "stateUpdates": {},
  "phase": "discover"
}
```

- `message` — conversational text (streamed to user in real-time via incremental JSON parsing)
- `components` — A2UI component descriptors (rendered after message completes, then progressively as we add component streaming)
- `stateUpdates` — key-value pairs accumulated across turns (replaces adaptive-ui's `state` object)
- `phase` — LLM's assessment of current phase (server validates against state machine)

### Migration Plan (3 Phases)

#### Phase 1: Immediate Fix (1-2 days) — Unblock Now

**Goal:** Stop the bleeding without changing the architecture.

1. **Relax the regex** in `response-processor.ts`:
   ```ts
   // Before: requires ~~~ at exact string end
   const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;
   
   // After: tolerates trailing whitespace, newlines, markdown, etc.
   const A2UI_FENCE_RE = /~~~a2ui\s*\n([\s\S]*?)\n~~~[^\n]*/;
   ```
   Also try multiple extraction strategies: first the strict regex, then a lenient one, then look for raw JSON arrays.

2. **Expand heuristic fallback** to all 6 phases. Add `inferGenerateComponents()`, `inferReviewComponents()`, `inferHandoffComponents()`, `inferDeployComponents()`. Even basic buttons ("Continue", "Deploy", "Open in Codespaces") are better than nothing.

3. **Add telemetry**: log when regex fails vs. succeeds, log when heuristic kicks in. We need data.

**Owner:** Bender (backend)  
**Files changed:** `response-processor.ts`  
**No client changes. No prompt changes. Ship immediately.**

#### Phase 2: Structured JSON Responses (1-2 weeks) — The Real Fix

**Goal:** Eliminate regex entirely. LLM outputs JSON, server parses JSON, client renders JSON.

1. **Update system prompt** (`system-prompt.ts`): Remove the `~~~a2ui` fenced block instructions. Replace with:
   ```
   You MUST respond with a JSON object containing these fields:
   - "message": Your conversational text (markdown allowed)
   - "components": Array of A2UI component descriptors (can be empty)
   - "stateUpdates": Object with any new user information gathered this turn
   
   Do NOT output anything outside the JSON object. No markdown wrapping, no code fences.
   ```

2. **Update OpenAI call** (`openai-client.ts`): Add `response_format: { type: "json_object" }` to force JSON mode.

3. **Replace `processLLMResponse()`** with `parseStructuredResponse()`:
   ```ts
   function parseStructuredResponse(raw: string, phase: string): ProcessedResponse {
     try {
       const parsed = JSON.parse(raw);
       return {
         text: parsed.message ?? raw,
         components: parsed.components ?? [],
         stateUpdates: parsed.stateUpdates ?? {},
       };
     } catch {
       // Fallback: treat entire response as text, infer components
       return { text: raw, components: inferComponents(raw, phase), stateUpdates: {} };
     }
   }
   ```
   Note: JSON.parse on the full response is 100% reliable when `response_format: json_object` is set. The fallback is defense-in-depth.

4. **Incremental JSON streaming**: Use a lightweight streaming JSON parser to detect the `"message"` field and stream its content to the user token-by-token. Libraries like `@streamparser/json` or a simple state machine work here. Text streams to the user AS the LLM generates it. Components arrive when the JSON object completes.

5. **Server-side deterministic components**: For interactive controls (buttons, pickers), the SERVER adds them based on phase + question content. The LLM produces content components (CodeBlock, ArchitectureDiagram, CostEstimate). The server produces interaction components (buttons for known choices). This separation means the LLM can't break the button layout.

6. **State accumulator**: New `session-state.ts` module:
   ```ts
   interface SessionState {
     collected: Record<string, unknown>;  // accumulated user info
   }
   
   function applyStateUpdates(state: SessionState, updates: Record<string, unknown>): SessionState {
     return { collected: { ...state.collected, ...updates } };
   }
   ```
   State persists across turns in the session. Components can reference state via `{{state.runtime}}` templates resolved at render time.

**Owner:** Bender (backend) + Fry (client-side JSON streaming)  
**Files changed:** `system-prompt.ts`, `phases.ts` (remove ~~~a2ui examples), `openai-client.ts`, `response-processor.ts` (rewrite), `converse.ts` (streaming rewrite), `api-client.js` (incremental JSON), `engine.js` (state), new `session-state.ts`  
**a2ui-renderer.js: UNCHANGED.** The renderer is solid. It takes component descriptors and produces DOM. The input format doesn't change — only how we get the descriptors.

#### Phase 3: Component Streaming (1 week) — The Wow Factor

**Goal:** Components appear one-by-one as the LLM generates them, like files appearing in GitHub Spark.

1. **Incremental component emission**: As the streaming JSON parser detects a completed object in the `"components"` array, emit it immediately as a `{type: "component", data: {...}}` SSE event. The client renders each component as it arrives.

2. **Progressive rendering**: CodeBlocks stream line-by-line. DeploymentProgress steps appear one at a time. ArchitectureDiagram components fade in sequentially. Each component type gets a `streaming` render mode in `a2ui-renderer.js`.

3. **State-bound templates**: Components can use `{{state.runtime}}` in labels and text. The renderer resolves these at render time from the accumulated session state.

4. **Auto-continue**: Borrow adaptive-ui's `onComplete: { type: "sendPrompt", prompt: "..." }` pattern. When a phase completes, the UI auto-sends the next prompt without user action. This creates the "flow" feeling.

**Owner:** Fry (renderer) + Bender (server streaming)  
**Files changed:** `converse.ts`, `api-client.js`, `a2ui-renderer.js` (add streaming modes), `app.js` (handle progressive components)

---

## Q2: Streaming

**Current state:** Text streams, components don't. Components only appear after the full response is processed.

**Phase 2 fix:** Text streams via incremental JSON parsing of the `"message"` field. Components appear when the JSON response completes. This is already better than today (no regex delay, no silent failures).

**Phase 3 fix:** Components stream individually. As the LLM generates each component object in the JSON array, it's emitted and rendered immediately. This is the Spark-like experience Ahmed wants.

**Technical approach:** The streaming JSON parser tracks nesting depth. When it detects a complete top-level object inside `"components": [...]`, it emits it as a separate SSE event. The client appends each component to the chat as it arrives, with a fade-in animation.

---

## Q3: State Management

**Current state:** None. Each response is stateless. The only persistence is the chat message history stored in session.

**Minimal state system (Phase 2):**

```ts
interface ConversationState {
  // Accumulated from stateUpdates across turns
  appName?: string;
  runtime?: string;
  services?: string[];
  hasDatabase?: boolean;
  hasCache?: boolean;
  hasPublicUrl?: boolean;
  hasAI?: boolean;
  // Phase-specific
  generatedFiles?: string[];
  deploymentApproved?: boolean;
  repoUrl?: string;
}
```

The LLM includes `"stateUpdates": { "runtime": "Node.js" }` in each response. The server accumulates these into a `ConversationState` object stored in the session. The state is injected into the system prompt as `{{knownInfo}}` (which we already do!) and into component templates.

**State binding in components** (Phase 3): Components can reference state:
```json
{ "type": "Text", "text": "Your {{state.runtime}} app is ready." }
```
The renderer resolves these templates before rendering. This is identical to adaptive-ui's approach.

---

## Q4: Migration Path / Renderer Compatibility

**a2ui-renderer.js is 100% preserved.** It takes component descriptors (JSON objects with a `type` field) and renders DOM. Nothing about this changes. The input format is the same — only the extraction mechanism changes (regex → JSON parse).

**The 17 component renderers all survive as-is:**
- Standard: Text, Button, TextField, Row, Column, Card, Tabs
- Kickstart: ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard
- GitHub: RepoPicker, WorkflowStatus, CodespaceLink, AppOverview, FileGeneration

**Migration order (least disruptive):**
1. Phase 1 changes ONLY `response-processor.ts` — zero client impact
2. Phase 2 changes the server response format but the client already handles `{ message, a2ui, phase }` — the `engine.js` `mapApiResponse()` function needs minor updates but the shape is compatible
3. Phase 3 adds new capabilities to the renderer without breaking existing ones

---

## Q5: Why A2UI Over adaptive-ui? — Honest Assessment

**adaptive-ui is better at being reliable today.** No regex, structured JSON, state binding, auto-continue, working packs (Azure, GitHub). Ahmed got a better experience because the framework makes it impossible for rendering to fail — the response IS the UI spec.

**But adaptive-ui has limitations for Kickstart's goals:**

1. **No streaming.** adaptive-ui renders after the full response. The LLM thinks, then the UI appears. There's no conversational text streaming. For Kickstart, where the LLM teaches and explains, losing streaming would feel like going backwards.

2. **No MCP story.** A2UI has `application/json+a2ui` MIME type for MCP embedded resources and catalog negotiation at the protocol level. Adaptive-ui is a standalone framework with no MCP integration path. Our dual-surface story (web + IDE) needs this.

3. **Tightly coupled renderer.** adaptive-ui's renderer is tied to its component set (questionnaire, card, chatInput). A2UI's catalog model lets us define custom components (our 17 Kickstart components) and swap renderers per surface. The renderer we built in `a2ui-renderer.js` is actually BETTER for our needs because it uses Portal Prototyper CSS and vanilla DOM — perfect for our zero-dependency web surface.

4. **Single-surface.** adaptive-ui is a web framework. A2UI is a protocol that works across surfaces. When we add the MCP/IDE surface, we need a second renderer (Copilot Chat markdown, VS Code webviews). A2UI's flat component model makes this easier.

**The honest trade-off:**

| Dimension | adaptive-ui | A2UI (our target) |
|---|---|---|
| Reliability today | Excellent (no regex) | Broken (regex extraction) |
| Text streaming | No | Yes (with Phase 2 fix) |
| State management | Yes (`state` + binding) | No (needs Phase 2) |
| Auto-continue | Yes (`onComplete`) | No (needs Phase 3) |
| MCP integration | None | Native (catalog negotiation) |
| Multi-surface | Web only | Web + IDE + MCP |
| Component ecosystem | Fixed set + packs | Extensible catalog |
| Renderer flexibility | Coupled | Pluggable per surface |

**Bottom line:** We were right to choose A2UI's architecture. We were wrong to implement it as "markdown + fenced blocks." The fix isn't to go back to adaptive-ui — it's to implement A2UI properly with structured JSON responses, which gives us adaptive-ui's reliability PLUS streaming and multi-surface support.

The structured JSON envelope in Phase 2 is essentially adaptive-ui's `AdaptiveUISpec` pattern adopted into A2UI's component model. We're taking the best of both.

---

## Action Items

| # | Task | Owner | Estimate | Depends On |
|---|------|-------|----------|------------|
| 1 | Fix regex + expand heuristics (Phase 1) | Bender | 1 day | — |
| 2 | Add extraction telemetry | Bender | 0.5 day | — |
| 3 | Update system prompt for JSON mode (Phase 2) | Bender | 2 days | #1 shipped |
| 4 | Implement incremental JSON streaming | Bender + Fry | 3 days | #3 |
| 5 | Add session state accumulator | Bender | 1 day | #3 |
| 6 | Update client engine for new response format | Fry | 2 days | #4 |
| 7 | Component streaming + progressive render (Phase 3) | Fry | 3 days | #6 |
| 8 | State binding in component templates | Fry | 1 day | #5, #6 |
| 9 | Auto-continue for phase transitions | Bender | 1 day | #5 |

**Total: ~15 days across two engineers, shipping incrementally.**

Phase 1 ships in 1-2 days and unblocks everything.  
Phase 2 ships in 1-2 weeks and fixes the architecture.  
Phase 3 ships the following week and delivers the wow.

---

## What We Keep

- `a2ui-renderer.js` — all 17 component renderers, unchanged
- A2UI component catalog schema in `packages/core`
- Phase-based conversation flow (6 phases)
- SSE streaming transport
- Portal Prototyper CSS styling
- Demo mode (scripted engine) — works as-is, already uses JSON components

## What We Kill

- `~~~a2ui` fenced block convention
- Regex extraction in `response-processor.ts`
- "Put components at the END of your message" system prompt instruction
- The assumption that LLM text output is the right transport for structured UI

# Decision: Two-Repo Strategy for A2UI Fork and Kickstart App

**Author:** Leela (Lead)  
**Date:** 2026-04-08  
**Status:** Proposed

## Context

Ahmed established a proven pattern with `adaptive-ui-framework` (framework repo) + `adaptive-ui-try-aks` (app repo consuming framework). We're adopting the same split for A2UI:

- **`sabbour/a2ui`** — Fork of google/A2UI (framework + our extensions)
- **`sabbour/kickstart`** — Our app (this repo) consuming the framework

The A2UI repo is a monorepo. Key packages:
- `renderers/react/` → `@a2ui/react` v0.9 (React renderer + 18 basic catalog components)
- `renderers/web_core/` → `@a2ui/web_core` v0.9 (SurfaceModel, ComponentContext, GenericBinder, Catalog)
- Both are TypeScript, React renderer depends on web_core

**Ahmed's directive:** "Anything 'frameworky' should go into our A2UI fork, similar to how we have the try-aks app but also the adaptive-ui-framework repo."

## Decision 1: What Goes Where

### `sabbour/a2ui` (Fork) — Framework Extensions

Add to the fork ONLY when the code is:
- **Generic** — usable by any A2UI app, not Kickstart-specific
- **Renderer-level** — improves the React renderer or web_core
- **Catalog-level** — extends the basic catalog with reusable components

**Examples of fork-appropriate work:**
- New base catalog components (e.g., `Table`, `Chart`, `Stepper`, `Timeline`) that have zero dependency on Kickstart/Azure/AKS
- Renderer improvements:
  - Streaming support (component-by-component rendering)
  - Progressive rendering enhancements
  - Server-side rendering (SSR) support
- Data binding utilities (custom binders beyond GenericBinder)
- Catalog JSON Schema tooling (validators, type generators, documentation generators)
- Bug fixes or improvements to core A2UI code that we want to upstream to google/A2UI
- Theme system extensions (if generic, not Kickstart-branded)

**What does NOT go in the fork:**
- Kickstart branding, styles, or themes
- Azure/AKS/GitHub-specific logic
- Business logic (session management, LLM integration, auth)
- Kickstart-specific catalog components (see below)

### `sabbour/kickstart` (App) — All Kickstart-Specific Code

Everything that knows about AKS, Azure pricing, GitHub, or Kickstart's business logic stays here.

**Catalog components that stay in Kickstart:**
- `CostEstimate` — knows Azure pricing APIs
- `ArchitectureDiagram` — knows AKS topology (node pools, ingress, monitoring)
- `FileEditor` — knows Kickstart file generation patterns (Bicep, Dockerfiles, Helm)
- `AuthCard` — knows Entra + GitHub OAuth flow
- `WorkflowStatus` — knows GitHub Actions API
- `RepoPicker` — knows GitHub repos API
- `CodespaceLink` — knows GitHub Codespaces
- `AppOverview` — knows Kickstart's 6-phase conversation model

**Other app-specific code:**
- Chat UI, session management, backend APIs
- System prompts, LLM integration (Azure OpenAI, Anthropic)
- Azure/GitHub integration
- Phase engine, conversation state machine
- MCP server implementation
- All business logic

## Decision 2: Consumption Pattern — npm Workspace + Side-by-Side Checkout

**Choice:** Option B — npm workspace with local checkout during development, published package for CI.

**How it works:**
1. **Development:**
   - Developer clones both repos side-by-side:
     ```
     ~/Git/sabbour/
       ├── a2ui/         (fork of google/A2UI)
       └── kickstart/    (this repo)
     ```
   - Run `npm link` to wire local fork to Kickstart:
     ```bash
     cd ~/Git/sabbour/a2ui/renderers/react
     npm link
     cd ~/Git/sabbour/kickstart
     npm link @a2ui/react
     ```
   - Changes in fork reflect instantly in Kickstart dev server (Vite HMR)

2. **CI/CD:**
   - CI consumes published package from GitHub Packages: `"@sabbour/a2ui-react": "^0.9.0"`
   - OR uses file: dependency with submodule if we don't want to publish

**Why this approach:**
- ✅ **Standard npm workflow** — every Node.js dev knows `npm link`
- ✅ **Fast iteration** — local changes in fork reflect instantly
- ✅ **CI flexibility** — can use published package OR submodule depending on publishing maturity
- ✅ **No submodule pain** — during dev, repos are just side-by-side on disk
- ✅ **Prototype-friendly** — zero upfront publishing infrastructure
- ❌ Manual link setup per developer (documented in README)

**Why NOT the other options:**
- **Option A (submodules):** Pain. Path issues. Nested git hell. Avoid.
- **Option C (GitHub Packages):** Overkill for now. Publishing adds delay. Do this later when we stabilize.
- **Option D (vendoring):** Drift risk. Manual sync. Defeats the purpose of a fork.

## Decision 3: Setup Steps

### Step 1: Fork the A2UI Repo

```bash
# On GitHub: Fork google/A2UI → sabbour/a2ui
# Clone locally
cd ~/Git/sabbour
git clone git@github.com:sabbour/a2ui.git
cd a2ui
git remote add upstream https://github.com/google/A2UI.git
git fetch upstream
```

**Fork configuration:**
- **Default branch:** `main` (match upstream)
- **Branch protection:** None initially (we're iterating fast)
- **Topics:** `a2ui`, `adaptive-ui`, `rendering`, `kickstart`
- **Description:** "Fork of google/A2UI with Kickstart framework extensions"

### Step 2: Wire Fork to Kickstart (Development)

In `sabbour/a2ui`:
```bash
cd renderers/react
npm install
npm run build
npm link
```

In `sabbour/kickstart`:
```bash
npm link @a2ui/react
npm link @a2ui/web_core  # If we also extend web_core
```

Verify in `node_modules/@a2ui/react` — it should be a symlink to `~/Git/sabbour/a2ui/renderers/react`.

### Step 3: Kickstart package.json Dependency

**During development (local fork):**
```json
{
  "dependencies": {
    "@a2ui/react": "file:../a2ui/renderers/react",
    "@a2ui/web_core": "file:../a2ui/renderers/web_core"
  }
}
```

**When published to GitHub Packages (future):**
```json
{
  "dependencies": {
    "@sabbour/a2ui-react": "^0.9.0",
    "@sabbour/a2ui-web-core": "^0.9.0"
  }
}
```

Committed version uses `file:` paths. CI can override via `.npmrc` or submodule if needed.

### Step 4: Handle Upstream Sync (google/A2UI → sabbour/a2ui)

Periodically pull upstream changes:
```bash
cd ~/Git/sabbour/a2ui
git fetch upstream
git checkout main
git merge upstream/main
# Resolve conflicts if any
git push origin main
```

When google/A2UI releases v0.9 officially:
- Tag our fork: `git tag v0.9.0-sabbour.1` (indicates our fork version)
- Update Kickstart dependency to `^0.9.0`
- Monitor upstream for v0.10, v1.0, etc.

### Step 5: Handle Fork Changes (sabbour/a2ui → Kickstart)

**Workflow:**
1. Make changes in fork:
   ```bash
   cd ~/Git/sabbour/a2ui
   git checkout -b feature/add-table-component
   # Edit renderers/react/src/v0_9/components/Table.tsx
   npm run build
   ```
2. Test in Kickstart (symlink makes it instant):
   ```bash
   cd ~/Git/sabbour/kickstart
   npm run dev
   # Kickstart dev server sees changes immediately
   ```
3. Commit and PR in fork:
   ```bash
   cd ~/Git/sabbour/a2ui
   git commit -m "Add Table component to basic catalog"
   git push origin feature/add-table-component
   # Create PR: sabbour/a2ui feature/add-table-component → main
   ```
4. After PR merge, update Kickstart (if using published package):
   ```bash
   cd ~/Git/sabbour/kickstart
   npm install @sabbour/a2ui-react@latest
   ```

### Step 6: Developer Onboarding

**`sabbour/kickstart/README.md`** must include:
```markdown
## Local Development with A2UI Fork

1. Clone both repos side-by-side:
   ```bash
   cd ~/Git/sabbour
   git clone git@github.com:sabbour/a2ui.git
   git clone git@github.com:sabbour/kickstart.git
   ```

2. Link the fork:
   ```bash
   cd a2ui/renderers/react
   npm install && npm run build && npm link
   cd ../web_core
   npm install && npm run build && npm link
   cd ~/Git/sabbour/kickstart
   npm link @a2ui/react @a2ui/web_core
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

Changes in `~/Git/sabbour/a2ui` will reflect instantly in Kickstart.
```

## Decision 4: Boundary Decision Rule

**When a component is ambiguous:**

| Question | Fork | Kickstart |
|----------|------|-----------|
| Could this be used by ANY A2UI app (e.g., a React dashboard, a Flutter app)? | ✅ | ❌ |
| Does it know about AKS, Azure pricing, GitHub, or Kickstart phases? | ❌ | ✅ |
| Is it a generic UI primitive (Table, Chart, Stepper, Timeline)? | ✅ | ❌ |
| Is it a domain-specific component (CostEstimate, ArchitectureDiagram)? | ❌ | ✅ |
| Does it extend the A2UI renderer or web_core? | ✅ | ❌ |
| Does it call Kickstart backend APIs? | ❌ | ✅ |

**Default rule:** When unsure → **start in Kickstart**. Promote to fork only when:
- We've used it in 2+ places in Kickstart, OR
- We can articulate a use case outside Kickstart, OR
- It's a pure UI primitive with zero Kickstart logic

**Example:**
- `FileEditor` component: Stays in Kickstart (knows about Bicep/Dockerfile generation)
- `CodeEditor` component: Could go in fork IF it's generic (no Kickstart file types hardcoded)
- `Table` component: Fork (generic data table with sorting/filtering)
- `AKSNodePoolTable` component: Kickstart (knows AKS node pool schema)

## Decision 5: Upstream Contribution Workflow

**Goal:** Contribute improvements back to google/A2UI when stable.

**Workflow:**
1. Develop in `sabbour/a2ui` fork
2. Test in Kickstart until proven
3. When stable + generic:
   - Create PR: `sabbour/a2ui` → `google/A2UI`
   - Reference in PR description: "Developed in sabbour/kickstart production use"
   - If accepted: Delete from our fork, consume upstream
   - If rejected: Keep in fork, document why (licensing, scope, etc.)

**Contribution candidates:**
- Bug fixes (always upstream)
- Generic catalog components (Table, Chart, Timeline)
- Renderer performance improvements
- Streaming/SSR support
- TypeScript improvements, type safety

**Not worth upstreaming:**
- Kickstart-specific components
- Azure/AKS integrations
- Branding/theming

## Consequences

### ✅ Benefits
- **Clean separation:** Framework vs. app logic never mix
- **Fast iteration:** Local fork changes reflect instantly in Kickstart
- **Upstream path:** Can contribute back to google/A2UI
- **Standard workflow:** npm link is a known pattern
- **No vendor lock-in:** If google/A2UI accepts our changes, we consume upstream

### ⚠️ Risks
- **Manual setup:** Each developer must clone + link both repos (mitigated by clear README)
- **Sync burden:** Must periodically merge google/A2UI upstream changes (standard fork maintenance)
- **Dependency drift:** If we diverge too far from upstream, merging becomes painful (mitigated by "upstream first" mindset)

### 🔄 Future Evolution
- **Phase 1 (now):** Side-by-side repos, npm link, file: dependency
- **Phase 2 (when stable):** Publish to GitHub Packages, consume `@sabbour/a2ui-react`
- **Phase 3 (if we upstream):** Consume `@a2ui/react` directly, sunset our fork

## Status

**Proposed** — Awaiting Ahmed's approval.

**Next steps:**
1. Ahmed reviews and approves
2. Leela forks google/A2UI → sabbour/a2ui
3. Leela updates Kickstart README with setup instructions
4. Fry updates package.json with file: dependency
5. Team tests side-by-side workflow


# Decision: UX Gap Analysis — Kickstart vs Try-AKS

**Author:** Leela (Lead)
**Date:** 2025-07-18
**Status:** Analysis complete — action items prioritized
**Requested by:** Ahmed Sabbour

---

## Executive Summary

Try-aks uses `@sabbour/adaptive-ui-core` — a React-based **structured UI framework** where the LLM outputs JSON specs with state bindings, form containers, questionnaires with rich radio options (title + description), and auto-continue actions. Kickstart uses a vanilla JS renderer with a `~~~a2ui` fenced-block pattern that only supports flat buttons, text fields, cards, and code blocks. The gap is architectural, not cosmetic.

---

## A. Component Gaps

### A1. Questionnaire (CRITICAL — does not exist in Kickstart)

**Try-aks has it.** This is the single biggest UX differentiator.

Try-aks system prompt (line 69-82 of `TryAksApp.tsx`):
```
═══ 3. QUESTIONNAIRE FOR COMPLEX CHOICES ═══
Use the questionnaire component when the user faces a technical choice they may not understand.
Each option MUST have a description in plain language.
Max 3 questions per questionnaire. One concept at a time.

Example:
{type:"questionnaire", questions:[{
  question:"How should we set up your infrastructure?",
  options:[
    {label:"Automated pipeline", value:"bicep", description:"I'll generate config files and a CI/CD pipeline that deploys automatically when you push code."},
    {label:"One-click deploy", value:"direct", description:"I'll create resources right now from this chat. Quick but manual."}
  ],
  bind:"infraApproach"
}], onComplete:{type:"sendPrompt", prompt:"Infrastructure approach: {{state.infraApproach}}"}}
```

**What it renders:** A self-contained card with:
- Question title at the top
- Step indicator ("1/2")
- Radio options with **bold label + gray description subtitle** per option
- A freeform text input helper ("Type anything to help me get it right")
- "Next" / "Continue" button
- Dismiss (X) button
- The selected value is bound to state via `bind` key

**Kickstart equivalent:** Nothing. We show flat pill buttons with no descriptions. The user gets `["Python", "Node.js", ".NET", "Java"]` with zero context about what each means for their deployment.

**Impact:** HIGH. This is why try-aks feels like a guided wizard and Kickstart feels like a chatbot.

### A2. State Binding System (CRITICAL — does not exist in Kickstart)

**Try-aks has it.** Every form component has a `bind` property that automatically saves the user's selection into a persistent `state` object. The LLM can reference state values in subsequent prompts via `{{state.infraApproach}}`.

Try-aks pattern:
```json
{
  "type": "questionnaire",
  "questions": [{"question": "...", "options": [...], "bind": "infraApproach"}],
  "onComplete": {"type": "sendPrompt", "prompt": "Infrastructure approach: {{state.infraApproach}}"}
}
```

**Kickstart equivalent:** Button click sends a hardcoded text string via `action: "reply"`. No state persistence, no binding, no template variables. Each button fires-and-forgets.

**Impact:** HIGH. State binding enables multi-step forms, conditional flows, and auto-continue sequences.

### A3. `onComplete` / Auto-Continue Actions (HIGH — does not exist in Kickstart)

**Try-aks has it.** Components can declare what happens when they complete:
- `{type: "sendPrompt", prompt: "..."}` — auto-sends a message to continue the conversation
- The LLM sets `filesComplete=false` during code generation, and the app auto-sends "Generate next set of files" without user action

From `TryAksApp.tsx` line 1880:
```typescript
if (sendPromptRef.current) {
  sendPromptRef.current('Generate next set of files');
}
```

**Kickstart equivalent:** Every transition requires the user to click something or type. No auto-continue.

**Impact:** HIGH. This is how try-aks achieves seamless multi-turn file generation without user friction.

### A4. Self-Contained Azure/GitHub Pack Components (HIGH — does not exist in Kickstart)

**Try-aks has it.** These are full React components that handle their own UI, API calls, and state:
- `azureLogin` — OAuth flow with token binding
- `azurePicker` — subscription/resource group dropdown with live ARM API queries
- `githubLogin` — GitHub OAuth
- `githubPicker` — org/repo picker with live GitHub API
- `githubCreatePR` — commits files and creates PR
- `githubSetSecret` — sets GitHub Actions secrets
- `costEstimate` — scans artifacts, fetches live Azure pricing, renders cost table
- `devEnvironment` — opens repo in VS Code/Codespaces/vscode.dev

These are registered via `registerComponent()` and rendered inline in chat.

**Kickstart equivalent:** We have static renderers (`ResourcePicker`, `RepoPicker`, `HandoffCard`) but they're display-only DOM elements — no live API integration, no OAuth, no artifact scanning.

**Impact:** HIGH for the deploy flow. Medium for the discover/design phases Ahmed is comparing.

### A5. Option Cards with Descriptions (MEDIUM — partial in Kickstart)

**Try-aks has it.** The questionnaire options render as radio cards with `label` + `description`. The CSS class `.adaptive-option-card` shows a selected state with blue accent border.

**Kickstart has:** `Button` components with only a `label`. No `description` property on buttons. No radio-group behavior. No visual indication of "recommended" beyond text in the chat bubble.

The try-aks CSS (line in `try-aks-theme.css`):
```css
.adaptive-option-card { border: 1px solid var(--adaptive-border); border-radius: 8px; }
.adaptive-option-card:hover { background-color: #fafafa; border-color: #a3a3a3; }
.adaptive-option-card-selected { border-color: var(--try-aks-accent) !important; background-color: #eff6ff !important; }
```

**Impact:** MEDIUM. Even without the full questionnaire, adding descriptions to buttons would significantly help.

### A6. Compact CodeBlock / File Chips (LOW — exists differently in Kickstart)

**Try-aks has:** `CompactCodeBlock` that renders generated files as small chips with emoji icons (🐳 for Dockerfile, 📄 for YAML). Full code goes to the file viewer.

**Kickstart has:** `renderFileChips()` in `components.js` — similar concept with SVG icons and status indicators (done/generating/pending). Comparable implementation.

**Impact:** LOW. Feature parity exists here.

### A7. Architecture Diagram (Mermaid) (LOW — Kickstart has alternative)

**Try-aks:** Full Mermaid diagram with Azure/K8s icons, rendered via `ArchitectureDiagram.tsx` (16KB component). Registered via `registerDiagramRenderer()`.

**Kickstart:** `ArchitectureDiagram` component in a2ui-renderer.js renders a simpler card-based layout (icon boxes).

**Impact:** LOW for the specific comparison Ahmed raised. The diagram is a nice-to-have visual.

---

## B. Prompt Gaps

### B1. Component Output Format

**Try-aks:** The LLM outputs an `AdaptiveUISpec` JSON object with these top-level keys:
```typescript
interface AdaptiveUISpec {
  version: string;
  title: string;
  agentMessage: string;      // Markdown text streamed to user
  state: Record<string, any>; // Persistent state bindings
  layout: LayoutNode;         // Nested component tree
  diagram?: string;           // Mermaid diagram
}
```

The `layout` is a recursive tree of component nodes (`{type: "questionnaire", ...}`, `{type: "card", children: [...]}`, `{type: "chatInput", ...}`).

**Kickstart:** The LLM outputs Markdown text followed by a `~~~a2ui` fenced block containing a flat JSON array of component descriptors. No state management, no layout tree, no spec version.

Kickstart system prompt (line 104-161 of `system-prompt.ts`):
```
You can include interactive UI components in your response by appending a ~~~a2ui fenced block
at the END of your message. The block must contain a JSON array of component objects.
```

**Gap:** Kickstart has no spec-level structure. Components are afterthoughts appended to text, not the primary interaction medium.

### B2. Teaching the LLM to Use Rich Components

**Try-aks prompt** (line 69-82): Explicitly teaches the questionnaire pattern with a full example including `bind`, `description`, and `onComplete`. It says "Use the questionnaire component when the user faces a technical choice they may not understand."

**Kickstart prompt** (line 109-174): Only teaches `Button` + `Row` for choices. The example is flat:
```json
[{"type":"Row","gap":"8px","wrap":true,"children":[
  {"type":"Button","label":"Node.js","action":"reply","data":{"text":"It's a Node.js application"}}
]}]
```

No description per option. No bind. No onComplete. No form grouping.

### B3. Conversation Rules: Self-Contained Components

**Try-aks prompt** (line 84-88): Has explicit rules for which components must appear ALONE:
```
═══ 4. SELF-CONTAINED COMPONENTS ═══
These components render their own buttons and auto-continue. Show them ALONE:
  azureLogin, azurePicker, azureQuery, githubLogin, githubPicker...
```

**Kickstart prompt:** Has no equivalent. All components can co-exist in any configuration. This leads to messy layouts where buttons appear alongside text with no visual hierarchy.

---

## C. Rendering Gaps

### C1. Visual Design System

**Try-aks:** Uses a professional CSS theme (`try-aks-theme.css`, 300+ lines) with:
- CSS custom properties for consistent theming
- Vercel-inspired dark primary buttons (#171717)
- GitHub-style inputs with focus shadows
- Subtle shadows (`--adaptive-shadow-sm/md/lg`)
- 8px border radius throughout
- System font stack matching GitHub
- Responsive mobile tab navigation

**Kickstart:** Uses Portal Prototyper CSS with:
- Fluent 2 design tokens (`--color-neutral-*`, `--spacing-*`)
- Functional but visually basic
- No elevation/shadow hierarchy
- Smaller border radius (2px corners from Fluent)
- Less visual polish overall

### C2. Chat Bubble Styling

**Try-aks:**
```css
.adaptive-agent-bubble { background-color: #f5f5f5; border-radius: 4px 16px 16px 16px; }
.adaptive-user-bubble { background-color: #171717; color: #ffffff; }
```

**Kickstart:** Standard bubble styling without the asymmetric radius or dark user bubbles.

### C3. Form Components Inside Chat

**Try-aks:** Forms (text inputs, radio groups, questionnaires) render as elevated cards within the chat stream. Each has:
- Clear card border with subtle shadow
- Structured header/body/footer sections
- Primary action button at bottom

**Kickstart:** Forms render as bare DOM elements in the message stream. TextField has a label and input, but no card container, no elevation, no visual containment.

---

## D. Interaction Pattern Gaps

### D1. Form Submission Flow

**Try-aks:** User fills out a questionnaire or text input → clicks "Continue"/"Next" → the component's `onComplete` action fires (typically `sendPrompt`) → conversation automatically advances. The state is bound, so the LLM sees what was selected.

**Kickstart:** User clicks a Button → button's `data.text` is sent as a chat message (e.g., "It's a Node.js application") → LLM receives literal text → must parse intent from that text.

**Key difference:** Try-aks sends structured data. Kickstart sends natural language that the LLM must re-interpret.

### D2. Multi-Step File Generation

**Try-aks:** LLM sets `filesComplete=false` → app auto-sends "Generate next set of files" → repeats until `filesComplete=true`. Zero user friction for multi-turn generation.

**Kickstart:** Each file generation batch requires user to either type or click something to continue. The prompt says to show `DeploymentProgress` but there's no auto-continue mechanism.

### D3. Recommendation Highlighting

**Try-aks:** Options in questionnaires can have descriptions like "Python (recommended for AI workloads)" and the LLM is instructed to "offer a sensible default and explain WHY."

**Kickstart:** Recommendations are buried in markdown text ("Python is very common for...") and the button just says "Python" with no visual distinction for the recommended option.

---

## E. Prioritized Action Items

### Priority 1 — HIGH IMPACT, FOUNDATIONAL (Sprint 1)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E1 | **Add RadioGroup component** to A2UI catalog with `label`, `description`, `value` per option, and `recommended` flag. Render as card-style radio buttons with title + subtitle. | M | Very High |
| E2 | **Add `description` property to Button** component. Render as smaller gray text below the label, inside the same button. | S | High |
| E3 | **Add `recommended` badge** to Button and RadioGroup options. Render as a small pill badge ("Recommended") next to the label. | S | High |
| E4 | **Add FormGroup wrapper component** — a Card-like container that groups inputs/radios with a question title, optional step indicator, and a "Continue" action button. | M | Very High |

### Priority 2 — INTERACTION UPGRADES (Sprint 1-2)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E5 | **Add `onSubmit` action to FormGroup** — when Continue is clicked, send a structured message (e.g., `"Selected: Python"`) rather than relying on individual button clicks. | M | High |
| E6 | **Update system prompt** to teach the LLM to use FormGroup + RadioGroup for technical choices. Add examples showing label + description per option. | S | Very High |
| E7 | **Update phase prompts** to use RadioGroup instead of Button rows for multi-option choices (language, database, cache, AI features). | S | High |
| E8 | **Add auto-continue for file generation** — when `DeploymentProgress` shows active generation, automatically send a continue prompt without user action. | M | High |

### Priority 3 — VISUAL POLISH (Sprint 2)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E9 | **Elevate FormGroup rendering** — add subtle shadow, rounded corners, clear header/body/footer sections matching the try-aks card style. | S | Medium |
| E10 | **Add step indicator** ("Step 1 of 3") to FormGroup header. | S | Medium |
| E11 | **Improve button styling** — rounded corners (8px), subtle hover shadow, better contrast for primary buttons. | S | Medium |
| E12 | **Add selected state for RadioGroup** — blue accent border + light blue background on the chosen option (`.adaptive-option-card-selected` equivalent). | S | Medium |

### Priority 4 — STATE MANAGEMENT (Sprint 2-3)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E13 | **Add state binding to A2UI components** — `bind` property that saves the selected value into a session-level state object accessible to the next LLM call. | L | High (but deferred) |
| E14 | **Add `onComplete` action spec** — components declare what happens on completion (`sendPrompt`, `advancePhase`, etc.). | L | High (but deferred) |
| E15 | **Add template variable interpolation** in component data — allow `{{state.runtime}}` in button text and prompt data. | M | Medium |

### Priority 5 — PACK COMPONENTS (Sprint 3+)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E16 | **Build Azure Login component** — OAuth flow rendering inline in chat. | L | High for deploy phase |
| E17 | **Build GitHub Login + Picker components** — OAuth + live API repo picker. | L | High for handoff phase |
| E18 | **Build live Cost Estimate component** — scan generated artifacts + fetch Azure pricing API. | L | High for review phase |

---

## Recommended Sprint 1 Scope

**E1 + E2 + E3 + E4 + E6 + E7** — Add RadioGroup with descriptions, add description to Button, add FormGroup wrapper, and update prompts. This alone closes ~70% of the perceived UX gap Ahmed identified.

Estimated effort: 1 sprint (5 dev-days for Fry on frontend, 1 dev-day for Leela on prompts).

The state binding (E13-E15) and pack components (E16-E18) are higher effort but lower urgency — the conversation works fine without them, it just requires the LLM to re-parse natural language instead of reading structured state.

---

## 2026-04-08T20:32:15Z: User directive — Fluent 2 design system

**By:** Ahmed Sabbour (via Copilot)

**What:** Playground fonts must match Fluent 2 design system (https://fluent2.microsoft.design/). All UI should use Fluent 2 typography, spacing, and visual language.

**Why:** User request — captured for team memory

---

## 2026-04-09T03:33Z: Adopt Fluent UI React v9

**By:** Ahmed Sabbour (via Copilot)

**What:** Build on @fluentui/react-components (Fluent UI React v9) for Fluent 2 compliance. Wrap app in FluentProvider with webLightTheme. Use Fluent UI components for all UI chrome.

**Why:** User directive - fonts and visual language must match Fluent 2 design system.

---

## 2026-04-09T03:33Z: Playground split-pane layout + component explorer

**Author:** Fry (Frontend Dev)

**Date:** 2025-07-29

**Status:** Accepted

### What

Redesigned the A2UI Playground from a single-column scroll page to a split-pane layout (scenario explorer left, rendered output right). Extracted all scenario definitions to `playground-scenarios.ts`. Added 19 built-in control scenarios covering every A2UI component except Icon/Video/AudioPlayer.

### Why

1. **Scroll bug** — playground content overflowed inside `.chat-main` (overflow: hidden) and couldn't scroll. Split-pane with independent scroll containers fixes this.
2. **Discoverability** — with 27 total scenarios, a flat button grid doesn't scale. Collapsible sections grouped by type work better.
3. **Separation of concerns** — scenario data in its own file keeps `Playground.tsx` focused on layout and interaction.

### Key decisions

- Each built-in scenario generates a **unique surfaceId** via a counter (`uid()`), so clicking the same scenario twice doesn't throw.
- All surfaces use `catalogId: 'kickstart'` — the kickstart catalog extends the basic catalog.
- Skipped Icon, Video, and AudioPlayer scenarios — they need external URLs that may not load in a test harness.

---

# Decision: Full Fluent UI v9 Migration for All A2UI Renderers

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-29
**Status:** Accepted

## Context

User directive: "I don't want to use raw elements anywhere." All A2UI component renderers and kickstart custom components must use Fluent UI React v9 components from `@fluentui/react-components`.

## Decision

Migrated all 22 component files (18 basic catalog + 4 custom) plus `utils.ts` to Fluent UI v9. Zero raw `<button>`, `<input>`, `<label>`, `<span>`, `<h1>`-`<h5>`, `<strong>` remaining. Only permitted raw elements are layout `<div>` (no Fluent flex component), `<audio>`/`<video>` (no Fluent media player), and `<pre>`/`<code>` (no Fluent preformatted text).

## Key Conventions

- All colors via `tokens.colorNeutral*`, `tokens.colorBrand*`, `tokens.colorPalette*`
- All spacing via `tokens.spacing*`
- All border radii via `tokens.borderRadius*`
- Custom styling via `makeStyles` — no inline hardcoded colors/sizes
- `createReactComponent(Api, renderFn)` adapter pattern preserved in all files

---

# Decision: Fluent UI v9 Override Catalog Architecture

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-29
**Status:** Accepted

## Context

The A2UI vendor basic catalog ships 18 components with mixed styling — some already use Fluent UI v9, others use inline styles with hardcoded colors. We need all components to render with Fluent UI v9 for visual consistency, but vendor files must remain untouched.

## Decision

Created a **Fluent override catalog** at `packages/web/src/catalog/fluent-components/` containing 18 component files that re-implement each basic catalog component using Fluent UI v9. These overrides exploit A2UI's `Catalog` Map behavior: when components share the same `.name`, later entries in the constructor array overwrite earlier ones.

**Catalog composition order:**
1. `basicCatalog.components` — 18 vendor components (will be overridden)
2. `fluentOverrides` — 18 Fluent UI v9 replacements (same names, replaces above)
3. Custom components — RadioGroup, FormGroup, CodeBlock, ProgressSteps

Each override imports the vendor's Api object (e.g., `ButtonApi`) to guarantee the `.name` property matches exactly, then wraps a new Fluent UI v9 render function via `createReactComponent()`.

## Consequences

- **Zero vendor modifications** — all 18 overrides live in our catalog directory.
- **Easy rollback** — removing `...fluentOverrides` from kickstart-catalog.ts reverts to vendor rendering.
- **Single source of truth** — component names are owned by vendor Api objects; we never duplicate or hardcode them.
- **Consistent Fluent styling** — all components use `makeStyles`, `tokens`, and Fluent primitives. No inline hardcoded colors.

---

# Decision: Smart Control Pack Patterns for Kickstart A2UI Architecture

**Author:** Leela (Lead)  
**Date:** 2025-07-26  
**Status:** Proposed  
**Supersedes:** None  
**Related:** leela-pragmatic-a2ui-react.md, leela-two-repo-strategy.md

## Context

Ahmed's previous prototype (`sabbour/adaptive-ui-try-aks`) used the **adaptive-ui-framework** — a custom React framework for conversational, agent-driven UIs. It had a **pack system** where bundles of smart components + LLM knowledge + tools + auth were registered as units. We need to understand these patterns and map them into our A2UI v0.9 + React + Fluent UI v9 architecture.

This decision documents every pattern found, assesses A2UI compatibility, and prescribes how to bring each into Kickstart.

## 1. Pack Inventory

### 1.1 Azure Pack (`@sabbour/adaptive-ui-azure-pack`)

| Component | Type | Description |
|-----------|------|-------------|
| `azureLogin` | Self-managing auth | MSAL popup sign-in. Sets `__azureToken` + fetches subscriptions. Auto-selects single subscription. |
| `azureResourceForm` | Dynamic form | Auto-generates forms from ARM provider metadata at runtime — zero hardcoded schemas. |
| `azurePicker` | Data-fetching dropdown | Dropdown that calls ARM API at render time. Used for regions, resource groups, SKUs. Guards against unresolved `{{state}}` interpolation. |
| `azureQuery` | Write-with-confirm | ARM API caller for PUT/POST/PATCH/DELETE with user confirmation dialog. Results stored in state. |

**Tools (inference-time):**
| Tool | Description |
|------|-------------|
| `azure_arm_get` | Read-only ARM REST API. LLM uses to reason before producing UI. Auto-injects subscription ID. |
| `azure_pricing` | Azure retail pricing API. Public, no auth. Returns up to 10 price records. |

**Skills Resolver:** Keyword-triggered domain knowledge injection — ARM PUT body templates for AKS, App Service, Container Apps, ACR, Cosmos DB, Key Vault, Storage, SQL, role assignments. Plus AKS Automatic domain knowledge (Gateway API, Workload Identity, Deployment Safeguards).

**Auth:** MSAL.js (`@azure/msal-browser`). Uses Azure CLI client ID. CORS proxied through `/api/auth-proxy`. Tokens cached in localStorage. Silent + popup flow. Also supports Graph token acquisition for incremental consent.

**Settings UI:** Sign-in/sign-out card injected into settings panel.

**Diagram Icons:** 27 Azure service SVG icons registered for Mermaid diagrams (`%%icon:azure/aks%%`).

### 1.2 GitHub Pack (`@sabbour/adaptive-ui-github-pack`)

| Component | Type | Description |
|-----------|------|-------------|
| `githubLogin` | Self-managing auth | OAuth Device Flow. User enters code on github.com. Polls for token. Shows green confirmation if already signed in. |
| `githubPicker` | Data-fetching dropdown | Fetches from GitHub API at render time. Auto-paginates (up to 300). Used for orgs, repos, branches. Personal account detection. |
| `githubQuery` | Write-with-confirm | GitHub API caller for POST/PUT/PATCH/DELETE with confirm dialog. Auto-rewrites personal account API paths. |
| `githubRepoInfo` | Read-only card | Rich repo card (name, description, language, stars, forks). |
| `githubCreatePR` | Multi-step action | Creates branch, commits all generated artifacts, opens PR. Auto-initializes empty repos. |
| `githubSetSecret` | Encrypted action | Sets GitHub Actions secrets using libsodium sealed box encryption. Self-contained, one-per-turn. |

**Tools (inference-time):**
| Tool | Description |
|------|-------------|
| `github_api_get` | Read-only GitHub REST API with auto-pagination (up to 200 items). Response slimming (repos→6 fields, issues→7 fields). |

**Auth:** OAuth Device Flow OR PAT entry. Token stored in localStorage + module cache. CORS proxied through `/api/github-oauth/*`.

**Settings UI:** OAuth client ID configuration, CORS proxy URL, PAT entry, token inspection.

### 1.3 App-Level Custom Components (try-aks)

| Component | Type | Description |
|-----------|------|-------------|
| `ArchitectureDiagram` | Visualization | Mermaid diagram renderer with ELK layout, pan/zoom, Azure icon substitution, auto-fit. |
| `CostEstimate` | Data display | Scans generated artifacts for cost breakdown. |
| `CompactCodeBlock` | File chip | Override of codeBlock — renders as compact file chip, full code goes to file viewer panel. |
| `DevEnvironmentCard` | Action card | Opens repo in VS Code / vscode.dev / Codespaces. |
| `K8sValidator` | Validation engine | Client-side AKS Deployment Safeguards validation (DS001-DS013). Validates + auto-fixes YAML manifests. |
| `SafeguardsChecker` | LLM feedback | Formats violations as markdown for LLM context injection → self-correction loop. |
| `DiagramBuilder` | Generator | Builds Mermaid diagrams from artifact context (Bicep resources + K8s manifests). |

### 1.4 Core Framework (`@sabbour/adaptive-ui-core`)

Not a "pack" but foundational capabilities all packs depend on:
- **Component Registry** — `registerComponent()`, `registerPackWithSkills()`, `getComponent()`
- **AdaptiveApp** — Conversation orchestrator (turn management, LLM adapter, history)
- **Context** — React Context with state, dispatch, handleAction, sendPrompt, disabled flag
- **Renderer** — Recursive node renderer consuming `AdaptiveUISpec.layout`
- **Interpolation** — `{{state.key}}` resolution in any string prop
- **Tools** — `registerTool()`, `executeTool()`, tool-call loop in LLM adapter
- **Artifacts** — Scoped file storage for generated code
- **Session Manager** — localStorage persistence with 24h TTL
- **Request Tracker** — `trackedFetch()` wrapper for API call monitoring
- **DisabledScope** — Wraps past turns, sets `disabled=true`, components skip side effects
- **Decision Log** — Audit trail of adapter/tool decisions
- **Sanitizer** — XSS protection for rendered content

## 2. Pattern Catalog (14 Patterns)

### P01: Pack Registration
**What:** Bundle of components + system prompt + skills resolver + settings UI + LLM tools, registered as a single unit via `registerPackWithSkills(createAzurePack())`.  
**How it works:** `createAzurePack()` returns a `ComponentPack` object. `registerPackWithSkills()` iterates components → `registry.set()`, stores system prompt, wires skill resolver, registers tools, injects settings.  
**Why it matters:** Clean separation of concerns. Adding GitHub support = one line. Removing it = one line. LLM automatically knows about available capabilities via system prompt injection.

### P02: Self-Managing Login Component
**What:** Login components handle their entire auth flow internally — render sign-in button, trigger popup/device flow, store token in state, fetch initial data (subscriptions, user info), show confirmation.  
**How it works:** Component checks `disabled` flag (skip in past turns). Checks existing token. If no token → renders sign-in UI. On click → triggers auth flow. On success → dispatches `SET` action to store token as `__azureToken`. LLM told to "omit next" — component self-manages.  
**Key detail:** Double-underscore prefix (`__`) = private state, hidden from LLM in form submissions.

### P03: Data-Fetching Picker
**What:** Dropdown that fetches options from an API at render time. Handles loading, error, empty states. Auto-paginates (GitHub: up to 300 items).  
**How it works:** Component receives `api` prop with `{{state.key}}` interpolation in the URL. On mount, resolves interpolation → fetches → renders dropdown. Guards: if interpolation yields literal `{{state.*}}`, shows "Waiting for selection..." instead of making broken API call.  
**Example:** `{type:"azurePicker", api:"/subscriptions/{{state.__azureSubscription}}/locations?api-version=2022-12-01", bind:"region", labelKey:"displayName", valueKey:"name"}`

### P04: Write-with-Confirm Action
**What:** Component that calls a write API (PUT/POST/DELETE) with explicit user confirmation before executing.  
**How it works:** Renders a confirm button (label customizable). On click → calls API with interpolated path + body → stores result in state under `bind` key. Shows loading spinner during execution.  
**Key detail:** `confirm` prop can be boolean (show/hide) or string (custom button label, e.g. "Create Repository").

### P05: LLM Inference-Time Tools
**What:** Functions the LLM calls during text generation, before producing UI. Results feed back into LLM reasoning.  
**How it works:** Tools registered via `registerTool(definition, handler)`. LLM adapter includes tool definitions in API request. When LLM emits tool_call → adapter executes handler → sends result back → LLM continues generating. Loop until LLM produces final response.  
**Example:** LLM calls `azure_arm_get` to check if a resource group exists → gets result → decides whether to show "create new" or "use existing" UI.  
**Key distinction from components:** Tools run DURING inference. Components run AFTER inference (render time). Tools inform LLM reasoning. Components present results to user.

### P06: Knowledge Skills Resolver
**What:** Per-turn prompt enrichment that injects domain knowledge based on conversation context.  
**How it works:** Before each LLM call, `resolvePackSkills(prompt)` runs all registered resolvers. Each resolver checks keywords → returns additional system prompt text. Only injects if content is new (not same as last turn). Content: ARM PUT body templates, AKS Automatic rules (Gateway API, Workload Identity, Deployment Safeguards).  
**Key detail:** Skill content is LARGE (multi-KB). Only injected when relevant. Prevents token waste on irrelevant turns.

### P07: Disabled Context (Past Turn Isolation)
**What:** Past conversation turns rendered in `DisabledScope` — components skip API calls, auth checks, and other side effects.  
**How it works:** `DisabledScope` wraps past-turn rendering, overrides context with `disabled: true`. Components check `useAdaptive().disabled` and short-circuit.  
**Why it matters:** Without this, scrolling through conversation history would re-trigger N auth popups and N×M API calls.

### P08: State-as-Token Convention
**What:** Auth tokens stored in conversation state with `__` prefix. Components check state for token presence to determine auth status. LLM instructions say "show login if `__azureToken` not set."  
**How it works:** Login component sets `__azureToken` → next turn, LLM reads state → sees token present → skips login → shows resource pickers. If token expired, component silently refreshes via `acquireTokenSilent()`.  
**Key detail:** `__` prefix hides from form submit payloads but LLM CAN reference in `{{state.__azureToken}}` for API calls.

### P09: CORS Proxy Pattern
**What:** All external API calls routed through a backend proxy (`/api/*`) to bypass browser CORS restrictions.  
**How it works:** Azure Functions backend with routes: `/api/arm-proxy/*` → ARM API, `/api/auth-proxy/*` → login.microsoftonline.com, `/api/github-oauth/*` → github.com, `/api/pricing-proxy/*` → Azure retail prices. Token forwarded in Authorization header.  
**Why it matters:** MSAL token exchange requires server-side call (CORS). ARM API requires it. GitHub OAuth requires it. The proxy also enables workload identity fallback when no user token is available.

### P10: Artifact-Aware Components
**What:** Components that read/write from a shared artifact store (generated files like Dockerfiles, Bicep, Helm charts).  
**How it works:** `githubCreatePR` reads ALL artifacts → creates branch → commits each file → opens PR. `CompactCodeBlock` renders as a file chip linking to the artifact in the file viewer panel. `CostEstimate` scans artifacts for cost-relevant resources. `DiagramBuilder` generates architecture diagrams from artifact context.  
**Key insight:** Artifacts are the bridge between LLM-generated code and external systems (GitHub, deployment).

### P11: Auto-Continue Component
**What:** Components that automatically advance the conversation after completing their action.  
**How it works:** `githubSetSecret` and `githubCreatePR` call `sendPrompt()` after success with a result summary. LLM picks up the next turn. User sees seamless flow without clicking "Continue."  
**Key detail:** "Self-contained, one per turn" — the system prompt explicitly tells the LLM to show these components alone.

### P12: ARM Introspection
**What:** Runtime discovery of Azure resource type schemas from ARM provider metadata — no hardcoded forms.  
**How it works:** `fetchResourceTypeSchema()` calls `/providers/{namespace}?api-version=...`, finds resource type definition, extracts properties, caches with 5-min TTL. `azureResourceForm` consumes the schema to generate form fields dynamically.  
**Why it matters:** Works for ANY ARM resource type without code changes. New Azure services automatically get forms.

### P13: Client-Side Validation + Auto-Fix
**What:** K8s manifest validator that checks AKS Deployment Safeguards (13 rules) and can auto-fix violations.  
**How it works:** Parses YAML → checks each container for resources, probes, security context, image tags, etc. Returns structured violations. `fixK8sManifest()` applies default fixes (adds resource limits, probes, security settings). Violations formatted as markdown → injected into LLM context → LLM self-corrects in next turn.  
**Key pattern:** Validate → format for LLM → LLM fixes → re-validate loop.

### P14: Intent Resolvers (Preconfigured Components)
**What:** Shortcut names that expand to fully-configured component props.  
**How it works:** `azure-regions` resolver returns `{type:"azurePicker", api:"/subscriptions/.../locations?...", labelKey:"displayName", valueKey:"name", filterKey:"metadata.regionType", filterValue:"Physical"}`. LLM uses intent name instead of specifying full props.  
**Why it matters:** Reduces LLM prompt complexity. Common patterns pre-baked.

## 3. Architecture Recommendations for Kickstart (A2UI + Fluent UI v9)

### R01: ServicePack Abstraction Layer

**Problem:** A2UI has no concept of "packs." It has custom components and that's it. No system for bundling components + prompts + tools + auth.

**Recommendation:** Create a `ServicePack` TypeScript interface in Kickstart's `packages/core`:

```typescript
interface ServicePack {
  name: string;
  displayName: string;
  
  // A2UI custom component registrations
  components: Record<string, A2UICustomComponent>;
  
  // System prompt additions for the LLM
  systemPrompt: string;
  
  // Knowledge skills — injected per-turn based on context
  resolveSkills?: (prompt: string) => Promise<string | null>;
  
  // LLM inference-time tools
  tools?: ToolDefinition[];
  
  // Service connector (auth + API client)
  connector: ServiceConnector;
}
```

This wraps A2UI's component registration with the additional machinery. Kickstart's engine calls `registerServicePack()` at startup, which:
1. Registers each component via `createReactComponent()` (A2UI)
2. Appends system prompt to the LLM context
3. Registers tools with the tool executor
4. Initializes the service connector

### R02: ServiceConnector Pattern (Auth + API)

**Problem:** The old framework stored tokens in conversation state (`__azureToken`). A2UI's data model uses JSON Pointers, not arbitrary state. We need auth tokens accessible to components without polluting the UI data model.

**Recommendation:** Create per-service `ServiceConnector` as React Context + singleton:

```typescript
interface ServiceConnector {
  name: string;
  isAuthenticated: boolean;
  login(): Promise<void>;
  logout(): void;
  getToken(): Promise<string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}
```

Components access via `useServiceConnector('azure')`. Tokens managed internally (MSAL/OAuth), never in A2UI state. Components report results (not tokens) back to the orchestrator via `action.event`.

**Port from old framework:**
- `azureLogin` auth logic → `AzureConnector` (MSAL, silent refresh, proxy routing)
- `githubLogin` auth logic → `GitHubConnector` (Device Flow, PAT, token storage)

### R03: Fat Components for Data-Fetching Controls

**Problem:** A2UI components receive props and render. They don't natively fetch data. The old framework's pickers called APIs at render time.

**Recommendation:** Build each pack control as a **fat A2UI custom component** — self-contained React component registered via `createReactComponent()` that:
1. Receives config props from LLM (API path, bind key, labels)
2. Uses `useServiceConnector()` to get auth + make API calls
3. Manages its own loading/error/empty states (Fluent UI v9 Spinner, MessageBar)
4. Reports selection back via A2UI `action.event` → orchestrator updates data model

**Mapping:**
| Old Component | Kickstart A2UI Component | Notes |
|---------------|-------------------------|-------|
| azureLogin | `<AzureLoginCard>` | Fat component, uses AzureConnector |
| azurePicker | `<AzureResourcePicker>` | Fat component, fetches at render |
| azureResourceForm | `<AzureResourceForm>` | Fat component, ARM introspection |
| azureQuery | `<AzureAction>` | Fat component, confirm + execute |
| githubLogin | `<GitHubLoginCard>` | Fat component, Device Flow |
| githubPicker | `<GitHubPicker>` | Fat component, auto-paginate |
| githubQuery | `<GitHubAction>` | Fat component, confirm + execute |
| githubCreatePR | `<GitHubCommit>` | Fat component, reads artifacts |
| githubSetSecret | `<GitHubSetSecret>` | Fat component, libsodium encryption |

### R04: Keep LLM Tools in Orchestration Layer

**Problem:** A2UI has no tool concept. Tools are a Kickstart concern.

**Recommendation:** Tools stay in Kickstart's LLM adapter (backend SSE endpoint or client-side adapter). Port `azure_arm_get`, `azure_pricing`, `github_api_get`, `fetch_webpage` directly. They use `ServiceConnector.getToken()` for auth instead of reading from state.

### R05: Port Knowledge Skills to Phase Engine

**Problem:** A2UI has no skill resolver concept.

**Recommendation:** Kickstart's 6-phase engine already has per-phase system prompts. Add a skill resolver middleware:
1. Before each LLM call, run all registered pack skill resolvers against the user prompt
2. Append returned knowledge to the system prompt for that turn only
3. Cache to avoid re-injecting identical content

Port `resolveAzureSkills()` directly — the keyword → ARM template mapping is valuable and framework-independent.

### R06: CORS Proxy Backend (Same Pattern)

**Recommendation:** Exact same architecture. SWA Functions backend with:
- `/api/arm-proxy/*` → Azure ARM API (forwards Bearer token or uses managed identity)
- `/api/auth-proxy/*` → login.microsoftonline.com (MSAL token exchange)
- `/api/github-oauth/*` → github.com (Device Flow + token exchange)
- `/api/pricing-proxy/*` → Azure retail pricing API

Already planned in Kickstart infra. No changes needed from the old pattern.

### R07: Artifact Store (Port Directly)

**Recommendation:** Port the artifact store concept to Kickstart's `packages/core`. A2UI components report generated files via `action.event`. The orchestrator stores them. Components like `<GitHubCommit>` read from the store to create PRs.

### R08: Client-Side Validation (Port Directly)

**Recommendation:** Port `k8s-validator.ts` and `safeguards-checker.ts` to `packages/core`. They're pure TypeScript, zero framework dependency. Wire into the phase engine: after Generate phase, validate artifacts → inject violations into LLM context → Review phase auto-corrects.

### R09: Diagram System (Port to A2UI)

**Recommendation:** `ArchitectureDiagram` → A2UI custom component `<ArchitectureDiagram>`. Mermaid + ELK rendering, Azure icon substitution, pan/zoom. Register Azure diagram icons from the Azure pack.

The old framework's diagram registry (`registerDiagramRenderer()`, `registerAzureDiagramIcons()`) maps cleanly to A2UI component registration.

## 4. Gaps — Things A2UI Can't Do Natively

### G01: No Pack/Bundle System
**A2UI provides:** Individual component registration.  
**Gap:** No way to bundle components + prompts + tools + auth as a unit.  
**Solution:** `ServicePack` abstraction (R01). Kickstart concern, not A2UI concern.

### G02: No Service/Connector Layer
**A2UI provides:** Data binding via JSON Pointers on a SurfaceModel.  
**Gap:** No mechanism for components to acquire auth tokens or call external APIs.  
**Solution:** `ServiceConnector` pattern (R02). React Context + hooks.

### G03: No LLM Tool System
**A2UI provides:** Nothing for inference-time tool calls.  
**Gap:** Tools are the bridge between "LLM needs data" and "show UI with data."  
**Solution:** Keep in Kickstart's orchestration layer (R04). Not an A2UI concern.

### G04: No Prompt Injection / Skills System
**A2UI provides:** Nothing for dynamic system prompt management.  
**Gap:** Knowledge skills are critical for Azure domain expertise.  
**Solution:** Phase engine middleware (R05). Not an A2UI concern.

### G05: No Artifact Store
**A2UI provides:** Nothing for file-level artifact management.  
**Gap:** Generated code (Bicep, Dockerfiles, manifests) needs persistent storage and cross-component access.  
**Solution:** Kickstart artifact store in `packages/core` (R07).

### G06: No Disabled/Past-Turn Isolation
**A2UI provides:** Messages are immutable by design once rendered.  
**Gap:** In conversation UIs, past turns must not re-trigger side effects when scrolled into view.  
**Solution:** A2UI's `@a2ui/react` renderer already handles this — past messages are static DOM. But fat components with `useEffect` need their own `isActive` guard. Recommend: components check a `turnActive` prop or context value.

### G07: No Auto-Continue
**A2UI provides:** Components can fire `action.event`, but there's no "auto advance conversation" mechanism.  
**Gap:** Components like `githubCreatePR` need to automatically trigger the next turn.  
**Solution:** Auto-continue middleware in the Kickstart conversation engine. When a component fires a specific event type (e.g., `action.complete`), the engine synthesizes a user prompt and advances.

### G08: No State Interpolation in Props
**A2UI provides:** Data binding via JSON Pointers.  
**Gap:** The old framework used `{{state.key}}` in any string prop (API paths, labels, etc.).  
**Solution:** A2UI uses JSON Pointer references (`/data/region`) which serve the same purpose. LLM generates A2UI JSON with pointer references instead of `{{state.key}}`. Different syntax, same capability.

## 5. Migration Priority

| Priority | Pattern | Effort | Rationale |
|----------|---------|--------|-----------|
| P0 | ServiceConnector (Azure auth) | 1 day | Everything depends on auth |
| P0 | ServiceConnector (GitHub auth) | 1 day | PR creation depends on it |
| P0 | ServicePack abstraction | 0.5 day | Registration framework |
| P0 | CORS proxy backend | 1 day | Already planned in infra |
| P1 | AzureResourcePicker (fat component) | 1 day | Core UX for resource selection |
| P1 | GitHubPicker (fat component) | 1 day | Core UX for repo/branch selection |
| P1 | GitHubCommit (createPR) | 1.5 days | Core deployment path |
| P1 | Azure/GitHub LoginCards | 1 day | Auth UI |
| P1 | K8s Validator + auto-fix | 0.5 day | Pure TS port, zero framework |
| P1 | Knowledge skills resolver | 0.5 day | Prompt middleware |
| P2 | AzureResourceForm (ARM introspection) | 2 days | Dynamic forms are complex |
| P2 | ArchitectureDiagram | 1.5 days | Mermaid + ELK + icons |
| P2 | AzureAction / GitHubAction (write-with-confirm) | 1 day | Write operations |
| P2 | GitHubSetSecret | 0.5 day | Libsodium encryption |
| P2 | CostEstimate | 1 day | Pricing API integration |
| P3 | LLM tools port | 1 day | Already have pattern |
| P3 | DiagramBuilder (auto-generate from artifacts) | 1 day | Nice-to-have |
| P3 | Intent resolvers (shortcuts) | 0.5 day | Convenience, not critical |

**Total estimate:** ~16.5 developer-days for full pack port.

## Decision

Adopt the **ServicePack + ServiceConnector** pattern as Kickstart's extension model. All pack components become fat A2UI custom components. Auth, tools, skills, and artifacts live in Kickstart's orchestration layer, not in A2UI. Port patterns P01-P14 following the priority table above.

This gives us the same rich capabilities as the adaptive-ui-framework while building on A2UI's renderer and Google's component model. We keep what worked (structured JSON, fat components, tools, skills) and drop what A2UI replaces (custom registry, custom renderer, custom context).

---

# Decision: Smart Control Patterns from adaptive-ui-trip-notebook

**Date:** 2025-07-25
**Author:** Leela (Lead)
**Status:** Research / Informational
**Requested by:** Ahmed Sabbour

## Context

Research analysis of `sabbour/adaptive-ui-trip-notebook` — an AI travel planning assistant built on the same adaptive-ui-framework used by the AKS app (`sabbour/adaptive-ui-try-aks`). This app uses 3 domain-specific packs with 11 smart controls, revealing additional architectural patterns beyond what the AKS app demonstrates.

## 1. Control Inventory

### Travel Data Pack (`@sabbour/adaptive-ui-travel-data-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `weatherCard` | `city` | Client-side fetch + 3-day forecast strip | wttr.in (free, no key) |
| `countryInfoCard` | `country` | Client-side fetch + fact card with flag | restcountries.com (free) |
| `currencyConverter` | `from?, to?` | Interactive widget with amount input + swap | open.er-api.com (free) |
| `travelChecklist` | `items, bind` | Checkbox list with progress bar | None (local state) |
| `budgetTracker` | `items, currency?, bind?` | Category-bar visualization + auto-artifact | None (auto-saves) |

**Tools:** `get_weather`, `get_exchange_rate`, `get_country_info`, `get_time_zone`

### Google Maps Pack (`@sabbour/adaptive-ui-google-maps-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `googleMaps` | `mode, query, origin, destination...` | 5-mode iframe embed | Maps Embed API |
| `googlePlacesSearch` | `query, bind` | Click-to-select place list | Places API (new) |
| `googleNearby` | `location, bind, placeType?` | Photo grid with ratings | Places API (new) |
| `googlePhotoCard` | `query, caption?` | Hero image with overlay | Places API (photos) |

**Tools:** `google_places_search`, `google_place_details`, `google_geocode`

### Google Flights Pack (`@sabbour/adaptive-ui-google-flights-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `flightSearch` | `from, to, date, bind?` | Live results via CORS proxy + HTML parse | Google Flights (scrape) |
| `flightCard` | `from, to, date` | Deep link card with protobuf URL | None (URL construction) |

**Tools:** `search_flights`

## 2. New Patterns (Not Found in AKS App)

### Pattern A: Component-Autonomous Data Fetching

Components call external APIs themselves at render time. The LLM provides minimal props (`city: "Paris"`) and the component handles the entire API lifecycle: loading state → fetch → parse → render → error recovery. The LLM never sees the fetched data.

**Why it matters:** Saves tokens, parallelizes API calls, and enables real-time data without tool calls. For Kickstart, a `DeploymentStatus` component could poll Azure APIs directly without the LLM orchestrating it.

**Example:** `{type: "weatherCard", city: "Cairo"}` — component fetches wttr.in, shows loading spinner, renders 3-day forecast. LLM moves on immediately.

### Pattern B: Artifact Extraction Pipeline

The app walks the entire AdaptiveUISpec layout tree after each LLM response, extracting structured data from component nodes. Extraction functions recognize component types (`countryInfoCard` → destination, `flightSearch` → flight info, `budgetTracker` → budget items) and persist them as typed artifacts via `upsertArtifact()`.

**Extraction targets:** places, flights, weather, checklists, photos, itinerary days, code blocks — each with its own tree-walking function.

**Why it matters:** Creates a persistent structured data layer from ephemeral chat components. Enables the second-panel "Trip Notebook" to aggregate all trip data across the conversation.

### Pattern C: Dual-Role API Integration (Tool + Component)

Every external API has TWO entry points:
1. **Tool** — LLM calls it at inference time, sees the response, reasons about it
2. **Component** — renders visually for the user, fetches data client-side

The system prompt explicitly instructs when to use each: "Use `get_weather` TOOL when LLM needs data to reason. Use `weatherCard` COMPONENT to display weather visually."

**Why it matters:** Optimizes token usage. The LLM only calls tools when it needs data to make decisions. Visual display uses components that fetch independently. For Kickstart: `check_aks_status` tool for LLM reasoning vs. `aksStatusCard` component for user display.

### Pattern D: Cross-Component State Binding via `{{state.key}}`

The `bind` prop + `{{state.key}}` interpolation creates implicit cross-component communication:
- User selects a hotel in `googlePlacesSearch` → stores in `state.hotel`
- `googleNearby` uses `location: "{{state.hotel}}"` → shows restaurants near selected hotel
- `flightSearch` uses `from: "{{state.fromAirport}}"` → updates when departure is set

State is managed via `dispatch({ type: 'SET', key, value })`. Components read via `interpolate(prop, state)`.

**Why it matters:** Enables multi-step wizards without LLM orchestration. Once state is set, downstream components auto-update. For Kickstart: selecting a runtime could auto-update deployment templates, resource suggestions, and cost estimates.

### Pattern E: Graceful Degradation Chain

FlightSearch demonstrates a 3-tier fallback:
1. **Rich mode:** CORS proxy → fetch Google Flights HTML → parse → show interactive results
2. **Link mode:** No proxy or parse fails → show styled "Search on Google Flights" link card
3. **Error mode:** Missing params → show yellow warning banner

GoogleNearby: Photos attempt Places API photo fetch → fall back to colored placeholder initials.

**Why it matters:** External APIs are unreliable. Every component needs a degradation path. For Kickstart: Azure API down → show cached state → show "check in portal" link.

### Pattern F: Artifact-Driven Side Panel

The TripNotebook panel uses `useSyncExternalStore` to subscribe to the artifact store. It categorizes artifacts by filename prefix convention:
- `place-*` → Overview tab destinations
- `flight-*` → Travel tab flights
- `budget-*` → Budget tab line items
- `weather-*` → Overview tab weather
- `itinerary-day-*` → Itinerary tab (sorted by day number)
- `checklist-*` → Packing tab
- Everything else → Trip Files

**Why it matters:** Decouples data production (chat components) from data consumption (notebook panel). For Kickstart: a "Deployment Dashboard" panel could aggregate all deployment artifacts by convention.

### Pattern G: Protobuf URL Construction

The flights pack includes a minimal protobuf encoder (`protobuf.ts`) that builds binary-encoded Google Flights URLs. It implements the wire format (varint, length-delimited, tags) and specific message types (Airport, FlightData, Info).

**Why it matters:** Pattern for integrating with services that use binary/encoded URL parameters. Could apply to Azure Portal deep links with complex state.

### Pattern H: HTML Scraping as API Alternative

The flights pack parses Google Flights HTML responses to extract structured flight data (`parser.ts`). It looks for specific script tags (`class="ds:1"`) and `AF_initDataCallback` patterns, then walks nested JSON arrays to extract prices, airlines, legs, durations, and carbon emissions.

**Why it matters:** When official APIs don't exist or are too expensive, scraping-via-CORS-proxy is a viable pattern. For Kickstart: could scrape Azure pricing pages or status pages as a fallback.

### Pattern I: Pack Scoping

`getActivePackScope() / setActivePackScope('travel')` + `clearAllPacks()` ensures multi-app isolation. When the travel app mounts, it clears any other app's packs and registers its own.

### Pattern J: Session-Scoped Artifact Persistence

Each session has its own artifact namespace. Switching sessions calls `saveArtifactsForSession(oldId)` then `loadArtifactsForSession(newId)`. Deleting a session also deletes its artifacts.

## 3. Cross-Domain Patterns (Shared with AKS App)

Both apps share the same foundational architecture:

| Pattern | Implementation |
|---------|---------------|
| Pack factory | `create{Name}Pack(): ComponentPack` |
| Registration | `registerPackWithSkills(pack)` |
| Component typing | `AdaptiveComponentProps<T extends AdaptiveNodeBase>` |
| State access | `useAdaptive()` → `{ state, dispatch, disabled }` |
| Template interpolation | `interpolate(value, state)` for `{{state.key}}` |
| Tool definition | OpenAI function-calling format (`type: 'function'`) |
| Tool handler | `async (args: Record<string, unknown>) => string` |
| Observable fetch | `trackedFetch(url, options)` |
| Settings panel | `settingsComponent` in pack definition |
| System prompt per pack | `systemPrompt` string in pack definition |
| API key storage | `localStorage` via settings components |
| Error display | Shared `Banner` component pattern |
| Loading display | Shared `LoadingSpinner` component pattern |

## 4. Architecture Implications for Kickstart A2UI Pack Design

### 4.1 Pack Anatomy Formalized

Every Kickstart pack should have this structure:
```
{
  name: string,
  displayName: string,
  components: Record<string, React.FC>,    // visual controls
  tools: ToolDefinition[],                  // LLM-callable functions
  systemPrompt: string,                     // instructions for when/how to use
  settingsComponent?: React.FC,             // API key / config UI
}
```

### 4.2 Component Autonomy Principle

Components that display external data should fetch it themselves (like `weatherCard` fetches wttr.in). The LLM provides intent (`what` to show), the component handles execution (`how` to get and display it). This saves tokens and enables real-time updates.

**Kickstart application:**
- `aksClusterStatus` — polls Azure for cluster health, shows live status
- `deploymentProgress` — polls deployment, shows step-by-step progress
- `costEstimate` — fetches Azure pricing calculator, shows cost breakdown
- `resourceHealth` — subscribes to Azure Resource Health API

### 4.3 Dual-Entry API Pattern

For every Azure/GitHub API integration:
- **Tool:** `check_deployment_status` — LLM calls it, sees JSON, reasons about next steps
- **Component:** `deploymentStatusCard` — user sees live visual, component polls API
- **System prompt rule:** "Use the tool when you need data to decide. Use the component when showing the user."

### 4.4 Artifact Convention for Dashboard Panel

If we build a Kickstart dashboard panel (like TripNotebook), use filename prefix convention:
- `infra-*` — Infrastructure resources
- `deploy-*` — Deployment status/progress
- `cost-*` — Cost estimates and breakdowns
- `manifest-*` — Generated Bicep/Helm/Dockerfile files
- `auth-*` — Entra/RBAC configuration

### 4.5 State Binding for Multi-Step Flows

Kickstart's 6-phase conversation can use `bind` + `{{state.key}}` for cross-phase data flow:
- Phase 1 (Discover): user picks runtime → `state.runtime`
- Phase 2 (Design): `architectureDiagram` reads `{{state.runtime}}`
- Phase 3 (Generate): manifest templates interpolate `{{state.runtime}}`
- Phase 4 (Review): cost estimate uses `{{state.runtime}}` for pricing

### 4.6 Graceful Degradation Required

Every component that calls an external API must have:
1. Rich interactive mode (API available)
2. Static/cached mode (API slow or intermittent)
3. Link-out mode (API unavailable — "Check in Azure Portal")
4. Error display mode (with actionable message)

## 5. Recommended Kickstart Packs

Based on patterns from both apps:

| Pack | Components | Tools |
|------|-----------|-------|
| `kickstart-azure-pack` | aksClusterStatus, resourceGroup, costEstimate, deploymentProgress | check_cluster, get_pricing, list_resources |
| `kickstart-github-pack` | repoCard, workflowStatus, prCard, codeViewer | create_repo, trigger_workflow, get_file |
| `kickstart-iac-pack` | fileEditor, manifestPreview, architectureDiagram, diffViewer | generate_bicep, generate_helm, validate_k8s |
| `kickstart-auth-pack` | entraAppCard, rbacMatrix, secretsPanel | configure_entra, assign_roles, create_secret |

---

# Decision: Playground JSON Viewer Implementation

**Date:** 2026-04-09  
**Author:** Fry  
**Status:** Implemented  

## Context

Users needed a way to view the raw A2UI JSON behind each scenario in the Playground to understand the structure and learn how to create their own scenarios.

## Decision

Added a tabbed interface to the Playground right panel with "Preview" and "JSON" tabs:

1. **Tab Navigation**: Used Fluent UI React v9 `TabList` and `Tab` components for a consistent, accessible tab interface.

2. **State Management**: 
   - `selectedScenario`: Tracks which scenario is currently active (set when user clicks a scenario)
   - `selectedTab`: Tracks active tab ('preview' | 'json'), defaults to 'preview'

3. **JSON Generation**:
   - For scenarios with `generate()` functions: Call the function and stringify the result
   - For keyword-based scenarios: Call `resetDemoState()` + `getDemoResponse()` to produce real A2UI JSON

4. **Styling Approach**:
   - All styles use Fluent UI tokens (no raw CSS values)
   - Code block uses `tokens.fontFamilyMonospace` for consistency
   - Background uses `colorNeutralBackground3` for subtle contrast
   - Proper spacing with `spacingHorizontalL` and `spacingVerticalM`

5. **Layout Integration**:
   - Tabs header is fixed (flexShrink: 0) to stay visible while scrolling
   - Both tab panels maintain the scrolling behavior from playground.css
   - JSON viewer container has `flex: 1` and `overflow: auto` to fill available space

## Alternatives Considered

1. **Side-by-side split view**: Would have been harder to fit in the already-split layout
2. **Toggle button instead of tabs**: Less discoverable, tabs are more conventional for this use case
3. **Syntax highlighting library**: Decided to keep it simple with monospace font and proper indentation initially; added via separate decision

## Impact

- Users can now inspect the A2UI JSON structure for any scenario
- Helps with learning and debugging
- No breaking changes to existing functionality
- Maintains accessibility through Fluent UI components

---

# Decision: Fluent 2 Polish — Syntax Highlighting, Markdown Control, Component Audit

**Date:** 2026-04-10  
**Decider:** Fry (Frontend Dev)  
**Status:** Implemented

## Context

Ahmed Sabbour identified three UI polish issues in the Kickstart web app:
1. Code blocks lacked syntax highlighting (plain monospace text)
2. No Markdown component for rendering LLM markdown responses with Fluent styling
3. Some controls had slipped Fluent 2 design language (spacing, typography, layout inconsistencies)

These issues affected code readability, content formatting flexibility, and visual consistency.

## Decision

Implemented a three-part polish pass:

### 1. Code Block Syntax Highlighting
- Added `highlight.js` to `CodeBlock.tsx` component
- Registered 10+ common languages (JavaScript, TypeScript, Python, Java, C#, JSON, XML/HTML, CSS, Bash, Markdown)
- Applied VS theme (`highlight.js/styles/vs.css`) to complement Fluent 2 neutral palette
- Used `useMemo` for performance optimization

### 2. Markdown A2UI Component
- Created new `Markdown.tsx` component using `react-markdown` and `remark-gfm`
- All HTML elements styled with Fluent 2 tokens via `makeStyles`
- Code blocks within Markdown delegate to highlight.js
- Registered in `kickstart-catalog.ts` alongside other custom components

### 3. Fluent 2 Component Audit
- Audited all components in `fluent-components/`, `components/`, and `Playground.tsx`
- Fixed violations in Modal.tsx, Icon.tsx, Video.tsx, ProgressSteps.tsx, Playground.tsx
- Replaced inline styles with `makeStyles` classes
- Replaced hardcoded values (px, hex, rgb) with Fluent tokens
- Ensured all spacing/fonts/colors use `tokens.*` references

## Rationale

**Syntax highlighting:** Improves code readability and provides visual hierarchy within code blocks. `highlight.js` chosen for lightweight footprint (190+ languages available) and VS theme chosen for Fluent 2 compatibility.

**Markdown component:** Enables flexible content formatting from LLM responses while maintaining Fluent 2 design system consistency. Using `react-markdown` provides GitHub-flavored markdown support (tables, strikethrough, task lists).

**Component audit:** Ensures visual consistency across the app by enforcing Fluent 2 design language. Using tokens instead of hardcoded values makes theme changes easier and ensures consistency with Microsoft design systems.

## Consequences

**Positive:**
- Code blocks now have professional syntax highlighting
- Markdown content can be rendered with full Fluent 2 styling
- Visual consistency improved across all components
- Design system compliance makes future theme updates easier
- All changes use existing Fluent UI React v9 + A2UI adapter pattern

**Negative:**
- Added two dependencies (`highlight.js`, `react-markdown`, `remark-gfm`)
- Bundle size increased slightly (but build still optimizes to 302 KB gzipped)

## Alternatives Considered

**For syntax highlighting:**
- Prism.js — more plugins but heavier
- Shiki — better accuracy but requires WASM and is slower

**For Markdown:**
- marked.js — smaller but no React integration, harder to style
- Custom markdown parser — too much work for limited benefit

**For audit:**
- Leave inline styles — rejected because it violates Fluent 2 design language
- Create global CSS classes — rejected because `makeStyles` provides better scoping and token integration

## Implementation

- Files changed:
  - `packages/web/src/catalog/components/CodeBlock.tsx` (syntax highlighting)
  - `packages/web/src/catalog/components/Markdown.tsx` (new component)
  - `packages/web/src/catalog/kickstart-catalog.ts` (registration)
  - `packages/web/src/catalog/fluent-components/Modal.tsx` (inline styles removed)
  - `packages/web/src/catalog/fluent-components/Icon.tsx` (hardcoded font size removed)
  - `packages/web/src/catalog/fluent-components/Video.tsx` (inline aspectRatio removed)
  - `packages/web/src/catalog/components/ProgressSteps.tsx` (font family added)
  - `packages/web/src/pages/Playground.tsx` (7 inline styles removed)
- Build verification: `npx vite build` passes with zero errors
- All components follow Fluent 2 audit checklist

---

# Decision: Backend Session ID Bridge Pattern

**Date**: 2026-04-10  
**Author**: Fry (Frontend Dev)  
**Status**: Implemented  

## Context

The LLM had no conversation memory because the frontend and backend used incompatible session ID systems:
- Frontend: `session-{timestamp}-{random}` (generated in `useSessions.ts`)
- Backend: `randomUUID()` (generated in `session-store.ts`)

When the frontend passed its session ID to the backend, it never matched any existing session in the backend's Map, causing a new session to be created for every message. The LLM only saw the system prompt + current message with no history.

## Decision

Introduce a `backendSessionId` field on the `Session` type to bridge the two ID systems:

1. Frontend sessions keep their UI-friendly IDs for localStorage and display
2. Each frontend session tracks its corresponding backend session ID via `backendSessionId?: string`
3. On first message, pass `undefined` to backend → backend creates new session and returns its UUID
4. Capture the backend UUID from the SSE `done` event and store it on the frontend session
5. On subsequent messages, pass the stored `backendSessionId` instead of the frontend ID

## Implementation

- Added `backendSessionId?: string` to `Session` type in `types.ts`
- Updated `StreamCallbacks.onComplete` signature to include `sessionId?: string` parameter
- Modified `useStreaming.ts` to capture `event.sessionId` from SSE responses and pass to `onComplete`
- Updated `useMockStreaming.ts` to match the new callback signature (passes `undefined`)
- Added `updateSession()` method to `useSessions.ts` for updating session metadata
- Modified `App.tsx` to read `backendSessionId` before calling `streaming.send()` and store it on first response

## Consequences

**Positive:**
- LLM now has full conversation history across multiple messages
- Clean separation between UI session IDs and backend session IDs
- No breaking changes to existing session storage format (backendSessionId is optional)

**Neutral:**
- Adds one extra field to session state
- Introduces slight coupling between frontend and backend session models

**Trade-offs:**
- Could have unified to a single ID system, but that would require migrating existing localStorage sessions or changing backend UUID generation
- This approach is minimally invasive and preserves both systems



# Decision: A2UI v0.9 Full Specification Analysis — New Insights

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Research Complete
**Requested by:** Ahmed Sabbour

---

## Context

Read and analyzed the complete A2UI v0.9 specification at https://a2ui.org/specification/v0.9-a2ui/. This supplements prior findings from catalog guides, component reference, agent development guide, and Leela's actions analysis.

## New Findings (beyond prior research)

### F6: Prompt-First Philosophy (Major Design Shift)

v0.9 is explicitly designed to be embedded directly in the LLM prompt — NOT for structured output mode. The spec states: "The LLM is then asked to produce JSON that matches the provided examples and schema descriptions." This requires robust post-generation validation but enables richer, more expressive schemas.

**Impact on Kickstart:** Validates our R3 recommendation (inject schema into system prompt). This is not just a good practice — it's the core design intent of v0.9. Our converse.ts endpoint MUST include the catalog schema in the system prompt.

### F7: Swappable Catalog via $ref Indirection

The envelope schema (`server_to_client.json`) uses `$ref: "catalog.json#/$defs/anyComponent"` — a placeholder filename. To use a custom catalog, you simply map `catalog.json` to your own file. The same envelope schema works with ANY compliant catalog without modification.

**Impact on Kickstart:** Our Kickstart catalog should be a standalone JSON Schema file that can be swapped in as `catalog.json`. Not a wrapper around Basic Catalog — a complete replacement per F1 (No Mappers Needed).

### F8: Client inlineCatalogs Capability

`a2uiClientCapabilities` supports `inlineCatalogs` — the client can send its full catalog definition inline to the server at runtime. This means the client pushes the catalog to the agent dynamically, no hardcoding needed on the server.

**Impact on Kickstart:** We could have the web client announce its Kickstart catalog to the backend, which then includes it in the LLM prompt. This enables catalog versioning without backend redeployment.

### F9: formatString Interpolation System

Rich `${/path}` syntax for inline data binding within strings, with function call nesting: `${formatDate(value:${/currentDate}, format:'yyyy-MM-dd')}`. Supports relative paths in collection scopes.

**Impact on Kickstart:** We're not using formatString at all. This enables dynamic text like "Welcome, ${/user/name}!" or "You have ${/items/length} items" without custom components.

### F10: Button Checks = Auto-Disable

Buttons can define `checks` with compound conditions (`and`, `or`, `not`) that auto-disable the button when conditions fail. Example: "Submit" disabled until terms accepted AND (email OR phone provided).

**Impact on Kickstart:** Form submission gates with zero custom code. LLM can generate self-validating forms natively.

### F11: Prompt-Generate-Validate Loop (Official Pattern)

The spec defines a three-step loop: (1) Prompt with schema + examples, (2) Generate JSON, (3) Validate against schema. On failure, send `VALIDATION_FAILED` error with `code`, `surfaceId`, `path`, and `message` back to LLM for self-correction.

**Impact on Kickstart:** This is exactly what R6 (agent-side validation) should implement. The error format is standardized — we should use it.

### F12: Transport Bindings — A2A, AG-UI, MCP

A2UI officially supports A2A (Agent-to-Agent), AG-UI, MCP, SSE/JSONRPC, WebSocket, and REST as transport layers. The spec provides concrete binding details for A2A (messages map to A2A Part payloads, metadata carries data model and capabilities).

**Impact on Kickstart:** Our current REST approach works fine. Future evolution path: A2A for multi-agent orchestration, or AG-UI for framework integration. Not blocking, but good to know.

### F13: Server Capabilities Advertisement

Servers advertise via `server_capabilities.json` which catalogs they can generate UI for and whether they accept inline catalogs from clients. This is exchanged via transport metadata (Agent Cards in A2A, capabilities in MCP).

**Impact on Kickstart:** When we build the agent endpoint, it should declare: "I support `kickstart` catalog" and "I accept inline catalogs". This enables proper capability negotiation.

### F14: Validator Compliance for Custom Catalogs

Custom catalogs MUST use `ComponentId` type from `common_types.json` for single child references and `ChildList` type for list references. Validators trace structural links by looking for these specific `$ref` types — raw strings are treated as static text.

**Impact on Kickstart:** When building `kickstart_catalog.json`, we must use proper `$ref` types, not raw `"type": "string"` for component ID fields. Otherwise validators won't check parent-child integrity.

### F15: Two-Way Binding is Local-Only

Input components (TextField, CheckBox, Slider, ChoicePicker, DateTimeInput) update the local data model IMMEDIATELY on user interaction. Server sync ONLY happens when an action is dispatched (button click). The data model is reactive — a TextField bound to `/user/name` and a Text also bound to `/user/name` update in real-time as the user types.

**Impact on Kickstart:** Our vendor DataContext class supports this, but we never wire it. Interactive forms should "just work" once we enable data binding — no custom state management needed.

---

## Updated Recommendation Table (cumulative)

| # | Action | Priority | Source |
|---|--------|----------|--------|
| R1 | Create `kickstart_catalog.json` as NATIVE catalog (standalone JSON Schema, not mapping Basic) | P0 | F1, F7, F14 |
| R2 | Change catalogId to URI format | P0 | Prior |
| R3 | Feed catalog schema + few-shot examples to LLM system prompt (prompt-first design) | P0 | F2, F6 |
| R4 | Implement updateDataModel for interactive components | P1 | F5, F15 |
| R5 | Define custom functions in catalog | P1 | Prior |
| R6 | Agent-side validation via jsonschema + VALIDATION_FAILED error format | P1 | F2, F11 |
| R7 | Catalog versioning strategy (consider F8 inlineCatalogs) | P2 | F8 |
| R8 | Graceful degradation + error reporting | P2 | Prior |
| R9 | Wire action handler (replace console.log dead-end) | P0 | Leela G1 |
| R10 | Add backend action endpoint | P0 | Leela G2 |
| R11 | Fix response-processor button schema to proper A2UI ActionSchema | P0 | Leela G3 |
| R12 | Build tool system for LLM (registerTool, executeTool, tool-call loop) | P1 | Leela G4 |
| R13 | Build ServiceConnector + auth (MSAL for Azure, GitHub OAuth) | P1 | Leela G5 |
| R14 | Build pack system (KickstartPack interface) | P1 | Leela G6 |
| R15 | Implement formatString support in renderer | P2 | F9 |
| R16 | Implement button checks / auto-disable | P2 | F10 |
| R17 | Server capabilities advertisement | P2 | F13 |


### 2026-04-09T07:15:00Z: A2UI Catalog Best Practices — Gap Analysis & Recommendations
**By:** Ahmed Sabbour (via Copilot Coordinator)
**Source:** https://a2ui.org/concepts/catalogs/ (reviewed 2026-04-09)

**What:** Our Kickstart catalog implementation has significant gaps compared to A2UI's official catalog best practices. We need a proper catalog JSON Schema, URI-based catalogId, catalog negotiation, validation, data binding, and versioning.

**Gap Analysis:**

| A2UI Best Practice | Our Status | Priority |
|---|---|---|
| Catalog JSON Schema file defining components, props, types, required fields | ❌ Missing — only have runtime TS `Catalog` object | P0 |
| URI-based catalogId (globally unique, stable identifier) | ❌ Using bare string `'kickstart'` | P0 |
| Catalog negotiation (`supportedCatalogIds` in message metadata) | ❌ Not implemented | P1 |
| Agent-side validation (validate LLM output before sending to client) | ❌ None | P1 |
| Client-side schema validation | 🟡 Partial (A2UI web_core basic processing only) | P2 |
| Data binding (`updateDataModel` messages + JSON Pointer bindings) | ❌ Not used anywhere | P1 |
| Custom functions definition in catalog | ❌ None defined | P1 |
| Versioning strategy in catalogId | ❌ None | P2 |
| Graceful degradation (fallback for unknown components) | 🟡 Partial — silently fails | P2 |
| Error reporting (`VALIDATION_FAILED` events back to agent) | ❌ None | P3 |
| Freestanding/self-contained catalog JSON | ❌ N/A (no JSON to make freestanding) | Depends on P0 |
| Composition via `$ref` / `allOf` extending basic catalog | ❌ Not applicable yet | Depends on P0 |

**Recommendations:**

**R1 (P0): Create `kickstart_catalog.json`**
- Define a proper JSON Schema catalog file reflecting our Fluent UI v9 design system
- Include all component definitions: basic catalog components + our custom components (CodeBlock, Markdown, ProgressSteps, FormGroup, RadioGroup) + all 18 Fluent overrides
- Each component schema must define: type, description, properties (with types + descriptions), required fields
- Follow A2UI's recommendation: "build catalogs that directly reflect a client's design system rather than trying to map the Basic Catalog to it through an adapter"
- Use `--extend-basic-catalog` pattern: import all basic catalog components, then add/override with our Fluent implementations
- Location: `packages/web/src/catalog/kickstart_catalog.json` (or a `catalogs/` directory)

**R2 (P0): Use URI-based catalogId**
- Change from `'kickstart'` to `'https://imagine.aks.azure.com/catalogs/kickstart/v1/catalog.json'`
- This URI does NOT need to be fetchable at runtime — it's just a stable identifier
- Update in: `kickstart-catalog.ts`, `playground-scenarios.ts`, `demo-scenarios.ts`, `Playground.tsx`

**R3 (P1): Feed catalog schema to the LLM**
- The catalog JSON Schema is what tells the LLM what components/props are available
- Include it in the system prompt (or as a tool/context) so the LLM generates valid A2UI JSON
- This is the single biggest improvement for LLM output quality — currently it's guessing

**R4 (P1): Implement `updateDataModel` usage**
- Start sending `updateDataModel` messages alongside `updateComponents`
- Use JSON Pointer data bindings (`{ "$data": "/path" }`) in component props instead of hardcoded values
- Enable `sendDataModel: true` on surfaces that need to read user input back
- Critical for: forms, pickers, multi-step flows, smart controls

**R5 (P1): Define custom functions in catalog**
- Functions are the A2UI way to define client-side callable actions
- Define functions for: form submission, navigation, state updates, pack connector calls
- These replace our ad-hoc `action.functionCall` usage

**R6 (P1): Agent-side validation**
- Before sending A2UI JSON to client, validate it against our catalog schema
- On validation failure: attempt to fix/regenerate, or fall back to text
- This catches LLM hallucinated properties and malformed structures

**R7 (P2): Catalog versioning strategy**
- Embed version in URI: `.../kickstart/v1/catalog.json`
- Breaking changes (new containers, removed containers, type changes) → bump major
- Non-breaking changes (new leaf components, optional props) → stay at current version
- Plan for v1 → v2 migration using dual-catalog negotiation

**R8 (P2): Graceful degradation**
- Implement fallback placeholder for unknown components (generic card with component name)
- Text fallback when entire surface fails to render
- Error reporting via `VALIDATION_FAILED` events

**Why:** The catalog JSON is the foundational contract between the LLM and our renderer. Without it, we have no formal component contract, no validation, no negotiation, and the LLM generates A2UI by guessing. This is the single most impactful architectural improvement for Kickstart's A2UI integration quality.

**Decision:** Proceed with R1-R2 (P0) first, then R3-R6 (P1), then R7-R8 (P2). The catalog JSON unblocks everything else.


### 2026-04-09T07:20:00Z: A2UI "Defining Your Own Catalog" guide + Agent Development findings
**By:** Ahmed Sabbour (via Copilot research)
**Status:** Accepted — augments prior catalog best practices decision
**References:** https://a2ui.org/guides/defining-your-own-catalog/, https://a2ui.org/reference/components/, https://a2ui.org/guides/agent-development/

#### New Findings (beyond prior gap analysis)

**F1: "No Mappers Needed" principle**
The official guide explicitly states: "It is recommended to build catalogs that directly reflect your client's design system rather than trying to map a generic catalog (like the Basic Catalog) to it through an adapter." We are currently doing the opposite — overriding Basic Catalog components with Fluent UI wrappers. Recommendation: define a Kickstart-native catalog JSON Schema where components ARE our Fluent-based implementations, not mapped from generic ones.

**F2: Agent Development — Concrete LLM Integration Pattern**
The agent development guide shows exactly how to feed A2UI to an LLM:
- Inject the full A2UI JSON Schema into the system prompt as `A2UI_SCHEMA`
- Add few-shot UI template examples (`RESTAURANT_UI_EXAMPLES` pattern) for in-context learning
- Use a `---a2ui_JSON---` delimiter — LLM outputs conversational text first, then raw JSON list of A2UI messages
- Parse and validate the JSON against the schema using `jsonschema.validate()` before sending to client
- This directly maps to our R3 (feed schema to LLM) and R6 (agent-side validation)

**F3: v0.9 Component Syntax Confirmed**
Full v0.9 component reference confirms flat syntax we should use:
- `"component": "Text"` (not nested `"component": { "Text": { } }`)
- Direct string values (not `{ "literalString": "..." }`)
- `variant` instead of `usageHint`
- `justify`/`align` instead of `distribution`/`alignment`
- `ChoicePicker` instead of `MultipleChoice`
- Actions use `{ "event": { "name": "..." } }` format

**F4: Security Requirements**
- Allowlist components: only register trusted components
- Validate properties: ensure agent messages match expected type constraints
- Sanitize text: avoid rendering un-sanitized content from agent

**F5: Data Binding Pervasive in Interactive Components**
Every interactive component (TextField, CheckBox, Slider, ChoicePicker, DateTimeInput) uses `{ "path": "/data/field" }` for data binding. This reinforces R4 (implement updateDataModel) — without it, none of these components can read/write state.

#### Updated Recommendation Priority

| # | Action | Priority | New insight |
|---|--------|----------|-------------|
| R1 | Create `kickstart_catalog.json` as native catalog (NOT mapping Basic Catalog) | P0 | F1 changes approach — direct catalog, not override |
| R3 | Feed schema + few-shot examples to LLM using delimiter pattern | P0 (bumped) | F2 provides concrete implementation pattern |
| R6 | Agent-side validation via jsonschema before sending to client | P1 | F2 confirms this is standard practice |
| R4 | Implement updateDataModel for all interactive components | P1 | F5 — every input component requires it |

R2, R5, R7, R8 unchanged from prior decision.


# Decision: A2UI Actions System Analysis — Gap Analysis & Implementation Path

**Author:** Leela (Lead)
**Date:** 2025-07-26
**Status:** Analysis Complete
**Requested by:** Ahmed Sabbour

---

## 1. A2UI Action Model Summary

A2UI v0.9 provides a two-tier action system designed for security-first, sandboxed UI interaction:

### 1.1 Events (Agent-Side)

Events dispatch user interactions to the backend agent for processing. They carry:

| Field | Description |
|-------|-------------|
| `name` | Stable identifier the agent switches on (e.g., `submit_reservation`) |
| `surfaceId` | Which surface originated the event |
| `sourceComponentId` | Which component triggered it |
| `timestamp` | ISO 8601 timestamp |
| `context` | Key-value map with resolved data model paths |

Events are the primary mechanism for user→agent communication. The renderer resolves all `path` references against the local data model before dispatch, so the agent receives fully resolved values.

### 1.2 Functions (Local/Renderer)

Functions execute locally without a network round-trip. The agent is NOT informed. Limited to:

- `openUrl` — opens a URL in new window
- Validation checks (`required`, `regex`, `length`, `numeric`, `email`)
- Arithmetic, comparison, logic, string operations, formatting

Functions act as a sandboxed execution layer — no arbitrary code injection possible.

### 1.3 Data Model & State

- **Write Contract:** Input components write to the local data model synchronously. No race conditions between typing and clicking.
- **Data Model Sync:** When `sendDataModel: true`, the renderer attaches the FULL data model to every outgoing message. Agent becomes stateless — receives complete UI state with each interaction.
- **Checks:** Client-side validation rules that auto-disable buttons when conditions fail. UX-only; data integrity validated agent-side.

### 1.4 Transport & Security

- Transport-agnostic (A2A, WebSockets)
- Sandboxed execution — agents can only trigger pre-registered behaviors
- Surface ownership pattern for multi-agent orchestration
- Data model isolation enforced by orchestrator (data from surface A never leaks to agent B)
- Error reporting: `VALIDATION_FAILED` errors flow from renderer→agent for self-correction

### 1.5 What A2UI Does NOT Provide

- No tool/function-calling system for LLM inference
- No service pack bundling (components + prompts + tools + auth)
- No external API bridging
- No artifact storage
- No auth token management
- No dynamic system prompt injection
- No multi-step workflow orchestration beyond event→response cycles

---

## 2. Gap Table: A2UI Native vs adaptive-ui-framework vs Kickstart

| Capability | A2UI v0.9 Native | adaptive-ui-framework | Kickstart Current |
|---|---|---|---|
| **Event→Agent dispatch** | ✅ Full (`action.event` → `client_to_server.json`) | ✅ `handleAction()` in AdaptiveProvider | ⚠️ Vendor code works, but handler only `console.log`s — dead end |
| **Local functions** | ✅ `openUrl`, validation, math/string ops | ✅ Same + custom via interpolation | ✅ Vendor basic functions available |
| **Action types** | 2 (event, functionCall) | 5 (sendPrompt, setState, navigate, submit, custom) | 0 implemented (buttons use non-standard `action: "reply"`) |
| **State binding** | ✅ JSON Pointers, DataModel, Signals | ✅ `{{state.key}}` interpolation, `bind` prop | ⚠️ DataModel class exists in vendor, not wired to app state |
| **Data Model Sync** | ✅ `sendDataModel: true` sends full state | N/A (uses state store directly) | ❌ Not configured |
| **Form submission** | ✅ Local write → event with resolved context | ✅ `submit` action serializes state to prompt | ❌ No form→backend pipeline |
| **Client validation** | ✅ Checks with auto-disable | ✅ Validation rules on inputs | ⚠️ Vendor code supports it, no components use it |
| **Action→Backend endpoint** | Spec only (transport-agnostic) | ✅ `sendPrompt()` → LLM adapter | ❌ No action endpoint. Only `/api/converse` for chat |
| **Tool system (LLM calls)** | ❌ Not in scope | ✅ `registerTool()`, tool-call loop, `fetch_webpage`, `azure_arm_get`, `github_api_get` | ❌ None |
| **Service packs** | ❌ Not in scope | ✅ `ComponentPack` (components + systemPrompt + tools + skills + settings) | ❌ None |
| **Auth/ServiceConnector** | ❌ Not in scope | ✅ `entra-auth.ts` (MSAL), GitHub OAuth, per-pack settings | ❌ None |
| **Knowledge skills** | ❌ Not in scope | ✅ `resolveSkills()` — dynamic prompt injection per pack | ❌ None |
| **Artifact store** | ❌ Not in scope | ✅ `artifacts.ts` — typed extraction, session-scoped | ❌ None |
| **Custom action dispatch** | ❌ (events are the mechanism) | ✅ `onCustomAction` callback for host app | ❌ None |
| **Disabled context (past turns)** | ❌ Not in scope | ✅ `DisabledScope` — components skip side effects | ❌ None |
| **Auto-continue** | ❌ Not in scope | ✅ LLM adapter re-invokes on phase transitions | ❌ None |
| **Error self-correction** | ✅ `VALIDATION_FAILED` → agent retry | ❌ Not implemented | ❌ Not implemented |
| **Orchestration routing** | ✅ Surface ownership pattern | N/A (single-agent) | ❌ Not needed yet |

---

## 3. Critical Gaps in Kickstart

### G1: Action Dead-End (CRITICAL)

`useA2UI.ts` line 23-25:
```ts
(action) => {
  console.log('[A2UI] action:', action);
}
```

A2UI events fire from components, bubble through `ComponentContext → SurfaceModel → SurfaceGroupModel → MessageProcessor`, and then... nothing. The action handler is a console.log. No backend communication, no state updates, no prompt generation.

**Impact:** Every interactive component (buttons, forms, pickers) in our catalog is decorative. User clicks produce no effect.

### G2: No Action Endpoint

`converse.ts` accepts `{ sessionId, message }` — a chat message. There is no endpoint for structured A2UI action events. No way to send `{ action: { name, surfaceId, context } }` back to the backend.

### G3: Hybrid Action Model Mismatch

`response-processor.ts` generates buttons with `action: "reply", data: { text: "..." }` — this is NOT the A2UI ActionSchema. It's a custom format that doesn't go through `dispatchAction()`. It's a separate code path that bypasses the entire A2UI action infrastructure.

### G4: No Tool System

The LLM has no tools. It can't query Azure ARM, check GitHub repos, validate K8s manifests, or fetch documentation. adaptive-ui-framework's power comes from tools being available during LLM inference — the LLM decides whether to call `azure_arm_get` or `github_api_get` before generating its UI response.

### G5: No Service Layer

No `ServiceConnector` for managing auth tokens. No CORS proxy. No way for components to make authenticated API calls to Azure or GitHub.

### G6: No Pack System

Components, prompts, tools, and auth are not bundled. When we add an Azure pack, there's no mechanism to register its tools, inject its system prompt, or wire its auth.

---

## 4. Recommended Implementation Path

### Phase 1: Wire the Action Loop (2-3 days)

**Goal:** Make A2UI events produce actual effects.

1. **Implement action handler in `useA2UI.ts`** that maps A2UI event names to behaviors:
   - `sendPrompt` events → call `converse()` with the event context as a structured message
   - `setState` events → update the data model locally
   - `navigate` events → `window.location.href`
   - All other events → serialize to a prompt: `"User triggered action: {name} with context: {JSON.stringify(context)}"`

2. **Add action endpoint to backend** — extend `converse.ts` or create new `/api/action` endpoint that accepts `A2uiClientAction` payloads. Convert them to LLM messages like adaptive-ui does:
   ```ts
   const query = `User action "${action.name}" with context: ${JSON.stringify(action.context)}`;
   ```

3. **Fix response-processor.ts** — stop generating non-standard `action: "reply"` buttons. Use proper A2UI ActionSchema: `{ event: { name: "select-runtime", context: { value: "Node.js" } } }`.

4. **Enable DataModel Sync** — set `sendDataModel: true` on surface creation. Include data model in action payloads.

**Maps to ServicePack:** This is the foundation. Without a working action loop, no ServicePack can function.

### Phase 2: Tool System (3-4 days)

**Goal:** LLM can call external APIs during inference.

1. **Port `tools.ts` pattern from adaptive-ui-framework** — `registerTool()`, `executeTool()`, tool-call loop.
2. **Implement tool-call loop in `converse.ts`** — when LLM returns `tool_calls`, execute them server-side, send results back, continue until LLM produces final response.
3. **Register initial tools:** `fetch_webpage` (documentation), `azure_arm_get` (ARM queries), `github_api_get` (repo info).

**Maps to ServicePack:** Tools are a ServicePack export. Each pack registers its tools via `pack.tools`.

### Phase 3: ServiceConnector + Auth (3-4 days)

**Goal:** Components can make authenticated API calls.

1. **Build ServiceConnector abstraction** — React Context providing `getToken(scope)` per service (Azure, GitHub).
2. **Wire MSAL for Azure** — `entra-auth.ts` already exists in adaptive-ui-framework, port it.
3. **Wire GitHub OAuth** — device flow + PAT fallback.
4. **CORS proxy** — SWA API function that proxies authenticated requests to Azure ARM / GitHub API.

**Maps to ServicePack:** ServiceConnector is the R02 gap from our prior pack architecture decision. It's the foundation stone — once connectors exist, fat components can register and orchestrator can wire tools.

### Phase 4: Pack System (2-3 days)

**Goal:** Bundled component packs with prompts, tools, auth, and skills.

1. **Define `KickstartPack` interface** — mirrors adaptive-ui-framework's `ComponentPack` but with A2UI component registration:
   ```ts
   interface KickstartPack {
     name: string;
     components: ReactComponentImplementation[];
     systemPrompt: string;
     tools?: ToolDefinition[];
     resolveSkills?: (prompt: string) => Promise<string | null>;
     serviceConnector?: ServiceConnectorConfig;
   }
   ```

2. **Register packs at app startup** — auto-inject system prompts, register tools, wire auth.
3. **Build initial packs:** `azure-pack`, `github-pack`, `iac-pack`.

**Maps to ServicePack:** This IS the ServicePack architecture from decision `leela-pack-architecture.md`. Phase 4 makes it real.

### Phase 5: Rich Interactions (2-3 days)

**Goal:** Approach adaptive-ui-framework's interaction depth.

1. **Custom action handler** — `onCustomAction` for pack-specific actions (deploy, validate, create-repo).
2. **Artifact extraction** — walk A2UI component tree after each response, extract structured data.
3. **Auto-continue** — when phase engine detects transition, auto-invoke next LLM turn.
4. **Disabled context** — past-turn components become read-only, skip API calls.

---

## 5. Architecture Mapping: A2UI Actions → ServicePack

| A2UI Concept | ServicePack Mapping | Implementation |
|---|---|---|
| `action.event` | Pack event handler | Action handler in `useA2UI.ts` routes by event name to pack-specific logic |
| `action.functionCall` | Local functions from pack catalog | Registered via pack's component catalog |
| `DataModel` + JSON Pointers | Pack state namespace | Each pack gets a `/packName/*` prefix in the data model |
| `sendDataModel` | State sync for tools | Tool calls receive current data model for context |
| `checks` | Pack validation rules | Client-side validation per pack's component schemas |
| `surfaceId` | Pack surface ownership | Each pack creates surfaces with `{packName}-{surfaceType}` IDs |
| Error reporting | Self-correction loop | Validation errors → re-prompt LLM with error context |

### Key Insight: A2UI Events ARE the ServicePack Action Bus

A2UI's event system (`action.event.name` + `action.event.context`) is exactly the primitive we need. The gap is that we're not USING it. The event name becomes the action type, the context becomes the payload, and the action handler becomes the router to pack-specific logic:

```
Component fires event → A2UI dispatchAction → MessageProcessor actionHandler
  → Router: "deploy" → azure-pack handler → calls ARM API
  → Router: "select-runtime" → sends structured prompt to LLM
  → Router: "approve-arch" → updates state + triggers next phase
```

This is architecturally identical to adaptive-ui-framework's `handleAction` switch, but using A2UI's native event plumbing instead of a custom action object.

---

## 6. Estimated Timeline

| Phase | Effort | Depends On | ServicePack Alignment |
|-------|--------|------------|----------------------|
| Phase 1: Wire Action Loop | 2-3 days | Nothing | Foundation |
| Phase 2: Tool System | 3-4 days | Phase 1 | Pack tool registration |
| Phase 3: ServiceConnector | 3-4 days | Phase 1 | R02 gap closure |
| Phase 4: Pack System | 2-3 days | Phases 2+3 | Full ServicePack |
| Phase 5: Rich Interactions | 2-3 days | Phase 4 | Pack capabilities |
| **Total** | **~12-17 days** | | |

Phase 1 is the critical path. Everything else builds on a working action loop.

---

## 7. Summary

A2UI provides the right primitives for rich interaction — events, data binding, validation, sandboxed functions. What it doesn't provide (tools, packs, auth, artifacts) is exactly what adaptive-ui-framework adds on top. Our Kickstart implementation has the A2UI vendor code properly wired for action dispatch, but the app layer treats it as a dead end (console.log). The fix is straightforward: wire the action handler to a router, add a backend action endpoint, and build up from there to tools, auth, and packs. The ServicePack architecture we already decided on maps cleanly to A2UI events as the action bus.



# Decision: A2UI Implementation Patterns — Concrete Code References

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Reference Material
**Requested by:** Ahmed Sabbour
**Sources:**
- https://a2ui.org/guides/defining-your-own-catalog
- https://a2ui.org/guides/agent-development/#generating-a2ui-messages

---

## 1. Custom Catalog Implementation Steps (from Defining Your Own Catalog guide)

The official guide prescribes 5 steps for custom catalogs:

1. **Define the Catalog**: Create a JSON Schema listing components, functions, and styles
2. **Register the Catalog**: Register catalog + component implementations (renderers) with client
3. **Announce Support**: Client informs agent via `supportedCatalogIds` in capabilities metadata
4. **Agent Selects Catalog**: Agent chooses catalog via `catalogId` in `createSurface`
5. **Agent Generates UI**: Agent generates messages using catalog component names

### Key Principle: "No Mappers Needed"
> "It is recommended to build catalogs that directly reflect your client's design system rather than trying to map a generic catalog (like the Basic Catalog) to it through an adapter."

**What this means for Kickstart:** Our current approach of composing `basicCatalog + fluentOverrides + customComponents` in `kickstart-catalog.ts` is explicitly against the recommended pattern. We should create a standalone `kickstart_catalog.json` that directly defines our Fluent UI React v9 components — NOT override/map the Basic Catalog.

### Security Requirements
1. **Allowlist components** — Only register trusted components in catalog definition
2. **Validate properties** — Always validate component properties from agent messages match expected types
3. **Sanitize text** — Avoid rendering un-sanitized agent content unless safe bounds established

---

## 2. Agent Development — Generating A2UI Messages (Concrete Pattern)

The agent development guide provides the exact implementation pattern for LLM → A2UI generation.

### Step 1: Import the Schema
```python
from .a2ui_schema import A2UI_SCHEMA  # The full JSON Schema for A2UI messages
```

### Step 2: Construct System Prompt with Schema + Examples
```python
RESTAURANT_UI_EXAMPLES = """
# (few-shot examples of valid A2UI JSON for in-context learning)
"""

A2UI_AND_AGENT_INSTRUCTION = AGENT_INSTRUCTION + f"""
Your final output MUST be a a2ui UI JSON response.

To generate the response, you MUST follow these rules:
1. Your response MUST be in two parts, separated by the delimiter: `---a2ui_JSON---`.
2. The first part is your conversational text response.
3. The second part is a single, raw JSON object which is a list of A2UI messages.
4. The JSON part MUST validate against the A2UI JSON SCHEMA provided below.

--- UI TEMPLATE RULES ---
Follow these rules to select the appropriate UI template:
{RESTAURANT_UI_EXAMPLES}

---BEGIN A2UI JSON SCHEMA---
{A2UI_SCHEMA}
---END A2UI JSON SCHEMA---
"""
```

### Step 3: Parse and Validate Output
```python
# 1. Parse the JSON (split on ---a2ui_JSON--- delimiter)
parsed_json_data = json.loads(json_string_cleaned)

# 2. Validate against A2UI_SCHEMA
jsonschema.validate(instance=parsed_json_data, schema=self.a2ui_schema_object)
```

### What Kickstart Needs to Implement

**In `converse.ts` (backend):**
1. Load our `kickstart_catalog.json` schema
2. Inject it into the LLM system prompt using the `---BEGIN A2UI JSON SCHEMA---` / `---END A2UI JSON SCHEMA---` delimiters
3. Add few-shot examples of valid Kickstart A2UI JSON between `--- UI TEMPLATE RULES ---` markers
4. Use `---a2ui_JSON---` as the delimiter between conversational text and A2UI JSON

**In `response-processor.ts` (backend):**
1. Split LLM response on `---a2ui_JSON---` delimiter
2. Parse the JSON portion
3. Validate against our catalog schema (use `ajv` or similar for JSON Schema validation in TypeScript)
4. On validation failure, send `VALIDATION_FAILED` error back to LLM for self-correction
5. On success, stream the A2UI messages to the client

**This replaces our current approach** where response-processor.ts manually constructs A2UI components from LLM markdown. Instead, the LLM generates the A2UI JSON directly — we just validate and pass through.

---

## 3. Impact on Current Architecture

### Current Flow (Broken)
```
User → converse.ts → LLM (no schema awareness) → markdown text
  → response-processor.ts manually constructs A2UI components
  → Client renders
```

### Target Flow (Per A2UI Spec)
```
User → converse.ts → LLM (with catalog schema + examples in prompt)
  → text + ---a2ui_JSON--- + A2UI JSON list
  → response-processor.ts validates JSON, passes through
  → Client renders native catalog components
```

The key shift: **LLM generates A2UI JSON directly** instead of us post-processing markdown into components. This is more reliable, supports the full component catalog, and enables the prompt-generate-validate loop the spec prescribes.

# Decision: A2UI Official Sample Implementation Analysis

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Research Finding
**Requested by:** Ahmed Sabbour
**Sources:**
- https://github.com/google/A2UI/tree/main/samples/agent/adk/restaurant_finder
- https://github.com/google/A2UI/tree/main/samples/agent/adk/contact_lookup
- https://github.com/google/A2UI/tree/main/samples/agent/adk/rizzcharts

---

## Summary

Analyzed all three official A2UI ADK sample implementations. Found two distinct agent architectures and seven new findings (F16-F22) with direct impact on Kickstart's implementation approach.

## Two A2UI Agent Architectures

### Pattern 1: Prompt-Inject + Validate (restaurant_finder, contact_lookup)
- Schema + few-shot examples injected into LLM system prompt via `A2uiSchemaManager.generate_system_prompt()`
- LLM generates A2UI JSON inline in text output, wrapped in `A2UI_OPEN_TAG`/`A2UI_CLOSE_TAG` tags
- Backend parses response, validates with `jsonschema`, retries on failure (max_retries=1)
- Uses `BasicCatalog.get_config()` — no custom catalog
- Both v0.8 and v0.9 supported with separate runners per version

### Pattern 2: Tool-Based (rizzcharts) ⭐ RECOMMENDED FOR KICKSTART
- LLM calls `send_a2ui_json_to_client` TOOL with A2UI JSON as argument
- Schema/examples loaded into session state (not prompt) by executor at setup time
- Toolset reads schema from session state, validates JSON, returns error as tool response
- Uses `CatalogConfig.from_path()` for CUSTOM catalog + BasicCatalog as fallback
- `BuiltInPlanner` with `ThinkingConfig` enables reasoning before UI generation
- `include_schema=False, include_examples=False` in system prompt — toolset handles it

## New Findings

### F16: Two A2UI Agent Architectures
**What:** Google's official samples demonstrate two distinct patterns for A2UI generation: (1) prompt-inject where the LLM outputs A2UI in text, and (2) tool-based where the LLM calls a function with A2UI JSON.
**Impact:** The tool-based pattern (rizzcharts) is more reliable for OpenAI models because:
- Structured output via function calling (no text parsing needed)
- Validation happens in tool — error goes back as natural tool response
- LLM reasoning is separate from A2UI output
- More compatible with OpenAI's function calling / Responses API
**Recommendation:** Adopt tool-based pattern for Kickstart. Define a `render_ui` function/tool that accepts A2UI JSON, validates it, and streams to client.

### F17: Actions = Re-Prompt LLM (All Three Samples)
**What:** ALL three samples handle user button clicks by translating the action into natural language and re-prompting the LLM. Example from restaurant_finder agent_executor.py:
- `"book_restaurant"` action → `"USER_WANTS_TO_BOOK: {restaurant_name}, Address: {address}, ImageURL: {image_url}"`
- `"submit_booking"` action → `"User submitted a booking for {restaurant_name} for {party_size} people at {reservation_time}..."`
**Impact:** This is fundamentally different from our adaptive-ui-framework approach (direct action dispatch to handlers). In A2UI, the LLM stays in full control of ALL state transitions. No separate action handlers needed.
**Recommendation:** For Kickstart, convert button click events to conversation messages. The LLM decides what happens next based on the action context. This aligns perfectly with our conversation-driven architecture.

### F18: Custom Catalog is Self-Contained (rizzcharts)
**What:** Rizzcharts' custom catalog (~35KB JSON Schema) includes ALL basic catalog components (Text, Image, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, etc.) PLUS custom components (Chart, GoogleMap, Canvas). It is NOT a delta/extension — it's a full standalone catalog.
**Impact:** Confirms R1 (create kickstart_catalog.json as native catalog). Our catalog must define ALL components we want the LLM to use, not just custom ones.
**Components in rizzcharts catalog:** Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Modal, Divider, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, Canvas, Chart, GoogleMap
**Recommendation:** Our kickstart_catalog.json should include: all Fluent UI components we support + custom Kickstart components (AzureResourcePicker, GitHubRepoPicker, DeploymentStatus, CostEstimate, etc.)

### F19: Canvas Component = Side Panel Pattern
**What:** The rizzcharts catalog defines a `Canvas` component described as: "Renders the UI element in a stateful panel next to the chat window." Used as root component for surfaces that should appear alongside (not inline with) the conversation.
**Impact:** This is exactly what we need for file editor, architecture diagrams, cost estimates — content that persists alongside the chat. The Canvas pattern provides a spec-compliant way to implement our split-pane playground layout.
**Recommendation:** Include a `Canvas` (or `Panel`) component in kickstart_catalog.json for side-panel rendering. Map to our existing split-pane layout.

### F20: Multi-Catalog Support
**What:** Rizzcharts registers BOTH its custom catalog AND the basic catalog simultaneously:
```python
catalogs=[
    CatalogConfig.from_path(name="rizzcharts", ...),
    BasicCatalog.get_config(version=version, ...),
]
```
Agent selects catalog based on client `supportedCatalogIds` capability.
**Impact:** We can support multiple catalogs — a rich Kickstart catalog for our app, plus basic catalog as fallback for simpler clients.
**Recommendation:** Register kickstart_catalog + basic_catalog. Use kickstart_catalog by default, fall back to basic_catalog for external/third-party clients.

### F21: SendA2uiToClientToolset Pattern (rizzcharts)
**What:** Instead of parsing A2UI from text output, rizzcharts uses `SendA2uiToClientToolset` — the LLM calls `send_a2ui_json_to_client` as a tool/function:
```python
tools=[
    get_store_sales,
    get_sales_data,
    SendA2uiToClientToolset(
        a2ui_catalog=self._a2ui_catalog_provider,
        a2ui_enabled=self._a2ui_enabled_provider,
        a2ui_examples=self._a2ui_examples_provider,
    ),
]
```
The toolset:
- Reads catalog schema from session state (via providers)
- Validates the A2UI JSON the LLM passes as argument
- Returns validation errors as tool response (natural retry)
- Streams validated A2UI to client
**Impact:** This is the cleanest integration pattern. For Kickstart with OpenAI, we define `render_ui` as a function in the Responses API. The LLM calls it with A2UI JSON. Our backend validates and streams.
**Recommendation:** Implement a `render_ui` tool/function for our converse.ts endpoint. LLM calls it to send UI. We validate and stream. This replaces our current response-processor.ts manual construction.

### F22: Session State for A2UI Context
**What:** Rizzcharts' executor injects A2UI metadata into session state at runtime:
```python
state_delta={
    _A2UI_ENABLED_KEY: True,
    _A2UI_CATALOG_KEY: a2ui_catalog,
    _A2UI_EXAMPLES_KEY: examples,
}
```
The toolset reads from session state when the LLM calls it — catalog and examples are available dynamically, not baked into the system prompt.
**Impact:** Decouples A2UI setup from prompt construction. The system prompt stays lean (role + workflow + UI description). Schema/examples are injected at runtime based on client capabilities negotiation.
**Recommendation:** For Kickstart, store catalog schema and examples in conversation context (or session state). The render_ui tool reads them when called. System prompt only needs role description, workflow rules, and UI template rules.

## Architecture Comparison: Current vs Target

### Current Flow (Broken)
```
User → converse.ts → LLM (no schema, no tools) → markdown text
  → response-processor.ts manually constructs A2UI components
  → Client renders (actions → console.log dead-end)
```

### Target Flow (Per Rizzcharts Pattern)
```
User → converse.ts → LLM (with render_ui tool + data tools)
  → LLM calls render_ui(a2ui_json) ← validated by tool
  → Stream A2UI messages to client
  → Client renders → user clicks → action → translate to NL → re-prompt LLM
```

### Key Architectural Shifts
1. **LLM generates A2UI directly** via tool call (not post-processing markdown)
2. **Actions re-prompt LLM** (not direct dispatch to handlers)
3. **Catalog schema as tool context** (not in system prompt)
4. **Validation in tool** (not in response processor)
5. **Multiple tools** — data tools (Azure, GitHub APIs) + render_ui tool (A2UI output)

## Updated Cumulative Recommendations

| ID | Priority | Recommendation | Updated By |
|----|----------|---------------|------------|
| R18 | P0 | Implement `render_ui` tool/function for LLM to output A2UI JSON (tool-based pattern from rizzcharts) | F16, F21 |
| R19 | P0 | Convert action events to conversation messages and re-prompt LLM (action re-prompting pattern from all 3 samples) | F17 |
| R20 | P1 | Include Canvas/Panel component in kickstart_catalog for side-panel rendering | F19 |
| R21 | P1 | Register multi-catalog (kickstart + basic) with capability-based selection | F20 |
| R22 | P2 | Store catalog schema/examples in session state, not system prompt | F22 |

Note: R18 supersedes R3 (feed catalog to system prompt) and R10 (add backend action endpoint). The tool-based pattern is cleaner than both.
Note: R19 supersedes R9 (wire action handler) and R11 (fix button schema). Actions become conversation messages, not dispatched events.
