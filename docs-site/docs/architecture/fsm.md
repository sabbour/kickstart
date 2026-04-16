---
sidebar_position: 3
---

# Conversation State Machine (FSM)

The FSM tracks which phase the conversation is in and enforces forward-only progression. It does NOT enforce exit conditions — those are LLM-driven.

> **Source:** `packages/core/src/engine/machine.ts`, `packages/core/src/engine/phases.ts`, `packages/core/src/engine/types.ts`

## What the FSM Enforces

- **Current phase** — `state.currentPhase` is always authoritative.
- **Forward-only transitions** — phases advance in order, never backward.
- **Phase status** — `pending | active | complete | skipped` per phase.
- **Completion** — `state.isComplete = true` after Deploy advances.

## What the FSM Does NOT Enforce

- **Exit conditions** — `phases.ts` lists conditions like `"user has approved the plan"`. These are strings in the `PhaseDefinition` struct. **Zero code reads them.** The FSM advances when it receives an ADVANCE event regardless of whether exit conditions are met.
- **Entry conditions** — same: narrative only.
- **Phase content quality** — the FSM tracks state, not what was said.

**The LLM decides WHEN to advance. The FSM decides WHAT is allowed (forward only).**

## The Six Phases

```
Discover → Design → Generate → Review → Handoff → Deploy
```

| Phase | Label | LLM Goal |
|-------|-------|----------|
| `discover` | Discover | Learn app name, runtime, description |
| `design` | Design | Confirm services, present architecture |
| `generate` | Generate | Produce Dockerfile, manifests, CI/CD workflow |
| `review` | Review | Walk through artifacts, show cost estimate |
| `handoff` | Handoff | Create/select GitHub repo, push files, Codespace link |
| `deploy` | Deploy | Trigger GitHub Actions, show deployment status and URL |

Source: `PHASE_DEFINITIONS` in `packages/core/src/engine/phases.ts`.

## Phase Transition Triggers

### Trigger 1 — LLM sets `phaseComplete: true`

```typescript
// packages/core/src/engine/machine.ts
export function handleImplicitFlags(
  state: ConversationState,
  flags: ImplicitFlags,
): ConversationState {
  if (flags.phaseComplete === true && canAdvance(state)) {
    return transition(state, { type: "ADVANCE" });
  }
  return state;
}

export function canAdvance(state, _phaseData?): boolean {
  // NOTE: does NOT check exit conditions
  return state.phaseStatus[state.currentPhase] === "active" && !state.isComplete;
}
```

### Trigger 2 — UI Button event

A2UI Button with `event.name: "complete:navigate:{phase}"` → client sends event → server emits ADVANCE.

## State Machine Events

```typescript
type ConversationEvent =
  | { type: "START" }                       // Reset to Discover
  | { type: "ADVANCE" }                     // Advance to next phase  ← only path used in production
  | { type: "SKIP" }                        // Skip, advance to next
  | { type: "PHASE_COMPLETE"; phase: Phase; data?: Record<string, unknown> }  ← never emitted
  | { type: "RESET" }                       // Full reset
  | { type: "USER_INPUT"; input?: string }  // No-op
```

`transition()` is a pure function — returns new state, never mutates input.

## `PhaseStatus` — Used or Dead?

**Used.** `phaseStatus` is read in production:

- `converse.ts` lines 421/423 — checks `"active"` / `"complete"` for phase progress info
- `action.ts` lines 152/154 — same check for action event routing

`PhaseStatus` is live computed state. Only `exitConditions`, `entryConditions`, and `PHASE_COMPLETE` event handling are dead.

## Code Health Notes

:::danger `exitConditions` and `entryConditions` are dead constraint logic
Defined in `PhaseDefinition` interface (`types.ts` lines 47, 49), populated in every phase definition in `phases.ts`, **never read anywhere in the runtime** — not by `machine.ts`, not by `converse.ts`, not by `action.ts`. Anyone reading `types.ts` will assume these are enforced. They are not.
:::

:::warning `PHASE_COMPLETE` event is handled but never emitted
`transition()` handles a `PHASE_COMPLETE` event that copies `event.data` into `phaseData`. No production code ever emits this event. The only advance path in use is `ADVANCE`. The `PHASE_COMPLETE` handler and all `phaseData` writes are dead code.
:::

:::warning `phaseData` is written but never read
`ConversationState.phaseData` accumulates data per phase via `PHASE_COMPLETE` events. Since `PHASE_COMPLETE` is never emitted, `phaseData` is always empty at runtime. It is never read in `converse.ts` or `action.ts`.
:::

:::note `_phaseData` parameter in `canAdvance()` is unused
The parameter exists as a placeholder for future exit condition checking. The source comment says "In a real implementation, this would check exit conditions against the accumulated phase data." It does not do that.
:::

## What Should Be Cleaned Up

1. **Remove `exitConditions` and `entryConditions` from `PhaseDefinition`** (or add an explicit code comment that they are narrative-only, not enforced). Typed interface fields that are never read mislead Agent SDK implementors.

2. **Remove `PHASE_COMPLETE` event handling** — or emit it from somewhere. Dead event handler in a state machine is a maintenance trap.

3. **Remove `phaseData` from `ConversationState`** — or start using it. If Agent SDK integration (issue #330) needs per-phase data accumulation, wire it up then. Right now it's allocated and populated by dead paths.

4. **Remove `_phaseData` from `canAdvance()`** — or implement exit condition checking. The unused parameter with its aspirational comment is a distraction.
