---
sidebar_position: 10
---

# Playground Scenarios

The Playground is a developer-only mode where the browser drives the agent loop with **fixed scripted inputs** and tools resolve via deterministic stubs. It exists to debug A2UI emission, surface negotiation, and the UserAction lifecycle without having to call live cloud APIs. The whole feature is gated by `KICKSTART_PLAYGROUND=true` (the playground env-gate enforced inside `Runner.run`).

The browser entry-point is `packages/web/src/playground/Playground.tsx`. The API entry-point is `packages/web/api/src/functions/playground.ts` (~249 lines). Scenarios and stubs are pack-contributed.

---

## Scenario shape

`PlaygroundScenario` is exported from `packages/harness/src/types/playground.ts`. A pack lists scenarios on `pack.playgroundScenarios` and stub functions on `pack.playgroundStubs`. Scenarios live with their pack:

- `packages/pack-core/src/playground/questionnaire.scenario.ts`
- `packages/pack-core/src/playground/generation-progress.scenario.ts`
- `packages/pack-aks-automatic/src/playground/...`

---

## Discovery

The API surfaces scenarios via the safe `/api/packs` DTO (`packages/web/api/src/functions/packs.ts`) — the safe-DTO carve-out:

```ts
interface PlaygroundScenarioDTO {
  id: string;
  title: string;
  description?: string;
  group?: string;
}
```

`Playground.tsx` reads this DTO to build the scenario picker — it never imports the registry. The DTO never leaks instructions, skill bodies, tool implementations, or stub keys.

---

## Stubs

`pack.playgroundStubs` is a `Record<string, PlaygroundStub>`:

```ts
export type PlaygroundStub = (args: unknown) => Promise<unknown>;
```

Keys are stable wire names (typically the user-action `wireName` or a tool name). At `seal()` time, `PackRegistry`:

- Refuses to register two packs that supply the same stub key (`Duplicate playground stub key across packs`).
- Snapshots all stubs into `_sealedPlaygroundStubs` and freezes the record. Post-seal mutations throw.
- Returns the frozen snapshot via `playgroundStubs` (used by `Runner.run` when in playground mode).

This freeze step is the structural enforcement of "playground mode is bounded" — once the API is up, no code path can sneak a new stub in.

---

## The runtime gate

`Runner.run` checks `KICKSTART_PLAYGROUND` before resolving any stub. With the env var absent or `'false'`:

- The runner takes the live path — tools execute their real `execute()` bodies.
- Stub lookups are not even attempted.

With `KICKSTART_PLAYGROUND=true`:

- Tools and user actions can resolve via `playgroundStubs[wireName]` if a stub exists; otherwise they execute live.
- The browser surfaces the playground scenario list.
- Server logs include a startup banner so an operator can see at a glance that the host is in playground mode.

The gate is enforced *inside* the runner — not at the API perimeter — so MCP, REST, and any future transport are equally bounded.

---

## End-to-end test pattern

A typical playground scenario test uses the in-memory pipeline directly:

```ts
process.env.KICKSTART_PLAYGROUND = 'true';
const registry = new PackRegistry();
registry.register(corePack);
registry.enable(['core']);
registry.seal();

const session = new Session({ sessionId: 's1', user: { oid: 'u1' } });
const runner  = new Runner(registry);

const events: Array<[string, unknown]> = [];
await runner.run(session, scenario.userMessage, (e, d) => events.push([e, d]));

expect(events.map(e => e[0])).toContain('a2ui');
```

This is the loop the SPA exercises end-to-end; the API simply maps it onto SSE.

---

## Authoring a scenario

1. Add a `PlaygroundScenario` to `pack.playgroundScenarios[]` — minimum fields: `id`, `title`, optional `description`, optional `group`.
2. Add stubs to `pack.playgroundStubs` keyed by the user-action `wireName` or the tool name your scenario expects to drive. Each stub must conform to the action's `resultSchema` (validation runs in the resume path; failures look identical to a real `400`).
3. Run pack tests so duplicate-key detection catches collisions early.
4. The scenario picker in the SPA picks it up the next boot.

---

## What scenarios cannot do

- Cannot bypass guardrails. `core/` rules still run; tool-stage blocks still halt the turn.
- Cannot bypass strict-mode schema validation. Stub return values flow through the same `assertStrictlyConformant`-validated `resultSchema` as live results.
- Cannot enable themselves. Without `KICKSTART_PLAYGROUND=true`, scenarios are inert.

---

## Production posture

`KICKSTART_PLAYGROUND` is **never** set in any deployment manifest. It exists for local dev and the dedicated `KICKSTART_PLAYGROUND` host. The runtime refuses to load stubs without the gate; the SPA hides the playground tab when the `/api/packs` DTO doesn't include scenarios; and observability surfaces a banner if a production-marked host ever boots with the env var on.
