# Decision: A2UI Action Dispatch — Re-Prompt Pattern Implemented

**Date:** 2025-07-26
**Author:** Bender
**Status:** Implemented
**Relates to:** F17, R19, Phase 1 of action loop

## What

Wired the A2UI action handler so component interactions (button clicks, form submissions, selections) are no longer no-ops. All actions are translated to natural language messages and sent back to the LLM as conversation re-prompts.

## Action Routing Convention

Actions are categorized by name prefix:
- **No prefix** (default `reply`) → `[Action: select-runtime] runtime: Node.js` → re-prompts LLM
- **`navigate:` / `nav:`** → same as reply, but also fires an optional local callback for phase tracking
- **`api:`** → stubbed for ServiceConnector (Phase 3). Currently falls back to LLM re-prompt with a console warning.

## Why

Per decision F17: "ALL three samples handle user button clicks by translating the action into natural language and re-prompting the LLM." The LLM stays in full control of state transitions. No separate action handlers needed for v1.

## Impact

- Components using `action.event.name` + `action.event.context` now trigger real effects
- `useA2UI` hook accepts an optional `actionHandler` (backward-compatible — Playground still works without one)
- Foundation for Phase 2 (tool system) and Phase 3 (ServiceConnector)
