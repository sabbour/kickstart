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

### 2026-04-08: Spark-like UX Roadmap — P0/P1/P2 Prioritization

- **Full decision:** Documented in `.squad/decisions/inbox/leela-spark-ux-roadmap.md` (merged into decisions.md). Complete gap analysis + prioritized roadmap.
- **P0 scope (~11 hours, ship next sprint):** (1) Hero text input above carousel, (2) In-chat file chips with status, (3) Sparkle/pulse loading animation, (4) Right panel as "Preview" (contextual titles, A2UI diagram support).
- **P1 scope (~26 hours, one sprint after P0):** (5) Code view toggle (Preview|Code modes), (6) Deploy CTA button (top bar, AKS target dialog), (7) Session persistence + Recent/Favorites.
- **P2 scope (backlog):** (8) Selective workspace tabs (Iterate, Files, Prompts, Assets — not Theme), (9) "Open Codespace" / "Create Repository" menu, (10) Mermaid diagram rendering in preview.
- **Vanilla JS all the way:** No framework change needed. Component factory pattern in `components.js` handles all P0/P1 work.
- **Event bus extensions:** `files:generating`, `files:generated`, `preview:show`, `deploy:ready`, `deploy:started`, `deploy:progress`, `deploy:complete`.
- **Key distinction:** Spark publishes running apps. Kickstart generates infrastructure (Bicep, Dockerfiles, Helm, GH Actions) and deploys to AKS. Preview = architecture diagram + deployment plan + IaC files, not a running app. UX must reflect this.
- **Next:** Fry assigned P0 in background mode. P1 is one sprint after P0 ships. P2 depends on GitHub OAuth and MCP App UI (deferred features).

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
- **sabbour/a2ui (fork):** Generic catalog components (Table, Chart, Stepper), renderer improvements (streaming, SSR), data binding utilities, schema tooling, upstream contributions. Zero Kickstart/Azure/AKS logic.
- **sabbour/kickstart (app):** All Kickstart-specific components (CostEstimate, ArchitectureDiagram, FileEditor, AuthCard, WorkflowStatus, etc.), chat UI, LLM integration, phase engine, MCP server, Azure/GitHub APIs.
- **Consumption:** npm workspace + side-by-side checkout. Dev: `npm link @a2ui/react` for instant changes. CI: `file:` dependency OR published GitHub Package (future).
- **Boundary rule:** If ANY A2UI app could use it → fork. If it knows AKS/Azure/GitHub/Kickstart → app. When unsure → start in app, promote when reuse proven.
- **Upstream path:** Develop in fork, test in Kickstart, PR to google/A2UI when stable. Bug fixes always upstream.
- **Developer setup:** Clone both repos side-by-side, `npm link` in fork, link in Kickstart. README documents this.
- **Why NOT submodules:** Pain. Why NOT GitHub Packages now: Overkill for prototype. Why NOT vendoring: Drift risk.
- **Full decision:** `.squad/decisions/inbox/leela-two-repo-strategy.md`

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
