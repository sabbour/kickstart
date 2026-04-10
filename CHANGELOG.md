# Kickstart Changelog

All notable changes to this project will be documented in this file.

This project uses [@changesets/cli](https://github.com/changesets/changesets) for versioning.

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
