---
sidebar_position: 1
---

# Architecture Overview

Kickstart v2 is a **harness + packs** system. The harness is domain-agnostic; packs carry all product knowledge.

## Monorepo Structure

```
kickstart/
├── packages/
│   ├── harness/           @kickstart/harness — runtime engine
│   │   └── src/
│   │       ├── runtime/       Runner, session, SSE adapter
│   │       ├── a2ui/          A2UI v0.9 message types and helpers
│   │       ├── mcp/           MCP adapter utilities
│   │       └── types/         Shared Zod schemas (AgentOutput, etc.)
│   ├── pack-core/         @kickstart/pack-core — base agents, skills, tools, components
│   ├── pack-azure/        @kickstart/pack-azure — Azure agents, tools, user actions
│   ├── pack-aks-automatic/ @kickstart/pack-aks-automatic — AKS Automatic deployment pack
│   ├── pack-github/       @kickstart/pack-github — GitHub agents, tools, user actions
│   ├── web/               @kickstart/web — React SPA + Azure Functions API
│   │   ├── api/               Azure Functions (converse, resume, packs manifest)
│   │   └── src/               React app, A2UI renderer, catalog components
│   └── mcp-server/        @kickstart/mcp-server — MCP adapter for IDE clients
└── infra/                 Bicep templates for Azure provisioning
```

## The Five Primitives

Every harness interaction is built from five primitive types that packs contribute:

| Primitive | Sigil | Example |
|-----------|-------|---------|
| **Agent** | `.` | `core.triage`, `azure.architect` |
| **Tool** | `.` | `azure.arm_get`, `core.write_file` |
| **UserAction** | `:` | `azure:login`, `github:oauth` |
| **Component** | `/` | `pack-core/Button`, `azure/Login` |
| **Guardrail** | — | `core/token-budget`, `azure/no-hardcoded-creds` |

## Request Flow

```
POST /api/converse { sessionId, message }
  1. Rate limit + guardrail input check
  2. Session lookup or creation
  3. Runner selects active Agent (session.activeAgent, default core.triage)
  4. Dynamic instructions = agent body + resolvedSkills(agent, ctx) + catalog
  5. Agent streams text, emits A2UI via core.emit_ui tool calls
  6. Agent may call Tools or UserActions
     └─ UserAction: pause → emit user_action_required SSE → browser acts → POST /api/converse/resume
  7. Guardrails run at input, tool-call, and output stages
  8. AgentOutput { message, intent } returned
  9. Handoff → next Agent picks up future turns
 10. Stream typed SSE events to client: chunk | a2ui | tool | handoff | intent | done | error
```

See [Prompt Pipeline](./prompt-pipeline.md) for the per-turn assembly details.

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages | Server session (memory) | 1 hour |
| Active agent name | Server session | Per turn |
| Generated artifact metadata | Server session | 1 hour |
| Virtual FS (file content) | Client memory + IndexedDB (`kickstart-vfs`) | No TTL |

**Cold start:** Server session expires → client resends message history. Session is restored from the conversation log.

## Session Lifecycle

```
Client POST (no sessionId)
  → createSession() → Session ID returned

Client POST (with sessionId, session alive)
  → getSession(sessionId) → found → continue

Client POST (with sessionId, session expired)
  → createSession() → fresh session

Garbage collection
  → Every 10 minutes: delete sessions older than 1 hour
```

## A2UI Component Catalog

Components are registered per pack at startup. The harness seals the registry before the first request. The negotiated catalog is served via `GET /api/packs`.

- **In-chat components** — emitted via `core.emit_ui` tool calls during agent turns.
- **Sidebar FileEditor** (`components/FileEditor/`) — persistent panel backed by `services/virtual-fs.ts`.

See [A2UI Integration](./a2ui-integration.md) for the full component model.
