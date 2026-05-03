---
sidebar_position: 6
---

# Component Selection Framework

How agents select UI components from the catalog at runtime, guided by **intent-based recipes** (R1–R17+) that define canonical compositions for common patterns.

## Overview

When an agent emits a UI surface (via the `core.emit_ui`, `core.show_card`, or `core.show_form` tools), the harness must resolve each component reference to a concrete React component. This process is governed by:

1. **Sealed registry** — a frozen lookup table built at startup that ensures only known, validated components can be rendered.
2. **Recipe gallery** — curated patterns (R1–R17+) that guide agents toward proven component combinations for common intents (plan summaries, diffs, cost cards, etc.).
3. **Schema validation** — strict Zod schemas that prevent hallucinated fields or unknown component types.

This document is organized **by intent first** — recipes — then by the components and primitives that compose them. For low-level registry details and component vocabulary, see the [Vocabulary Appendix](#vocabulary-appendix) at the end.

---

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

---

## Recipe Gallery

Recipes are **intent-driven patterns** — they answer "what's the right way to show this type of information?" The gallery below lists recipes by promotion status (core → candidates) and use case.

### Primary Recipes (Promoted)

These recipes are the most common and should be your first choice when matching an agent's intent.

#### **R1: Plan Summary Card**

**Intent:** Single unified plan summary for simple, floor-case scenarios (one service, one deployable unit).

- **Composition:** `Card[Text(h2) + Text(body) + List + Row[Button × 2]]`
- **Components Used:** Card, Text, List, Row, Button
- **When to fire:** `track:containerized_web` with single service AND no existing manifests
- **Anti-patterns:** Don't use for ≥2 distinct concepts (cost, preview, identity wiring) — use R2 instead.
- **Validated by:** sim-01, sim-06, sim-10, sim-11

#### **R2: Multi-Card Plan**

**Intent:** Multi-card plan for complex scenarios where 2+ distinct concepts (cost, architecture preview, identity wiring) require separate cards.

- **Composition:** `Column[Card+, …]` (multiple cards stacked)
- **Components Used:** Column, Card, Text, List, Row, Button
- **When to fire:** Multi-service deployments OR scenarios with branching context (cost vs preview vs security)
- **Anti-patterns:** Don't use R1 for complex plans; don't over-granularize (every fact does not get its own card).
- **Validated by:** sim-02, sim-03

#### **R5: Diff Plan (Additive)**

**Intent:** Show before/after resource state for deployment plans, with markers indicating what's new, changed, or removed.

- **Composition:** `Column[DiffCard+]` — each resource gets a DiffCard with before/after state
- **Components Used:** Column, DiffCard, Text, Badge
- **When to fire:** Pre-deployment plan review phase
- **Anti-patterns:** Don't mix architectural diffs (what's the new architecture) with drift diffs (what changed on the cluster).
- **Validated by:** sim-04, sim-05

#### **R7: What I'm Doing For You (Reassurance List)**

**Intent:** Build trust by explicitly listing the capabilities the agent is providing on behalf of the user (e.g., "I'm setting up identity wiring", "I'm configuring TLS").

- **Composition:** `Card[CheckList]` — bulleted list with check marks
- **Components Used:** Card, Text, CheckList
- **When to fire:** After major decisions are made; before handing off to next phase
- **Anti-patterns:** Don't list things the user had to do themselves; don't mix reassurance with next-steps.
- **Validated by:** sim-07, sim-08

#### **R16: Cost Card (Live Retail Prices)**

**Intent:** Show projected Azure costs with live SKU pricing pulled from `core.estimate_cost` tool.

- **Composition:** `CostCard[Table(resource, SKU, cost/mo, annual)]`
- **Components Used:** CostCard, Table, Text
- **When to fire:** Post-architecture phase, before handoff to provisioning
- **Anti-patterns:** Don't show outdated cached prices; don't omit per-resource breakdown.
- **Validated by:** sim-12, sim-13

#### **R17: Next-Surface Handover (Closing Card)**

**Intent:** Gracefully close the current phase and invite the user to take next action in a new surface (e.g., "Review the plan above, then click 'Deploy' to provision.").

- **Composition:** `ClosingCard[Text + Button]`
- **Components Used:** ClosingCard, Text, Button
- **When to fire:** End of every major agent phase
- **Anti-patterns:** Don't leave the user hanging; don't bury the next action.
- **Validated by:** sim-14, sim-15

### Extended Recipes (Candidates & Specialization)

The recipes below are validated patterns for specific scenarios. Use them when your use case matches the intent exactly.

