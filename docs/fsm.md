# Conversation State Machine (FSM)

This document describes what the FSM actually does, what it does NOT do, and how phase transitions trigger.

> **Source:** `packages/core/src/engine/machine.ts` (157 lines), `packages/core/src/engine/phases.ts`, `packages/core/src/engine/types.ts`

---

## What the FSM Enforces

1. **Current phase tracking** — `state.currentPhase` is the authoritative phase.
2. **Forward-only progression** — phases advance in sequence: Discover → Design → Generate → Review → Handoff → Deploy. There is no backward transition.
3. **Phase status tracking** — each phase has a status: `pending | active | complete | skipped`.
4. **Completion detection** — when the last phase (Deploy) advances, `state.isComplete = true`.

## What the FSM Does NOT Enforce

- **Exit conditions** — `phases.ts` lists exit conditions like `"user has approved the plan"` and `"appName is defined"`. These are **strings in the `PhaseDefinition` interface — never read by `machine.ts` or any handler.** No code checks them.
- **Entry conditions** — same: populated in every phase object, never read.
- **Phase content quality** — the FSM does not know what was said. It tracks state, not content.

**Key insight:** The system is LLM-driven within FSM guardrails. The LLM decides WHEN a phase is complete; the FSM decides WHAT transitions are allowed (forward only).

---

## The Six Phases

```
Discover → Design → Generate → Review → Handoff → Deploy
```

| Phase | Purpose | LLM goal |
|-------|---------|----------|
| `discover` | Learn about the app | Identify name, runtime, description |
| `design` | Plan architecture | Confirm services, present architecture diagram |
| `generate` | Produce deployment artifacts | Dockerfile, K8s manifests, GitHub Actions workflow |
| `review` | Validate and cost-estimate | Walk through generated files, show cost breakdown |
| `handoff` | Get code into GitHub | Create/select repo, push files, provide Codespace link |
| `deploy` | Optional live deployment | Trigger GitHub Actions, show status and URL |

Source: `PHASE_DEFINITIONS` in `packages/core/src/engine/phases.ts`.

---

## Phase Transition Triggers

### Trigger 1 — LLM sets `phaseComplete: true`

The LLM outputs a JSON envelope each turn:
```json
{ "message": "...", "a2ui": [...], "phaseComplete": true }
```

The converse handler calls `handleImplicitFlags()`:

```typescript
// packages/core/src/engine/machine.ts
export function handleImplicitFlags(state, flags): ConversationState {
  if (flags.phaseComplete === true && canAdvance(state)) {
    return transition(state, { type: "ADVANCE" });
  }
  return state;
}
```

`canAdvance()` only checks that the current phase is `active` and the conversation is not complete. **It does not check exit conditions.**

### Trigger 2 — User clicks a Button with `event.name: "complete:navigate:{phase}"`

A2UI Button components can carry event metadata. When a user clicks such a button, the client sends this event to the server, which triggers an ADVANCE.

---

## State Machine Events

```typescript
type ConversationEvent =
  | { type: "START" }
  | { type: "ADVANCE" }
  | { type: "SKIP" }
  | { type: "PHASE_COMPLETE"; phase: Phase; data?: Record<string, unknown> }
  | { type: "RESET" }
  | { type: "USER_INPUT"; input?: string }  // No-op — state unchanged
```

The `transition()` function is a pure function — returns a new state, never mutates input.

---

## `PhaseStatus` — Is It Actually Read?

Yes — `PhaseStatus` is read in two production files:

- `converse.ts` lines 421/423: checks `engineState.phaseStatus[phase] === "active"` / `=== "complete"` when building phase progress info for the client.
- `action.ts` lines 152/154: same check for action event routing.

`PhaseStatus` is live computed state, not dead. The only dead parts are `exitConditions` and `entryConditions`.

---

## `canAdvance()` — What It Actually Checks

```typescript
export function canAdvance(state: ConversationState, _phaseData?: Record<string, unknown>): boolean {
  // NOTE: The source code comment reads:
  // "In a real implementation, this would check exit conditions against
  // the accumulated phase data. For now, we allow manual advancement."
  // It does NOT do that.
  return state.phaseStatus[state.currentPhase] === "active" && !state.isComplete;
}
```

The `_phaseData` parameter is unused. The function comment is the only place where exit condition checking is acknowledged as missing.

---

## Code Health Notes

**`exitConditions` and `entryConditions` are dead constraint logic:**
- Defined in `PhaseDefinition` interface (`types.ts` line 47, 49).
- Populated as strings in every phase (`phases.ts`).
- Never read by `machine.ts`, `converse.ts`, `action.ts`, or any test that checks runtime behavior.
- They exist as inert data in a runtime object. Anyone reading `types.ts` and seeing these fields will assume they are enforced somewhere — they are not.

**`PHASE_COMPLETE` event is defined but never emitted:**
- The `transition()` function handles a `PHASE_COMPLETE` event type.
- No code in `converse.ts` or `action.ts` ever emits this event. The only phase-advance path used in production is `ADVANCE`.
- The `PHASE_COMPLETE` handler (which copies `event.data` into `phaseData`) is dead code.

**`phaseData` is accumulated but never read in production:**
- `ConversationState.phaseData` is a `Record<Phase, Record<string, unknown>>`. The FSM writes to it on `PHASE_COMPLETE` events and `ADVANCE` events (when `event.data` is provided). Neither write path is triggered in practice (see above). `phaseData` fields are never read in `converse.ts` or `action.ts`.

---

## What Should Be Cleaned Up

1. **Remove `exitConditions` and `entryConditions` from `PhaseDefinition`** — or add a comment to `types.ts` explicitly saying they are not enforced. Leaving them as typed interface fields implies runtime significance they don't have.

2. **Remove or stub `PHASE_COMPLETE` event handling** — `ADVANCE` is the only production path. `PHASE_COMPLETE` exists but is never emitted.

3. **Remove `_phaseData` parameter from `canAdvance()`** — it's unused and its presence implies future exit-condition checking that hasn't happened.

4. **Decide: enforce exit conditions or delete the concept** — if exit conditions are desirable for Agent SDK integration, wire them up. If not, remove the dead fields. The current half-state misleads anyone reading the types.
