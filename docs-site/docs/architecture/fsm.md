---
sidebar_position: 3
---

# FSM — Confirmed for Deletion

:::danger Scheduled for deletion
`machine.ts` and `phases.ts` are confirmed for deletion per architectural decision in `.squad/decisions.md`. Do not add new dependencies on the FSM. The migration plan is below.
:::

---

## What Is Being Deleted

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/engine/machine.ts` | 157 | Pure-function state machine: `transition()`, `handleImplicitFlags()`, `canAdvance()` |
| `packages/core/src/engine/phases.ts` | ~120 | Phase definitions with `exitConditions`, `entryConditions`, prompt templates |
| `ConversationState.engineState` | — | FSM state slice in session: `currentPhase`, `phaseStatuses`, `phaseData` |
| `ConversationEvent` type | — | `USER_MESSAGE`, `PHASE_COMPLETE` enum used by machine |
| `PhaseStatus` type | — | `"active"` / `"complete"` string enum read in `converse.ts` and `action.ts` |

### Dead Code That Goes Away Automatically

:::note
These fields and code paths are currently in the codebase but never exercised at runtime. FSM removal deletes them without any behavioral change.
:::

- `exitConditions` / `entryConditions` — defined in `PhaseDefinition`, never read at runtime
- `PHASE_COMPLETE` event — handled in `machine.ts`, never emitted by any handler
- `phaseData` on `ConversationState` — written only by the dead `PHASE_COMPLETE` path, never read
- `_phaseData` param in `canAdvance()` — unused placeholder

---

## What Replaces It

### Plain Phase String

```typescript
// Before: session.engineState.currentPhase (FSM-managed enum)
// After:  session.state.currentPhase (plain string, LLM sets directly via JSON envelope)
```

### Numbered Prompt Blocks

Phase progression moves from `phases.ts` TypeScript structs into `═══ N. SECTION ═══` narrative blocks in the system prompt (pattern from `sabbour/adaptive-ui-try-aks`):

```
═══ 1. BEFORE YOU START ═══
...
═══ 2. GATHER REQUIREMENTS ═══
...
═══ 3. GENERATE ═══
...
```

The full sequence is always present. The LLM reads the numbered blocks and knows its position from conversation history.

### Model Routing — Interface Unchanged

`resolveConverseModelRoute` reads a phase string. Only the source changes:

```typescript
// Before: session.engineState.currentPhase  (FSM enum)
// After:  session.state.currentPhase         (plain string)
```

`routingPhaseTrusted` flag is unchanged. `Phase.Generate` enum becomes `"generate"` string literal.

### `filesComplete` Flag — Unchanged

The `filesComplete` auto-continue flag is **not FSM**. It is a client-side reactive check. It stays exactly as-is.

---

## Migration Checklist

- [ ] Delete `packages/core/src/engine/machine.ts`
- [ ] Delete `packages/core/src/engine/phases.ts`
- [ ] Remove `ConversationState.engineState` slice; add `state: Record<string, string>`
- [ ] Remove `ConversationEvent`, `PhaseStatus`, `PhaseDefinition` types from `types.ts`
- [ ] Update `system-prompt.ts`: replace phase-template selection with numbered blocks
- [ ] Update `converse.ts`: replace `session.engineState.currentPhase` with `session.state.currentPhase`
- [ ] Update `converse-model-router.ts`: replace `Phase.Generate` enum with `"generate"` string
- [ ] Update `session-store.ts`: remove FSM state from session initializer and rehydration
- [ ] Delete `packages/core/src/__tests__/machine.test.ts`
- [ ] Delete `packages/core/src/__tests__/phases.test.ts`
- [ ] Update `packages/core/src/engine/index.ts`: remove `machine` and `phases` exports
- [ ] Verify `resolveSkills(phase, kits)` and `resolveConversationSkills(message, phase, context)` — both accept phase strings; no changes needed to either function

---

## Why

The FSM added TypeScript enforcement for phase transitions that:

1. **Was never actually used** — `exitConditions` and `entryConditions` are typed but not read at runtime
2. **Duplicated the LLM's judgment** — the LLM navigates transitions from its system prompt, not the state machine
3. **Added coupling** — `converse.ts` called `transition()` even though the LLM was the real decision-maker
4. **Has dead internal paths** — `PHASE_COMPLETE` is handled but never emitted; `phaseData` is written by a dead path and never read

Replacing it with `session.state.currentPhase` removes the redundant layer while keeping all behavior.
