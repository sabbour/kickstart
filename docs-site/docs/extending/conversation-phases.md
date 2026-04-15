---
sidebar_position: 2
---

# Conversation Phases

Kickstart guides users through a multi-phase conversation — Discover, Design, Generate, Review, Handoff, Deploy. The phase engine is a pure-function state machine that determines what the AI focuses on, which skills are available, and how the system prompt is assembled at each step.

This guide explains the phase system and walks you through adding a new phase.

## How Phases Work

### The Phase Enum

Every phase is identified by a string-valued enum, defined in `packages/core/src/engine/types.ts`:

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

Each phase has a `PhaseDefinition` that describes its purpose, transition conditions, and system prompt template. Definitions live in `packages/core/src/engine/phases.ts`:

```typescript
export interface PhaseDefinition {
  id: Phase;
  label: string;
  description: string;
  entryConditions: string[];  // Human-readable — used in system prompt
  exitConditions: string[];   // Human-readable — used in system prompt
  promptTemplate: string;     // Injected as Layer 3 of the system prompt
  nextPhase: Phase | null;    // null = terminal phase
}
```

The `PHASE_DEFINITIONS` array in `phases.ts` is the authoritative phase order. The first entry is the initial phase; `nextPhase` chains them.

### The State Machine

`packages/core/src/engine/machine.ts` implements a pure state machine:

```typescript
export interface ConversationState {
  currentPhase: Phase;
  phaseStatus: Record<Phase, "pending" | "active" | "complete" | "skipped">;
  phaseData: Record<Phase, unknown>;
  isComplete: boolean;
}

// Pure transition function — no side effects
transition(state: ConversationState, event: PhaseEvent): ConversationState
```

Valid events:

| Event | Description |
|---|---|
| `START` | Begin the conversation (activates first phase) |
| `ADVANCE` | Move to `nextPhase` |
| `SKIP` | Skip current phase, same as ADVANCE but marks it `skipped` |
| `RESET` | Return to the first phase |
| `USER_INPUT` | Notify state of new user message |
| `PHASE_COMPLETE` | Mark current phase complete without advancing |

### Auto-Advance

The LLM can trigger a phase transition autonomously. When the LLM response includes `phaseComplete: true` in the JSON envelope, `handleImplicitFlags()` in `machine.ts` fires a `PHASE_COMPLETE` event automatically — no user action required.

Similarly, A2UI actions with `navigate:` or `complete:` prefixes (handled in `packages/core/src/engine/auto-continue.ts`) can trigger transitions from button clicks in the UI.

### Skill Resolution

Skills are filtered by phase. `packages/core/src/engine/skill-resolver.ts` runs a middleware chain:

1. **phaseFilter** — drops skills whose `phases` array doesn't include `currentPhase`
2. **keywordActivation** — boosts skills that match keywords in the user message
3. **priorityOrder** — sorts remaining skills by priority

Convenience groups are exported for registration:

```typescript
export const DISCOVERY_PHASES  = [Phase.Discover];
export const DESIGN_PHASES     = [Phase.Discover, Phase.Design];
export const GENERATE_PHASES   = [Phase.Generate, Phase.Review];
export const DEPLOYMENT_PHASES = [Phase.Handoff, Phase.Deploy];
```

### System Prompt Architecture

The system prompt builder (`packages/core/src/prompts/system-prompt.ts`) stacks three layers per turn:

| Layer | Content |
|---|---|
| Layer 1 | Active skills (resolved for current phase) |
| Layer 2 | Copilot extension instructions |
| Layer 3 | Phase-specific `promptTemplate` from `PhaseDefinition` |

This means the `promptTemplate` you write in a `PhaseDefinition` is injected verbatim as the innermost context ring for that phase.

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

### Step 2 — Define the phase

Open `packages/core/src/engine/phases.ts` and add a `PhaseDefinition` to the `PHASE_DEFINITIONS` array at the correct position. Update the `nextPhase` of the preceding phase to point to your new one:

```typescript
{
  id: Phase.Validate,
  label: "Validate",
  description: "Verify that the proposed architecture meets the user's requirements before generating artifacts.",
  entryConditions: [
    "Architecture design is complete",
    "User has confirmed service selection",
  ],
  exitConditions: [
    "User has approved the architecture",
    "All required fields are populated",
  ],
  promptTemplate: `
You are in the VALIDATE phase. Your goal is to confirm the architecture before generating files.

Review the proposed design with the user:
- Confirm service tiers and scaling settings
- Highlight any cost or security implications
- Ask for explicit approval before proceeding

When the user approves, set phaseComplete: true in your response envelope.
  `.trim(),
  nextPhase: Phase.Generate,
},
```

Also update the `Design` phase definition so its `nextPhase` points to `Phase.Validate` instead of `Phase.Generate`.

### Step 3 — Register skills for the new phase

If you have skills that should be active during this phase, add `Phase.Validate` to their `phases` array in your `IntegrationKit` definitions. You can also define a new phase group constant in `skill-resolver.ts`:

```typescript
export const VALIDATE_PHASES = [Phase.Validate];
```

### Step 4 — Add phase-specific prompts to kits (optional)

If an `IntegrationKit` needs to inject additional context during your phase, add it to `phasePrompts`:

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

Add test cases to:

- `packages/core/src/__tests__/phases.test.ts` — verify your `PhaseDefinition` is well-formed, `entryConditions` and `exitConditions` are populated, `nextPhase` chains correctly
- `packages/core/src/__tests__/machine.test.ts` — verify state transitions flow through your new phase correctly, auto-advance works, SKIP routes past it

```typescript
it("transitions through Validate phase", () => {
  const state = transition(initialState, { type: "START" });
  // advance to Validate
  const validated = transition(
    transition(state, { type: "ADVANCE" }), // Design
    { type: "ADVANCE" }                      // Validate
  );
  expect(validated.currentPhase).toBe(Phase.Validate);
  expect(validated.phaseStatus[Phase.Validate]).toBe("active");
});
```

---

## Key Files

| File | Purpose |
|---|---|
| `packages/core/src/engine/types.ts` | `Phase` enum and `PhaseDefinition` interface |
| `packages/core/src/engine/phases.ts` | `PHASE_DEFINITIONS` array — phase order and templates |
| `packages/core/src/engine/machine.ts` | State machine: `ConversationState`, `transition()`, `handleImplicitFlags()` |
| `packages/core/src/engine/skill-resolver.ts` | Phase-aware skill filtering and phase group constants |
| `packages/core/src/engine/auto-continue.ts` | A2UI action → phase transition wiring |
| `packages/core/src/prompts/system-prompt.ts` | 3-layer system prompt assembly |
| `packages/core/src/__tests__/phases.test.ts` | Phase definition tests |
| `packages/core/src/__tests__/machine.test.ts` | State machine transition tests |
