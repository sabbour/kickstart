# Leela — Lead/Architecture History

## Summary (Archived entries before 2026-04-28)

- ✅ Consensus checkpoint #197 closed with 7/7 acks, 0 dissents
- ✅ Sub-tasks #243 (microsoft-skills.json schema) and #244 (handoff-briefing v1) promoted from convergent signals
- ✅ PR #241 (triage rewrite) drafted before #197, blocked pending #244 completion
- ✅ Architecture review #244: 5 typed fields, fail-closed constraint-bucket enum, Zod-as-source contract
- ✅ Learning: file-level verification (not just diff) caught CSP line omission in PR #239 — review actual files vs patches
- ✅ Post-flight check gap identified: `issue-edit` doesn't filter `closed` events (P1 → filed)

## 2026-04-28 — Phase 2.0 Implementation (#244)

PR #245 opened, 16/16 tests passing. Awaiting four-way PR Review Gate (self-ack architecture, Zapp security, Nibbler codereview, Amy docs).

**Downstream impact:** PR #241 currently blocked-on:#244. Will unblock for rebase once this merges. Enables downstream issues #199–#20x for prompt rewrites.

**Architecture doc includes:** Zapp's structured-render guidance for constraint-label rendering in downstream contexts.

**Post-flight:** exit 0, identity confirmed.

## Ceremony: PR Review Gate #245 + #246 (2026-04-28)

- **Ceremony:** pr-gate-245-246-plus-kif
- **Time:** 2026-04-28T11:56:56Z
- **Bender PRs:** #245 (backend-auth), #246 (backend-schema)
- **Gate Status:** ✅ BOTH APPROVED
  - #245 & #246 cleared all 4 labels: architecture, security, codereview, docs
  - Merge-ready pending CI green
- **Note:** NEW decision: squad-platform[bot] owns workflows scope (impacts future feature planning)

## Ceremony: PR-stage Architecture Approval (2026-04-28T12:12:30Z)

**Ceremony ID:** arch-pr-stage-245-246

Re-affirming issue-stage architecture approvals at the PR-stage gate:

- **PR #246** (closes #243): microsoft-skills schema + loader
  - Review posted via squad-lead[bot] (not author) — ✅
  - Label `architecture:approved` applied via REST API — ✅
  - Rationale: Carrying forward D8 architecture ack. Schema location, fail-closed loader, AJV CI gate all match DP.

- **PR #245** (closes #244): Handoff Briefing Schema v1
  - Review cannot be posted (PR author is squad-lead[bot]) — N/A
  - Label `architecture:approved` applied via REST API — ✅
  - Rationale: Re-affirming self-ack from issue. Zod-as-source split, pack boundary, typed contract all in place.

**Process Gap Identified:** Issue-stage `architecture:approved` labels DO NOT auto-propagate to PR-stage. Must explicitly apply at PR gate (not just issue ack). This was a surprise in Ralph's merge ceremony gate check. Recommend updating `.squad/ceremonies.md` to clarify: PR gate requires label on the PR object, not just the issue.

