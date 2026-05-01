---
sidebar_position: 2
---

# Conversation Phases

Kickstart guides users through six phases — **Discover → Design → Generate → Review → Handoff → Deploy**. The phase enum is the single source of truth for which step the user is on; agents and components both read it.

---

## The enum

`Phase` is a `const` object exported from `packages/harness/src/index.ts`:

```ts
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

`PHASE_DEFINITIONS` (same file) carries the human-readable label, description, and `nextPhase` link. `advancePhase(current)` returns the next phase, or the same one if there is no successor.

A parallel set of types lives in `packages/harness/src/a2ui/chat-a2ui.ts` for chat-side rendering: `ConversationPhaseId`, `CONVERSATION_PHASE_ORDER`, `CONVERSATION_PHASE_LABELS`, `extractConversationPhase`, `normalizeConversationPhase`. The two enums are kept aligned by definition.

---

## How phase advances

Phase belongs to the **agent**, not the runner. Agent prompts decide when to advance and surface the change in their `AgentOutput`:

```ts
// packages/harness/src/types/agent-output.ts
export const AgentOutput = z.object({
  message: strictOptional(z.string()),
  intent: strictOptional(z.enum(['continue', 'advance', 'revise', 'auto-continue-files'])),
}).strict();
```

`intent === 'advance'` tells the harness to call `advancePhase(session.currentPhase)`; `intent === 'revise'` keeps the phase but pulls in a different agent or skill set; `intent === 'auto-continue-files'` is the codesmith-chain marker that triggers another iteration without user input.

The runner emits a `phase` SSE event on each agent **handoff** (`runtime/runner.ts` — `sseWrite('phase', { agent: newAgentName })`). Phase transitions that don't involve a handoff simply update `session.currentPhase` and the next `updateComponents` for the phase tracker reflects the change.

---

## The phase tracker component

`ConversationPhaseComponent` is a fixed A2UI component type:

```ts
export type ConversationPhaseComponent = {
  type: 'ConversationPhase';
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
};
```

It is rendered by the SPA when surfaces include a node of this type. Any agent can update it via `core.emit_ui` with the latest `currentPhase` and the phase list.

---

## Reading phase from the chat history

`extractConversationPhase(items)` walks an array of A2UI message envelopes (most recent first) and returns the phase carried by the most recent `ConversationPhase` component, or `null` if none exists. `prepareChatA2ui(items, turnId, opts?)` rebuilds the chat surface for a turn including the resolved phase. Both helpers are re-exported from `@aks-kickstart/harness`.

---

## Adding a phase

Phases are part of the harness contract — packs do not define new ones. To extend, edit `packages/harness/src/index.ts` (`Phase`, `PHASE_DEFINITIONS`) and `packages/harness/src/a2ui/chat-a2ui.ts` (`ConversationPhaseId`, `CONVERSATION_PHASE_ORDER`, `CONVERSATION_PHASE_LABELS`) in the same change, then update agent frontmatter that hard-codes phase strings.

This is intentionally a heavyweight operation: the phase enum participates in chat history hydration, and shipping a mismatched enum across server and client breaks rehydration.

---

## What phases do NOT do

- They do not gate guardrails. Guardrails apply to **agents** via `appliesTo` globs, not phases.
- They do not gate tools. Tool allowlists are per-agent.
- They are not part of the LLM system prompt. The agent's instructions and matched skills carry context — phase is metadata for the UI.
