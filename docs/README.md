# Kickstart Documentation

Welcome to the Kickstart docs — the AI-guided onboarding experience for deploying apps to AKS Automatic. Learn about architecture, APIs, components, and deployment.

## Contents

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System overview, conversation phases, IntegrationKit/ServicePack pattern, tool system, fat components, CORS proxy security |
| [API Reference](./api-reference.md) | REST API endpoints, request/response schemas, streaming, error handling |
| [A2UI Catalog](./a2ui-catalog.md) | Kickstart custom components, fat A2UI components, vendor basics, adding new components |
| [MCP Server](./mcp-server.md) | IDE integration for VS Code Copilot and Claude Code |
| [Prompt Architecture](./prompt-architecture.md) | 3-layer system prompt, skill resolver, phase-specific augmentations |
| [Extending Kickstart](./extending.md) | How to add phases, LLM tools, integration kits, API endpoints, and MCP tools |
| [Deployment Guide](./deployment.md) | Azure resource setup, Bicep templates, CI/CD workflows |
| [Development](./development.md) | Local development, testing, debugging |
| [Contributing](../CONTRIBUTING.md) | Dev setup, project structure, code style |
| [Infrastructure](../infra/README.md) | Azure deployment (Bicep templates, Entra setup) |

## Key Concepts

### v0.3.0 Architecture Highlights

- **ServicePack Pattern** — Declarative auth requirements, kit lifecycle hooks, transactional registration with rollback
- **Fat A2UI Components** — Self-managing Azure login, GitHub login, resource pickers with built-in security (in-memory tokens, operation allowlisting)
- **LLM Function Calling** — 9 built-in tools enable the LLM to query Azure/GitHub and fetch web pages
- **CORS Proxy Security** — Private IP filtering, redirect validation, hostname allowlisting for safe cross-origin calls
- **Service Pattern** — ServiceConnectors handle API authentication and provide domain-specific methods

## Quick Links

- **Monorepo packages:** [`packages/core`](../packages/core), [`packages/web`](../packages/web), [`packages/mcp-server`](../packages/mcp-server)
- **IntegrationKits:** [`packages/core/src/kits/`](../packages/core/src/kits/)
- **A2UI Components:** [`packages/web/src/catalog/`](../packages/web/src/catalog/)
- **Prompt system:** [`packages/core/src/prompts/`](../packages/core/src/prompts/)
- **Tool Registry:** [`packages/core/src/engine/tool-registry.ts`](../packages/core/src/engine/tool-registry.ts)
- **MCP tools:** [`packages/mcp-server/src/tools/`](../packages/mcp-server/src/tools/)
