---
sidebar_position: 1
---

# Architecture Overview

Kickstart is a monorepo with three packages — a shared core engine, a React web app, and an MCP server for IDE integration. The web surface runs on Azure Static Web Apps with a managed functions backend.

## Monorepo Structure

```
kickstart/
├── packages/
│   ├── core/         @kickstart/core — shared TypeScript engine
│   │   ├── artifacts/     ArtifactStore (generated file management)
│   │   ├── connectors/    APIConnector implementations + registry
│   │   ├── engine/        Conversation FSM + Skill Resolver
│   │   ├── generators/    Dockerfile, manifest, CI/CD generators
│   │   ├── kits/          IntegrationKit definitions + registry
│   │   ├── prompts/       3-layer prompt system
│   │   ├── tools/         ToolRegistry + 7 built-in tools
│   │   └── validation/    ValidationEngine + 7 validators
│   ├── web/          @kickstart/web — React 19 + Vite 6 portal
│   │   ├── api/           Azure Functions (7 endpoints)
│   │   └── src/
│   │       ├── catalog/   A2UI catalog (16 custom components)
│   │       ├── components/  Chat, FileEditor, Landing
│   │       └── vendor/    Vendored A2UI v0.9 runtime
│   └── mcp-server/   @kickstart/mcp-server — IDE integration
└── infra/            Bicep templates + setup scripts
```

## System Components

```
┌─────────────────────────────────────────────────────────┐
│  Browser (SPA)                                          │
│  React 19 + Vite 6 + TypeScript                        │
│  A2UI v0.9 React Renderer + Fluent 2                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (SSE + JSON)
┌────────────────────▼────────────────────────────────────┐
│  Azure Static Web App                                   │
│  ├─ Static hosting (React build)                        │
│  └─ Managed Functions (API)                             │
│       ├─ /api/converse  → Azure OpenAI proxy            │
│       ├─ /api/action    → A2UI action processing        │
│       ├─ /api/generate  → Codex code generation         │
│       ├─ /api/github-proxy → GitHub API proxy           │
│       ├─ /api/pricing-proxy → Azure Pricing API proxy   │
│       └─ /api/health       → Health check               │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│  Azure OpenAI Service + External APIs                   │
│  GPT-4o (conversation) + Codex (code gen)              │
│  Azure ARM + GitHub REST + Azure Pricing                │
└─────────────────────────────────────────────────────────┘
```

### Frontend

- **React 19** with TypeScript, bundled by **Vite 6**
- Deployed as static content of an Azure Static Web App
- Uses the vendored **A2UI v0.9** React renderer to display structured AI output
- Fluent 2 design tokens for consistent Microsoft look and feel
- **16 custom Kickstart components** in the A2UI catalog

### Backend

- **Azure Functions** (SWA managed functions)
- `/api/converse` — conversation proxy to Azure OpenAI
- `/api/action` — A2UI action event processing
- `/api/generate` — Codex-powered code generation
- `/api/github-proxy`, `/api/pricing-proxy` — CORS proxies
- `/api/health` — health check

### Core Engine (`@kickstart/core`)

- **6-phase conversation FSM** (Discover → Design → Generate → Review → Handoff → Deploy)
- **IntegrationKit pattern** — kits bundle tools, connectors, and prompts
- **ToolRegistry** — 7 built-in LLM-callable tools
- **APIConnectorRegistry** — authenticated API clients (Azure ARM, GitHub, Pricing)
- **ArtifactStore** — in-memory store for generated deployment files
- **ValidationEngine** — 7 validators that check artifacts before deployment
- **Skill Resolver** — injects per-phase kit prompts into the system prompt

### AI Engine

- **Azure OpenAI** GPT-4o for conversation, Codex for code generation
- 3-layer prompt system: IntegrationKit skills → System prompt → Phase prompts
- 13 deployment safeguards (DS001–DS013) enforced across all phases

## Request Flow

```
User types message
    → React sends POST to /api/converse (with sessionId)
    → SWA Function initialises/looks up session state
    → Skill Resolver injects phase-relevant kit prompts
    → Azure OpenAI returns structured response
    → Response processor extracts A2UI components
    → SSE stream returns text chunks + final A2UI JSON
    → React renders A2UI components from kickstartCatalog
```

Each conversation turn preserves the full message history, allowing the AI to maintain context across all 6 phases.
