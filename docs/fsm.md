# FSM — Confirmed for Deletion

> **Status: SCHEDULED FOR DELETION**
> Architectural decision recorded in `.squad/decisions.md`. `machine.ts` and `phases.ts` are to be deleted. This document describes what is being removed, what replaces it, and the migration checklist.

---

## What Is Being Deleted

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/engine/machine.ts` | 157 | Pure-function state machine: `transition()`, `handleImplicitFlags()`, `canAdvance()` |
| `packages/core/src/engine/phases.ts` | ~120 | Phase definitions with `exitConditions`, `entryConditions`, prompt templates |
| `ConversationState.engineState` | — | FSM state slice in session: `currentPhase`, `phaseStatuses`, `phaseData` |
| `ConversationEvent` type | — | `USER_MESSAGE`, `PHASE_COMPLETE` enum used by machine |
| `PhaseStatus` type | — | `"active"` / `"complete"` string enum; read in `converse.ts` and `action.ts` |

### Dead Code That Goes Away Automatically

- `exitConditions` / `entryConditions` fields — defined in `PhaseDefinition`, never read at runtime.
- `PHASE_COMPLETE` event — handled in `machine.ts`, never emitted by `converse.ts` or `action.ts`.
- `phaseData` on `ConversationState` — written only by the dead `PHASE_COMPLETE` path, never read.
- `_phaseData` param in `canAdvance()` — unused placeholder.

---

## What Replaces It

### 1. Plain Phase String

```typescript
// Before: session.engineState.currentPhase (FSM-managed)
// After:  session.state.currentPhase (plain string, LLM sets directly)
session.state.currentPhase = "generate";  // LLM writes this via JSON envelope
```

The LLM already determines phase transitions narratively. The FSM enforced this in TypeScript code that duplicated the LLM's own judgment. Removing it is not a loss of correctness — it's removing a second layer that never added a constraint the LLM wasn't already enforcing.

### 2. Numbered Prompt Blocks in `system-prompt.ts`

The phase progression (what happens in each phase, when to move on) moves from `phases.ts` TypeScript structs into `═══ N. SECTION ═══` narrative blocks in the system prompt.

Reference pattern from `sabbour/adaptive-ui-try-aks` (`BASE_SYSTEM_PROMPT`):

```
═══════════════════════════════════════════════════════
═══ 1. BEFORE YOU START ═══
═══════════════════════════════════════════════════════
[narrative for what the LLM should do at the start of the conversation]

═══════════════════════════════════════════════════════
═══ 2. GATHER REQUIREMENTS ═══
═══════════════════════════════════════════════════════
[narrative for requirements gathering, when to proceed]

═══════════════════════════════════════════════════════
═══ 3. GENERATE ═══
═══════════════════════════════════════════════════════
[narrative for code generation, file creation conventions]
```

The full sequence is always in the prompt. `buildSystemPrompt()` no longer needs a `phase` parameter to select a template — the LLM reads the numbered blocks and knows where it is from the conversation history.

### 3. Model Routing — Same Interface, Different Source

`resolveConverseModelRoute` reads a phase string. After FSM removal:

```typescript
// Before
const phase = session.engineState.currentPhase;  // FSM-managed enum value

// After
const phase = session.state.currentPhase;        // plain string from LLM
```

The routing logic itself is unchanged. `Phase.Generate` enum becomes `"generate"` string literal. `routingPhaseTrusted` flag is unchanged.

### 4. `filesComplete` Flag — Unchanged

The `filesComplete` auto-continue flag is **not FSM**. It is a client-side reactive check on whether the A2UI FileEditor has completed rendering all generated files. It stays exactly as-is after FSM removal.

---

## Migration Checklist

- [ ] Delete `packages/core/src/engine/machine.ts`
- [ ] Delete `packages/core/src/engine/phases.ts`
- [ ] Remove `ConversationState.engineState` slice; add `state: Record<string, string>` (or typed object)
- [ ] Remove `ConversationEvent`, `PhaseStatus`, `PhaseDefinition` types from `types.ts`
- [ ] Update `system-prompt.ts`: replace phase-template selection with numbered `═══ N. SECTION ═══` blocks
- [ ] Update `converse.ts`: replace `session.engineState.currentPhase` reads with `session.state.currentPhase`
- [ ] Update `converse-model-router.ts`: replace `Phase.Generate` enum with `"generate"` string
- [ ] Update `session-store.ts`: remove FSM state from session initializer and rehydration
- [ ] Delete `packages/core/src/__tests__/machine.test.ts`
- [ ] Delete `packages/core/src/__tests__/phases.test.ts`
- [ ] Update `packages/core/src/engine/index.ts`: remove `machine` and `phases` exports
- [ ] Verify: `resolveSkills(phase, kits)` and `resolveConversationSkills(message, phase, context)` both take a phase string — no changes needed to either function; only the source of that string changes

---

## Why This Is the Right Call

The FSM added a TypeScript enforcement layer for phase transitions that:

1. **Was never actually used** — `exitConditions` and `entryConditions` in `phases.ts` are defined but not read by `machine.ts` at runtime.
2. **Duplicated the LLM's judgment** — the LLM navigates phase transitions based on its system prompt, not the state machine.
3. **Added coupling** — `converse.ts` had to import and call `transition()` even though the LLM was the real decision-maker.
4. **Has dead internal paths** — `PHASE_COMPLETE` event is handled but never emitted; `phaseData` is written by that dead path and never read.

Replacing it with a plain `session.state.currentPhase` string reduces the system to its working parts.
