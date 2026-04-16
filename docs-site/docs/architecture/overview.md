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
│   │   ├── engine/        Skill Resolver (machine.ts ⚠️ DELETE, skill-resolver.ts)
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
  8. Parse JSON → handleImplicitFlags() → may advance FSM phase
  9. Extract FileEditor artifacts → session store
 10. Stream SSE events to client
```

See [Prompt Pipeline](./prompt-pipeline.md) for the full assembly order with code references.

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages | Server (memory) | 1 hour |
| FSM phase state | Server (memory) | 1 hour |
| Generated artifact metadata | Server (memory) | 1 hour |
| Full generated file content | Client message history | Browser session |
| Virtual FS (file content for sidebar) | Server (memory) | 1 hour |
| `routingPhaseTrusted` flag | Server session | Reset on rehydration |

**Cold start:** Server session expires → client resends up to 50 messages for rehydration. All messages content-safety checked. `routingPhaseTrusted` reset to `false` — client cannot self-elevate to generate-tier model.

## AI Engine

- **Azure OpenAI GPT-5.4-mini** for all conversation phases (`AZURE_OPENAI_CHAT_DEPLOYMENT`)
- **Azure OpenAI GPT-5.4** for Generate phase when server-trusted (`AZURE_OPENAI_CODEX_DEPLOYMENT`)
- Model selection is trust-based, not phase-based — see [Prompt Pipeline: Model Routing](./prompt-pipeline.md#model-routing)
- Two skill injection mechanisms run every turn — see [Skill Injection](./skill-injection.md)
- FSM (`machine.ts`, `phases.ts`) **is scheduled for deletion** — see [FSM](./fsm.md)

:::danger FSM scheduled for deletion
`machine.ts` and `phases.ts` are confirmed for deletion per architectural decision in `.squad/decisions.md`. The FSM is being replaced by a plain `session.state.currentPhase` string + numbered `═══ N. SECTION ═══` blocks in the system prompt. Do not add new FSM dependencies. See [FSM](./fsm.md) for the migration plan.
:::

## A2UI Component Catalog

Two FileEditor concepts, both backed by `services/virtual-fs.ts`:

- **A2UI FileEditor** (`catalog/components/FileEditor.tsx`) — ephemeral, per-turn in-chat component. LLM controls content.
- **Sidebar FileEditor** (`components/FileEditor/`) — persistent panel with FileTree + Monaco. Shows all generated files across the session.

Base catalog: `packages/core/src/prompts/component-catalog.ts`. Kit-contributed components merged at `buildSystemPrompt()` time.

## Code Health Notes

:::warning Exported but uncalled APIs
`resolveSkillsAsync()` and `resolveSkillsFromList()` are exported from `@kickstart/core` and tested, but never called in any production handler. Only `resolveSkills()` is used. These inflate the public API surface without runtime callers.
:::

:::warning Typed Skill path is dormant
`skill-resolver.ts` has two resolution paths: a typed `kit.skills[]` (Skill objects) and a legacy `kit.prompts[]`/`kit.phasePrompts[]` path. Neither production kit (`azure-kit.ts`, `github-kit.ts`) uses the typed path. The typed path is exercised only in tests.
:::

:::note Two keyword systems with no shared vocabulary
Mechanism A (kit prompt classification) and Mechanism B (user message classification) both key on words like `"dockerfile"`, `"manifest"`, `"pipeline"` — but in separate files with separate formats. They will drift independently.
:::

## What Should Be Cleaned Up

1. **Delete `machine.ts` and `phases.ts`** (confirmed architectural decision) — see [FSM](./fsm.md) for migration checklist.
2. **`resolveSkillsAsync` / `resolveSkillsFromList`** — remove or mark `@internal` before Agent SDK integration.
3. **Typed `Skill` path in `skill-resolver.ts`** — consolidate to one path; both existing kits use legacy.
4. **Keyword vocabulary** — extract a shared constants module referenced by both mechanisms.
5. **`exitConditions`/`entryConditions` in `phases.ts`** — moot on FSM removal; will be deleted with `phases.ts`.
