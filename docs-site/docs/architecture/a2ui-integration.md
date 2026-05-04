---
sidebar_position: 3
---

# A2UI v0.9 Integration

Kickstart speaks **A2UI v0.9** — a small JSON envelope protocol used to push UI state from agents to the browser. The schema and helpers live in `packages/harness/src/types/a2ui.ts` (re-exported from `@aks-kickstart/harness` as `A2UI_VERSION`, `A2UIMessageEnvelopeSchema`, the four message-payload schemas, and the typed message types).

`A2UI_VERSION = 'v0.9'`. Every envelope carries `version: 'v0.9'` and is rejected by `A2UIMessageEnvelopeSchema.parse()` if it doesn't.

---

## The four message ops

`A2UIMessageEnvelopeSchema` is a discriminated union on `op`:

| op | Payload | Purpose |
|---|---|---|
| `createSurface` | `{ surfaceId, catalogId, theme?, sendDataModel? }` | Create a new render target on the client. |
| `updateComponents` | `{ surfaceId, components: [...] }` (min 1) | Replace the component tree on a surface. |
| `updateDataModel` | `{ surfaceId, path, value }` (`value` is `string \| number \| boolean \| null`) | Patch a scalar in the surface's data model. |
| `deleteSurface` | `{ surfaceId }` | Tear down a surface. |

All payload schemas use `.strict()` — unknown keys throw at parse-time.

---

## How the harness emits A2UI

A2UI envelopes are produced by **tools** and **components**. The runner queues them on `session.a2uiEmissions` during a tool call and **drains** them after the LLM-side tool_call returns (the post-tool A2UI drain rule documented at the top of `packages/harness/src/runtime/runner.ts`).

> **Deprecation:** `core.emit_ui` is deprecated (issue #112). Use the focused replacements instead: `core.show_card` (display-only cards), `core.show_form` (data collection), `core.confirm` (yes/no gates), `core.navigate` (surface switching). `core.emit_ui` remains registered for backward compatibility but will be removed in the next major release.

Each drained envelope is sent as a single `a2ui` SSE frame:

```
event: a2ui
data: {"version":"v0.9","op":"updateComponents","updateComponents":{...}}
```

Because the queue is drained between tool calls, A2UI frames can never appear before the `tool_done` of the tool that produced them.

---

## Catalogs

A *catalog* is a named bundle of components and user-actions a client can render. The harness builds a catalog snapshot at seal-time (`runtime/catalog.ts`):

```ts
export interface CatalogSnapshot extends A2UICatalog {
  components: readonly string[];
  userActions: readonly string[];
}

export function buildCatalogSnapshot(...): CatalogSnapshot;
export function negotiateCatalog(advertisedCatalogIds, snapshot): CatalogSnapshot;
```

`negotiateCatalog()` lets the browser advertise the catalog ids it knows; the harness picks one or returns the default (`'kickstart'`).

---

## MCP transport

When the conversation runs over MCP rather than the SPA, A2UI envelopes are wrapped as **embedded resources**:

- `mimeType: 'application/json+a2ui'`
- `audience: ['user']`
- `text` is the stringified envelope.

See `packages/harness/src/mcp/server.ts` (`buildA2UIContent`, `A2UIEmbeddedResource`) and the [MCP server internals](./mcp-server-internals.md) page.

---

## Browser rendering

The SPA renders surfaces through the A2UI React adapter at `packages/web/src/` (driven by component implementations the renderer is registered with at boot — see `packages/pack-core/src/components/` for the bundled set). Custom components are added by registering a `ComponentContribution` (`packages/harness/src/types/component.ts`):

```ts
export interface ComponentContribution {
  name: string;
  propertySchema: z.ZodTypeAny;
  renderer: unknown;
  llmHint?: string; // injected into the system prompt so the model knows HOW to use it
}
```

See [Components → Extending A2UI](../architecture/extending-a2ui.md) for the full add-a-component walkthrough.

---

## Conversation phases as a special component

`ConversationPhaseComponent` is a fixed A2UI component type defined in `packages/harness/src/index.ts`:

```ts
export type ConversationPhaseComponent = {
  type: 'ConversationPhase';
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
};
```

The phase enum (`Phase` in the same file) — `Discover → Design → Generate → Review → Handoff → Deploy` — drives the visible phase tracker. See [Conversation phases](../extending/conversation-phases.md).

---

## Strict validation

A2UI envelopes that originate from tools are validated *twice*:

1. The tool's own params schema (`z.object(...).strict()` per `runtime/z-strict.ts`).
2. The shared `A2UIMessageSchema` / `A2UIMessageEnvelopeSchema` at the harness boundary.

Failures are caught and surfaced as `error` SSE frames; the offending tool result is dropped, never partially rendered.
