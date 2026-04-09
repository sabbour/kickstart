# Decision: Playground JSON tab shows real A2UI messages for all scenarios

**Date:** 2025-07-30
**Author:** Fry (Frontend Dev)
**Status:** Accepted

## Context

The Playground's JSON tab showed a placeholder object for keyword-based Kickstart Scenarios instead of the actual A2UI messages. This defeated the purpose of the JSON inspector — users couldn't see what messages the demo engine produces.

## Decision

`getScenarioJson()` now calls `resetDemoState()` + `getDemoResponse()` (mirroring `injectScenario()` logic) to produce real A2UI JSON for keyword-based scenarios. The demo state reset is acceptable because the user already clicked the scenario (triggering `injectScenario`), and `getScenarioJson()` is only called for display in the JSON tab.

Also added a brief helper description at the top of the scenario explorer sidebar explaining the two scenario types, since users found the distinction confusing.

## Implications

- If `demo-scenarios.ts` keyword routing changes, the JSON tab automatically reflects it (no separate maintenance).
- The `resetDemoState()` call in `getScenarioJson()` is a minor side-effect, but harmless since Preview and JSON tabs share the same selected scenario context.
