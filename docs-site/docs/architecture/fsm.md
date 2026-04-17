---
sidebar_position: 3
---

# Phase System (archived)

:::caution This page is archived
The TypeScript state machine (`machine.ts`) documented here was removed in [PR #412](https://github.com/sabbour/kickstart/pull/412). The FSM was never exercised at runtime — the LLM navigated phases entirely from its system prompt.

**For current phase documentation see [Architecture Overview](./overview.md) and [Prompt Pipeline](./prompt-pipeline.md).**
:::

The conversation engine now uses a lightweight, LLM-driven phase system. Phases are a static array in `packages/core/src/engine/phases.ts`; the current phase is a plain string on the server-side session (`session.state.currentPhase`). Phase advancement happens when the model emits `phaseComplete: true` in the JSON envelope — no event system, no transition guards.

With the Agents SDK migration (#330) the route-management model has changed further. See the decisions log (`.squad/decisions.md`) for the full rationale.
