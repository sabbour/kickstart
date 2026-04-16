---
sidebar_position: 1
---

# Architecture Overview

Kickstart is a monorepo with three packages — a shared core engine, a React SPA, and an MCP server for IDE integration. The web surface runs on Azure Static Web Apps with a managed functions backend.

## Monorepo Structure

```
kickstart/
├── packages/
│   ├── core/          @kickstart/core — shared TypeScript engine
│   │   ├── engine/        FSM + Skill Resolver (machine.ts, skill-resolver.ts)
│   │   ├── kits/          IntegrationKit interface + defaultKitRegistry
│   │   ├── prompts/       buildSystemPrompt(), phase templates, component catalog
│   │   ├── services/      resolveConversationSkills (per-turn injection)
│   │   └── tools/         ToolRegistry + built-in LLM-callable tools
│   ├── web/           @kickstart/web — React SPA + Azure Functions API
│   │   ├── api/           Azure Functions (converse, health, proxies)
│   │   │   └── src/lib/   session-store, openai-client, model-router, rate-limiter
│   │   └── src/
│   │       ├── catalog/   A2UI component implementations (28+ components)
│   │       ├── components/ Chat UI, FileEditor sidebar, Landing
│   │       └── services/  virtual-fs.ts (in-memory file store, 1-hour TTL)
│   └── mcp-server/    @kickstart/mcp-server — optional IDE adapter
└── infra/             Bicep templates for Azure provisioning
```

## System Components

```
┌─────────────────────────────────────────────────────────┐
│  Browser (SPA)                                          │
│  React + Vite + TypeScript                              │
│  A2UI React Renderer + Fluent 2                         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (SSE + JSON)
┌────────────────────▼────────────────────────────────────┐
│  Azure Static Web App                                   │
│  ├─ Static hosting (React build)                        │
│  └─ Managed Functions (API)                             │
│       ├─ /api/converse  → main LLM proxy               │
│       ├─ /api/health    → health check                  │
│       └─ /api/*-proxy   → ARM, GitHub, Pricing proxies │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│  Azure OpenAI Service                                   │
│  GPT-5.4-mini (chat) + GPT-5.4 (generate, trusted only)│
└─────────────────────────────────────────────────────────┘
```

## Request Flow

What happens when a user sends a message:

```
POST /api/converse { sessionId, message, messages? }
  1. Rate limit + content safety checks
  2. Session lookup or creation (rehydrate from client messages[] on cold start)
  3. resolveSkills(phase, kits)         ← kit prompts for system prompt
  4. resolveConverseModelRoute()        ← trust-based model selection
  5. buildSystemPrompt({ phase, kitPrompts, artifactSummary })
  6. resolveConversationSkills(msg)     ← per-turn domain knowledge injection
  7. Call Azure OpenAI
  8. Parse JSON envelope → handleImplicitFlags() → may advance FSM phase
  9. Extract FileEditor artifacts → session store
 10. Stream SSE events to client
```

See [Prompt Pipeline](./prompt-pipeline.md) for the full assembly order.

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages | Server (memory) | 1 hour |
| FSM phase state | Server (memory) | 1 hour |
| Generated artifact metadata | Server (memory) | 1 hour |
| Full generated file content | Client message history | Browser session |
| Virtual FS (file content for sidebar) | Server (memory) | 1 hour |
| `routingPhaseTrusted` flag | Server session | Reset on rehydration |

**Cold start:** Server session expires → client resends up to 50 messages for rehydration. All messages are content-safety checked. `routingPhaseTrusted` is reset to `false` — client cannot self-elevate to the generate-tier model.

## AI Engine

- **Azure OpenAI GPT-5.4-mini** for all conversation phases (`AZURE_OPENAI_CHAT_DEPLOYMENT`)
- **Azure OpenAI GPT-5.4** for Generate phase when server-trusted (`AZURE_OPENAI_CODEX_DEPLOYMENT`)
- Model selection is trust-based, not phase-based — see [Prompt Pipeline](./prompt-pipeline.md#model-routing)
- Two skill injection mechanisms run every turn — see [Skill Injection](./skill-injection.md)
- 6-phase FSM tracks conversation progress — see [FSM](./fsm.md)

## A2UI Component Catalog

28+ components split across two concepts:

- **A2UI FileEditor** (`catalog/components/FileEditor.tsx`) — ephemeral, per-turn. LLM controls content. Shows one file in chat.
- **Sidebar FileEditor** (`components/FileEditor/`) — persistent panel with FileTree + Monaco editor. Shows ALL generated files across the session.

Both are backed by `services/virtual-fs.ts` (in-memory, 1-hour TTL).

The base catalog is defined in `packages/core/src/prompts/component-catalog.ts`. Kit-contributed components are merged at `buildSystemPrompt()` time.
