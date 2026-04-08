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
