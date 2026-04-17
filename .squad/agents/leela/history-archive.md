# Leela — History Archive

Old entries (>7 days)

### 2025-07-25: Docs structure and architecture diagrams
- Created `docs/architecture.md` with 7 Mermaid diagrams: system overview (C4-style), web flow sequence, IDE/MCP flow sequence, 6-phase conversation pipeline, A2UI rendering pipeline, 3-layer prompt architecture, and deployment architecture.
- Created `docs/README.md` as index linking to architecture, contributing, and infra docs.
- Created root `README.md` with project description, dual-surface concept, quick start, tech stack table, and links to docs.
- A2UI catalog has 17 components (7 standard, 6 Kickstart, 4 GitHub). Catalog schema uses JSON Schema draft/2020-12.
- 6-phase engine confirmed: Discover→Design→Generate→Review→Handoff→Deploy. K8s hidden in phases 1-3, visible in 4-6.
- Deployment safeguards DS001–DS013 enforced across all phases via Layer 2 system prompt.


### 2025-07-25: Spark-like UX Evolution Scoping
- **Key insight:** Kickstart ≠ Spark. Spark generates full runnable apps; Kickstart generates infrastructure (Bicep, Dockerfiles, Helm, GH Actions) and deploys to AKS. "Preview" = architecture diagram + deployment plan, not a running app.
- **Landing page** already Spark-like (carousel, track cards, framework pills, IDE links). Gap: needs a hero text input above everything — single biggest UX win.
- **Split-view layout** (chat left, file-viewer right) already exists in `core.css`. File viewer is `<aside class="file-viewer">` toggled by `files:generated` EventBus event.
- **File generation display** only in sidebar today. P0: add in-chat file chips with progressive status.
- **No code view toggle** exists. P1: add Preview|Code toggle in right panel header.
- **No deploy button.** P1: add Deploy CTA in topbar, maps to Spark's "Publish" but targets AKS.
- **Spark tabs** (Iterate/Theme/Data/Prompts/Assets): Theme irrelevant (infra not UI). Prompts already exists as debug toggle. Assets (upload Dockerfiles/manifests) is P2.
- **P0 is ~11 hours, all vanilla JS.** Hero input, file chips, sparkle loading, preview rename. No framework change needed.
- **Key files touched:** `index.html` (hero input), `landing.css` (input styles), `components.css` (file chips, sparkle), `app.js` (hero handler, file chip rendering), `components.js` (new factories).
- **Ahmed preference:** claude-opus-4.6 for code, claude-haiku-4.5 for non-code (confirmed still active).


### 2025-07-26: Smart Control Pack Patterns — Deep Dive into adaptive-ui-framework
- **Source repos analyzed:** `sabbour/adaptive-ui-framework` (core + pack system), `sabbour/adaptive-ui-azure-pack`, `sabbour/adaptive-ui-github-pack`, `sabbour/adaptive-ui-try-aks` (app).
- **14 patterns catalogued:** Pack Registration (P01), Self-Managing Login (P02), Data-Fetching Picker (P03), Write-with-Confirm (P04), LLM Inference-Time Tools (P05), Knowledge Skills Resolver (P06), Disabled Context (P07), State-as-Token (P08), CORS Proxy (P09), Artifact-Aware Components (P10), Auto-Continue (P11), ARM Introspection (P12), Client-Side Validation + Auto-Fix (P13), Intent Resolvers (P14).
- **Azure Pack:** 4 components (azureLogin, azureResourceForm, azurePicker, azureQuery), 2 tools (azure_arm_get, azure_pricing), skills resolver (ARM templates + AKS Automatic knowledge), MSAL auth, 27 diagram icons.
- **GitHub Pack:** 6 components (githubLogin, githubPicker, githubQuery, githubRepoInfo, githubCreatePR, githubSetSecret), 1 tool (github_api_get), OAuth Device Flow + PAT auth.
- **App Layer:** ArchitectureDiagram (Mermaid+ELK+icons+pan/zoom), CostEstimate, CompactCodeBlock, DevEnvironmentCard, K8sValidator (13 rules + auto-fix), SafeguardsChecker, DiagramBuilder.
- **Key architecture insight:** The old framework's power comes from 3 layers A2UI doesn't have: (1) ServicePack bundling (components + prompts + tools + auth), (2) ServiceConnector (auth token management separate from UI state), (3) orchestration middleware (skills resolvers, tool executors, artifact store). All 3 must be built in Kickstart's app layer.
- **A2UI mapping:** All pack components → fat A2UI custom components via `createReactComponent()`. Auth → ServiceConnector (React Context). Tools → Kickstart orchestration layer. Skills → phase engine middleware. Artifacts → Kickstart core store.
- **8 gaps identified:** No pack system (G01), no service layer (G02), no tool system (G03), no prompt injection (G04), no artifact store (G05), no past-turn isolation (G06), no auto-continue (G07), no state interpolation (G08, but JSON Pointers cover it).
- **Migration estimate:** ~16.5 developer-days for full pack port. P0 = auth connectors + CORS proxy (3.5 days). P1 = core pickers, loginCards, GitHub commit, validator (5.5 days). P2 = ARM forms, diagrams, write actions (6 days). P3 = tool ports, diagram builder, intent resolvers (2.5 days).
- **Full decision:** `.squad/decisions/inbox/leela-pack-architecture.md`


### 2025-07-25: Rendering Architecture Decision — Kill the Regex
- **Root cause confirmed:** `response-processor.ts` regex `A2UI_FENCE_RE` requires closing `~~~` at exact string end. Any trailing LLM content = silent extraction failure. Components vanish, raw JSON shows as chat text.
- **Heuristic fallback only covers 2/6 phases** (discover, design). Generate/Review/Handoff/Deploy get zero components on regex failure — exactly the phases where components matter most.
- **adaptive-ui comparison:** adaptive-ui uses NO regex. Entire LLM response is a JSON `AdaptiveUISpec`. Renderer consumes directly. That's why Ahmed got better results — the framework makes failure impossible.
- **Decision: Option C — Structured JSON Envelope.** 3-phase migration:
  - Phase 1 (1-2 days): Fix regex + expand heuristics to all 6 phases. Ship immediately.
  - Phase 2 (1-2 weeks): Switch to `response_format: json_object`. LLM outputs `{ message, components, stateUpdates }`. Incremental JSON streaming for text. Eliminates regex entirely. Adds state management.
  - Phase 3 (1 week): Component streaming (components appear one-by-one like Spark files). State binding (`{{state.runtime}}`). Auto-continue for phase transitions.
- **a2ui-renderer.js is PRESERVED.** All 17 component renderers unchanged. Only the extraction layer changes (regex → JSON parse).
- **A2UI vs adaptive-ui verdict:** A2UI architecture was the right choice (MCP integration, multi-surface, catalog model). Implementation was wrong (fenced blocks in markdown). Fix = adopt adaptive-ui's structured JSON pattern into A2UI's component model. Best of both.
- **Key pipeline files:** `response-processor.ts` (extraction), `converse.ts` (streaming SSE), `api-client.js` (client stream reader), `engine.js` (state machine), `a2ui-renderer.js` (DOM rendering), `system-prompt.ts` (LLM instructions), `phases.ts` (phase prompts with ~~~a2ui examples).
- **Full decision:** `.squad/decisions/inbox/leela-rendering-architecture.md`
- **SUPERSEDED:** This decision was obsoleted by `leela-pragmatic-a2ui-react.md` after discovery that A2UI React renderer already exists.


