---
sidebar_position: 2
---

# Conversation Phases

Kickstart guides users through six phases — Discover, Design, Generate, Review, Handoff, Deploy. This guide explains how the phase system works and how it integrates with agents and skills.

## The Phase System

### Phases

Phases are defined as a simple object in `packages/harness/src/index.ts`:

```typescript
export const Phase = {
  Discover: 'discover',
  Design: 'design',
  Generate: 'generate',
  Review: 'review',
  Handoff: 'handoff',
  Deploy: 'deploy',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
```

Each phase guides the user through one step of the deployment journey. The phases are **ordered sequentially** — each phase's `nextPhase` points to the next phase in the conversation, with `Deploy` being terminal (null).

### Phase Metadata

Phase definitions are stored inline in `packages/harness/src/index.ts` and exported as an array:

```typescript
export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  { id: Phase.Discover, label: 'Discover', description: 'What are you building?', nextPhase: Phase.Design },
  { id: Phase.Design, label: 'Design', description: 'Here is the recommended architecture.', nextPhase: Phase.Generate },
  { id: Phase.Generate, label: 'Generate', description: 'Generating your deployment files.', nextPhase: Phase.Review },
  { id: Phase.Review, label: 'Review', description: 'Review and validate your artifacts.', nextPhase: Phase.Handoff },
  { id: Phase.Handoff, label: 'Handoff', description: 'Hand off to the target platform.', nextPhase: Phase.Deploy },
  { id: Phase.Deploy, label: 'Deploy', description: 'Deploy to your environment.', nextPhase: null },
];
```

Each `PhaseDefinition` includes:
- `id`: the phase identifier
- `label`: user-facing name
- `description`: what the phase focuses on
- `nextPhase`: the following phase (or null if terminal)

### Session State

The current phase is stored as a plain string on the server-side session:

```typescript
session.state.currentPhase  // e.g. "generate"
```

This is the single source of truth. There is no separate phase state map or phase-specific data bag — all conversational state is held in the session's message history.

### Phase Advancement

The agent signals phase completion via the `intent: "advance"` field in its `AgentOutput`:

```typescript
const AgentOutput = z.object({
  message: z.string(),
  intent: z.enum(['continue', 'advance', 'revise', 'auto-continue-files']).optional(),
});
```

When `intent: "advance"` is set, `advancePhase()` looks up the current phase in `PHASE_DEFINITIONS`, retrieves its `nextPhase`, and updates `session.state.currentPhase`. There are no guards or preconditions — if the agent signals advance, the phase advances.

A2UI actions with `complete:` prefix (handled in `packages/harness/src/runtime/runner.ts`) can also trigger phase transitions from button clicks in the UI. For example, `complete:navigate:design` signals an advance.

### How the LLM Uses Phases

The agent's dynamic instructions include:
1. The current phase identifier
2. The phase description (from `PhaseDefinition`)
3. Available skills filtered for the current phase (via `resolveSkills()`)

The LLM reads this context and decides when the phase goals are met. When ready, it signals `intent: "advance"`. There are no TypeScript-enforced entry or exit conditions — the LLM's judgment drives phase transitions.

---

## How to Add a Phase

Adding a phase is rare (all six are defined and in production). If you need a new phase, follow this pattern:

### Step 1 — Add the phase constant

Edit `packages/harness/src/index.ts` and add your phase to the `Phase` object:

```typescript
export const Phase = {
  Discover: 'discover',
  Design: 'design',
  Validate: 'validate',   // ← new phase
  Generate: 'generate',
  Review: 'review',
  Handoff: 'handoff',
  Deploy: 'deploy',
} as const;
```

### Step 2 — Add the phase definition

Insert a `PhaseDefinition` in `PHASE_DEFINITIONS` at the correct position, and update the preceding entry's `nextPhase`:

```typescript
{ id: Phase.Validate, label: 'Validate', description: 'Verify the architecture against requirements.', nextPhase: Phase.Generate },
```

Update `Design`'s `nextPhase` from `Phase.Generate` to `Phase.Validate`.

### Step 3 — Register skills for the new phase

Skills activate per-turn based on `resolveSkills()`. If your pack has skills that should activate during the new phase, ensure they are registered in the pack (see [Packs and Skills](../extending/overview.md)).

### Step 4 — Write tests

Add test cases to verify that `PHASE_DEFINITIONS` chains correctly and that `advancePhase()` produces the expected next phase.

---

## Key Files

| File | Purpose |
|---|---|
| `packages/harness/src/index.ts` | Phase constants and definitions |
| `packages/harness/src/runtime/session.ts` | Session state including `currentPhase` |
| `packages/harness/src/runtime/runner.ts` | Action dispatch and phase advancement |
| `packages/pack-core/src/agents/` | Base agent definitions (`.agent.md`) |

---

## Related

- [Phase System (Architecture)](../architecture/fsm.md) — Historical context on FSM removal
- [Packs and Skills](../extending/overview.md) — How to write skills that activate in specific phases
