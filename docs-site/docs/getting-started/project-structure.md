---
sidebar_position: 2
---

# Project Structure

Kickstart is organized as an npm workspaces monorepo.

```
kickstart/
├── packages/
│   ├── core/              # AI engine — phases, prompts, catalog, tools
│   │   ├── src/
│   │   │   ├── engine/    # Phase definitions, state, skill resolver
│   │   │   │   └── phases.ts  # Conversation phase definitions
│   │   │   ├── prompts/   # System prompt templates
│   │   │   ├── catalog/   # A2UI component catalog definitions
│   │   │   ├── tools/     # LLM tool definitions
│   │   │   └── index.ts   # Package entry point
│   │   └── package.json
│   │
│   ├── web/               # React frontend + Azure Functions API
│   │   ├── src/            # React app source
│   │   │   ├── vendor/     # Vendored A2UI renderer
│   │   │   ├── catalog/    # A2UI catalog component implementations
│   │   │   │   └── components/  # Rendered A2UI components (CodeBlock, AuthCard, …)
│   │   │   ├── components/ # App-shell components (Layout, Sidebar, Topbar, …)
│   │   │   ├── pages/      # Route-level pages (Chat, Playground, Landing, …)
│   │   │   ├── hooks/      # React hooks (useStreaming, useNavigation, …)
│   │   │   └── App.tsx     # Root component
│   │   ├── api/            # Azure Functions (SWA managed)
│   │   │   └── src/
│   │   │       └── functions/  # Individual function handlers
│   │   │           └── converse.ts  # /api/converse endpoint
│   │   ├── public/         # Static assets (icons, favicon)
│   │   ├── dist/           # Vite build output
│   │   └── package.json
│   │
│   └── mcp-server/        # MCP server — exposes Kickstart tools via Model Context Protocol
│       ├── src/
│       │   ├── app/        # Server bootstrap and protocol handler
│       │   ├── tools/      # MCP tool implementations
│       │   └── index.ts    # Package entry point
│       └── package.json
│
├── docs-site/              # This documentation site (Docusaurus)
├── infra/                  # Azure infrastructure (Bicep)
├── .squad/                 # AI team configuration (Squad framework)
├── package.json            # Root workspace config
├── tsconfig.json           # Shared TypeScript config
└── vitest.config.ts        # Test configuration
```

## Package Details

### `packages/core`

The AI engine package. Contains:

- **Phase definitions** — the 6-phase conversation flow (Discover → Design → Generate → Review → Handoff → Deploy), defined in `src/engine/phases.ts`
- **System prompts** — templates that instruct the LLM on response format, tone, and behavior
- **A2UI catalog** — component type definitions for the custom Kickstart catalog
- **LLM tools** — tool definitions used by the AI engine

This package has no UI dependencies and can be used independently.

### `packages/web`

The frontend application and API layer. Contains:

- **React SPA** — the main user interface, built with React 19 and Vite 6
- **A2UI renderer** — vendored renderer in `src/vendor/`
- **Catalog components** — A2UI component implementations in `src/catalog/components/`
- **Azure Functions** — the `/api/converse` endpoint in `api/src/functions/converse.ts`

### `packages/mcp-server`

The Model Context Protocol (MCP) server. Exposes Kickstart's AI tools to MCP-compatible clients (e.g. GitHub Copilot, Claude Desktop). Lives alongside `core` and `web` in the monorepo.

### `docs-site`

This Docusaurus documentation site. Independent from the main monorepo (not in workspaces).

### `infra`

Azure infrastructure definitions using Bicep templates. Deploys the Static Web App, Azure OpenAI resource, and related infrastructure.
