---
sidebar_position: 2
---

# Project Structure

Kickstart is organized as an npm workspaces monorepo.

```
kickstart/
├── packages/
│   ├── core/              # AI engine — phases, prompts, state machine, catalog
│   │   ├── src/
│   │   │   ├── phases/    # Conversation phase definitions
│   │   │   ├── prompts/   # System prompt templates
│   │   │   ├── catalog/   # A2UI component catalog definitions
│   │   │   └── index.ts   # Package entry point
│   │   └── package.json
│   │
│   └── web/               # React frontend + Azure Functions API
│       ├── src/            # React app source
│       │   ├── vendor/     # Vendored A2UI v0.9 renderer
│       │   ├── components/ # React components
│       │   └── App.tsx     # Root component
│       ├── api/            # Azure Functions (SWA managed)
│       │   └── chat/       # /api/chat endpoint
│       ├── css/            # Fluent 2 stylesheets
│       ├── public/         # Static assets (icons, favicon)
│       ├── dist/           # Vite build output
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

- **Phase definitions** — the 6-phase conversation flow (Discover → Design → Generate → Review → Handoff → Deploy)
- **System prompts** — templates that instruct the LLM on response format, tone, and behavior
- **A2UI catalog** — component type definitions for the custom Kickstart catalog
- **State machine** — tracks conversation phase transitions

This package has no UI dependencies and can be used independently.

### `packages/web`

The frontend application and API layer. Contains:

- **React SPA** — the main user interface, built with React 19 and Vite 6
- **A2UI renderer** — vendored `@a2ui/react` v0.9 in `src/vendor/a2ui/`
- **Azure Functions** — the `/api/chat` endpoint in `api/`
- **Styles** — Fluent 2 design tokens in `css/`

### `docs-site`

This Docusaurus documentation site. Independent from the main monorepo (not in workspaces).

### `infra`

Azure infrastructure definitions using Bicep templates. Deploys the Static Web App, Azure OpenAI resource, and related infrastructure.
