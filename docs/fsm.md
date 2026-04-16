# Conversation State Machine (FSM)

This document describes what the FSM actually does, what it does NOT do, and how phase transitions trigger.

> **Source:** `packages/core/src/engine/machine.ts` (157 lines), `packages/core/src/engine/phases.ts`, `packages/core/src/engine/types.ts`

---

## What the FSM Enforces

1. **Current phase tracking** — `state.currentPhase` always reflects where the conversation is.
2. **Forward-only progression** — phases advance in sequence: Discover → Design → Generate → Review → Handoff → Deploy. There is no backward transition.
3. **Phase status tracking** — each phase has a status: `pending | active | complete | skipped`.
4. **Completion detection** — when the last phase (Deploy) advances, `state.isComplete = true`.

## What the FSM Does NOT Enforce

- **Exit conditions** — `phases.ts` lists exit conditions like `"user has approved the plan"` and `"appName is defined"`. These are **narrative strings for LLM guidance only**. No code checks them. The FSM advances when it receives an ADVANCE event regardless of whether exit conditions are met.
- **Entry conditions** — same: listed for LLM context, not code-checked.
- **Phase content** — the FSM does not know what was said in a phase. It tracks state, not content.

**Key insight:** The system is LLM-driven within FSM guardrails. The LLM decides WHEN a phase is complete; the FSM decides WHAT transitions are allowed (forward only).

---

## The Six Phases

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

There are two ways a phase advances:

### Trigger 1 — LLM sets `phaseComplete: true`

The LLM outputs a JSON envelope each turn:
```json
{ "message": "...", "a2ui": [...], "phaseComplete": true }
```

When `phaseComplete: true`, the converse handler calls `handleImplicitFlags()`:

```typescript
// packages/core/src/engine/machine.ts
export function handleImplicitFlags(state, flags): ConversationState {
  if (flags.phaseComplete === true && canAdvance(state)) {
    return transition(state, { type: "ADVANCE" });
  }
  return state;
}
```

`canAdvance()` returns `true` if the current phase is `active` and the conversation is not complete. There is no content-based check.

### Trigger 2 — User clicks a Button with `event.name: "complete:navigate:{phase}"`

A2UI Button components in the LLM's JSON response can carry event metadata. When a user clicks a button with `event.name: "complete:navigate:design"` (for example), the client sends this event to the server, which triggers an ADVANCE.

---

## State Machine Events

```typescript
type ConversationEvent =
  | { type: "START" }           // Reset to initial state
  | { type: "ADVANCE" }         // Advance to next phase
  | { type: "SKIP" }            // Skip current phase, advance to next
  | { type: "PHASE_COMPLETE"; phase: Phase; data?: Record<string, unknown> }
  | { type: "RESET" }           // Full reset
  | { type: "USER_INPUT"; input?: string }  // No-op (state unchanged)
```

The `transition()` function is a pure function — it returns a new state object and never mutates the input.

---

## Phase Status Values

```typescript
type PhaseStatus = "pending" | "active" | "complete" | "skipped";
```

- `pending` — not yet reached
- `active` — currently in this phase
- `complete` — phase advanced normally
- `skipped` — phase was skipped via SKIP event

---

## FSM in the Converse Handler

The FSM `engineState` lives in the server session. Each turn:

1. `getSafeCurrentPhase(engineState)` reads current phase.
2. Phase is used to resolve skills, route model, build system prompt.
3. After OpenAI responds, `handleImplicitFlags()` may advance the phase.
4. `session.state.currentPhase` is synced from `engineState.currentPhase`.
5. Updated phase is returned in the API response so the client can reflect it.

```typescript
// converse.ts (simplified)
const currentPhase = getSafeCurrentPhase(engineState);
// ... build prompt, call OpenAI ...
session.engineState = handleImplicitFlags(session.engineState, { phaseComplete });
session.state.currentPhase = session.engineState.currentPhase;
```

---

## What `canAdvance()` Actually Checks

```typescript
export function canAdvance(state, _phaseData?): boolean {
  // NOTE: The comment in the source says "In a real implementation, this would
  // check exit conditions against the accumulated phase data."
  // It does NOT do that. It only checks:
  return state.phaseStatus[state.currentPhase] === "active" && !state.isComplete;
}
```

Exit condition checking is not implemented. The function comment acknowledges this explicitly.
