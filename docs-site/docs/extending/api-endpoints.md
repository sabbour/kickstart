---
sidebar_position: 5
---

# API Endpoints

Kickstart's backend runs on **Azure Functions v4** (Node.js, ESM) deployed inside a Static Web App. Handlers live in `packages/web/api/src/functions/`. Each function file is wired with `app.http(...)`; routes are registered at module load time.

---

## Function inventory

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/converse` | `converse.ts` (~649 lines) | Per-turn SSE stream — runs the active agent through `Runner.run()`. |
| `POST /api/converse/resume` | `resume.ts` (~136 lines) | Resume a paused Runner after a UserAction result arrives. |
| `POST /api/action` | `action.ts` (~338 lines) | Execute a one-shot UserAction outside a converse stream. |
| `GET /api/packs` | `packs.ts` (~129 lines) | Safe client DTO of components, user actions, and playground scenarios. |
| `POST /api/inspirations` | `inspirations.ts` (~312 lines) | Generate inspiration suggestions. |
| `POST /api/widget-inspirations` | `widget-inspirations.ts` (~265 lines) | Per-component inspirations. |
| `POST /api/playground` | `playground.ts` (~249 lines) | Drive a playground scenario (gated by `KICKSTART_PLAYGROUND`). |
| `GET /api/health` | `health.ts` (~216 lines) | Readiness + dependency probes. |
| `POST /api/generate` | `generate.ts` (~208 lines) | Direct codegen entry-point. |
| `GET /api/github/auth/*` | `github-auth.ts` (~206 lines) | GitHub OAuth flow + callback. |
| `*  /api/arm-proxy/*` | `arm-proxy.ts` | Browser-direct ARM proxy (Option A2). |
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

## ARM proxy — `/api/arm-proxy/*`

Browser-direct ARM (Option A2). The browser owns the ARM access token and forwards it through the proxy, which adds correlation headers and rate-limit shaping. See [ARM call flow](../architecture/arm-call-flow.md).

---

## Health probe — `/api/health`

`health.ts` and `health.test.ts` validate readiness, dependency reachability (storage, OpenAI), and pack-load status. Failures surface as an HTTP 503 with an opaque body and a structured server-side log.

---

## Telemetry on every request

Every handler routes errors through `lib/sanitize-error.ts` and `telemetry/sanitize-error.ts` before logging via `lib/logger.ts` and `appinsights.ts`. Trace ids are pulled from incoming headers via `extractTraceId(...)` so the same `traceId` correlates SSE frames with App Insights spans. See [Observability](../operations/observability.md).
