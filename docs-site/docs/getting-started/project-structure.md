---
sidebar_position: 2
---

# Project Structure

Kickstart is organized as an npm workspaces monorepo.

```
kickstart/
├── packages/
│   ├── harness/           # @aks-kickstart/harness — runtime engine
│   │   └── src/
│   │       ├── runtime/   # Runner, session, skill resolver, SSE adapter
│   │       ├── a2ui/      # A2UI v0.9 message types and helpers
│   │       ├── mcp/       # MCP adapter utilities
│   │       └── types/     # Zod schemas (AgentOutput, pack primitives)
│   │
│   ├── pack-core/         # @aks-kickstart/pack-core — base agents, skills, tools, components
│   │   └── src/
│   │       ├── agents/    # .agent.md files for triage, codesmith, reviewer
│   │       ├── skills/    # SKILL.md files
│   │       ├── tools/     # core.emit_ui, core.write_file, etc.
│   │       └── components/ # Basic + rich A2UI component renderers
│   │
│   ├── pack-azure/        # @aks-kickstart/pack-azure — Azure agents, tools, user actions
│   ├── pack-aks-automatic/ # @aks-kickstart/pack-aks-automatic — AKS Automatic deployment pack
│   ├── pack-github/       # @aks-kickstart/pack-github — GitHub agents, tools, user actions
│   │
│   ├── web/               # @aks-kickstart/web — React frontend + Azure Functions API
│   │   ├── src/           # React app source
│   │   │   ├── vendor/    # Vendored A2UI renderer
│   │   │   ├── components/ # App-shell components (Layout, Sidebar, Topbar, …)
│   │   │   ├── pages/     # Route-level pages (Chat, Playground, Landing, …)
│   │   │   └── hooks/     # React hooks (useStreaming, useActionDispatch, …)
│   │   ├── api/           # Azure Functions (SWA managed)
│   │   │   └── src/functions/  # converse.ts, resume.ts, packs.ts
│   │   └── package.json
│   │
│   └── mcp-server/        # @aks-kickstart/mcp-server — MCP adapter wrapping the Runner
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

MCP adapter wrapping the Runner. Exposes Kickstart turns to MCP-compatible clients (VS Code Copilot, Claude Code). A2UI surfaces emitted as MCP embedded resources with `mimeType: "application/json+a2ui"`.

### `docs-site`

This Docusaurus documentation site. Independent from the main monorepo (not in workspaces).

### `infra`

Azure infrastructure definitions using Bicep templates. Deploys the Static Web App, Azure OpenAI resource, and related infrastructure.