| ID | Name | Intent | When to Use |
|----|------|--------|------------|
| R2.1 | Multi-card hierarchical | Complex plan with parent/child relationships | Resource groups containing multiple resources |
| R3 | Migration mapping table | PaaS → Azure service mapping | Migration/compatibility assessments |
| R4 | Per-item bulk+per actions | Many items with bulk + individual operations | Manifest review, rollback per item |
| R6 | Why this stack (rationale) | Justify architectural choices | After recommending a specific AKS topology |
| R7-table | What each does FOR you (3-col) | Structured comparison of capabilities | Agent features vs manual alternatives |
| R8 | Job-to-be-done table | User intent / How agent helps mapping | Clarify user's need and your response |
| R9 | Review pack composition | Show all artifacts (Bicep, manifests, scripts) | Deployment review phase |
| R9.1 | File-preview Card | Preview single file inline | Before/after code review |
| R10 | Single question with citation | Grounded question tied to a skill or constraint | When asking about enterprise policy |
| R12 | Compatibility scorecard | 4-bucket severity table (compat, warnings, errors) | Multi-target compatibility check |
| R13 | Auto-fix information | Show what the agent automatically fixed | After auto-remediation |
| R14 | Combined diff + approval | Diff view + single approval button | Pre-deployment final check |
| R15 | Capacity check card | Show remaining capacity vs plan needs | Cluster capacity validation |
| R16-delta | Cost comparison (was/now/Δ) | Before/after cost with delta column | Cost optimization scenarios |
| R16b | Cost trim + compliance column | Cost breakdown with compliance-critical resources | Compliance + cost trade-off |

---

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

1. **Recipe matching** — evaluate the user's need against the recipe gallery (R1–R17+). Match the recipe whose intent aligns with your current goal.
2. **Tool constraints** — `core.emit_ui` exposes the `A2UIComponentSchema` discriminated union, so the LLM's function-calling layer only sees valid component shapes.
3. **`core.search_components` tool** — agents can query the catalog by category or use case to discover available components before emitting.
4. **System prompt grounding** — agent instructions reference specific recipes appropriate to their domain (e.g., the architect agent knows when to use R1 vs R2 vs R5).

---

## Adding a New Component

1. Create the `.tsx` component in `packages/web/src/catalog/components/`.
2. Add a Zod schema in `packages/pack-core/src/schemas/rich-component-schemas.ts` with `.strict()`.
3. Register the component in `packages/web/src/main.tsx` (add to the richComponents map or pack registration).
4. Update the contract test in `packages/web/src/__tests__/a2ui-allow-list-registry.test.ts` to include the new component count.
5. **If the component is intended for a new pattern**, add a recipe in `config/recipes.json` with intent, composition, and anti-patterns.
6. Update the [Custom Catalog](../components/custom-catalog.md) documentation.

---

## Recipe Browser (Complete Reference)

For a complete list of all 42+ recipes and their validation status, see `config/recipes.json`. Recipes are indexed by:
- **Promotion status** — `promotion_candidate: true` for core recipes (above); `false` for experimental
- **Fired when** — conditions under which to emit the recipe
- **Validated by sims** — test simulation IDs that cover this recipe

Query recipes programmatically:
```bash
# List core recipes
jq '.recipes[] | select(.promotion_candidate == true)' config/recipes.json

# List all recipes for a track
jq '.recipes[] | select(.fires_when[] | contains("containerized_web"))' config/recipes.json
```

---

## Vocabulary Appendix

### Component Types

**Rich Components** (domain-specific, 22 total):
- `Card` — primary container for structured information
- `Column`, `Row` — layout primitives
- `Table`, `DiffCard`, `CostCard`, `ClosingCard` — specialized data views
- `CheckList`, `RadioGroup`, `TextField` — input components
- And 13 others (see `packages/web/src/main.tsx`)

**Basic Primitives** (A2UI, 5 core):
- `Text` — typography, supports levels (h1–h6), inline formatting
- `Image` — asset embedding
- `Button` — call-to-action
- `TextField` — single-line text input
- `CheckBox` — boolean toggle

### Composition Notation

Recipes use a shorthand notation for component trees:

```
Card[Text(h2) + Text(body) + List + Row[Button × 2]]
│    │          │           │      │   └─ two Button children
│    │          │           │      └─ Row layout
│    │          │           └─ List of items
│    │          └─ Body paragraph
│    └─ Heading
└─ Container
```

- `A[B + C]` — A contains B and C
- `A[B × N]` — A contains N instances of B
- `A(modifier)` — A with a modifier (e.g., `Text(h2)` is a heading level 2)

---

## Related

- [Custom Kickstart Catalog](../components/custom-catalog.md) — full list of available components.
- [A2UI Integration](./a2ui-integration.md) — how the A2UI protocol connects to the component layer.
- [Extending A2UI](../components/extending-a2ui.md) — building new component types.
- `config/recipes.json` — complete recipe database.
