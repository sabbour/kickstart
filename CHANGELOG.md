# Kickstart Changelog

All notable changes to this project will be documented in this file.

This project uses [@changesets/cli](https://github.com/changesets/changesets) for versioning.

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