**Post-flight:** exit 3 (known gap per Kif #242 — review ID lookup fails). Label verification manual: both PRs now show all 4 required labels.


## Ceremony: Zod v4 Migration Issue Filed (2026-04-28T12:12:30-07:00)

**Ceremony ID:** leela-zod-v4-migration-issue

### Context
PR #245 (closes #244) and PR #246 (closes #243) are both fully approved (architecture, security, codereview, docs) but blocked on CI. Kif diagnosed the root cause as a three-way Zod split in the monorepo lockfile: `node_modules/zod@4.3.6` (root) + `packages/web/node_modules/zod@3.25.76` + `packages/pack-core/node_modules/zod@3.25.76`. The `3.25.76` bridge version introduces `$ZodTypeInternals` nominal symbols — two separate copies → two distinct `Symbol()` instances → TypeScript project references fail with TS2740.

### Issue filed
- **Issue #247** — "[Phase 2.0 prerequisite] Zod v4 migration — converge monorepo on a single major, drop the v3.25 bridge"
- URL: https://github.com/azure-management-and-platforms/kickstart/issues/247
- Labels applied: `estimate:M`, `priority:p0`, `type:chore`, `squad:leela`, `architecture:approved`

### DP posted
- Comment ID: 4338529578
- URL: https://github.com/azure-management-and-platforms/kickstart/issues/247#issuecomment-4338529578
- `architecture:approved` self-ack applied at DP stage per charter
- Post-flight: exit 0, `squad-lead[bot]` confirmed

### Key learnings
1. **Zod v3→v4 blocker pattern:** `z.preprocess` removed in v4. Two callsites must migrate before `overrides.zod` can pin v4 across the monorepo. This is a recurring pattern — any pack author who pins `^3.x` triggers the split. The CI guardrail (Kif) is the systemic fix.
2. **Cascade depth:** A single dependency split can block p0 issues transitively (here: #244 → #198 → #241). When CI is broken on architecture-approved PRs, immediately check for duplicate hoisted packages before re-reviewing code.
3. **Issue-stage→PR-stage label gap:** Architecture self-ack at issue stage (DP) must be re-applied at PR stage. This was documented in the prior ceremony; still true here — tracked in ceremonies.md update from ceremony arch-pr-stage-245-246.
4. **Cross-link discipline:** Cross-link comments on blocked PRs help reviewers and Kif's CI triage see the dependency chain without reading the full issue thread.

### Post-flight summary
- DP comment 4338529578: exit 0, `squad-lead[bot]` ✅
- `architecture:approved` label: exit 0, `squad-lead[bot]` ✅
- PR #245 cross-link comment 4338538020: exit 0, `squad-lead[bot]` ✅
- PR #246 cross-link comment 4338538669: exit 0, `squad-lead[bot]` ✅

### Awaiting
- `security:approved` — Zapp (coercion-equivalence audit on both migrated callsites)
- `codereview:approved` — Nibbler (pattern correctness)
After DR: Fry owns `basic_functions_api.ts`, Bender owns `gen-gha-workflow/schema.ts`, Kif owns `overrides` + CI guardrail.

## 2026-04-28 — DR #247 Zod v4 migration cleared (all 3 labels)

**Ceremony:** design-review-247-zod-v4  
**Status:** All approval labels applied (architecture + security + codereview)

**Implementation greenlit.** Fry and Bender starting work in parallel. Bender has scope decision to make (harness 5-callsite question). Kif to apply skill correction and add overrides after both migration PRs land.
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

### 2026-04-09: Pack Research Synthesis — Architecture Foundation Approved
- **Two research initiatives completed:** (1) adaptive-ui-try-aks pack inventory (14 patterns, 9 A2UI recommendations), (2) adaptive-ui-trip-notebook pattern analysis (7 new patterns, 4 Kickstart packs).
- **14 pack patterns consolidated:** P01 (Pack Registration), P02 (Self-Managing Login), P03 (Data-Fetching Picker), P04 (Write-with-Confirm), P05 (LLM Inference-Time Tools), P06 (Knowledge Skills Resolver), P07 (Disabled Context), P08 (State-as-Token), P09 (CORS Proxy), P10 (Artifact-Aware Components), P11 (Auto-Continue), P12 (ARM Introspection), P13 (Client-Side Validation + Auto-Fix), P14 (Intent Resolvers).
- **8 A2UI gaps mapped:** No pack system → ServicePack abstraction (R01). No service layer → ServiceConnector pattern (R02). No tools → orchestration layer (R04). No skills resolver → phase engine middleware (R05). No artifact store → Kickstart core (R07). No validation → pure TS port (R08). Others have A2UI native solutions.
- **ServicePack + ServiceConnector pattern adopted:** All pack components become fat A2UI custom components. Auth/tools/skills/artifacts stay in Kickstart orchestration. This preserves adaptive-ui's rich capabilities (components + tools + state binding) while building on A2UI's renderer and component model.
- **Migration priority table finalized:** P0 (auth connectors, CORS proxy) = 3.5 days. P1 (pickers, logins, GitHub commit, validator) = 5.5 days. P2 (ARM forms, diagrams, write actions) = 6 days. P3 (tool ports, builders, resolvers) = 2.5 days. Total ~16.5 days.
- **7 trip notebook patterns codified:** A (Component-Autonomous Fetching), B (Artifact Extraction), C (Dual-Entry API), D (State Binding), E (Graceful Degradation), F (Artifact-Driven Panel), G (Protobuf URLs), H (HTML Scraping), I (Pack Scoping), J (Session-Scoped Artifacts).
- **Architecture ready for buildout:** Foundation stone is ServiceConnector (auth token management outside UI state). Once connectors exist, fat components can register and orchestrator can wire tools. All subsequent packs follow same pattern.
- **Decisions merged:** leela-pack-architecture.md + leela-trip-notebook-patterns.md appended to `.squad/decisions.md`.

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
# Project Context
# Leela — Lead

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.


## Status (Summarized 2026-04-21)

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.


## Key Process Learnings (rolled)

- DP 3-step gate required before code: Issue → DP comment → Leela/Zapp approval → code
- Sprint planning gates feature work; ceremony gaps erode when not in coordinator logic
- Four-way review gate (Leela/Zapp/Nibbler/Docs) now enforced; all four labels required for merge
- PR comment resolution is non-optional; reply + resolve thread before merge
- v2 blocking chain: #474 → #475 → #476 (Step 1-3 gates); Step 4+ frozen until complete

## Recent Activity

- v2 sprint planning + #474 DP review: #474 → #475 → #476 blocking chain; APPROVE_WITH_CONDITIONS on #474
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS; DP #330 (Agents SDK) APPROVED + closed out
- PR #383 engineering docs rewrite (7 files); label-based review gate; comment-resolution process fix
- v0.6.1 deployment prep: vendor diagram assets, CI hardening, stepwise generation default


## 2026-04-21 — Four-way Review Gate + Ceremony Enforcement

Four-way PR Review Gate now live (Leela/Zapp/Nibbler/Docs). Merge blocked until all four approval labels present. Ceremony enforcement tightened with pre-dispatch blocking checkpoint. Docs gate added to DP + PR Review.

## 2026-04-21 — 6h Sprint Cadence Calibration (PR #993 pre-review amend)

Ahmed corrected post-merge that the squad runs **6-hour sprints**, not weekly. Recalibrated the just-shipped Sprint Planning + Cadence Retrospective ceremonies in PR #993 before flipping ready-for-review.

Anchor times set to **00:00 / 06:00 / 12:00 / 18:00 UTC** (Ahmed may override by editing the ceremony row directly). Sprint notes are timestamped per anchor: `.squad/sprints/{YYYY-MM-DDThh}Z.md` (e.g. `2026-04-21T12Z.md`).

**Estimate band recalibration (for 6h sprint):**
- `estimate:S` ~15 min (1 pt)
- `estimate:M` ~1 hour (3 pt)
- `estimate:L` ~3 hours (8 pt) — at most one per sprint
- `estimate:XL` >3 hours (20 pt) — **does not enter a sprint**

**XL-split rule (rationale):** the old weekly bands (2h / 8h / 24h / 80h) encoded "XL = big epic, stretches across sprints." In a 6h cadence, an XL by definition cannot fit, so the only honest way to preserve the "one PR maps to one issue, one sprint completes its scope" invariant is to refuse XL into planning and split it during triage. Keeps velocity math consistent and prevents a single item from eating an entire sprint plus silent carry-over.

**Cadence Retro output change:** instead of a new `Weekly Retro` issue, retros are appended as comments to a **rolling daily issue** `Cadence Retro · {YYYY-MM-DD}` (up to 4 comments/day, one per closed 6h sprint). Avoids 4 issues/day of noise while keeping an auditable record.

**Coordinator enforcement (`.github/agents/squad.agent.md`):** no text changes needed — the file never hardcoded "weekly," only referenced `.squad/ceremonies.md` as the source of truth. The pre-dispatch checkpoint is cadence-agnostic and still correct.

**Deferred:** did NOT retime `squad-weekly-pulse.yml` / `squad-velocity-report.yml` / `squad-daily-pulse.yml` crons — they're independent reporting workflows, not Sprint Planning inputs. Flagged in PR description as a follow-up for #992 (possible rename to `squad-sprint-pulse.yml` at 6h cadence).

### 2026-04-21 — PR #988 architecture re-review (post-nit push)
- **Outcome:** APPROVED (`leela:approved` applied).
- **Rationale:** Commit dd1e6c6 is strictly the requested nit sweep — JSDoc refresh, stale helper comment, `GalleryCardErrorBoundary`→`ComponentCardErrorBoundary` rename (def + both call sites), orphan CSS (`.playground-gallery` + breakpoints + `.playground-widget-card`) removed; `.playground-gallery-scroll` correctly retained. No layout/registry/behaviour drift.
Key findings:
- Primitive coverage complete (all 12 type files match brief). ✅
- AgentOutput Zod contract correct. ✅
- A2UI schemas must be discriminated unions with `version: 'v0.9'` literal — not v1 all-optional transcription. (C1)
- `SessionCtx` forward refs (`AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, `AzureCredential`) must be resolved. (C2)
- `ComponentContribution.renderer` typed as `unknown` in harness — React-aware narrowing deferred to pack-core. (C3)
- `package.json` missing `zod` and `@openai/agents` as runtime dependencies. (C4)

## Archived History Note

For comprehensive work history prior to 2026-04-20, see git log and .squad/orchestration-log/. Recent sessions tracked above.

### Work queue unblocked

**Immediate (no dependencies):**
- **#998** (Bender) — Chat regression fix (S)
- **#995** (Fry) — Core tab rendering (M)
- **#997** (Fry) — Workspace layout (S)
- **#1001** (automated) — Merge ready

**Blocked on #991 merge:**
- **#987** (Fry) — Ideas tab restoration (M)

**Blocked on #998 resolution:**
- **#996** (Bender) — AKS inspiration prompt audit (M) [loose dependency; can start earlier if needed]

**Waiting on gate closure:**
- **#1000** — Pack rendering engine (Zapp + Nibbler approvals required)

---

**Decision closure:** Appended to `.squad/decisions/inbox/leela-round3-2026-04-21.md`

## 2026-04-21 — Round 3 Ceremony Closure + Post-Gate Decisions

**Five DPs Approved (2026-04-21T04:30Z):**
- #998 (chat regression, Bender, S, HIGH) → APPROVED + READY FOR IMPLEMENTATION
- #995 (Core rendering, Fry, M) → APPROVED + READY FOR IMPLEMENTATION
- #996 (AKS brittleness, Bender, M) → APPROVED but depends on #1000
- #997 (workspace black void, Fry, S) → APPROVED + READY FOR IMPLEMENTATION
- #987 (Ideas tab, Fry, M) → APPROVED but depends on #991 merge

**Two PRs Under Review:**
- **PR #1000** (pack rendering, #991) → **REJECTED** by Zapp + Nibbler. Red CI (TS2307/TS2352) + missing CI grep rule. Fry locked out; bender-1000-revise assigned to add CI step + allow-list comment.
- **PR #1001** (emit_ui fixture, #980) → ✅ **MERGED.** All gates green. Shipped explicit-op discriminator coverage.

**Process Milestone:**
- PR #993 (ceremony enforcement) merged (commit c90f5da). Mechanical 4-way gate + docs gate now active on all future PRs.
- All future PRs require: `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` ∨ `docs:not-applicable`) + green CI.
- No override path; gate is blocking at merge time.

**In-flight Dispatches:**
- bender-998 (chat fix, HIGH) — unblocked, implementation ready
- bender-1000-revise (pack rendering fix) — Reviewer Rejection Protocol applies; Fry locked out
- fry-995 (density bugs) — ready, unblocked
- fry-997 (black void) — ready, unblocked

**Key DP-Time Security Decisions:**
1. Structural invariant test for strict-mode schema compliance (Object.keys(properties) ⊆ required)
2. Ideas-tab curated-only model; future user-supplied inspirations will reopen threat
3. Composition-reliability harness constraints: fail-loud, ≤2 retries, redacted logs
4. DP-time conditions enforce at PR time non-negotiable (Reviewer Rejection Protocol on #1000 sets precedent)

## Learnings (2026-04-27 — Harness patterns audit against OpenAI Agents SDK)
- **Agent.asTool()** available in `@openai/agents-core` v0.8.4 — we don't use it. Critical gap for flexible triage orchestration.
- **Handoff input filters** (`handoff({ inputFilter })`) and `RunConfig.handoffInputFilter` — we pass full context on every handoff, causing token bloat.
- **RunConfig** has `callModelInputFilter`, `handoffInputFilter`, `inputGuardrails`, `outputGuardrails` — we use none of these. Wrapping our options in RunConfig is shovel-ready.
- **Our guardrails are home-rolled** in `guardrails.ts` — sequential, blocking. SDK-native guardrails run in parallel with agent inference.
- **MaxTurnsExceededError** — we catch generically, should handle specifically with user-friendly recovery.
- **History threading** — our `toAgentInputItems()` strips tool calls. SDK's `callModelInputFilter` is the right place for selective trimming.
- **useResponses: false** blocks tool search, hosted tools, server-managed history. Worth revisiting as Azure OpenAI v1 matures.
- **Deterministic chaining** (codesmith → reviewer → quality gate) and **LLM-as-Judge** are high-value patterns we don't implement.
- **Key files:** `runner.ts`, `guardrails.ts`, `schema-conformance.ts`, `agent-output.ts`, `triage.agent.md`
- **Decision written to:** `.squad/decisions/inbox/leela-harness-patterns-audit-2026-04-27.md`

## Learnings (2026-04-27 — PR Review Gate simplification, PR #80)
- **Phase split:** Amy's docs commits must precede approval reviews. Split gate into Phase 1 (Amy docs, parallel with CI) and Phase 2 (Nibbler + Zapp approval reviews). Phase 1 must fully complete before Phase 2 begins — this prevents post-approval commits from dismissing existing reviews.
- **Simplified gate:** `nibbler:approved` + `zapp:approved` are the required set. `leela:approved` is now conditional — only required for PRs with `architecture` label or touching pack boundaries.
- **Hermes removed from PR Review Gate:** Test coverage is enforced by CI status checks, not manual reviews. Hermes no longer participates in the PR Review Gate.
- **Duplicate-review guard added:** Before submitting a review, check `gh pr reviews {N}` for the current HEAD. Do not submit if a review already exists for that commit.
- **No-commit-after-approval rule added:** Once any Phase 2 approval is submitted, no further commits are permitted to the branch. Any needed commit restarts the cycle from Phase 1.
