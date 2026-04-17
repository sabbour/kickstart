---
sidebar_position: 2
---

# Conversation Phases

Kickstart guides users through six phases — Discover, Design, Generate, Review, Handoff, Deploy. This guide explains how the phase system works and how to extend it.

## How Phases Work

### The Phase Enum

Every phase is a string constant defined in `packages/core/src/engine/types.ts`:

```typescript
export enum Phase {
  Discover = "discover",
  Design   = "design",
  Generate = "generate",
  Review   = "review",
  Handoff  = "handoff",
  Deploy   = "deploy",
}
```

### Phase Definitions

Each phase has a `PhaseDefinition` in `packages/core/src/engine/phases.ts`:

```typescript
export interface PhaseDefinition {
  id: Phase;
  label: string;
  description: string;
  nextPhase: Phase | null;   // null = terminal phase
}
```

The `PHASE_DEFINITIONS` array is the authoritative phase order. The first entry is the initial phase; `nextPhase` chains them together.

### Session State

The current phase is a plain string stored on the server-side session:

```typescript
session.state.currentPhase  // e.g. "generate"
```

This is the single source of truth. No FSM state slice, no `phaseStatuses` map.

### Phase Advancement

Phase transitions happen in `converse.ts` when the LLM returns `phaseComplete: true` in its JSON response envelope:

```typescript
// converse.ts — simplified
if (llmResponse.phaseComplete) {
  session.state.currentPhase = advancePhase(session.state.currentPhase);
}
```

`advancePhase()` looks up the current phase in `PHASE_DEFINITIONS` and returns `nextPhase`. There is no event system or transition guard — the LLM's signal is the only trigger.

A2UI actions with `navigate:` or `complete:` prefixes (handled in `packages/core/src/engine/auto-continue.ts`) can also trigger phase transitions from button clicks in the UI.

### How the LLM Navigates Phases

The system prompt includes the current phase identifier and the `description` from its `PhaseDefinition`. The LLM reads this context, determines when the phase goals are met, and signals `phaseComplete: true`. There are no TypeScript-enforced entry or exit conditions — the LLM decides.

### Skill Resolution

Skills are filtered by phase. `packages/core/src/engine/skill-resolver.ts` runs a middleware chain:

1. **phaseFilter** — drops skills whose `phases` array doesn't include `currentPhase`
2. **keywordActivation** — boosts skills that match keywords in the user message
3. **priorityOrder** — sorts remaining skills by priority

Phase group constants for skill registration:

```typescript
export const DISCOVERY_PHASES  = [Phase.Discover];
export const DESIGN_PHASES     = [Phase.Discover, Phase.Design];
export const GENERATE_PHASES   = [Phase.Generate, Phase.Review];
export const DEPLOYMENT_PHASES = [Phase.Handoff, Phase.Deploy];
```

### System Prompt Architecture

The system prompt builder (`packages/core/src/prompts/system-prompt.ts`) assembles context per turn:

| Layer | Content |
|---|---|
| Active skills | Resolved for current phase (Mechanism A) |
| Copilot extension instructions | Static per-turn context |
| Per-turn domain injection | Resolved from user message (Mechanism B) |

Phase context (current phase + description) is included in the prompt so the LLM knows where it is in the conversation.

---

## How to Add a Phase

### Step 1 — Add the enum value

Open `packages/core/src/engine/types.ts` and add your new phase to the `Phase` enum:

```typescript
export enum Phase {
  Discover  = "discover",
  Design    = "design",
  Validate  = "validate",   // ← new phase
  Generate  = "generate",
  Review    = "review",
  Handoff   = "handoff",
  Deploy    = "deploy",
}
```

### Step 2 — Add the phase definition

Open `packages/core/src/engine/phases.ts` and insert a `PhaseDefinition` at the correct position in `PHASE_DEFINITIONS`. Update the `nextPhase` of the preceding entry to point to your new phase:

```typescript
{
  id: Phase.Validate,
  label: "Validate",
  description: "Verify that the proposed architecture meets requirements before generating artifacts.",
  nextPhase: Phase.Generate,
},
```

Also update the `Design` entry so its `nextPhase` is `Phase.Validate`.

### Step 3 — Register skills for the new phase

Add `Phase.Validate` to the `phases` array of any skills that should activate during this phase. Define a phase group constant in `skill-resolver.ts` if needed:

```typescript
export const VALIDATE_PHASES = [Phase.Validate];
```

### Step 4 — Add phase-specific prompts to kits (optional)

If an `IntegrationKit` needs to inject extra context during your phase, use `phasePrompts`:

```typescript
const myKit: IntegrationKit = {
  // ...
  phasePrompts: {
    [Phase.Validate]: [
      "When validating architecture, always check for missing health check configurations.",
    ],
  },
};
```

### Step 5 — Write tests

Add test cases to `packages/core/src/__tests__/phases.test.ts` to verify your `PhaseDefinition` is well-formed and `nextPhase` chains correctly.

---

## Key Files

| File | Purpose |
|---|---|
| `packages/core/src/engine/types.ts` | `Phase` enum and `PhaseDefinition` interface |
| `packages/core/src/engine/phases.ts` | `PHASE_DEFINITIONS` — phase catalog and order |
| `packages/core/src/engine/skill-resolver.ts` | Phase-aware skill filtering and phase group constants |
| `packages/core/src/engine/auto-continue.ts` | A2UI action → phase transition wiring |
| `packages/core/src/prompts/system-prompt.ts` | System prompt assembly including phase context |
