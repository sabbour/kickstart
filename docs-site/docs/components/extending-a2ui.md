---
sidebar_position: 2
---

# Extending the A2UI Component System

This page is the end-to-end recipe for adding a new component to Kickstart's A2UI catalog: write the schema, register the renderer with the SPA, register the contribution with the harness, teach the LLM how to call it, and (optionally) wire a playground scenario.

The protocol is **A2UI v0.9** — see [A2UI integration](./a2ui-integration.md) for the envelope shapes and ordering rules. The bundled catalog is documented in [Custom catalog](./custom-catalog.md).

---

## Component contribution

Every component is a `ComponentContribution` (`packages/harness/src/types/component.ts`):

```ts
export interface ComponentContribution {
  name: string;                 // "<pack>/<ComponentName>", e.g. "core/Questionnaire"
  propertySchema: z.ZodTypeAny; // strict-mode object schema
  renderer: unknown;            // SPA-side React renderer; opaque to the harness
  llmHint?: string;             // injected into the system prompt so the model knows HOW to use it (#1130 Phase A)
}
```

`name` is namespaced by pack so `core/Questionnaire` and `mypack/Questionnaire` can coexist.

`llmHint` is the difference between a component the model never reaches for and one it uses correctly. Keep it 1–3 sentences; describe the purpose, key props, and which UserAction(s) feed back when the user interacts.

---

## Step 1 — Define the property schema

```ts
// packages/pack-mypack/src/components/RegionPicker/schema.ts
import { z } from 'zod';
import { strictOptional } from '@aks-kickstart/harness';

export const RegionPickerSchema = z.object({
  options: z.array(z.string()).min(1),
  selected: strictOptional(z.string()),
  helpText: strictOptional(z.string()),
}).strict();
export type RegionPickerProps = z.infer<typeof RegionPickerSchema>;
```

Strict-mode rules apply (see [Schema conformance](../architecture/schema-conformance.md)) — `propertySchema` is validated by `assertStrictlyConformant()` for any tool whose params reference it.

---

## Step 2 — Implement the React renderer

The bundled adapter in `packages/pack-core/src/vendor/a2ui/react/adapter.ts` defines `ReactComponentImplementation`:

```ts
// packages/pack-mypack/src/components/RegionPicker/RegionPicker.tsx
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
import { RegionPickerSchema, type RegionPickerProps } from './schema';

export const RegionPicker: ReactComponentImplementation<RegionPickerProps> = {
  name: 'RegionPicker',
  schema: RegionPickerSchema,
  render(props, ctx) {
    return (
      <select value={props.selected ?? ''} onChange={(e) => ctx.emitDataModel('selected', e.target.value)}>
        {props.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  },
};
```

`ctx.emitDataModel(path, value)` produces the `updateDataModel` A2UI envelope back to the harness. `ctx.invokeAction(name, args)` invokes a UserAction.

---

## Step 3 — Register with the pack

Add the implementation to your pack's `components` list. The reference for shape and registration order is `packages/pack-core/src/core-pack.ts`:

```ts
// packages/pack-mypack/src/index.ts
import type { Pack } from '@aks-kickstart/harness';
import { RegionPicker } from './components/RegionPicker/RegionPicker';

const toContrib = (impl) => ({
  name: `mypack/${impl.name}`,
  propertySchema: impl.schema,
  renderer: impl.render,
  llmHint: 'Show a single-select dropdown for regions. Read the choice via updateDataModel { path: "selected" }.',
});

export const myPack: Pack = {
  name: 'mypack',
  version: '0.1.0',
  components: [toContrib(RegionPicker)],
};
```

Register the pack in `packages/web/api/src/startup/packs.ts` and `packages/mcp-server/src/startup/packs.ts`.

---

## Step 4 — Surface to the SPA

The SPA boots a renderer registry; every component contribution's `renderer` is registered against `name`. The bundled set lives in `packages/pack-core/src/components/` and is wired during web bootstrap. Custom packs export their renderers from `packages/pack-<yourpack>/src/components/index.ts`; the SPA (`packages/web/src/main.tsx`) imports the bundle and registers them in one place.

The browser learns which components exist via `GET /api/packs` (see [API endpoints](../extending/api-endpoints.md)) — the `ComponentDTO` carries the `name` and JSON-Schema-serialised `propertySchema` (no renderer code, no internal types).

---

## Step 5 — Teach the LLM

Two paths:

1. **`llmHint`** on the contribution — visible in every system prompt that mentions this component.
2. **A typed tool** — wrap an `updateComponents` envelope in a tool whose params are constrained to your component schema, so the model invokes the component through a function call rather than emitting raw A2UI:

```ts
import { tool } from '@openai/agents';
import { RegionPickerSchema } from './schema';

export const showRegionPicker = tool({
  name: 'mypack.show_region_picker',
  description: 'Render a region picker. Reads selection via updateDataModel.',
  parameters: z.object({
    surfaceId: z.string(),
    props: RegionPickerSchema,
  }).strict(),
  async execute({ surfaceId, props }) {
    return {
      a2ui: {
        version: 'v0.9',
        op: 'updateComponents',
        updateComponents: {
          surfaceId,
          components: [{ type: 'mypack/RegionPicker', ...props }],
        },
      },
    };
  },
});
```

The runner's post-tool a2ui drain handles ordering — the envelope is emitted *after* the LLM tool_call returns, never before. See [LLM tools](../extending/llm-tools.md).

---

## Step 6 — Optional: a UserAction for confirm / cancel

If your component needs a typed result (e.g. "selected region"), add a UserAction whose `confirmComponent: { component: 'mypack/RegionPicker' }` ties UI to result. See [User actions](../extending/actions.md). The runner pauses on `user_action_req`, the browser collects the result, and `/api/converse/resume` validates against `resultSchema` (the resume schema-validation gate).

---

## Step 7 — Optional: a playground scenario

Add a `PlaygroundScenario` and a `playgroundStubs[wireName]` for any UserAction the scenario needs. Stubs only resolve when `KICKSTART_PLAYGROUND=true` and the registry's frozen stub map allows them. See [Playground scenarios](../extending/playground-scenarios.md).

---

## Validation checklist

- `propertySchema` is `.strict()` and uses `strictOptional()` for nullable fields.
- Pack tests run `assertStrictlyConformant(getToolJsonSchema(tool), tool.name)` for every tool that references the schema.
- The renderer sanitises any free-text props before injecting them into the DOM.
- The pack's `dependsOn` lists every pack whose components or tools you import.
- `llmHint` is short and concrete — no internal jargon.

---

## What you do NOT need to do

- Modify the harness. Components are fully pack-contributed.
- Touch `Runner` or `PackRegistry` — registration is automatic via `pack.components[]`.
- Hand-write JSON Schema. `getToolJsonSchema()` and `assertStrictlyConformant()` derive everything from your Zod schema.
