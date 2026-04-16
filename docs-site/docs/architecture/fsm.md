---
sidebar_position: 3
---

# Conversation State Machine (FSM)

The FSM tracks which phase the conversation is in and enforces forward-only progression. It does NOT enforce exit conditions — those are LLM-driven.

> **Source:** `packages/core/src/engine/machine.ts`, `packages/core/src/engine/phases.ts`, `packages/core/src/engine/types.ts`

---

## What the FSM Enforces

- **Current phase** — `state.currentPhase` is always the authoritative phase.
- **Forward-only transitions** — phases advance in order, never backward.
- **Phase status** — each phase carries `pending | active | complete | skipped`.
- **Completion** — `state.isComplete = true` after the last phase (Deploy) advances.

## What the FSM Does NOT Enforce

- **Exit conditions** — `phases.ts` lists conditions like `"user has approved the plan"`. These are strings for LLM context only. **No code checks them.**
- **Entry conditions** — same: narrative only.
- **Phase content** — the FSM tracks state, not what was discussed.

**The LLM decides WHEN to advance. The FSM decides WHAT is allowed (forward only).**

---

## The Six Phases

```
Discover → Design → Generate → Review → Handoff → Deploy
```

| Phase ID | Label | LLM Goal |
|----------|-------|----------|
| `discover` | Discover | Learn app name, runtime, description |
| `design` | Design | Confirm service requirements, present architecture |
| `generate` | Generate | Produce Dockerfile, K8s manifests, GitHub Actions workflow |
| `review` | Review | Walk through generated files, show cost estimate |
| `handoff` | Handoff | Create/select GitHub repo, push files, Codespace link |
| `deploy` | Deploy | Trigger GitHub Actions, show deployment status and URL |

Source: `PHASE_DEFINITIONS` in `packages/core/src/engine/phases.ts`.

---

## How Phase Transitions Trigger

### Via LLM — `phaseComplete: true` in JSON response

The LLM outputs a JSON envelope each turn:
```json
{ "message": "...", "a2ui": [...], "phaseComplete": true }
```

The converse handler calls `handleImplicitFlags()`:

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
```

`canAdvance()` only checks that the current phase is `active` and the conversation is not complete. It does NOT check exit conditions.

### Via UI Button — `event.name: "complete:navigate:{phase}"`

A2UI Button components in the LLM's JSON response can carry:
```json
{ "type": "Button", "label": "Looks good →", "event": { "name": "complete:navigate:design" } }
```
When clicked, the client sends this event to the server, triggering an ADVANCE.

---

## State Machine Events

```typescript
type ConversationEvent =
  | { type: "START" }                     // Reset to Discover
  | { type: "ADVANCE" }                   // Advance to next phase
  | { type: "SKIP" }                      // Skip current phase, go to next
  | { type: "PHASE_COMPLETE"; phase: Phase; data?: Record<string, unknown> }
  | { type: "RESET" }                     // Full reset to Discover
  | { type: "USER_INPUT"; input?: string } // No-op, state unchanged
```

`transition()` is a pure function — returns a new state, never mutates input.

---

## Phase Status

```typescript
type PhaseStatus = "pending" | "active" | "complete" | "skipped";
```

Initial state: `discover = active`, all others = `pending`.

After ADVANCE: current phase → `complete`, next phase → `active`.

After SKIP: current phase → `skipped`, next phase → `active`.

---

## FSM in the Request Handler

```typescript
// packages/web/api/src/functions/converse.ts (simplified)
const currentPhase = getSafeCurrentPhase(session.engineState);

// ... build prompt, call OpenAI, parse response ...

// Advance phase if LLM said so
session.engineState = handleImplicitFlags(session.engineState, { phaseComplete });

// Keep session.state in sync
session.state.currentPhase = session.engineState.currentPhase;
```

The updated phase is returned to the client in the SSE "done" event so the UI can reflect phase progress.

---

## `canAdvance()` — What It Actually Checks

```typescript
export function canAdvance(state: ConversationState, _phaseData?: Record<string, unknown>): boolean {
  // NOTE: source comment says "In a real implementation, this would check
  // exit conditions against the accumulated phase data."
  // It does not do that.
  return state.phaseStatus[state.currentPhase] === "active" && !state.isComplete;
}
```

Exit condition checking is **not implemented**. The code comment in `machine.ts` acknowledges this explicitly.
