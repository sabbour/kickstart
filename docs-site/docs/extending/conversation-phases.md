---
sidebar_position: 2
---

# Conversation Phases

Kickstart guides users through six phases — Discover, Design, Generate, Review, Handoff, Deploy. This guide explains how the phase system works and how to extend it.

## How Phases Work

### The Phase Enum

Every phase is a string constant defined in `packages/harness/src/types/phases.ts`:

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

Each phase has a `PhaseDefinition` in `packages/harness/src/types/phases.ts`:

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

A2UI actions with `complete:` or `continue:` prefixes (handled in `packages/harness/src/runtime/runner.ts`) can trigger phase transitions from button clicks in the UI. After stripping the `complete:`/`continue:` prefix, if the resulting action name starts with `navigate:` or `nav:`, it is treated as a phase-navigation signal — for example, the full action name is `complete:navigate:design`.

### How the LLM Navigates Phases

The system prompt includes the current phase identifier and the `description` from its `PhaseDefinition`. The LLM reads this context, determines when the phase goals are met, and signals `phaseComplete: true`. There are no TypeScript-enforced entry or exit conditions — the LLM decides.

### Skill Resolution

Skills are filtered per agent turn. `packages/harness/src/runtime/skill-resolver.ts` exports `resolveSkills()` which:

1. Matches skills by `appliesTo` glob against the current agent name
2. Keyword-activates additional skills from recent conversation turns
3. Sorts the combined set by `priority` (higher first)
4. Caps at the token budget (2000 tokens default)

### System Prompt Architecture

The system prompt is assembled per turn by the harness:

| Layer | Content |
|---|---|
| Active skills | Resolved for current agent by `resolveSkills()` |
| Agent base instructions | Static `.agent.md` body |
| Component catalog | Registered component type list |

---

## How to Add a Phase

### Step 1 — Add the enum value

Open `packages/harness/src/types/phases.ts` and add your new phase to the `Phase` enum:

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

Open `packages/harness/src/types/phases.ts` and insert a `PhaseDefinition` at the correct position in `PHASE_DEFINITIONS`. Update the `nextPhase` of the preceding entry to point to your new phase:

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

Add `Phase.Validate` to the `phases` array of any skills that should activate during this phase:

```typescript
// In your pack's SKILL.md frontmatter:
// appliesTo: "aks.*"
// keywords:
//   - validate
//   - architecture check
```

Or in a typed skill registration:

```typescript
const mySkill: Skill = {
  id: "my-skill",
  name: "My Skill",
  appliesTo: "aks.*",
  keywords: ["validate", "architecture check"],
  content: "When validating architecture, ...",
};
```

### Step 4 — Write tests

Add test cases to the harness skill resolver tests to verify your phase's skill activation behavior. Also confirm that `PHASE_DEFINITIONS` correctly chains `nextPhase` through all phases.

## Key Files

| File | Purpose |
|---|---|
| `packages/harness/src/runtime/session.ts` | Session state including `currentPhase` |
| `packages/harness/src/runtime/skill-resolver.ts` | Per-turn skill filtering |
| `packages/pack-core/src/agents/` | Base agent definitions (`.agent.md`) |