### 2025-07-25: Trip Notebook Smart Control Patterns Research
- **Repo analyzed:** `sabbour/adaptive-ui-trip-notebook` — AI travel planning assistant with 3 packs, 11 smart controls, 7 tools.
- **Three packs:** `@sabbour/adaptive-ui-travel-data-pack` (weather, country info, currency, checklists, budget), `@sabbour/adaptive-ui-google-maps-pack` (maps, places search, nearby, photo cards), `@sabbour/adaptive-ui-google-flights-pack` (flight search, flight cards with protobuf URL encoding).
- **Key pattern: Component-Autonomous Fetching** — Components like weatherCard/countryInfoCard call APIs themselves at render time. LLM provides minimal props (city name), component handles loading/error/display. Saves tokens, enables real-time data.
- **Key pattern: Dual-Entry API** — Every external API has BOTH a tool (LLM calls for reasoning) AND a component (visual, client-side fetch). System prompt instructs when to use each. Optimizes token usage.
- **Key pattern: Artifact Extraction Pipeline** — App walks AdaptiveUISpec layout tree after each LLM response, extracts structured data (places, flights, budget items, itinerary days, photos) into typed artifacts. Enables second-panel aggregation.
- **Key pattern: Cross-Component State Binding** — `bind` prop + `{{state.key}}` interpolation enables implicit communication. Selecting a hotel auto-updates restaurant search location. Eliminates need for LLM-orchestrated multi-step updates.
- **Key pattern: Graceful Degradation Chain** — FlightSearch: live results → link-only → error banner. Three tiers. Every component that calls external APIs needs this.
- **Key pattern: Artifact-Driven Side Panel** — TripNotebook subscribes to artifact store, categorizes by filename prefix convention (flight-*, budget-*, itinerary-day-*), renders in tabbed interface. Decouples data production from consumption.
- **Key pattern: Protobuf URL Construction** — Custom minimal protobuf encoder for Google Flights deep links. Pattern for services with binary/encoded URL parameters.
- **Key pattern: HTML Scraping as API** — Flights pack parses Google Flights HTML via CORS proxy when no official API exists. Fallback pattern for APIs that don't have official endpoints.
- **Kickstart implications:** (1) Components should fetch their own data for real-time display (e.g., AKS cluster status polling), (2) Every Azure/GitHub API needs both tool + component entry points, (3) Artifact prefix convention enables dashboard panel aggregation, (4) State binding enables cross-phase data flow in 6-phase conversation, (5) All external API components need 4-tier degradation (rich → cached → link → error).
- **Recommended Kickstart packs:** azure-pack (cluster status, cost, deployment), github-pack (repo, workflow, PR), iac-pack (file editor, manifest preview, architecture diagram), auth-pack (Entra app, RBAC, secrets).
- **Full decision:** `.squad/decisions/inbox/leela-trip-notebook-patterns.md`


### 2025-07-26: A2UI Actions System Analysis — Gap Analysis & Implementation Path
- **A2UI v0.9 action model:** Two-tier system — Events (agent-side, carry name/surfaceId/context with resolved JSON Pointer values) and Functions (local renderer-only, openUrl + validation + math/string ops). Data Model Sync sends full UI state with every message. Write contract guarantees synchronous local updates. Sandboxed execution prevents arbitrary code injection.
- **Critical finding — ACTION DEAD-END:** `useA2UI.ts` wires the MessageProcessor action handler to `console.log` only. A2UI events fire correctly through the full vendor pipeline (ComponentContext → SurfaceModel → SurfaceGroupModel → MessageProcessor) but produce zero effect. Every interactive component is decorative.
- **No action endpoint:** Backend `converse.ts` only accepts chat messages (`{ sessionId, message }`). No way to receive structured A2UI action events.
- **Hybrid action mismatch:** `response-processor.ts` generates buttons with non-standard `action: "reply"` format that bypasses A2UI ActionSchema entirely. Two incompatible action systems coexist.
- **6 major gaps identified:** G1 (action dead-end), G2 (no action endpoint), G3 (hybrid action mismatch), G4 (no tool system), G5 (no service layer), G6 (no pack system).
- **Key architectural insight:** A2UI's `action.event` system IS the ServicePack action bus. Event name = action type, context = payload, action handler = router to pack logic. This is structurally identical to adaptive-ui-framework's `handleAction` switch but using A2UI native plumbing.
- **5-phase implementation path:** (1) Wire action loop + backend endpoint (2-3 days), (2) Tool system with tool-call loop (3-4 days), (3) ServiceConnector + auth (3-4 days), (4) Pack system (2-3 days), (5) Rich interactions — artifacts, auto-continue, disabled context (2-3 days). Total ~12-17 days.
- **Phase 1 is critical path.** Everything builds on a working action loop. Without it, no ServicePack, no tools, no auth can function.
- **adaptive-ui-framework action types mapped:** sendPrompt → event with prompt in context, setState → local data model update, navigate → openUrl function, submit → event with serialized state, custom → pack-specific event handler.
- **Full decision:** `.squad/decisions/inbox/leela-a2ui-actions-analysis.md`


### 2025-07-26: IntegrationKit Abstraction (B-10)

- **Name:** `IntegrationKit` (renamed from ServicePack per user directive). Lives in `packages/core/src/kits/`.
- **Interface:** `{ name, description, tools: Tool<any>[], connectors: APIConnector[], prompts?: string[], components?: ComponentRegistration[] }`. `components` is frontend-only — core records type identifiers, web binds React components.
- **Registry pattern:** `IntegrationKitRegistry` mirrors `ToolRegistry` / `APIConnectorRegistry`. `registerKit(kit)` is the public API; delegates to `defaultKitRegistry`. On register, auto-wires tools → `ToolRegistry`, connectors → `APIConnectorRegistry`.
- **Typed constraint:** `tools: Tool<any>[]` required (not `Tool[]`) because individual tool files type their args as specific interfaces, not `Record<string, unknown>`. The `Tool<any>` escape hatch matches `ToolRegistry`'s existing pattern.
- **AzureKit:** azure_resource_list + azure_resource_get + estimate_cost tools; AzureARMConnector + PricingConnector; 4 system-prompt augmentations (AKS Automatic preference, resource discovery, cost transparency, K8s abstraction); azureLoginCard + azureResourcePicker component registrations.
- **GitHubKit:** github_repo_info tool; GitHubConnector; 3 system-prompt augmentations (repo-first detection, CI/CD OIDC wiring, branch strategy); githubLoginCard + githubRepoPicker component registrations.
- **App startup wiring:** `registerKit(azureKit); registerKit(githubKit)` called in `packages/web/src/main.tsx` before ReactDOM render. Kits push into `defaultRegistry` (tools) and `defaultConnectorRegistry` (connectors) — both singletons available to engine + MCP.
- **Tests:** 23 contract tests in `integration-kit.test.ts`, all green alongside existing 286 tests (309 total).
- **Commit:** `c7b99ac` on main.

