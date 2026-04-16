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
│   │       └── services/  virtual-fs.ts (browser-side virtual file store with IndexedDB persistence)
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
   e. resolveSkills(phase, kits)           ← Mechanism A: system prompt skill injection
   f. resolveConverseModelRoute()          ← trust-based model selection
   g. buildSystemPrompt({ phase, appDefinition, kitPrompts, artifactSummary })
   h. Replace stored system message with freshly built prompt
   i. resolveConversationSkills(msg, ...)  ← Mechanism B: per-turn domain injection
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

### `packages/core/src/engine/machine.ts` — Conversation FSM ⚠️ SCHEDULED FOR DELETION
Pure function state machine. Tracks current phase and phase statuses. Enforces forward-only transitions. Does NOT enforce exit conditions — those are narrative strings in `phases.ts` for LLM guidance only.

**This file and `phases.ts` are confirmed for deletion** (architectural decision recorded in `.squad/decisions.md`). Replacement: `session.state.currentPhase` as a plain `string` set directly by the LLM. Phase sequencing moves from TypeScript structs into numbered `═══ N. SECTION ═══` blocks in `system-prompt.ts`. See `docs/fsm.md` for the migration plan.

### `packages/core/src/engine/skill-resolver.ts` — Kit Skill Resolver (Mechanism A)
3-stage middleware: phase filter → keyword activation → priority sort. Injects kit-provided domain knowledge as `## Available Capabilities` into the system prompt via `buildSystemPrompt()`. Called every turn.

### `packages/core/src/services/resolveConversationSkills.ts` — Per-Turn Injection (Mechanism B)
Keyword-based domain detection on the user message. Injects targeted domain knowledge as a **user message turn** before the real user message. Also appends a `[Current session context]` block to the real user message. **Added in PR #382, now live in main.**

### `packages/core/src/prompts/system-prompt.ts` — System Prompt Builder
`buildSystemPrompt()` assembles the full system prompt: persona + COLLABORATOR VOICE + GUARDRAILS + phase template + kit prompts. Called every turn with fresh context.

### `packages/web/api/src/lib/converse-model-router.ts` — Model Router
Trust-based. Generate phase + `session.routingPhaseTrusted = true` → generate-tier model (GPT-5.4 via `AZURE_OPENAI_CODEX_DEPLOYMENT`). All other cases → chat-tier model (GPT-5.4-mini via `AZURE_OPENAI_CHAT_DEPLOYMENT`). `routingPhaseTrusted` is reset to `false` on session rehydration — client cannot self-elevate.

### `packages/web/api/src/lib/session-store.ts` — Session Store
In-memory, 1-hour TTL, GC every 10 minutes. Stores conversation messages (max 50), FSM phase state, generated artifact metadata. Full file content is NOT stored — it lives in the A2UI message history on the client.

### `packages/web/src/services/virtual-fs.ts` — Virtual Filesystem
Browser-side virtual file store with optional IndexedDB persistence (`kickstart-vfs`). Provides an in-memory `VirtualFileSystem` and an IndexedDB-backed `VirtualFS` used by the sidebar/workspace file experience. It does **not** directly back the in-chat A2UI `FileEditor`, which resolves file content from the A2UI payload / `ArtifactContext`. No TTL — data persists in client memory for the session and may survive across sessions via IndexedDB.

---

## Server-Side vs Client-Side State

| What | Where | Lifetime |
|------|-------|----------|
| Conversation messages (text only) | Server session store (memory) | 1 hour |
| FSM phase state | Server session store (memory) | 1 hour | **Being replaced by plain `session.state.currentPhase` string** |
| Generated artifact metadata | Server session store (memory) | 1 hour |
| Full file content (generated files) | Client A2UI message history | Browser session |
| Virtual FS (file content for sidebar) | Client memory + optional IndexedDB (`kickstart-vfs`) | No TTL |
| `routingPhaseTrusted` flag | Server session | Reset on rehydration |

**Cold start rehydration:** When the server session expires, the client re-sends its message history (`messages[]` in the POST body). The server re-creates the session from this. `routingPhaseTrusted` is set to `false` during rehydration.

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

## Code Health Notes

**Dead / exported-but-uncalled APIs in `@kickstart/core`:**
- `resolveSkillsAsync()` — exported and tested, never called in any production handler. Only `resolveSkills()` is called in `converse.ts`. Safe to remove the async variant if no external caller needs it.
- `resolveSkillsFromList()` — same: exported, tested, not called in production code.

**Typed `Skill` object path in `skill-resolver.ts` is effectively dormant:**
- `skill-resolver.ts` supports two paths: a typed `kit.skills[]` (Skill objects with `id`, `phase`, `content` fields) and a legacy `kit.prompts[]`/`kit.phasePrompts[]` path.
- No production kit (`azure-kit.ts`, `github-kit.ts`) uses `skills:`. Both use the legacy path.
- The typed path exists, is tested, and is exported — but is traversed by zero registered kits at runtime.

**Two skill mechanisms with overlapping trigger keywords:**
- Mechanism A classifies *kit prompt text* by keywords (`"dockerfile"`, `"manifest"`, `"pipeline"`, etc.).
- Mechanism B classifies *user message text* by regex patterns (overlapping: `/\bdocker(file)?\b/i`, `/\bmanifest\b/i`, `/\bpipeline\b/i`).
- When a user says "generate a Dockerfile", both fire. They inject different *content* (A: kit prompts into system prompt; B: Docker knowledge as user turn) but from overlapping trigger logic. This works correctly today but creates maintenance risk — changes to keyword sets in one mechanism are invisible to the other.

**`exitConditions`/`entryConditions` in `phases.ts` are load-bearing strings in zero places:**
- Defined in `PhaseDefinition` interface, populated in every phase, never read by `machine.ts` or any handler. They exist only as documentation embedded in code.
- **Moot on FSM removal** — `phases.ts` is being deleted. This dead code goes away automatically.

**`machine.ts` and `phases.ts` are scheduled for deletion:**
- The FSM adds transition enforcement that the LLM already handles narratively. Removing it simplifies the architecture significantly.
- See `docs/fsm.md` for the full migration plan and what replaces each deleted artifact.

---

## What Should Be Cleaned Up

Prioritized by impact before the Agent SDK integration (issue #330):

1. **Delete `machine.ts` and `phases.ts`** — confirmed architectural decision. Replace with `session.state.currentPhase` string + numbered prompt blocks in `system-prompt.ts`. See `docs/fsm.md` for the migration checklist.

2. **`resolveSkillsAsync` and `resolveSkillsFromList`** — remove from public exports or clearly mark `@internal`. They add surface area to the SDK without being used.

2. **Typed `Skill` path in `skill-resolver.ts`** — either have at least one kit use it (making it the canonical API), or consolidate to the legacy path and remove `collectSkills()` and the typed path. The dual-path resolver is confusing to anyone building Agent SDK adapters.

3. **`exitConditions`/`entryConditions` fields** — move them out of the runtime type into a separate documentation structure, or enforce them. Leaving them as inert fields in a runtime interface misleads anyone reading `types.ts` who assumes they are checked.

4. **Keyword duplication between Mechanism A and B** — the two mechanisms should have a shared vocabulary file or at least a note tying them together. Keyword drift will cause bugs where one mechanism activates and the other doesn't for the same user intent.
