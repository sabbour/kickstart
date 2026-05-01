---
sidebar_position: 6
---

# Component Selection Framework

How agents select UI components from the catalog at runtime, including the sealed registry, schema validation, and error fallback patterns.

## Overview

When an agent emits a UI surface (via the `core.emit_ui`, `core.show_card`, or `core.show_form` tools), the harness must resolve each component reference to a concrete React component. This process is governed by a **sealed registry** — a frozen lookup table built at startup — that ensures only known, validated components can be rendered.

## Sealed Registry

The component registry is sealed at application boot. Once sealed, no new components can be added at runtime.

```
┌─────────────────────────────────────────────────────┐
│              PackRegistry (sealed)                   │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐              │
│  │ A2UI Basic   │   │  Kickstart   │              │
│  │ (Text, Image,│   │  Custom (22) │              │
│  │  Button, …)  │   │  (RadioGroup,│              │
│  │              │   │  CodeBlock…) │              │
│  └──────────────┘   └──────────────┘              │
└─────────────────────────────────────────────────────┘
```

**Why sealed?** Sealing prevents:
- LLM hallucinations from registering arbitrary component names.
- Runtime injection of unknown UI elements.
- Non-deterministic rendering caused by late registrations.

The registry is constructed at client boot in `packages/web/src/main.tsx` from three sources:
1. **A2UI Basic Catalog** — low-level primitives (`Text`, `Image`, `Button`, `TextField`, `CheckBox`).
2. **Fluent UI Overrides** — theme-aware wrappers registered at boot.
3. **Kickstart Rich Components** — 22 domain-specific components registered from pack definitions and richComponents map.

## Schema Validation with `.strict()` Zod

Every **rich component** (the 22 domain-specific components) in the catalog has a corresponding Zod schema in `packages/pack-core/src/schemas/rich-component-schemas.ts`. Basic primitives (Text, Image, Button, etc.) are validated through the tool parameter unions in their respective tool definitions. The rich-component schemas use **`.strict()`** mode, meaning:

- No extra properties are allowed (no hallucinated fields).
- Nullable fields use `.nullable()` — the LLM emits `null` rather than omitting the key.

> **Note:** `.strict()` in Zod rejects unknown keys but does not itself require all declared properties. The "all keys required" behavior comes from avoiding `.optional()` — using `.nullable()` instead ensures every declared key must be present (with `null` as the explicit "empty" value).

```typescript
export const DecisionCardSchema = z.object({
  id: z.string(),
  component: z.literal('DecisionCard'),
  title: DynStr,
  recommendation: DynStr,
  rationale: DynStr.nullable(),
  alternatives: z.array(DynStr).nullable(),
  badge: z.enum(['recommended', 'best-practice', 'required', 'optional']).nullable(),
}).strict();
```

This aligns with OpenAI's strict-mode requirement that every key in `properties` also appears in `required`. Fields the LLM may not always populate are typed as `.nullable()` — never `.optional()`.

### Validation Flow

```
LLM output → JSON parse → discriminatedUnion('component') → per-schema .strict() parse
                                                                      │
                                                              ┌───────┴───────┐
                                                              │  Success      │  Failure
                                                              │  Render       │  → _ErrorComponent
                                                              └───────────────┘
```

## `_ErrorComponent` Fallback Pattern

When schema validation fails — the LLM emits an unknown component type, includes extra fields, or omits required ones — the harness does **not** crash. Instead, it renders a built-in `_ErrorComponent` that:

1. Displays a "Component not available: `<name>`" message indicating which component could not be rendered.
2. Logs the validation error (Zod issue path + message) via `console.error`.
3. Preserves the conversation flow — the user can continue interacting.

This pattern ensures **graceful degradation**: a single malformed component does not break the entire UI surface.

### When `_ErrorComponent` fires

| Cause | Example |
|-------|---------|
| Unknown component type | `"component": "FancyWidget"` (not in registry) |
| Extra properties | `"component": "DecisionCard", "color": "red"` (`.strict()` rejects) |
| Missing required field | `"component": "RadioGroup"` without `options` |
| Type mismatch | `"badge": 42` instead of a string enum |

## Agent Selection Flow

Agents do not randomly pick components. The selection is guided by:

1. **Tool constraints** — `core.emit_ui` exposes the `A2UIComponentSchema` discriminated union, so the LLM's function-calling layer only sees valid component shapes.
2. **`core.search_components` tool** — agents can query the catalog by category or use case to discover available components before emitting.
3. **System prompt grounding** — agent instructions reference specific components appropriate to their domain (e.g., the architect agent knows about `ArchitectureDiagram`).

## Adding a New Component

1. Create the `.tsx` component in `packages/web/src/catalog/components/`.
2. Add a Zod schema in `packages/pack-core/src/schemas/rich-component-schemas.ts` with `.strict()`.
3. Register the component in `packages/web/src/main.tsx` (add to the richComponents map or pack registration).
4. Update the contract test in `packages/web/src/__tests__/a2ui-allow-list-registry.test.ts` to include the new component count.
5. Update the [Custom Catalog](../components/custom-catalog.md) documentation.

:::note Partial coverage
This document covers the sealed registry architecture and component selection flow. Recipe/intent-based organization (R1–R17+) from `config/recipes.json` as requested in #219 is tracked for a follow-up.
:::

## Related

- [Custom Kickstart Catalog](../components/custom-catalog.md) — full list of available components.
- [A2UI Integration](./a2ui-integration.md) — how the A2UI protocol connects to the component layer.
- [Extending A2UI](../components/extending-a2ui.md) — building new component types.