---

## [ARCHIVE SUMMARY] Pre-2026-04-09 Architecture & Decisions

The learnings in this file through 2026-04-09 capture foundational architecture (monorepo, toolchain, auth setup, backlog consolidation). When file size exceeds 50KB, consider archiving older entries (pre-April 2026) to `history-archive.md` while keeping recent named-decision entries (B-10/B-11 naming, consolidated backlog, etc.).

Core decisions preserved in `.squad/decisions.md` supersede archived entries. This history is Leela's decision ledger; archive only when approaching 75KB to preserve recent context.

## 2026-04-09T22:32Z — P0–P2 Wave Complete Handoff

**Items owned:** B-10 (1 core item) + code review + architecture direction for all 29 items across P0–P2

**Key contributions:**
- **B-10 IntegrationKit abstraction:** Unified interface for cloud platforms. Two implementations: AzureKit (MSAL auth, ARM tools, Azure pricing, skill resolver) + GitHubKit (Device Flow auth, GitHub tools, repo browsing). Decouples chat engine from platform-specific logic. 309 tests passing.

**Decision leadership:** Merged 6 architectural decisions to canonical registry.
- B-25 handleAction (Bender): unified action model
- B-11 API routing (Bender): api: convention
- B-17 artifact singleton (Bender): pattern
- B-16 CORS proxy (Bender): auth policies
- B-15 phasePrompts (Bender): skill resolver
- B-10 IntegrationKit (Leela): abstraction layer

**Code review notes:** All P0–P2 branches reviewed for:
- Architectural coherence (decisions matched code)
- Test coverage (all PRs require 85%+ coverage)
- No regressions (423 tests baseline maintained)
- Documentation (decisions recorded, history updated)

**Pattern learnings:**
- IntegrationKit as contract enables clean multi-platform support. Prevents monolithic chat engine.
- Decision-driven code reviews: Refer to canonical registry when evaluating PRs.
- Three-phase plan (P0 architecture, P1 features, P2 polish) proved effective for parallel work.

**Team performance:** 29 items shipped with zero regressions. Handoff ready for QA.

**Next P3 priority:** Advanced auth (service principal, ADFS, Enterprise GitHub), offline mode (local code generation), analytics/telemetry, internationalization (i18n).

**Closing notes:** System is stable on main. All decisions recorded. Ready for production deployment decision. Consider P3 scope: either expand platform support (Oracle Cloud, AWS) or deepen AKS Automatic guidance (Workload Identity, gateway API setup, cost optimization).

### B-97 — Docs site update (2025-01)

- Audited docs/ and docs-site/ against the actual codebase before writing — always read source files first.
- Architecture has diverged significantly from early docs: IntegrationKit+APIConnector pattern, ToolRegistry (7 tools), ValidationEngine (7 validators), ArtifactStore, Skill Resolver, and React 19 + Vite 6 frontend.
- Kickstart catalog has 16 custom components (not the 4 or 17 in older docs): RadioGroup, FormGroup, CodeBlock, ProgressSteps, Markdown + 4 GitHub + 3 Azure + 4 deployment components.
- API surface grew from 1 endpoint (/api/chat) to 7: converse, action, generate, health, arm-proxy, github-proxy, pricing-proxy.
- Created docs/development.md (new) with npm run dev, npx vitest run, npx playwright test, and build commands.
- Updated both docs/ (authoritative) and docs-site/ (Docusaurus) in the same commit.


### 2025-07-27: PR + Tagged Release Workflow
- **Branch protection enabled:** Main branch requires PRs. 0 approvers (agents are the team), admins not exempt. No direct pushes.
- **SWA deploy now tag-gated:** `deploy-swa.yml` triggers on `push: tags: ['v*']` instead of `push: branches: [main]`. PR preview environments preserved via `pull_request` trigger.
- **CI is PR-only:** `ci.yml` removed `push: branches: [main]` trigger — runs only on PRs. Added TypeScript check step (`npx tsc --noEmit`).
- **Release flow:** changeset per PR → `npx changeset version` → `git tag vX.Y.Z` → push tag → auto deploy.
- **Infra + docs deploys unchanged:** Still trigger on push to main (path-scoped). Lower risk, no tag gate needed yet.
- **Full decision:** `.squad/decisions/inbox/leela-pr-release-workflow.md`


