---
sidebar_position: 3
---

# Project Structure

Kickstart is organized as an npm workspaces monorepo.

```
kickstart/
├── packages/
│   ├── harness/           # @kickstart/harness — runtime engine
│   │   └── src/
│   │       ├── runtime/   # Runner, session, skill resolver, SSE adapter
│   │       ├── a2ui/      # A2UI v0.9 message types and helpers
│   │       ├── mcp/       # MCP adapter utilities
│   │       └── types/     # Zod schemas (AgentOutput, pack primitives)
│   │
│   ├── pack-core/         # @kickstart/pack-core — base agents, skills, tools, components
│   │   └── src/
│   │       ├── agents/    # .agent.md files for triage, codesmith, reviewer
│   │       ├── skills/    # SKILL.md files
│   │       ├── tools/     # core.emit_ui, core.write_file, etc.
│   │       └── components/ # Basic + rich A2UI component renderers
│   │
│   ├── pack-azure/        # @kickstart/pack-azure — Azure agents, tools, user actions
│   ├── pack-aks-automatic/ # @kickstart/pack-aks-automatic — AKS Automatic deployment pack
│   ├── pack-github/       # @kickstart/pack-github — GitHub agents, tools, user actions
│   │
│   ├── web/               # @kickstart/web — React frontend + Azure Functions API
│   │   ├── src/           # React app source
│   │   │   ├── vendor/    # Vendored A2UI renderer
│   │   │   ├── components/ # App-shell components (Layout, Sidebar, Topbar, …)
│   │   │   ├── pages/     # Route-level pages (Chat, Playground, Landing, …)
│   │   │   └── hooks/     # React hooks (useStreaming, useActionDispatch, …)
│   │   ├── api/           # Azure Functions (SWA managed)
│   │   │   └── src/functions/  # converse.ts, resume.ts, packs.ts
│   │   └── package.json
│   │
│   └── mcp-server/        # @kickstart/mcp-server — MCP adapter wrapping the Runner
│       └── src/
│           └── index.ts   # MCP server entry point
│
├── docs-site/             # This documentation site (Docusaurus)
├── infra/                 # Azure infrastructure (Bicep)
├── .squad/                # AI team configuration (Squad framework)
├── package.json           # Root workspace config
├── tsconfig.json          # Shared TypeScript config
└── vitest.config.ts       # Test configuration
```

## Package Details

### `packages/harness`

The domain-agnostic runtime. Manages pack registration, runs agents via the `@openai/agents` SDK, streams typed SSE events, mediates A2UI, enforces guardrails. Does not know about Azure, AKS, or GitHub — packs carry all product knowledge.

### `packages/pack-core`

The base pack. Contributes the core agents (triage, codesmith, reviewer), cross-cutting skills (file generation, code review), basic tools (`core.emit_ui`, `core.write_file`, `core.read_file`, etc.), and the full A2UI component catalog.

### `packages/pack-azure` / `pack-aks-automatic` / `pack-github`

Domain packs. Each contributes agents, skills, tools, user actions, and components for its domain.

### `packages/web`

The frontend application and API layer. React 19 + Vite 6 SPA with Azure Functions backend. The web client reads the negotiated catalog from `GET /api/packs` at startup and dispatches user actions through `useActionDispatch`.

### `packages/mcp-server`

MCP adapter wrapping the Runner. Exposes Kickstart turns to MCP-compatible clients (Claude Code, Cursor, and other stdio-based MCP hosts).

### `docs-site`

This Docusaurus documentation site. Independent from the main monorepo (not in workspaces).

### `infra`

Azure infrastructure definitions using Bicep templates. Deploys the Static Web App, Azure OpenAI resource, and related infrastructure.
