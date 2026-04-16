# Kickstart Architecture — Engineering Overview

This document answers "how does this system work?" in 5 minutes of reading.

> **Related docs:**
> - [Prompt Architecture](./prompt-architecture.md) — full LLM pipeline details
> - [FSM](./fsm.md) — conversation state machine
> - [Integration Kits](./integration-kits.md) — how to extend the engine

---

## Monorepo Structure

```
kickstart/
├── packages/
│   ├── core/          @kickstart/core — shared TypeScript engine
│   │   ├── engine/        FSM (machine.ts, phases.ts, types.ts) + Skill Resolver
│   │   ├── kits/          IntegrationKit interface + defaultKitRegistry
│   │   ├── prompts/       buildSystemPrompt(), phase templates, component catalog
│   │   ├── services/      resolveConversationSkills (per-turn injection)
│   │   ├── tools/         ToolRegistry + built-in LLM-callable tools
│   │   └── telemetry/     Logging helpers
│   ├── web/           @kickstart/web — React SPA + Azure Functions API
│   │   ├── api/           Azure Functions (converse, health, proxies, etc.)
│   │   │   └── src/lib/   session-store, openai-client, model-router, rate-limiter
│   │   └── src/
│   │       ├── catalog/   A2UI component implementations (28+ components)
│   │       ├── components/ Chat UI, FileEditor (sidebar), Landing
│   │       └── services/  virtual-fs.ts (in-memory file store)
│   └── mcp-server/    @kickstart/mcp-server — optional IDE adapter
└── infra/             Bicep templates for Azure provisioning
```

---

## Request Flow

What happens when a user sends a message:

```
1. Browser (React SPA)
   └─ POST /api/converse  { sessionId, message, messages? }
       └─ Accept: text/event-stream  (SSE streaming)

2. Azure Functions — converse.ts
   a. Rate limit check
   b. Content safety check (Azure AI Content Safety)
   c. Look up or create session (in-memory, 1-hour TTL)
      - If session missing and client sent messages[], rehydrate from client history
        (max 50 messages, all content-safety checked)
   d. Resolve current phase from FSM engineState
   e. resolveSkills(phase, kits)      ← Mechanism A: system prompt skill injection
   f. resolveConverseModelRoute()     ← trust-based model selection
   g. buildSystemPrompt({ phase, appDefinition, kitPrompts, artifactSummary })
   h. Replace stored system message with freshly built prompt
   i. resolveConversationSkills(msg, phase, context)  ← Mechanism B: per-turn injection
      - If domainKnowledge != null: insert as user message before real message
      - Append currentState snapshot to real user message
   j. Call Azure OpenAI (streaming or JSON)
   k. Parse JSON envelope { message, a2ui, phaseComplete, filesComplete }
   l. handleImplicitFlags(state, { phaseComplete }) → may advance FSM phase
   m. Extract FileEditor components → upsertArtifact() into session
   n. Stream SSE events back to client

3. Browser (React SPA)
   a. Render text chunks as they arrive
   b. On "done" event: render A2UI component tree from kickstartCatalog
   c. If autoContinue: true — auto-send "Continue where you left off"
   d. Sidebar FileEditor re-populated from virtual-fs artifacts
```

---

## Key Components

### `packages/core/src/engine/machine.ts` — Conversation FSM
Pure function state machine. Tracks current phase and phase statuses. Enforces forward-only transitions. Does NOT enforce exit conditions — those are narrative strings in `phases.ts` for LLM guidance only. See [fsm.md](./fsm.md).

### `packages/core/src/engine/skill-resolver.ts` — Kit Skill Resolver (Mechanism A)
3-stage middleware: phase filter → keyword activation → priority sort. Injects kit-provided domain knowledge as `## Available Capabilities` into the system prompt via `buildSystemPrompt()`. Called every turn.

### `packages/core/src/services/resolveConversationSkills.ts` — Per-Turn Injection (Mechanism B)
Keyword-based domain detection on the user message. Injects targeted domain knowledge as a **user message turn** before the real user message. Also appends a `[Current session context]` block to the real user message. Called every turn.

### `packages/core/src/prompts/system-prompt.ts` — System Prompt Builder
`buildSystemPrompt()` assembles the full system prompt: persona + COLLABORATOR VOICE + GUARDRAILS + phase template + kit prompts. Called every turn with fresh context.

### `packages/web/api/src/lib/converse-model-router.ts` — Model Router
Trust-based, NOT phase-based. Generate phase + `session.routingPhaseTrusted = true` → generate-tier model (GPT-5.4 via `AZURE_OPENAI_CODEX_DEPLOYMENT`). All other cases → chat-tier model (GPT-5.4-mini via `AZURE_OPENAI_CHAT_DEPLOYMENT`). Client cannot self-elevate — `routingPhaseTrusted` is reset to `false` on session rehydration.

### `packages/web/api/src/lib/session-store.ts` — Session Store
In-memory, 1-hour TTL, GC every 10 minutes. Stores conversation messages (max 50), FSM phase state, generated artifact metadata (filename, language, resource declarations). Full file content is NOT stored — it lives in the A2UI message history on the client, sent back for rehydration on cold start.

### `packages/web/src/services/virtual-fs.ts` — Virtual Filesystem
In-memory file store, 1-hour TTL. Backs both the A2UI FileEditor (in-chat) and the Sidebar FileEditor (persistent panel). Files are extracted from A2UI FileEditor components and written here automatically.

### `packages/web/src/catalog/` — A2UI Component Catalog
28+ React components: layout (Row, Column, Card, Tabs, Modal), content (Text, Markdown, CodeBlock, Badge), input (Button, TextField, ChoicePicker, RadioGroup, Toggle), domain-specific (AuthCard, GenerationProgress, ArchitectureDiagram, FileEditor, CostEstimate, GitHubRepoPicker, AzureResourcePicker). Defined in `packages/core/src/prompts/component-catalog.ts`; implemented in `packages/web/src/catalog/components/`.

---

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages (text only) | Server session store (memory) | 1 hour |
| FSM phase state | Server session store (memory) | 1 hour |
| Generated artifact metadata | Server session store (memory) | 1 hour |
| Full file content (generated files) | Client A2UI message history | Browser session |
| Virtual FS (file content) | Server virtual-fs (memory) | 1 hour |
| `routingPhaseTrusted` flag | Server session | Reset on rehydration |

**Cold start rehydration:** When the server session expires, the client re-sends its message history (`messages[]` in the POST body). The server re-creates the session from this. `routingPhaseTrusted` is set to `false` during rehydration, so even if the client claims to be in Generate phase, it gets the chat-tier model.

---

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

---

## What Is and Isn't Implemented

| Feature | Status |
|---------|--------|
| 6-phase FSM (Discover → Deploy) | ✅ Implemented |
| Kit-based skill injection (Mechanism A) | ✅ Implemented |
| Per-turn domain skill injection (Mechanism B) | ✅ Implemented (wired in converse.ts as of latest commit) |
| Auto-continue file generation | ✅ Implemented |
| Session rehydration from client history | ✅ Implemented |
| Trust-based model routing | ✅ Implemented |
| FSM exit condition enforcement | ❌ Not implemented — exit conditions are LLM narrative only |
| External plugin/config skill loading | ❌ Not implemented — new skills require TypeScript IntegrationKit |
| Persistent storage (DB) | ❌ Not implemented — all in-memory |
