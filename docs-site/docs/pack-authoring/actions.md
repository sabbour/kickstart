---
sidebar_position: 7
---

# User Actions

A **UserAction** lets the agent pause the run and ask the browser to do something — pick a subscription, deploy a Bicep template, authorise a GitHub repo. The action surfaces as a confirm component in the UI; the user's response (or a stub during playground) flows back to `Runner` via `/api/converse/resume`.

User actions are pack-contributed alongside tools, components, and guardrails. The contribution shape lives in `packages/harness/src/types/user-action.ts`.

---

## Contribution shape

```ts
import type { z } from 'zod';

export interface UserActionContribution {
  name: string;            // "<pack>.<action>"
  wireName: string;        // stable on-the-wire id (sent to client)
  description: string;
  parameters: z.ZodTypeAny;     // what the agent passes when it requests the action
  resultSchema: z.ZodTypeAny;   // what the client must return on resume
  confirmComponent?: {           // optional confirm UI
    component: string;           // component name (must be registered)
    props?: Record<string, unknown>;
  };
  scopes?: string[];             // OAuth or RBAC scopes the action needs
  cancellation?: 'supported' | 'not-supported';
  mcpExposed?: boolean;          // appears in MCP manifest
}
```

Actions live under `packages/<pack>/src/user-actions/`. The Azure pack ships:

- `select-subscription.ts`
- `deploy.ts`, `deploy-resource.ts`
- `update-resource.ts`, `delete-resource.ts`

---

## Lifecycle

1. The agent calls a tool (e.g. `azure.deploy_resource`) that emits a `user_action_req` SSE frame containing the action's `wireName`, `actionId`, and `parameters` payload.
2. The runner sets `session.pendingUserAction` and stops emitting until the resume call arrives.
3. The browser renders the confirm component (`confirmComponent`), collects user input, and `POST`s to `/api/converse/resume` with `{ sessionId, actionId, toolName, result }`.
4. `resume.ts` enforces three security-critical gates:
   - **Critical 1** — OID from `X-MS-CLIENT-PRINCIPAL` must match `session.user.oid` → `403` on mismatch.
   - **Critical 2** — `result` is validated against `UserAction.resultSchema` → `400` on failure.
   - **Critical 3** — playground stubs are gated by `KICKSTART_PLAYGROUND=true` (enforced in `Runner.run`).
5. The runner replays the result into the agent loop and continues. SSE resumes from the same stream contract.

The `pendingUserAction` field is cleared via **compare-and-swap** *before* validation — that prevents a concurrent replay from re-firing the same action (see `resume.ts` comment "B3").

---

## MCP transport

Over MCP, user actions surface as **interrupts** (see [MCP server internals](../architecture/mcp-server-internals.md)). `buildInterruptContent()` produces an `McpInterruptBlock`; the MCP adapter's `interrupt-store.ts` keeps the in-flight payload (TTL `INTERRUPT_TTL_MS = 15 * 60 * 1000`, 15 minutes). Per-session ordering is guaranteed by the chain-of-promises mutex in `session-mutex.ts`.

---

## Authoring an action

```ts
import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

export const selectRegion: UserActionContribution = {
  name: 'mypack.select_region',
  wireName: 'select-region',
  description: 'Ask the user to pick an Azure region.',
  parameters: z.object({
    suggested: z.array(z.string()),
  }).strict(),
  resultSchema: z.object({
    region: z.string(),
  }).strict(),
  confirmComponent: { component: 'core/RadioGroup' },
  cancellation: 'supported',
};
```

Add it to `pack.userActions[]`. The registry uniqueness check enforces that **both** `name` and `wireName` are globally unique. Schema-conformance tests catch strict-mode violations against `getUserActionJsonSchema(action)`.

---

## Playground stubs

Each `pack.playgroundStubs?[wireName]` is an async function that takes the action's parameters and returns a fake result. The harness only loads stubs when `KICKSTART_PLAYGROUND=true`. Stub keys are validated for duplicate-across-packs at `seal()` time and the resulting record is frozen — post-seal mutations throw. See [Playground scenarios](./playground-scenarios.md).

---

## Ergonomics

- Use `strictOptional()` (`runtime/z-strict.ts`) for nullable fields in both `parameters` and `resultSchema` so they pass `assertStrictlyConformant()`.
- Set `cancellation: 'supported'` only if your tool gracefully tolerates a `null` result; the runner surfaces cancellation by passing `null` through.
- Don't wedge custom flow into `name` — keep it `<pack>.<action>` and use `wireName` for any client-friendly slug.
