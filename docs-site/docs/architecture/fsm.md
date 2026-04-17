---
sidebar_position: 3
---

# Phase System

Kickstart's conversation engine uses a lightweight, LLM-driven phase system to guide users from project discovery through deployment.

:::note Historical context
An earlier version of the codebase included a TypeScript state machine (`machine.ts`) with explicit transition functions, event types, and condition fields (`entryConditions`, `exitConditions`, `promptTemplate`) on `PhaseDefinition`. This was removed in PR #412 because the machine was never exercised at runtime — the LLM navigated phases entirely from its system prompt. The reasoning is in `.squad/decisions.md`.
:::

---

## Current State

### Phase Catalog

Phases are defined in `packages/core/src/engine/phases.ts` as a static array:

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

`advancePhase()` in `converse.ts` looks up the current phase in `PHASE_DEFINITIONS` and returns `nextPhase`:

```typescript
function advancePhase(currentPhase: Phase): Phase {
  const def = PHASE_DEFINITIONS.find((p) => p.id === currentPhase);
  return def?.nextPhase ?? currentPhase;
}
```

The LLM signals that a phase is complete via `phaseComplete: true` in its JSON response envelope. The `converse` handler reads this flag and calls `advancePhase()` — there is no event system or transition guard.

### How the LLM Knows Its Phase

The system prompt includes the current phase identifier and the `description` from its `PhaseDefinition`. This tells the LLM what to focus on and when to signal completion.

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

---

## Future Direction

Phase behavior is expected to evolve significantly with the Agents SDK integration. See issue [#330](https://github.com/sabbour/kickstart/issues/330) for the planned redesign. The current plain-string approach is intentionally minimal — a clean baseline before that work begins.
