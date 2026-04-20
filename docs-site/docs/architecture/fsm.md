---
sidebar_position: 3
---

# Phase System

:::note Historical reference
This page documents the **deprecated** finite state machine (FSM) that was removed in v2. It is kept for historical context. **Current phase definitions are in `packages/harness/src/index.ts`** — see [Conversation Phases](../extending/conversation-phases.md) for the current implementation.
:::

Kickstart's conversation engine uses a lightweight, LLM-driven phase system to guide users from project discovery through deployment.

:::note Historical context
An earlier version of the codebase included a TypeScript state machine (`machine.ts`) with explicit transition functions, event types, and condition fields (`entryConditions`, `exitConditions`, `promptTemplate`) on `PhaseDefinition`. This was removed in PR #412 because the machine was never exercised at runtime — the LLM navigated phases entirely from its system prompt. The reasoning is in `.squad/decisions.md`.
:::

---

## Current State

### Phase Catalog

Phases are defined in the harness session types:

```typescript
export interface PhaseDefinition {
  id: Phase;
  label: string;
  description: string;
  nextPhase: Phase | null;
}
```

The six phases in conversation order:

| Phase | Label | nextPhase |
|-------|-------|-----------|
| `discover` | Discover | `design` |
| `design` | Design | `generate` |
| `generate` | Generate | `review` |
| `review` | Review | `handoff` |
| `handoff` | Handoff | `deploy` |
| `deploy` | Deploy | `null` (terminal) |

### Session State

The current phase is stored as a plain string on the server-side session:

```typescript
session.state.currentPhase  // e.g. "generate"
```

This is the single source of truth. There is no separate FSM state slice, no `phaseStatuses` map, and no `phaseData` bag.

### Phase Advancement

`advancePhase()` looks up the current phase in `PHASE_DEFINITIONS` and returns `nextPhase`. The agent signals phase completion via the `intent: "advance"` field in `AgentOutput`.

### How the LLM Knows Its Phase

The agent's dynamic instructions include the current phase identifier and description from its `PhaseDefinition`. This tells the LLM what to focus on and when to signal completion via `intent: "advance"` in `AgentOutput`.

---

## What Was Removed

The original `machine.ts` implemented a pure-function state machine with:

- `transition(state, event)` — pure transition function
- `handleImplicitFlags()` — auto-advance on LLM signals
- `canAdvance()` — gate check before advancing
- `ConversationState` — FSM state slice (`phaseStatuses`, `phaseData`)
- `ConversationEvent` enum — `USER_MESSAGE`, `PHASE_COMPLETE`

`PhaseDefinition` also carried `entryConditions`, `exitConditions`, and `promptTemplate` fields — all typed, none read at runtime.

The machine was removed because it duplicated the LLM's own phase judgment without adding correctness guarantees.

## Future Direction

Phase behavior continues to evolve with the v2 harness + packs model. Phase transitions are now signalled via `AgentOutput.intent = "advance"` rather than a JSON envelope flag. See [Architecture Overview](./overview.md) for the current v2 request flow.
