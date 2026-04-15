---
sidebar_position: 1
---

# Extending Kickstart

Kickstart is built to be extended. Every major system surface has a defined extension point — no forking required. Whether you want to add a new guided conversation phase, expose a new function to the LLM, or bundle an entire third-party integration, there's a clean contract for doing it.

## Extension Points

| Extension Point | What You're Adding | Where It Lives |
|---|---|---|
| [Conversation Phases](./conversation-phases.md) | A new guided step in the AI flow | `packages/core/src/engine/` |
| [LLM Tools](./llm-tools.md) | A new function the AI can call | `packages/core/src/tools/` |
| [Integration Kits](./integration-kits.md) | A composable bundle of tools, connectors, prompts, and skills | `packages/core/src/kits/` |
| [API Endpoints](./api-endpoints.md) | A new Azure Functions endpoint (optionally SSE-streaming) | `packages/web/api/src/functions/` |
| [MCP Tools](./mcp-tools.md) | A new tool for VS Code Copilot / Claude Code IDE integration | `packages/mcp-server/src/tools/` |

## Architecture Overview

Kickstart's extensibility is layered. Most changes flow through the **core package** (`packages/core`), which is shared by both the web API and the MCP server.

```
packages/
├── core/                    ← Shared engine: phases, tools, kits, prompts
│   └── src/
│       ├── engine/          ← Phase state machine, skill resolver
│       ├── tools/           ← LLM tool registry
│       ├── kits/            ← Integration kit registry
│       └── prompts/         ← System prompt builder
├── web/
│   └── api/src/functions/   ← Azure Functions HTTP endpoints
└── mcp-server/src/          ← MCP server for IDE clients
```

## Where to Start

- **Adding a new AI capability?** → [LLM Tools](./llm-tools.md) is the fastest path. Create one file, register it, done.
- **Adding an end-to-end integration** (e.g., a new cloud provider)? → [Integration Kits](./integration-kits.md) lets you bundle tools + connectors + prompts into one unit.
- **Adding a new guided workflow step?** → [Conversation Phases](./conversation-phases.md) walks you through the phase state machine.
- **Exposing a new HTTP surface?** → [API Endpoints](./api-endpoints.md) covers the Azure Functions v4 pattern with SSE streaming.
- **Extending IDE integration?** → [MCP Tools](./mcp-tools.md) covers the MCP server pattern for VS Code Copilot and Claude Code.

## Design Principles

**First-party only.** There is no plugin sandbox or dynamic loading — all extensions are compiled into the package. This keeps the trust model simple: anything registered is trusted code.

**Composition over inheritance.** Integration Kits wire into the ToolRegistry, ConnectorRegistry, and SkillResolver automatically. You define the what; the system handles the wiring.

**Phase-aware.** Skills and prompts can be scoped to specific phases. An LLM tool registered for the `generate` phase doesn't appear in `discover` phase conversations.

**SSE-first.** Long-running AI operations use Server-Sent Events. New endpoints that call the LLM should follow the same streaming pattern as `converse` and `generate`.
