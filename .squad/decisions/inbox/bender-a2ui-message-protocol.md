# Decision: A2UI Message Protocol for Dynamic Surfaces

**Date:** 2025-07-26
**Author:** Bender
**Status:** Accepted (enforced by fix for #54)

## Context

The Playground Create tab was broken — showing "[Loading root...]" because A2UI surfaces were created empty. The root cause was misunderstanding the A2UI message protocol.

## Decision

When creating A2UI surfaces dynamically (e.g. from LLM responses), always use the **two-message pattern**:

1. `{ version: 'v0.9', createSurface: { surfaceId, catalogId } }` — creates an empty surface
2. `{ version: 'v0.9', updateComponents: { surfaceId, components: [...] } }` — adds components

**Never** put a `body` field on `createSurface` — it is silently ignored.

One component in the `updateComponents` array **must** have `id: "root"` — this is the renderer's entry point.

Components use the flat format: `{ id, component, ...props, children: ["child-id-refs"] }`. Never nest component objects inline.

## Implications

- Any new code that creates A2UI surfaces must follow this pattern
- LLM system prompts that generate A2UI must teach the flat format with `id: "root"`
- The `normalizePlaygroundComponents()` function in Playground.tsx can be reused as a safety net for LLM output normalization