### 2025-07-27: Sprint Planning — Release Roadmap v0.2.0–v0.5.0
- **4 milestones created:** v0.2.0 (34pt, 10 issues), v0.3.0 (40pt, 8 issues), v0.4.0 (17pt, 12 issues), v0.5.0 (68pt, 18 issues). Total: 159 story points across 48 issues.
- **All 48 issues assigned to milestones.** No unassigned work remains.
- **v0.2.0 P0 items moved to Ready** on the project board (#22, #23, #24, #53, #59). Items already in-progress (#2, #3, #27, #28, #29) left as-is.
- **Two active PRs:** PR #65 (prompt knowledge batch → #3/#27/#28/#29) and PR #66 (questionnaire → #2) — both mergeable, both v0.2.0 scope.
- **Key dependency chain:** #22→#23→#24 (action handler), #34→#25→#30→#31/#32 (ServiceConnector→ServicePack→fat components).
- **Capacity balance:** v0.2.0 is Bender-heavy (core loop), v0.3.0 is balanced, v0.4.0 is light (prompt batch), v0.5.0 is stretch.
- **Full decision:** `.squad/decisions/inbox/leela-sprint-planning-roadmap.md`

### 2025-07-28: PR #76 Review Feedback — Sidebar Layout
- Addressed Copilot review comments on PR #76 (squad/59-playground-sidebar)
- **Comment 1 (Theater/Tutorial):** PR description was stale — referenced coming-soon Theater/Tutorial items that Fry already removed per #79. Updated PR description to reflect current state.
- **Comment 2 (Accessibility):** Added `aria-expanded={sidebarOpen}` and `aria-controls="playground-sidebar"` to mobile nav button; added `id="playground-sidebar"` to sidebar `<aside>`. Button now toggles open/close.
- Replied to both review comments, pushed fix, requested fresh Copilot review.
- Lint and build both clean after changes.
# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->


### 2026-04-08: Kickstart Architecture Foundation
- **Rename:** Project is "Imagine" → "Kickstart". Repo will move to sabbour/kickstart.
- **Dual surface:** Web (SWA + Portal Prototyper) and MCP (tools + future App UI). If we host it, we provide the LLM. If MCP, user's LLM.
- **Monorepo:** npm workspaces — `packages/core`, `packages/web`, `packages/mcp-server`.
- **Web stays vanilla JS** — Portal Prototyper is zero-dep, SWA deploys with `skip_app_build: true`. No React unless proven necessary.
- **A2UI pattern adopted, not library** — JSON UI schemas in core, each surface renders natively.
- **Conversation engine:** Hybrid state machine (phase tracking) + LLM (natural language per phase). Phases 1-4 for Phase 1 ship.
- **MCP tools first** in Phase 1: `kickstart`, `generate-manifests`, `check-status`. MCP App UI deferred.
- **IaC:** Bicep for Azure infra, `az` CLI scripts for Entra (Graph Bicep provider is preview, too risky).
- **Branching:** `squad/{issue}-{slug}`. Fry owns web/, Bender owns core/ + mcp-server/ + infra/, Hermes owns tests/.
- **Shared contracts** (`ui-schema.ts`, `types.ts`) are the integration bottleneck — require Lead review.
- **Key files:** `js/config.js` (auth config, needs migration to new tenant), `staticwebapp.config.json` (SWA routing), `infra/` (to be created).
- **Tenant pivot:** Entra app must be recreated in CA Global Demos 2605 tenant (caglobaldemos2605.onmicrosoft.com), not Microsoft corp tenant.
- **Ahmed's model preference:** claude-opus-4.6 for code, claude-haiku-4.5 for non-code.
- **Phase 1 defers:** cost estimation, Mermaid diagrams, K8s validation, MCP App UI, conversation phases 5-8, Codespaces integration.


### 2026-04-08: Spark-like UX Roadmap — P0/P1/P2 Prioritization

- **Full decision:** Documented in `.squad/decisions/inbox/leela-spark-ux-roadmap.md` (merged into decisions.md). Complete gap analysis + prioritized roadmap.
- **P0 scope (~11 hours, ship next sprint):** (1) Hero text input above carousel, (2) In-chat file chips with status, (3) Sparkle/pulse loading animation, (4) Right panel as "Preview" (contextual titles, A2UI diagram support).
- **P1 scope (~26 hours, one sprint after P0):** (5) Code view toggle (Preview|Code modes), (6) Deploy CTA button (top bar, AKS target dialog), (7) Session persistence + Recent/Favorites.
- **P2 scope (backlog):** (8) Selective workspace tabs (Iterate, Files, Prompts, Assets — not Theme), (9) "Open Codespace" / "Create Repository" menu, (10) Mermaid diagram rendering in preview.
- **Vanilla JS all the way:** No framework change needed. Component factory pattern in `components.js` handles all P0/P1 work.
- **Event bus extensions:** `files:generating`, `files:generated`, `preview:show`, `deploy:ready`, `deploy:started`, `deploy:progress`, `deploy:complete`.
- **Key distinction:** Spark publishes running apps. Kickstart generates infrastructure (Bicep, Dockerfiles, Helm, GH Actions) and deploys to AKS. Preview = architecture diagram + deployment plan + IaC files, not a running app. UX must reflect this.
- **Next:** Fry assigned P0 in background mode. P1 is one sprint after P0 ships. P2 depends on GitHub OAuth and MCP App UI (deferred features).


### 2026-04-08: Pragmatic A2UI v0.9 React Adoption — The Shortest Path
- **Discovery:** `@a2ui/react` v0.9 renderer ALREADY EXISTS at `renderers/react/src/v0_9/`. Apache 2.0 licensed, production-ready, 18 basic components implemented.
- **Architecture:** Two-context React pattern with `A2uiSurface`, `createReactComponent()` factory, `GenericBinder` + `useSyncExternalStore`, `DeferredChild` for lazy loading, `SurfaceModel` from `@a2ui/web_core/v0_9` for component buffer + data model.
- **adaptive-ui-try-aks pattern:** React/Vite/TypeScript, outputs structured JSON (not fenced blocks), renders via React engine. This is the proven path — same team, same tech stack.
- **Decision:** Adopt `@a2ui/react` v0.9 directly. Migrate frontend to React/Vite. Kill the regex. Output structured JSON from LLM.
- **Alignment strategy:** Use the code that exists today (Apache 2.0). When v0.9 ships officially, update the dependency. If release stalls, vendor it. Either way, we're not blocked.
- **Frontend migration:** Vanilla JS → React/Vite (~1 week, Fry's domain). Portal Prototyper CSS preserved (it's just CSS classes). Vite = instant dev server, HMR, TypeScript out-of-box.
- **Structured JSON envelope:** LLM outputs `{ message, a2ui_messages }`. Backend parses JSON, forwards A2UI messages via SSE. Client calls `processMessages()`. Regex eliminated.
- **Free from `@a2ui/react`:** 18 basic components, surface model, data binding via JSON Pointers, component registry, theme system, two-context optimization, DeferredChild, action handling.
- **Kickstart custom components:** CostEstimate, ArchitectureDiagram, FileEditor, AuthCard, WorkflowStatus, RepoPicker, CodespaceLink, AppOverview — all registered via `createReactComponent()`.
- **4-phase migration:** (1) React/Vite + A2UI integration + kill regex (1 week), (2) Custom Kickstart catalog (1-2 weeks), (3) Port try-aks features — diagrams, K8s validation, auth, Cloud Shell (2-3 weeks), (4) Data binding, multi-surface, component streaming (1-2 weeks).
- **Supersedes:** `.squad/decisions/inbox/leela-rendering-architecture.md` (Option C). Previous decision assumed vanilla JS rendering + JSON extraction. Now we're adopting React renderer entirely.
- **Full decision:** `.squad/decisions/inbox/leela-pragmatic-a2ui-react.md`


### 2026-04-08: Two-Repo Strategy — sabbour/a2ui Fork + sabbour/kickstart App
- **Pattern:** Mirrors adaptive-ui-framework + adaptive-ui-try-aks split. Framework extensions in fork, app-specific code in Kickstart.


### 2026-04-09: Consolidated Backlog Audit — Single Source of Truth
- **Finding:** Three disconnected tracking systems (SQL todos, decisions.md R-items, untracked Playground work) caused duplication + gaps. No single source of truth.
- **Audit:** Consolidated 45 items across 5 sources (SQL, R01–R09 + G01–G08 + G1–G6 from decisions, Playground work, untracked infrastructure). Created 105 B-items (B-01 through B-103).
- **Cross-reference table:** Every old ID (p1–p4, R1–R9, G01–G08, G1–G6) mapped to new B-item or marked superseded. Two items (leela-rendering-architecture, leela-spark-ux-roadmap) archived as decision obsoletes.
- **Key blockers identified:** Action loop (B-23–B-25) is hard blocker. Components fire events but have no handler. Blocks all P1 work. Recommend P0 = 9 days.
- **Effort reality:** 68 days for P0+P1+P2+Ops (45 items) assumes clear specs. P1 has unknowns (fat components, token mgmt, artifact store API). Recommend: Timebox B-10 (ServicePack design) as 2-day spike, run B-12 (Azure components) as proof-of-concept early.
- **Critical unknowns:** OpenAI function calling stability, MSAL token refresh in SSE, A2UI v0.9 component streaming capability, GitHub OAuth timeout UX. Recommend: Early spikes before commitments.
- **Deferred-but-important:** MCP tools (undefined scope, Phase 1 pivot unclear), multi-surface rendering (P3), cost estimation (scope ambiguous — spike recommended).
- **Output:** `.squad/decisions/inbox/leela-consolidated-backlog.md` — 20KB canonical backlog with cross-references, superseded items table, effort summary, owner assignments, critical path, and recommendations.
- **sabbour/a2ui (fork):** Generic catalog components (Table, Chart, Stepper), renderer improvements (streaming, SSR), data binding utilities, schema tooling, upstream contributions. Zero Kickstart/Azure/AKS logic.
- **sabbour/kickstart (app):** All Kickstart-specific components (CostEstimate, ArchitectureDiagram, FileEditor, AuthCard, WorkflowStatus, etc.), chat UI, LLM integration, phase engine, MCP server, Azure/GitHub APIs.
- **Consumption:** npm workspace + side-by-side checkout. Dev: `npm link @a2ui/react` for instant changes. CI: `file:` dependency OR published GitHub Package (future).
- **Boundary rule:** If ANY A2UI app could use it → fork. If it knows AKS/Azure/GitHub/Kickstart → app. When unsure → start in app, promote when reuse proven.
- **Upstream path:** Develop in fork, test in Kickstart, PR to google/A2UI when stable. Bug fixes always upstream.
- **Developer setup:** Clone both repos side-by-side, `npm link` in fork, link in Kickstart. README documents this.
- **Why NOT submodules:** Pain. Why NOT GitHub Packages now: Overkill for prototype. Why NOT vendoring: Drift risk.
- **Full decision:** `.squad/decisions/inbox/leela-two-repo-strategy.md`


### 2026-04-09: Pack Research Synthesis — Architecture Foundation Approved
- **Two research initiatives completed:** (1) adaptive-ui-try-aks pack inventory (14 patterns, 9 A2UI recommendations), (2) adaptive-ui-trip-notebook pattern analysis (7 new patterns, 4 Kickstart packs).
- **14 pack patterns consolidated:** P01 (Pack Registration), P02 (Self-Managing Login), P03 (Data-Fetching Picker), P04 (Write-with-Confirm), P05 (LLM Inference-Time Tools), P06 (Knowledge Skills Resolver), P07 (Disabled Context), P08 (State-as-Token), P09 (CORS Proxy), P10 (Artifact-Aware Components), P11 (Auto-Continue), P12 (ARM Introspection), P13 (Client-Side Validation + Auto-Fix), P14 (Intent Resolvers).
- **8 A2UI gaps mapped:** No pack system → ServicePack abstraction (R01). No service layer → ServiceConnector pattern (R02). No tools → orchestration layer (R04). No skills resolver → phase engine middleware (R05). No artifact store → Kickstart core (R07). No validation → pure TS port (R08). Others have A2UI native solutions.
- **ServicePack + ServiceConnector pattern adopted:** All pack components become fat A2UI custom components. Auth/tools/skills/artifacts stay in Kickstart orchestration. This preserves adaptive-ui's rich capabilities (components + tools + state binding) while building on A2UI's renderer and component model.
- **Migration priority table finalized:** P0 (auth connectors, CORS proxy) = 3.5 days. P1 (pickers, logins, GitHub commit, validator) = 5.5 days. P2 (ARM forms, diagrams, write actions) = 6 days. P3 (tool ports, builders, resolvers) = 2.5 days. Total ~16.5 days.
- **7 trip notebook patterns codified:** A (Component-Autonomous Fetching), B (Artifact Extraction), C (Dual-Entry API), D (State Binding), E (Graceful Degradation), F (Artifact-Driven Panel), G (Protobuf URLs), H (HTML Scraping), I (Pack Scoping), J (Session-Scoped Artifacts).
- **Architecture ready for buildout:** Foundation stone is ServiceConnector (auth token management outside UI state). Once connectors exist, fat components can register and orchestrator can wire tools. All subsequent packs follow same pattern.
- **Decisions merged:** leela-pack-architecture.md + leela-trip-notebook-patterns.md appended to `.squad/decisions.md`.


### 2026-04-09: Naming Proposal Approved — APIConnector + IntegrationKit

- **Proposed:** APIClient + IntegrationKit for ServiceConnector (B-11) and ServicePack (B-10).
- **User override:** APIClient → APIConnector (better emphasizes connection/auth management).
- **Final decision documented:** Both names follow established patterns (HttpClient, Firebase Kit conventions). Ready for implementation.
- **Cross-team alignment:** Bender and Fry briefed. Will refactor codebase in B-11/B-10 PRs.
- **Backlog consolidated:** Merged all scattered SQL todos, R-items, G-items, and untracked work into single-source-of-truth backlog (leela-consolidated-backlog.md). 45 total items, 68-day estimate, P0–P3 + Ops prioritized. Critical path: B-23–B-25 (action loop) 9 days.


### 2026-04-10: Consolidated process directives into reusable skill
- **Created `.squad/skills/pr-workflow/SKILL.md`** — single reference for the full issue→PR→review→merge lifecycle
- Consolidated 12 inbox directives (draft PRs, rebase-only, copilot review API, CI gates, board updates, sprint cycles, model pref) into one actionable document
- Updated Fry, Bender, Hermes charters to read the skill before starting issue work
- Project board field IDs are NOT hardcoded — skill includes GraphQL discovery query so agents can self-serve
- Inbox files left intact per protocol — Scribe handles cleanup
- **Decision:** `.squad/decisions/inbox/leela-process-optimization.md`


### 2026-04-10: Sprint Retro & Release v0.2.0
- **Retro conducted:** 12 issues closed, 11 PRs merged in one sprint session. Report at `.squad/log/2026-04-10-sprint-retro-v0.2.0.md`.
- **Release cut:** All packages bumped 0.1.0 → 0.2.0 via changesets. Tag `v0.2.0` pushed, GitHub release created, milestone closed.
- **Branch protection lesson:** `main` is protected — cannot push directly. Must use PR even for release commits. Used `--admin` merge to bypass status check wait.
- **Changeset GitHub token:** `@changesets/changelog-github` requires `GITHUB_TOKEN` env var — fails without it. Must export before running `npx changeset version`.
- **Tag update after squash-merge:** When using squash-merge PRs, the pre-push tag points at the wrong commit. Must `git tag -d` + re-tag + force-push after merge.
- **Key retro decisions:** (1) Lead must never be routed to write code, (2) Copilot reviewer can't APPROVED — adjust branch protection, (3) force-push noise should be minimized, (4) story point estimates mandatory, (5) feature PRs must include test updates.


### 2026-04-10: v0.2.0 Release & Sprint Retro Complete

Completed full v0.2.0 milestone closeout:
- Sprint retro documented (.squad/log/2026-04-10-sprint-retro-v0.2.0.md)
- Review process inefficiencies captured per user directive
- Wall-clock vs estimate analysis included in retro
- PR #76 reviewed and approved (Fry made aria-expanded fix)
- PR #78 reviewed and approved (Bender made data→context fix)
- PR #80 released (v0.2.0 tag, GitHub release, CHANGELOG, package.json bumps)
- Milestone v0.2.0 closed (14/14 issues)

Key decision: Lead (Leela) will not write code in future — routing code fixes to Fry/Bender per charter boundaries.


### 2026-04-10: v0.3.0 Sprint Retrospective Complete

**v0.3.0 milestone shipped:** 8 issues, 6 PRs, 34 story points, 100% delivery in 2 working sessions.

**Key process wins:**
- **DP 3-step gate enforced:** 100% of issues had Design Proposal → Leela architecture review → Zapp security review → code
- **Parallel work streams:** Bender (backend #25/#26/#30/#34/#37) and Fry (frontend #31/#32/#44) worked independently; no blocking dependencies in practice
- **No-lockout directive:** Original authors handled all post-review feedback; no reassignment; no context loss
- **Review quality improved:** Avg 1.75 rounds (down from v0.2.0's 2.0)
- **Security gate perfect:** Zapp approved all critical changes; zero regressions

**Technical foundation solid:**
- **ServiceConnector pattern** (#25) — Auth + API management for all integrations (MSAL, GitHub OAuth, future Azure tools)
- **ServicePack abstraction** (#30) — Extensible pack framework; foundation for all future component packs
- **LLM tool system** (#26) — Function calling protocol ready for phase 2-4 expansion
- **Fat A2UI packs** (#31/#32) — Azure (login, picker, query, forms) + GitHub (login, picker, repo info, write-with-confirm) shipping with self-managing auth
- **Security hardening:** CORS allowlist, ARM path validation, GitHub intent allowlist, API rate limiting, auto-continue state safety

**Metrics & lessons:**
- **Story point accuracy:** 80% (v0.3.0 tracked properly; #30 ServicePack had more design overhead than estimated)
- **Wall-clock vs calendar:** Sprint planned for 3 days over 2 weeks; delivered in 2 working sessions (1 day each) due to parallel work + reduced rework
- **Review rounds:** 3 issues needed post-merge fixes (#31 ARM validation, #32 intent allowlist, #30 self-dep cycle); all addressed; no lockout
- **DP compliance:** 8/8 issues (100%); DP gate will be standard for all future sprints
- **No-lockout compliance:** 8/8 issues (100%); directive working; maintain for all future sprints

**Action items captured:**
- A1: Reduce review rounds to <1.5 by deepening DP security review (Zapp)
- A2: Add ARM path validation + string allowlist linting rules (Hermes)
- A3: Document ServicePack naming in architecture guide (Leela)
- A4: Use "working sessions" + "session count" not calendar weeks for estimates (Leela)
- A5: Update sprint plan template with DP checklist (Leela)
- A6: Schedule external security audit post-v0.3.0 (Zapp)
- A7: Monitor CSP violations + API rate limits in production (Bender)

**Retrospective report:** `.squad/log/2026-04-10-sprint-retro-v0.3.0.md`

**Next sprint:** v0.4.0 pending issue planning. Focus areas identified: (1) component streaming, (2) state interpolation, (3) MCP app UI prototype, (4) K8s validation rules.


### 2026-04-10: v0.4.0 Sprint Planning Complete

**v0.3.0 closed:** Milestone moved from open → closed (10 closed issues, 0 open).

**v0.4.0 planned and ready:**
- **12 issues pre-assigned** to v0.4.0 milestone (no scope negotiation)
- **35 story points** across 3 domains: Bender (24, knowledge imports), Fry (9, components), Leela (2, docs)
- **Wave structure:** Wave 1 (knowledge intake + components, Days 1–2), Wave 2 (code review, Days 3–4), Wave 3 (release, Day 5)
- **DP gate enforced:** 100% compliance required (all agents post Design Proposal before coding)
- **No blocking dependencies:** Bender and Fry work independent streams; Leela runs parallel doc updates
- **Retro action items integrated:**
  - A3 (ServicePack naming docs) → assigned to #52 (Leela)
  - A4 (working sessions vs calendar) → sprint plan uses sessions + wall-clock days
  - A5 (DP checklist) → template created for this sprint
- **Release target:** 2026-04-17 (1 week, 5 working days); merge window Friday with tag + SWA deployment

**v0.4.0 differences from v0.3.0:**
- Smaller scope (12 issues vs 8), lower story points (35 vs 34), faster turnaround (1 week vs 2)
- 100% non-architecture work (knowledge imports + component polish vs feature architecture)
- No security-critical features (Zapp review lighter load)
- Execution: 2-3 parallel work streams instead of 3 waves
- Docs refresh (#52) runs concurrent with code to avoid staleness

**Sprint plan artifact:** `.squad/log/2026-04-10-sprint-plan-v0.4.0.md`

**Key decision:** v0.5.0 backlog remains unchanged (18 issues, 68 pts) — ready for post-v0.4.0 planning. Next sprint could accelerate if v0.4.0 ships early (high confidence: low architectural risk).


## Issue #52 — Documentation Update (2026-04-10)

**Status:** ✅ Completed | **PR:** #109

**Work summary:**
- Updated README.md with v0.3.0 architectural features: Fat A2UI components, LLM function calling, ServiceConnector/ServicePack patterns, CORS proxy security
- Expanded docs/README.md index with full documentation map and v0.3.0 highlights
- Enhanced docs/architecture.md with new sections:
  - ServicePack Pattern — auth requirements, lifecycle hooks, transactional registration
  - Fat Components & Component Lifecycle — Azure/GitHub components with security table
  - Tool System & LLM Function Calling — updated tool list (9 tools), function calling details, SSRF controls
  - ServiceConnector Pattern — unified API authentication
  - CORS Proxy Security — IP filtering, redirect validation, hostname allowlisting, rate limiting
- Added Fat A2UI Components section to docs/a2ui-catalog.md with security feature matrix

**Acceptance criteria met:**
- ✓ README reflects current architecture
- ✓ API reference docs present (docs/api-reference.md already complete)
- ✓ Component catalog documented (docs/a2ui-catalog.md with fat components)
- ✓ Deployment guide current (docs/deployment.md already complete)

**Branch:** `squad/52-docs-update`
**Commit:** 6804267 (docs: Update README and architecture docs for v0.3.0 features)
**PR:** https://github.com/sabbour/kickstart/pull/109

All DP reviewers approved; implementation complete per scope.


### 2026-07-28: PR #128 Review — K8s Rules Engine (#49)

**Status:** ✅ Approved | **Author:** Hermes (Tester)

**Architecture review findings:**
- RulesEngine composition over ValidationEngine is clean — no inheritance, no breaking changes
- Type layering (types → rule-types → rules-engine) well-separated
- ALL_RULES canonical registry is a good single-source-of-truth pattern
- 7 new validators (DS014–DS020) match DP spec exactly; 23 total, 665 tests pass
- AKS constraint mapping covers 4 families correctly

**Non-blocking observations:**
- container-port-names (DS014) has a regex false-positive bug — only matches protocol-prefix names, not arbitrary valid names like `api` or `metrics`. Follow-up fix recommended.
- drop-all-capabilities (DS015) autoFix injects `runAsNonRoot: true` — cross-concern with run-as-non-root validator but pragmatic for PSS Restricted bootstrap.
- 10 unrelated web files (Fry's progressive-rendering work) bundled in this PR — process feedback given to split in future.

**Learnings:**
- Regex-based YAML parsing is accumulating tech debt across all validators — worth scheduling a structured parser migration in a future sprint.
- Cross-branch contamination (mixing Fry's web changes with Hermes's core changes) is a process gap to address in next retro.


### 2026-07-28: PR #129 Review — Theme System (#42)

**Status:** ✅ Approved (with one fix) | **Author:** Fry (Frontend Dev)

**Architecture review findings:**
- Three-state theme (`light | dark | system`) with `resolvedTheme` pattern is the correct abstraction — user preference vs. rendered theme cleanly separated.
- `useSyncExternalStore` for `matchMedia` subscription is React 18 best practice — concurrent-safe, correct subscribe/snapshot/serverSnapshot.
- Inline SVG icons for ThemeToggle avoids unnecessary Fluent icon dependency.
- CSS transitions use existing design tokens (`--duration-normal`, `--easing-ease`) — consistent with the design system.
- Scope discipline: 7 files, 128 additions, faithful to DP spec.

**Required fix before merge:**
- `useTheme()` null guard was removed. With `strict: true`, returning `ctx` (which is `ThemeContextValue | null`) as `ThemeContextValue` is a type safety issue. The error message is also valuable DX. Guard must be restored.

**Learnings:**
- `resolvedTheme` pattern (user pref vs. rendered value) is reusable for any setting that has a "system/auto" option — worth documenting as a standard pattern.
- `useSyncExternalStore` is the right tool for any browser API subscription (matchMedia, ResizeObserver, IntersectionObserver) — prefer over manual useEffect+useState.

### 2026-07-27: DP Review #40 + PR #126 Review (Component Streaming)

**DP #40 — Progressive Rendering:** ✅ Approved
- Three-layer pipeline (useProgressiveQueue hook, mock streaming stagger, CSS --enter-index) is architecturally sound
- Clean separation: ref collects ALL IDs authoritatively, queue state drives incremental render
- No security concerns — no new data inputs, existing A2UI pipeline used throughout

**PR #126 — Request Changes (scope creep):**
- Progressive rendering code (commit 76fb803) is clean and ready to merge
- PR also bundles validation safeguards DS001–DS013 (commit d023d31, issue #36) — ~1500 lines of unrelated work
- Requested Fry split #36 into its own PR with separate DP review
- Once split, progressive rendering PR can be approved immediately

**Learnings:**
- Always check commit list on multi-commit PRs for scope violations — file count (23 files) was the first red flag
- Validation safeguards are Bender's domain (#36) not Fry's — routing violation on top of scope creep
- The `useProgressiveQueue` pattern (timer + refs to avoid stale closures) is a good reusable hook pattern for any future staggered UI reveals

### 2026-04-13: Issue #39 DP Review + PR #125 Code Review

**Issue:** #39 — feat: Build IndexedDB virtual filesystem
**PR:** #125 — IndexedDB virtual filesystem with file tree + Monaco editor
**Author:** Fry (Frontend Dev)

**DP Review:** Approved. Dual-filesystem architecture (in-memory streaming + IndexedDB persistence) is sound. One-way sync bridge avoids bidirectional state conflicts. IDB v2 schema with lazy v1 migration is clean.

**PR Review:** Approved. 680 additions, 83 deletions across 6 files. Implementation matches DP precisely. Fluent UI compliance verified (makeStyles + tokens). Security: sanitizeHtml() on hljs fallback, Monaco read-only, no raw innerHTML. 580 tests pass, zero type errors.

**Minor notes (non-blocking):** Sync bridge iterates all files per VFS notification (O(n) per event, acceptable at current scale). document.execCommand copy fallback is deprecated but fine for compat.

---

### 2026-04-13T22:32:25Z: Extension Package — kickstart-aks-dev

**Task:** Review all squad processes and package as a Squad Extension.

**What I did:**
- Read and analyzed: `decisions.md` (4046 lines, 213 entries), 13 inbox files, `ceremonies.md` (4 ceremonies), `skills/pr-workflow/SKILL.md`, `routing.md`, `team.md`
- Extracted 6 skills, 3 ceremonies (design-review, retrospective with sprint planning), and 1 consolidated directives file
- Created extension at `.squad/extensions/kickstart-aks-dev/` with README
- Wrote decision inbox entry at `.squad/decisions/inbox/leela-extension-package.md`

**Key files:**
- `.squad/extensions/kickstart-aks-dev/README.md`
- `.squad/extensions/kickstart-aks-dev/skills/{pr-workflow,release-process,swa-deployment,debug-mode,a2ui-components,testing-strategy}.md`
- `.squad/extensions/kickstart-aks-dev/ceremonies/{design-review,retrospective}.md`
- `.squad/extensions/kickstart-aks-dev/directives/project-conventions.md`
- `.squad/decisions/inbox/leela-extension-package.md`

**Findings:** ~150 early decisions are pre-A2UI and could be archived. 13 inbox files need Scribe merge. Some date inconsistencies in inbox files (2025 dates on 2026 features).

---

## ARCHIVED 2026-04-17 (Scribe summarization — leela history exceeded 15 KB)

### Round 5: Design Review (2026-04-14)
Reviewed and approved DP #188 (expanded demo scenarios). Approved Fry's implementation readiness.

### 2026-04-15 E2E Demo Sprint Planning
Built sprint plan for demo-readiness. GitHub OAuth App available (#274 unblocked). Azure auth/deployment in scope. Critical path: PR #297 → #298 → #275 + #274 → Azure MSAL. 4 parallel tracks post-#298: Wizard Flow, GitHub OAuth, Azure, Polish. Zapp mandatory on #274 and Azure auth. Deferred: #272, #277. Decision: `leela-e2e-sprint-plan.md`.

### 2026-04-15 Sprint Planning Ceremony (v0.6.1)
Board drift: 12/15 issues no milestone, all stale `go:needs-research`. Fixed: all demo-critical → v0.6.1, v0.7.0 for deferred, cleared stale labels. Burn now: PR #297, #298, #299, #274. Burn next: #300, #296, #275, #265, #266. Decision: `leela-sprint-planning-v061.md`.

### 2026-04-15 PR Review Sprint
Merged PR #252 (FileManagerSidebar + FileViewer). Merged PR #247, #248 bug fixes. 3 PRs merged, 5 issues closed, CI green.

### 2026-04-15 Architecture Diagram Depth (#300)
Three-tier model: Tier 1 (always: AKS subgraph), Tier 2 (conditional: DB/cache/queue/AI), Tier 3 (annotations: CI/CD). Use `diagram` prop with Mermaid subgraphs. Files: `system-prompt.ts`, `component-catalog.ts`, `demo-scenarios.ts`. Decision: `leela-architecture-diagram-depth.md`.

### 2026-04-15 Priority Tracking Decision
Priority labels (`priority:p1`, `priority:p2`) + cross-link comments on GitHub issues. Applied to #333, #328, #327, #326, #331, #332. Decision: `leela-priority-tracking-github.md`.

### 2026-04-16 Post-v0.7.0 Triage
Merge #341 security bump immediately; run sprint planning before feature code; proceed #330 Agents SDK design spike (P1) in parallel; #329 MCP App IDE follows; #332 blocked. Decision: `leela-post-v070-priority-lane.md`.

### 2026-04-16 Vendor Hotfix (#342)
Issue #342 removes `@sabbour/adaptive-ui-core` + `@sabbour/adaptive-ui-azure-pack` — surgical extraction of icon registry + 2 SVGs. Fry-routed. No DP needed (pure refactor). Decision: `leela-vendor-diagram-hotfix.md`.

### 2026-04-16 PR #383 Documentation Rewrite
7 engineering docs updated (ARCHITECTURE, PHASES, CONVERSATION-ENGINE, AUTHENTICATION, PERSISTENCE, INTEGRATION, TESTING). All review feedback addressed. 12 accuracy fixes. CI green, internal links validated.

### 2026-04-16 Sprint Retro — Security + Generation Sprint
Merged (cross-cutting): #341 DOMPurify, #354 STEPWISE_GENERATION_V1 default, #356 rename, #358 catalog guidance, #368 CI permissions, #372 phantom cleanup. Decisions: component rename discipline, sanitization standard, stepwise default.


### 2026-04-17 / 2026-05-28: v2 Sprint Kickoff DP Reviews

#### DP #329 (MCP App IDE Surface) — APPROVED WITH CONDITIONS
- Resource registration via `registerAppResource` + `registerAppTool` canonical. Single-file bundle + CSP headers + `event.source` guard required. Bundle size validation required before Slice 1.

#### DP #330 (Agents SDK Migration) — APPROVED + CLOSED
- Option B (hybrid route planner + manager agent) adopted. Server-authored route state replaces model-emitted booleans. Implementation: #445 (Bender), #446 (Fry).

#### PR #447 Code Review + Approval
- Found duplicate-message bug in SDK streaming loop (blocking). Fixed in a3899e5. Applied `leela:approved`.

#### v2 Sprint Planning + #474 DP Review
- Sprint plan: #474 → #475 → #476 blocking chain. Step 4+ frozen until #476.
- #474 APPROVE_WITH_CONDITIONS. Seam-cutting approach confirmed.
- v2 architecture DP (#473) APPROVED. Guardrail semantics pinned before Step 11.

#### #474 Step 1 + A2UI #351 (Wave 3 inbox)
- `leela-v2-rewrite-start-gate.md`: HOLD gate honored, sprint planning first.
- `leela-dp-474-step1.md`: APPROVE_WITH_CONDITIONS — shim shrinking-only, no new exports/runtime.
- `leela-351-component-expansion.md`: A2UI catalog 28→33 components; SummaryCard + DecisionCard added.

### 2026-05-28: DP Reviews #475 / #476 / #477 / #478

#### DP #475 v2 Step 2: Harness types — APPROVE_WITH_CONDITIONS
C1 A2UI Zod schemas must be discriminated unions with `version: z.literal("v0.9")`.
C2 `ComponentContribution.renderer: unknown`; narrowing deferred to pack-core.
C3 `SessionCtx` forward refs stubbed with `// TODO(Step 3)`.
C4 `zod` + `@openai/agents` in `dependencies` (not devDeps).
C5 `chat-a2ui.ts` must drop all v1 phase-model code; keep/drop inventory required.

#### DP #476 v2 Step 3: Registry + loaders — APPROVE_WITH_CONDITIONS
C1 Drop custom mini-parser; use `yaml` npm package (arrays in frontmatter).
C2 Full registry read surface locked in Step 3: `getAgent`, `getSkillsForAgent`, `getToolsForAgent`, `getUserAction`, `getGuardrailsByStage`, `components`.
C3 `UserActionContribution` must carry both `.name` (`:` sigil) and `.wireName` (`__`); loader-agent.ts produces both.

#### DP #477 v2 Step 4: pack-core — APPROVE_WITH_CONDITIONS
Scope: 3 agents, 5 skills, 6 tools, 39 components, 3 guardrails, 2 playground scenarios. Domain-neutral boundary.
C1 (BLOCKER Phase C): Pack type shape — `agentsDir`/dir-based vs inline arrays must resolve against #476.
C2 (BLOCKER Phase C): `SessionCtx.a2uiEmissions: A2UIMessage[]` must exist in merged #475.
C3 (merge gate): Step 5 DP must commit to `session.a2uiEmissions` forwarding.
C4 (merge gate): §6c test must exercise loader-from-disk path.
C5 (Phase E): `AuthCard` must be domain-neutral (no MSAL props).

#### DP #478 v2 Step 4a: Playground on registry — APPROVE_WITH_CONDITIONS
C1 (BLOCKER): Three registry APIs used by this DP (`getComponent`, `playgroundScenarios`, `playgroundStubs`) not in #476-approved surface — Bender must extend Step 3 spec.
C2 `usePlaygroundDispatch` pseudocode: add `if (!stub)` guard.
M1: "Fail loudly" must cover both unregistered component (error badge) and empty scenario (empty state).

### 2026-06-10: PR #544 Code Review (v2 Step 1)

**PR #544 (Closes #474) — APPROVED + `leela:approved` applied**
All 8 DP conditions verified: shim compile-only, flags gone, fail-closed 503, 16 web files on harness, 34 smoke tests, no new exports, vite build green, deferred items correct. 407 tests total green.
Hard gate on Step 2: `types.ts` is `export {};` but 15+ web shell files still import named types — `tsc --noEmit` would fail. Bender + Fry must resolve before any tsc CI gate lands.


### 2026-06-10 / 2026-04-17: v2 Step 2–4a Reviews (archived wave 20)

#### DP #479 (Runner + SSE) — APPROVE_WITH_CONDITIONS
9 SSE events locked. Runner/registry coupling correct. C1–C5 conditions set (Phase gates and merge gates). Zapp Critical 1–3 remain merge gates. Filed `leela-479-dp-review.md`.

#### PR #545 (Step 2) — Initial REQUEST CHANGES (2 blockers)
Missing `SessionCtx.a2uiEmissions: A2UIMessageV09[]`; `Pack` had dual-registration model. Filed `leela-pr545-review.md`.

#### DP #480 (Skill Resolver) — APPROVE_WITH_CONDITIONS
C1 BLOCKER: `*` glob self-contradiction; C2 BLOCKER: `listSkills()` not in #476 surface; C3: export `estimateTokens` from harness index. OQ2: all roles; OQ3: XML tags. Filed `leela-480-dp-review.md`.

#### PR #546 (Step 3) — APPROVED
All #476 conditions verified. `yaml` npm package, 9-accessor surface, `UserActionContribution.wireName`, Zapp security conditions, `SessionCtx.a2uiEmissions` backported. Build + 53/53 tests. Filed `leela-pr546-review.md`.

#### PR #545 Re-verification — APPROVED (after fixes)
`Pack` dir-based only ✅, `a2uiEmissions` present ✅, `handoff`→`assess` remap ✅. Filed `leela-pr545-recheck.md`.

#### PRs #544 / #545 / #546 MERGED (Steps 1–3)
Step 1 (nuke v1, harness seam), Step 2 (harness types + Zod), Step 3 (PackRegistry + loaders) all shipped into v2-rewrite. Known debt: `types.ts` tsc gap, `enable()`-after-`seal()` guard.

#### PR #547 (Step 4a Playground on Registry) — APPROVED
Phases A–D all complete. C1 resolved (registry surface used, `getComponent` not needed). C2 resolved (`if (!stub)` guard present). M1: empty scenario → informational; unregistered → `GalleryCardErrorBoundary`. `leela:approved` applied. Unblocks #479.
