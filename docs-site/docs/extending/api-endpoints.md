---
sidebar_position: 5
---

# API Endpoints

Kickstart's backend runs on **Azure Functions v4** (Node.js, ESM) deployed inside a Static Web App. Handlers live in `packages/web/api/src/functions/`. Each function file is wired with `app.http(...)`; routes are registered at module load time.

---

## Function inventory

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/converse` | `converse.ts` | Per-turn SSE stream — runs the active agent through `Runner.run()`. |
| `POST /api/converse/resume` | `resume.ts` | Resume a paused Runner after a UserAction result arrives. |
| `POST /api/action` | `action.ts` | Execute a one-shot UserAction outside a converse stream. |
| `GET /api/packs` | `packs.ts` | Safe client DTO of components, user actions, and playground scenarios. |
| `POST /api/inspirations` | `inspirations.ts` | Generate inspiration suggestions. |
| `POST /api/widget-inspirations` | `widget-inspirations.ts` | Per-component inspirations. |
| `POST /api/playground` | `playground.ts` | Drive a playground scenario (gated by `KICKSTART_PLAYGROUND`). |
| `GET /api/health` | `health.ts` | Readiness + dependency probes. |
| `POST /api/generate` | `generate.ts` | Direct codegen entry-point. |
| `GET /api/github/auth/*` | `github-auth.ts` | GitHub OAuth flow + callback. |
| `*  /api/arm-proxy/*` | `arm-proxy.ts` | **Retired (`410 Gone` tombstone).** Browser-direct ARM (Option A2) — see [ARM call flow](../architecture/arm-call-flow.md). Use `armFetch` + `/api/azure/token`. |
| `*  /api/github-proxy/*` | `github-proxy.ts` | Browser-direct GitHub proxy. |
| `GET /api/cost-estimate` | `cost-estimate.ts` | Pricing lookups. |

The companion `packages/web/api/src/functions/converse.md` keeps a focused architecture note for the converse handler; this page is the inventory.

---

## SSE — `/api/converse`

`converse.ts` opens an SSE stream with `SSE_RESPONSE_HEADERS` from `runtime/sse.ts` and emits the 12-event taxonomy (`start | chunk | a2ui | tool_start | tool_done | phase | user_action_req | end | error | session_token | guardrail_warn | chain_step`). Imports from the harness:

```ts
import { sessionStore, getOrCreateSession } from '@aks-kickstart/harness/runtime/session';
import { Runner }                            from '@aks-kickstart/harness/runtime/runner';
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from '@aks-kickstart/harness/runtime/sse';
```

For the per-turn data flow, see [Architecture overview](../architecture/overview.md). For the prompt assembly inside `Runner.run`, see [Prompt pipeline](../architecture/prompt-pipeline.md).

---

## Resume — `/api/converse/resume`

`resume.ts` handles UserAction completion. The header comment captures the security gates:

> Critical 1: OID from X-MS-CLIENT-PRINCIPAL must match `session.user.oid` → 403.
> Critical 2: `resultPayload` validated against `UserAction.resultSchema` → 400.
> Critical 3: Playground stub gate enforced in `runner.ts` (`KICKSTART_PLAYGROUND=true`).

The handler also performs a **compare-and-swap** on `session.pendingUserAction` — clearing it before validation prevents a concurrent replay from re-firing the same action. See [Resume & session token](./resume-and-session-token.md) for the full flow.

---

## Packs DTO — `/api/packs`

`packs.ts` returns a strictly safe client DTO (header comment in the file):

> Never exposes: agent instructions, skill bodies, tool implementations, file paths, or credentials.
> Error bodies are always opaque — full error detail goes to server-side telemetry only.

Response shape:

```ts
interface PacksResponse {
  components: ComponentDTO[];          // { name, propertySchema (JSON-Schema) }
  userActions: UserActionDTO[];        // { name, wireName, description, confirmComponent?, scopes }
  playgroundScenarios: PlaygroundScenarioDTO[]; // { id, title, description?, group? } (safe-DTO carve-out)
  loadErrors: PackLoadError[];
}
```

`getRegistry()` and `getLoadErrors()` are imported from `../startup/packs.js` — the registry is sealed before the API serves any traffic.

---

## ARM proxy — `/api/arm-proxy/*` *(retired — `410 Gone`)*

The legacy ARM proxy is retired. The route stays registered as a minimal `410 Gone` tombstone (mirroring `/api/github-proxy` and `/api/github-oauth`) so any straggling caller gets a clear migration signal. Browser ARM traffic now goes **direct** to `https://management.azure.com` using a token from `GET /api/azure/token` and the `armFetch` wrapper. See [ARM call flow](../architecture/arm-call-flow.md).

---

## Health probe — `/api/health`

`health.ts` and `health.test.ts` validate readiness, dependency reachability (storage, OpenAI), and pack-load status. Failures surface as an HTTP 503 with an opaque body and a structured server-side log.

---

## Telemetry on every request

Every handler routes errors through `lib/sanitize-error.ts` and `telemetry/sanitize-error.ts` before logging via `lib/logger.ts` and `appinsights.ts`. Trace ids are pulled from incoming headers via `extractTraceId(...)` so the same `traceId` correlates SSE frames with App Insights spans. See [Observability](../operations/observability.md).
