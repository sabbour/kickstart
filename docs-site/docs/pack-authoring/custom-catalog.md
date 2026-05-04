---
sidebar_position: 1
---

# Custom Kickstart Catalog

The core pack contributes 27 basic Fluent overrides + 13 rich domain-neutral components. Pack-contributed catalogs add domain components (Azure resource pickers, AKS readiness cards, etc.). Every component is a `ComponentContribution` registered with the harness `PackRegistry` and rendered by the SPA's A2UI v0.9 adapter.

For the protocol, see [A2UI integration](../architecture/a2ui-integration.md). For the recipe to add new ones, see [Extending the A2UI component system](../architecture/extending-a2ui.md).

---

## Where the bundled set lives

`packages/pack-core/src/core-pack.ts` composes the core catalog:

| Group | Source | Count |
|---|---|---|
| **Basic Fluent overrides** | `packages/pack-core/src/components/basic/index.ts` (`fluentOverrides`) | 27 |
| **Rich components** | `packages/pack-core/src/components/rich/*.tsx` | 13 |

The 13 rich components imported in `core-pack.ts`:

`ArchitectureDiagram`, `AuthCard`, `CodeBlock`, `DecisionCard`, `FileEditor`, `FormGroup`, `GenerationProgress`, `Markdown`, `ProgressSteps`, `Questionnaire`, `RadioGroup`, `SteppedCarousel`, `SummaryCard`.

Each rich component implements `ReactComponentImplementation` (`packages/pack-core/src/vendor/a2ui/react/adapter.ts`) — `{ name, schema, render }` — and is wrapped into a `ComponentContribution` by `toContrib(impl)`:

```ts
function toContrib(impl: ReactComponentImplementation): ComponentContribution {
  return {
    name: `core/${impl.name}`,
    propertySchema: impl.schema,
    renderer: impl.render,
  };
}
```

The same pattern works for any pack — `mypack/RegionPicker`, `azure/SubscriptionSelector`, etc.

---

## Pack-contributed catalogs

| Pack | Components |
|---|---|
| `pack-azure` | `AzureAction`, `AzureResourceCard`, `BicepEditor`, `CostEstimate`, `DeploymentStatus`, `LocationSelector`, `ResourceGroupSelector`, `SubscriptionSelector` (under `packages/pack-azure/src/components/`). |
| `pack-aks-automatic` | AKS-specific cards under `packages/pack-aks-automatic/src/components/`. |
| `pack-github` | Repo / PR / branch components (where contributed). |

Each of these registers in its own `Pack` object and is loaded at API boot via the fixed registration order (`core, azure, aks, github`). The SPA discovers them via the `/api/packs` DTO.

---

## Discovery

`/api/packs` (`packages/web/api/src/functions/packs.ts`) returns:

```ts
interface ComponentDTO {
  name: string;            // e.g. "azure/SubscriptionSelector"
  propertySchema: unknown; // JSON-Schema serialisation
}
```

The SPA renderer registry maps `name` → React component at boot. JSON-Schema-typed `propertySchema` is what powers component-aware tools and the inspirations endpoint.

---

## Fixed phase tracker — `ConversationPhase`

`ConversationPhase` is a *typed* component baked into the harness, not contributed by a pack. Its shape (`packages/harness/src/index.ts`):

```ts
export type ConversationPhaseComponent = {
  type: 'ConversationPhase';
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
};
```

Any pack can update it via `core.emit_ui` (or via the chat-A2UI helpers in `packages/harness/src/a2ui/chat-a2ui.ts`). See [Conversation phases](../agent-authoring/conversation-phases.md).

---

## Surfaces, themes, data models

The four A2UI v0.9 ops the catalog speaks:

| op | When |
|---|---|
| `createSurface` | Open a render target (`{ surfaceId, catalogId, theme?, sendDataModel? }`). |
| `updateComponents` | Replace the component tree on a surface (min 1 component). |
| `updateDataModel` | Patch a scalar in the surface's data model (`string \| number \| boolean \| null`). |
| `deleteSurface` | Tear down a surface. |

The catalog id (`'kickstart'` by default) is negotiated via `negotiateCatalog()` so a future client could declare its own catalog id and the harness would honour it. The browser advertises catalog ids on connect; the harness picks one or falls back to `'kickstart'`.

---

## Building on top

The recommended pattern is:

1. **Don't extend rich components** — copy them into your pack and re-namespace if you need behavioural change.
2. **Use `llmHint`** so the model uses your component correctly.
3. **Bind to a UserAction** when the component must produce a typed result the agent reads.
4. **Wrap in a typed tool** when you want strict-mode validation on the entire envelope before the runner's a2ui drain emits it.

See [Extending the A2UI component system](../architecture/extending-a2ui.md) for the full step-by-step.
