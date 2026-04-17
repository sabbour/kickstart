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
│   │   ├── engine/        phase catalog (phases.ts), skill resolver (skill-resolver.ts)
│   │   ├── kits/          IntegrationKit interface + defaultKitRegistry
│   │   ├── prompts/       buildSystemPrompt(), phase templates, component catalog
│   │   ├── services/      resolveConversationSkills (per-turn injection)
│   │   └── tools/         ToolRegistry + built-in LLM-callable tools
│   ├── web/           @kickstart/web — React SPA + Azure Functions API
│   │   ├── api/           Azure Functions (converse, health, proxies)
│   │   │   └── src/lib/   session-store, openai-client, model-router, rate-limiter
│   │   └── src/
│   │       ├── catalog/   A2UI component implementations (22 custom — asserted in `custom-component-count.test.ts`; base catalog has 33 entries — asserted in `component-catalog.test.ts`)
│   │       ├── components/ Chat UI, FileEditor sidebar, Landing
│   │       └── services/  virtual-fs.ts (browser-side virtual file store with IndexedDB persistence)
│   └── mcp-server/    @kickstart/mcp-server — optional IDE adapter
└── infra/             Bicep templates for Azure provisioning
```

## Request Flow

```
POST /api/converse { sessionId, message, messages? }
  1. Rate limit + content safety checks
  2. Session lookup or creation (rehydrate from client messages[] on cold start)
  3. resolveSkills(phase, kits)         ← kit prompts for system prompt (Mechanism A)
  4. resolveConverseModelRoute()        ← trust-based model selection
  5. buildSystemPrompt({ phase, kitPrompts, artifactSummary })
  6. resolveConversationSkills(msg)     ← per-turn domain injection (Mechanism B)
  7. Call Azure OpenAI
  8. Parse JSON → if phaseComplete: true → advancePhase()
  9. Extract FileEditor artifacts → session store
 10. Stream SSE events to client
```

See [Prompt Pipeline](./prompt-pipeline.md) for the full assembly order with code references.

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages | Server (memory) | 1 hour |
| Phase string (`currentPhase`) | Server session | 1 hour |
| Generated artifact metadata | Server (memory) | 1 hour |
| Full generated file content | Client message history | Browser session |
| Virtual FS (file content for sidebar) | Client memory + optional IndexedDB (`kickstart-vfs`) | No TTL |
| `routingPhaseTrusted` flag | Server session | Reset on rehydration |

**Cold start:** Server session expires → client resends up to 50 messages for rehydration. All messages content-safety checked. `routingPhaseTrusted` reset to `false` — client cannot self-elevate to generate-tier model.

## AI Engine

- **Azure OpenAI GPT-5.4-mini** for all conversation phases (`AZURE_OPENAI_CHAT_DEPLOYMENT`)
- **Azure OpenAI GPT-5.4** for Generate phase when server-trusted (`AZURE_OPENAI_CODEX_DEPLOYMENT`)
- Model selection is trust-based, not phase-based — see [Prompt Pipeline: Model Routing](./prompt-pipeline.md#model-routing)
- Two skill injection mechanisms run every turn — see [Skill Injection](./skill-injection.md)
- Phase tracking: `session.state.currentPhase` (plain string) — see [Phase System](./fsm.md)

## A2UI Component Catalog

Two FileEditor concepts, both backed by `services/virtual-fs.ts`:

Both use `services/virtual-fs.ts` as the browser-side virtual file store: data lives in client memory and may also be persisted in IndexedDB for reuse across sessions. This module does not implement a 1-hour TTL eviction policy.

- **A2UI FileEditor** (`catalog/components/FileEditor.tsx`) — ephemeral, per-turn in-chat component. LLM controls content.
- **Sidebar FileEditor** (`components/FileEditor/`) — persistent panel with FileTree + Monaco. Shows all generated files across the session.

Base catalog: `packages/core/src/prompts/component-catalog.ts`. Kit-contributed components merged at `buildSystemPrompt()` time.

## Code Health Notes

:::warning Exported but uncalled APIs
`resolveSkillsAsync()` and `resolveSkillsFromList()` are exported from `@kickstart/core` and tested, but never called in any production handler. Only `resolveSkills()` is used. These inflate the public API surface without runtime callers.
:::

:::info Both skill paths are active
**`azure-kit.ts` uses the typed `kit.skills[]` path** (Path 1) — it registers `skills: azureIacSkills` (see `azure-kit.ts:573`). **`github-kit.ts` uses the legacy `kit.prompts[]` / `kit.phasePrompts{}` path** (Path 2). Both paths are valid for kit authors. Consolidation of the two paths into a single mechanism is tracked as future work.
:::

:::note Two keyword systems with no shared vocabulary
Mechanism A (kit prompt classification) and Mechanism B (user message classification) both key on words like `"dockerfile"`, `"manifest"`, `"pipeline"` — but in separate files with separate formats. They will drift independently.
:::

## Session Lifecycle

```
Client POST (no sessionId)
  → createSession()  OR  hydrateSession(messages[])
  → Session ID returned in response

Client POST (with sessionId, session alive)
  → getSession(sessionId) → found → continue

Client POST (with sessionId, session expired)
  → getSession(sessionId) → null
  → body.messages[] present → hydrateSession() → new session, same conversation
  → body.messages[] absent → createSession() → fresh start

Garbage collection
  → Every 10 minutes: delete sessions older than 1 hour
```

## What Should Be Cleaned Up

1. **`resolveSkillsAsync` / `resolveSkillsFromList`** — remove or mark `@internal` before Agent SDK integration.
2. **Typed `Skill` path in `skill-resolver.ts`** — consolidate to one path; both existing kits use legacy.
3. **Keyword vocabulary** — extract a shared constants module referenced by both mechanisms.
