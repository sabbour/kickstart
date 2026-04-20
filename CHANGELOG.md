# Kickstart Changelog

All notable changes to this project will be documented in this file.

This project uses [@changesets/cli](https://github.com/changesets/changesets) for versioning.

## [1.0.1] - 2026-04-20

### Fixed

- Resolved bundled pack asset path collision causing chat endpoint 404 in production. Asset manifests now load correctly from pack-scoped directories.

## [1.0.0] - 2026-04-20

### Breaking changes

- Kickstart now treats the harness plus packs runtime as the supported product baseline. Remaining v1 compatibility stubs, docs, and extension guidance are no longer part of the shipped surface.

### Added

- `@kickstart/harness` as the shared runtime for sessions, SSE streaming, pack registration, guardrails, and MCP integration.
- First-party pack composition with `pack-core`, `pack-azure`, `pack-aks-automatic`, and `pack-github`.
- A retained MCP surface that runs the same harness runtime as the web app.
- A refreshed public docs set for pack authoring, API endpoints, deployment, and current repository structure.

### Changed

- Public and engineering docs now describe the harness plus packs architecture as the current product, not an in-progress rewrite.
- Release prep guidance now assumes a curated `v1.0.0` release PR instead of informal v0.x milestone notes.
- Canonical architecture guidance now points to the harness runtime, pack manifests, and current Azure Functions endpoints.

### Fixed

- Bundled API output now ships pack runtime assets into the dist layout expected at runtime, fixing `/api/converse` failures and `Unknown agent: core.triage` in deployed environments.
- Server-safe pack manifests and startup registration are now aligned between the web API and MCP server boot paths.
- The web client now includes the Fluent dark-mode send icon fix, session-expiry redirect handling, and Monaco/Vite 8 compatibility updates.
- Removed stale references to retired v1 docs, JSON-envelope response handling, and legacy extension guidance across the repo docs and docs site.

### Removed

- Remaining v1 compatibility stubs and legacy docs surfaces that duplicated or contradicted the current docs site.

### Security

- Release documentation now reflects the current guardrail pipeline, browser-mediated user actions, and resume-token validation model instead of older optimistic descriptions.

## [0.7.0] - 2026-04-15

### Added

- **Stepwise setup generation** — Codex-backed setup execution now streams progress in chat while delivering generated files directly into the workspace/file manager. (#336, #337)
- **Real Azure deployment lane** — Kickstart now includes the real Azure deployment path with deploy UI, auth boundary coverage, and deployment health-check hardening. (#301)
- **Real GitHub handoff flow** — Project handoff now supports the real GitHub ship/repo flow instead of placeholder behavior. (#274)
- **Live pricing + token usage tracking** — Chat sessions now surface Azure pricing data and per-session token usage/cost tracking. (#272, #277)
- **Workspace and diagram upgrades** — Generated-file routing, file manager UX, and ArchitectureDiagram rendering depth all improved significantly. (#252, #265, #314)

### Changed

- **Generate routing and progressive flow** — Generate-phase routing now prefers codex-backed execution and the progressive conversation/setup flow is more resilient end-to-end. (#266, #275, #278)
- **Prompt and diagram narrative alignment** — System prompts and diagram rendering are more closely aligned with the Try-AKS narrative and richer architecture output. (#278, #300, #314)

### Fixed

- **File/workspace artifact stability** — Fixed the setup/file rendering regressions, file-surface duplication, and chat/file ownership issues around generated artifacts. (#334, #336, #337)
- **Runtime and deployment hardening** — Fixed CostEstimate compatibility, hotspot robustness, SWA/API startup hygiene, false heartbeat failures, and Azure/GitHub deployment-path error handling. (#312, #317, #320, #324)
- **Security and debug hardening** — Strengthened action-context sanitization, ArchitectureDiagram safety, and raw/debug output handling. (#250, #263, #300)
- **UI and session polish** — Fixed assorted issues across session rehydration, streaming, buttons, tabs, code blocks, topbar polish, and general chat rendering behavior. (#239, #243, #244, #248, #291, #294)

## [0.6.0] - 2026-04-14

### Added

- **Guided onboarding tour** — 4-step tooltip tour for first-time users with SVG spotlight overlay, skip/next navigation, and localStorage persistence (#187)
- **Public Copilot skill system** — Build-time bundling pipeline for public Copilot extension skills with security policy, frontmatter parsing, knowledge extraction, and phase mapping (#186)
- **Copilot Skills Registry** — 5 pre-configured Azure extension skills (AKS, App Service, Functions, Container Apps, Azure SQL) with keyword-based resolution from conversation history (#186)
- **Browser back button** — Hash-based navigation with History API; deep links via `#session/{id}`, back button returns to landing (#211)
- **Azure Retail Pricing API** — Live Azure pricing data integration for CostEstimate component (#189)
- **Continue button** — Auto-selection affordance for ChoicePicker with Continue button (#190)
- **Expanded playground** — 10 new scenarios: file operations (single/multi-file editors, create/edit/delete), cost estimate, and full multi-phase demo (Discover → Design → Generate → Review → Deploy) (#174, #188)
- **Dynamic A2UI catalog** — Component catalog auto-generated in system prompt from Zod schemas, keeping LLM examples in sync with code (#185)

### Fixed

- **UI freeze after selection** — Removed `pointerEvents: 'none'` on past messages that trapped cursor after clicking A2UI components (#205)
- **ChoicePicker visual selection** — Radio buttons and checkboxes now visually fill on click; single clean chat message instead of duplicates (#208)
- **A2UI surfaces lost on reload** — Raw A2UI messages persisted and replayed on session resume; FileEditor highlighting restored (#193, #200)
- **Interactive choice components** — LLM now always uses Buttons/RadioGroup/ChoicePicker for questions with finite options (#213)
- **Action context enrichment** — Selection messages show human-readable values (e.g., "Web API") instead of raw metadata (#214)
- **Debug panel raw JSON** — Shows parsed LLM output instead of JSON envelope (#198)
- **Selection message text** — Removed "I chose" prefix; shows just the selected value (#224)
- **CodeBlock + Home + Delete** — Syntax highlighting with highlight.js, home button navigation, session delete (#167, #173, #178)
- **Heartbeat workflow** — Added missing `github-token` input to `actions/github-script@v7` (#226)

## [0.5.7] - 2026-04-14

### Added

- **Continuous SWA deployment** — Merge to `main` now auto-deploys to Azure Static Web Apps; version-SHA footer link added (#177)

### Fixed

- **A2UI v0.9 wire format (P0)** — Adopted official nested wire format (`{version:"v0.9", createSurface:{...}}`) end-to-end, fixing all A2UI component rendering (#166, #184)
- **A2UI interactivity** — Interactive components (ChoicePicker, CheckBox, Toggle, ComboBox, MultiSelect) now fire action events via `ActionSchema`; `onAction` callback wired through component chain (#192, #195)
- **SSE event parsing** — Fixed sticky `eventType` bug, JSON envelope extraction, and duplicate A2UI message accumulation (#179, #180)
- **Integration Kit visibility** — Kit card carousel animation and debug panel fixes (#168, #170, #175)
- **Version SHA footer** — Topbar footer now shows clickable commit SHA linking to GitHub (#181)
- **Auth-aware sign-in** — Sign-in button reflects authentication state (#169)
- **Clear All confirmation** — Added confirmation dialog before clearing all sessions (#172)
- **Folder icon** — Restored files/folder icon in sidebar (#171)
- **Phase indicator** — Added visual phase progress indicator (#182)

## [0.5.6] - 2026-04-14

### Fixed

- **Sign-in button** — Topbar sign-in now redirects to AAD login with Microsoft branding (#158)
- **SVG backgrounds** — Fixed CSS paths for light/dark hero backgrounds in chat UI (#159)
- **Dark mode playground** — Replaced hardcoded hex colors with theme variables, fixed code block inversion (#161)
- **IndexedDB filesystem** — File tree panel now visible with create/edit/navigate, path validation + quota limits (#147)
- **System prompts** — Redesigned phase prompts to enforce A2UI component output every turn (#145)
- **Prompt injection boundary** — Added boundary markers + A2UI payload validation in response processor (#153)
- **CodeBlock styling** — Added syntax highlighting with highlight.js + fixed thick black border (#148)
- **FileEditor prop** — Aligned schema prop `fileName` → `filename` to match core catalog (#141)
- **AuthCard adapter** — Added adapter dispatching to Azure/GitHub login providers (#150)
- **Integration Kit scenarios** — Added Azure/GitHub AuthCard playground scenarios (#142)

## [0.5.5] - 2026-04-13

### Added

- **Dark mode hero background SVG** — New `hero-bg-dark.svg` with deep navy/indigo palette, CSS swap via `[data-theme="dark"]`
- **Squad extension package** — New `.squad/extensions/kickstart-aks-dev/` with 6 skills (A2UI components, debug mode, PR workflow, release process, SWA deployment, testing strategy), 2 ceremonies (design review, retrospective), and 1 directives file (project conventions)

### Fixed

- **CSP violation: CDN script removal** — Removed dead `@fluentui/web-components` CDN script from `index.html` (app uses npm `@fluentui/react-components` instead)
- **CSP violation: inline BUILD_SHA migration** — Migrated inline `__BUILD_SHA__` script to Vite `define()` — no more `unsafe-inline` needed
- **Dead CI step removed** — Removed "Stamp build metadata" step from `deploy-swa.yml` (both `sed` commands replaced by Vite define)
- **Dead E2E route handler** — Removed unpkg route handler from `helpers.ts`

### Changed

- **Squad framework upgraded** — Updated to v0.9.1-build.6
- **Decisions archived** — `decisions.md` archived (213KB → 90KB), agent histories summarized

## 0.5.3

### Bug Fixes

- **Debug panel model leak** — Model name no longer shown as plain text outside the debug panel; only visible inside the expandable accordion
- **Render decisions populated** — Fixed `renderDecisions` nesting bug (was inside `debug` object, now top-level in SSE data) and type mismatch (objects → formatted strings). Debug panel now shows actual A2UI pipeline decisions per message.

## 0.5.2

### Features

- **Debug mode** — Toggle with `?debug=true` URL param or `Ctrl+Shift+D`; shows 🐛 badge when active
- **Per-message debug panel** — Expandable debug section below each assistant message showing model name, raw LLM response, and rendering engine decisions
- **Debug metadata API** — SSE endpoints include `model`, `rawContent`, and `renderDecisions` when `x-kickstart-debug: true` header or `?debug=true` query param is set

## 0.5.1

### Bug Fixes

- **Footer version display** — Version now injected from `package.json` at build time via Vite `define()`, replacing hardcoded `v0.1.0` (#133)

### Features

- **IndexedDB virtual filesystem** — File tree panel with Monaco editor, virtual FS backed by IndexedDB (#125)

## 0.5.0

### Validation & Security

- **K8s validation engine** — 23 validators (DS001–DS020) with auto-fix engine, post-generation injection, and `RulesEngine` categorized filtering (#127, #128)
- **Full DS001–DS013 safeguards** — Resource limits, no-latest-tag, health probes, no-privileged, namespace, replicas, image-pull-policy, run-as-non-root, no-privilege-escalation, no-host-networking, read-only-root-fs, gateway-api-ingress, no-image-pull-secrets (#36)
- **Rules engine validators DS014–DS020** — Container port names, drop-all-capabilities, label requirements, no-host-IPC/PID, service account token, topology spread constraints (#49)

### Frontend

- **State binding & data interpolation** — JSON Pointer resolution with defaults, template interpolation with `{{/path|fallback}}` syntax, chained pointer resolution with cycle detection, batch binding, cross-component data flow analysis (#122)
- **Theme system** — Three-state dark/light/system mode with `useSyncExternalStore`, live OS preference tracking, `ThemeToggle` component, smooth CSS transitions (#129)
- **WCAG 2.1 AA accessibility** — Audited 46 A2UI components, fixed 15 across 16 files with ARIA labels, keyboard nav, roving tabIndex, aria-live regions (#124)
- **Frontend Wave 2** — Inspiration button, URL links, 5 new Fluent components (#118)
- **FileEditor + CostEstimate** — Monaco tabs, SKU selector with cost projection (#115)

### Backend & Infrastructure

- **Remote filesystem abstraction** — Pluggable `FileSystemProvider` interface with `InMemoryFileSystemProvider`, `CloudShellProvider`, path sanitization, 4 LLM tools (`fs_read/write/list/delete`) (#123)
- **Knowledge skills middleware** — Async middleware chain for skill resolution with 5 IaC best-practice skills (Bicep modules, secure decorators, diagnostic settings, resource tagging, RBAC) (#119)
- **Artifact store** — Per-session `InMemoryArtifactStore` with quota enforcement (100 artifacts / 10MB), `ToolContext` pattern (#116)

### Bug Fixes

- **Failed-to-fetch auth fix** — `apiFetch()` wrapper with `redirect: 'manual'` prevents SWA auth redirect CORS failures, `SessionExpiredError` with auto-redirect (#131)

### Docs & Tooling

- **A2UI v0.9 component authoring skill** — SKILL.md for agent-authored components (#113)
- **Copilot coding agent instructions** — Squad-aware `copilot-instructions.md` with capability profile (#120)

## 0.4.0

### Knowledge & Prompts

- **System prompt rules** — Self-contained components, JSON validation, no pre-selection, architect mindset (#6, #10, #11, #15)
- **AKS Automatic knowledge block** — Detailed feature overview with YAML examples and pricing details (#7, #14)
- **ARM PUT body templates** — Common Azure resources with body schema guidance for githubKit code generation (#8)
- **Existing-repo analysis protocol** — Structured discovery of existing repos for githubKit Discover phase (#17)

### Frontend

- **Fluent UI v9 overhaul** — All 18 A2UI basic components upgraded to Fluent v9 with updated API surface (#57)
- **New catalog components** — Table, Alert, Link with Fluent v9 integration and Storybook stories (#9)
- **VS Code SVG icons** — Proper VS Code / VS Code Insiders logos, replacing generic icon placeholders (#106)
- **Dark mode CSS removal** — Simplified docs site CSS, removed unused dark-mode-in-JS patterns (#55)

### Docs

- **README and architecture docs** — Updated for v0.3.0 patterns and A2UI component usage (#52)

## 0.3.0

### Features

- **IntegrationKit ServicePack** — Extensible kit system with auth requirements, dependency validation, lifecycle hooks, and security hardening (#30, PR #103)
- **Azure A2UI Smart Components** — Self-managing AzureLoginCard, AzureResourcePicker, AzureResourceForm, AzureAction with MSAL auth and ARM validation (#31, PR #104)
- **GitHub A2UI Smart Components** — Self-managing GitHubLoginCard, GitHubRepoPicker, GitHubAction, GitHubCommit with device-code auth and operation allowlisting (#32, PR #105)
- **ServiceConnector Pattern** — BaseConnector with token provider injection, retry, CORS proxy (#25, PR #96)
- **LLM Tool System** — Function calling with ToolRegistry, approval gates, and security restrictions (#26, PR #100)
- **VSCode Launch Buttons** — Quick-launch buttons for VSCode/Insiders with MCP server install (#44, PR #94)
- **CORS Proxy Security** — Host allowlist, GitHub OAuth path restrictions, auto-continue middleware (#34, #37, PR #97)

### Process

- Design Proposal (DP) 3-step gate workflow
- CI path filters for docs/infra-only changes
- Proper semver versioning (#101, #102)

## 0.2.0

### @kickstart/web

- **Sidebar layout** — Playground restructured with A2UI Composer sidebar navigation (#59)
- **Action system** — End-to-end button→API→handler pipeline: wire action handler (#22), /api/action endpoint (#23), unified ActionSchema format (#24)
- **Questionnaire + Markdown components** — New A2UI catalog components for guided flows (#2)
- **Playwright E2E tests stabilized** — 15 tests updated to match current UI (#69)
- **TypeScript CI errors resolved** — ~50 pre-existing errors fixed, CI pipeline now green (#67)
- **Playground link fix** — README uses full URL for playground (#71)

### @kickstart/core

- **Prompt knowledge updates** — KAITO/RAGEngine/Fine-Tuning knowledge ported to azureKit (#27), OIDC pipeline protocol added to githubKit (#28), false secrets claim fixed (#29), component props documented (#3)

### Tooling

- **Changesets & releases strategy** — Configured @changesets/cli with GitHub changelog integration (#53)
- **PR workflow skill** — Consolidated issue→branch→PR→review→merge lifecycle into a single reference document

## 0.1.0 — Initial Scaffold

### @kickstart/core

- 6-phase conversation engine (Discover → Design → Generate → Review → Handoff → Deploy)
- A2UI component catalog with 7 custom components (ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard)
- Kubernetes manifest and GitHub Actions code generators
- JSON envelope format for structured LLM output

### @kickstart/web

- React 19 + Vite 6 + TypeScript scaffold
- @a2ui/react v0.9 integration with Fluent UI v9 theming
- Azure Portal-style UX with chat UI, session management, and message history
- Demo mode with pre-canned sample conversations
- 5-tab playground (Create, Gallery, Components, Icons, Widgets)
- 18 Fluent UI v9 component overrides and 5 custom A2UI components

### @kickstart/mcp-server

- MCP server with 4 tools (kickstart, generate-manifests, check-status, action)
- A2UI responses via `application/json+a2ui` MIME type
- Depends on @kickstart/core for engine and catalog

### Infrastructure

- Azure Static Web Apps deployment via GitHub Actions
- Bicep templates for SWA Standard tier
- Entra ID app registration for auth (PKCE flow)
