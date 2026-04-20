# A2UI Components

**When to use:** you are rendering UI from an agent, adding a component to a pack, or debugging the A2UI stream.

## Context

Kickstart v2 streams UI through one mechanism: the `core.emit_ui` tool. Agents call it. The harness forwards the payload as an SSE `a2ui` event. The web client renders the payload against the registered component catalog. There is no envelope. There is no JSON parser. There is no FSM.

See [`docs-site/docs/architecture/v2-implementation-brief.md`](../../../../docs-site/docs/architecture/v2-implementation-brief.md) sections on A2UI streaming and components.

## The contract

```ts
// Agent-side (from any pack)
await emitUi({
  component: "azure/resource-picker",
  props: { subscriptionId, resourceType: "Microsoft.Web/sites" },
  data: [...],
  actions: { onSelect: "azure:select_resource" },
});
```

The payload is validated against the component's manifest before it leaves the server. An invalid payload produces an `error` SSE event, never a half-rendered component.

## Component rules

1. **Pure render.** No fetches, no setTimeout beyond CSS animation, no localStorage.
2. **Typed props.** Props are declared in the component manifest. TypeScript types are generated from the manifest, not hand-written.
3. **Fluent UI v9 only.** `makeStyles` + design tokens. No custom class systems.
4. **Action dispatch.** Interaction produces an A2UI `action.event` that maps to a user action tool (sigil `pack:action`). Never call APIs directly from a component.
5. **Deterministic keys.** Every list item needs a stable key derived from the data, not the render index.
6. **Past-turn safety.** Components receive an `isActive` prop. When false, they render read-only and run no effects.

## Progressive rendering

- The harness emits `a2ui` events as the agent produces them.
- The client uses a short stagger (≈60ms per item) for entry animation via the `--enter-index` CSS custom property.
- The stagger is a render concern, not a stream concern. Do not add delays on the server.

## Adding a new component

1. Create the component under `packages/pack-<name>/src/components/<Component>.tsx`.
2. Declare its manifest entry in the pack's `components` array.
3. Add a sample render to the playground fixture.
4. Add a render test under the pack's `__tests__/`.
5. Update `docs-site/docs/components/` with a usage page.
6. Update `docs-site/docs/extending/<pack>.md` to list the new component.

## Registering with the LLM

The LLM only knows about components that appear in the pack's agent prompt. If you add a component but forget to list it in an agent's allowed catalog, it will never be emitted. See the **component ↔ prompt sync rule** in the root memory notes.

## Debugging the stream

- Use the web client's debug panel (`?debug=true`) to see raw SSE events.
- `a2ui` events include the full payload. Inspect `props` and `data` to confirm the manifest shape.
- If a component renders empty, check that the agent's prompt lists it in the allowed catalog.
- If a component renders but actions no-op, verify the `actions` map points at a registered user action in the pack.

## Key files (v2)

- `packages/pack-core/src/components/` — shared primitives (card, list, button, form)
- `packages/pack-<domain>/src/components/` — domain components
- `packages/pack-core/src/tools/emit-ui.ts` — the `core.emit_ui` tool
- `packages/harness/src/sse/` — SSE event emission
- `packages/web/src/a2ui/` — client-side registry and renderer
