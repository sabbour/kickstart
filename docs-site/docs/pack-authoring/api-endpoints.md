---
sidebar_position: 5
---

# API Endpoints

Kickstart's backend runs on **Azure Functions v4** (Node.js, ESM) deployed inside a Static Web App. Handlers live in `packages/web/api/src/functions/`. Each function file is wired with `app.http(...)`; routes are registered at module load time.

---

## Function inventory


### Azure Functions v4 Pattern

Every endpoint follows the same registration pattern using `app.http()` in `packages/web/api/src/functions/`:

```typescript
import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

app.http("functionName", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "endpoint-path",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    // Handler logic
  },
});
```

| Property | Description |
|---|---|
| `"functionName"` | Unique function name used by the Azure Functions runtime |
| `methods` | HTTP methods to accept (`["GET"]`, `["POST"]`, etc.) |
| `authLevel` | Always `"anonymous"` — SWA handles auth at the edge |
| `route` | URL path (relative to `/api/`) |
| `handler` | Async function receiving the request and invocation context |

### Existing Endpoints

#### Conversation & Session

| Endpoint | Method | Route | Auth | Response Format | Description |
|---|---|---|---|---|---|
| `converse` | POST | `/api/converse` | None (rate-limited) | SSE or JSON | Main LLM conversation proxy — multi-round tool calling |
| `action` | POST | `/api/action` | Session required | JSON | A2UI action event processing |
| `generate` | POST | `/api/generate` | None (rate-limited) | SSE or JSON | Codex-powered code generation |
| `health` | GET | `/api/health` | None | JSON | Health check (`{ status: "ok" }`) |

#### GitHub Integration

| Endpoint | Method | Route | Auth | Response Format | Description |
|---|---|---|---|---|---|
| `github-auth` | GET/POST | `/api/github-auth/{action}` | SWA principal | HTML / JSON | GitHub OAuth flow — login, callback, session state, logout |
| `github-repos` | GET/POST | `/api/github/repos` | GitHub session cookie | JSON | List or create GitHub repositories |
| `github-pulls` | POST | `/api/github/pulls` | GitHub session cookie | JSON | Commit files and open a pull request |

#### Azure Integration

| Endpoint | Method | Route | Auth | Response Format | Description |
|---|---|---|---|---|---|
| `azure-subscriptions` | GET | `/api/azure/subscriptions` | `x-ms-token-aad-access-token` | JSON `{ value: [] }` | List Azure subscriptions for the signed-in user |
| `azure-locations` | GET | `/api/azure/subscriptions/{subId}/locations` | `x-ms-token-aad-access-token` | JSON `{ value: [] }` | List Azure locations available in a subscription |
| `azure-resource-groups` | GET | `/api/azure/subscriptions/{subId}/resource-groups` | `x-ms-token-aad-access-token` | JSON `{ value: [] }` | List resource groups in a subscription |
| `azure-resources` | GET | `/api/azure/subscriptions/{subId}/resources` | `x-ms-token-aad-access-token` | JSON `{ value: [] }` | List resources in a subscription |
| `azure-target` | PUT | `/api/sessions/{sessionId}/azure-target` | Azure access token + SWA sign-in + session | JSON | Persist Azure subscription / resource group for a session |
| `azure-deployments-start` | POST | `/api/sessions/{sessionId}/azure-deployments` | Azure access token + SWA sign-in + session | JSON | Kick off an ARM deployment for a session |
| `azure-deployments-status` | GET | `/api/azure-deployments/{runId}` | Azure access token + SWA sign-in | JSON | Poll the status of a running ARM deployment |
| `deploy-cost-gate` | POST | `/api/sessions/{sessionId}/deploy-gates/cost` | SWA sign-in + session | JSON | Record that the user acknowledged estimated deployment costs |
| `cost-estimate` | POST | `/api/sessions/{sessionId}/cost-estimate` | Session required | JSON | Fetch a live Azure cost estimate for the session's resource line-items |

#### Utility

| Endpoint | Method | Route | Auth | Response Format | Description |
|---|---|---|---|---|---|
| `pricing-proxy` | GET | `/api/pricing-proxy` | None | JSON | CORS proxy for the Azure Retail Prices API |
| `inspirations` | GET | `/api/inspirations` | None | JSON / SSE | Landing page inspiration ideas (LLM-generated or hardcoded fallback) |
| `widget-inspirations` | GET | `/api/inspirations/widgets` | None | JSON / SSE | Playground widget inspiration prompts |
| `playground` | POST | `/api/playground` | None | JSON | 🔧 Internal — A2UI Playground Create tab; iterates A2UI component designs |

#### Deprecated (410 Gone)

These routes are registered solely to return `410 Gone` to any client still calling them. Do not use them.

| Endpoint | Route | Replacement |
|---|---|---|
| `github-proxy-legacy` | `/api/github-proxy/{*path}` | Use `/api/github-auth`, `/api/github/repos`, `/api/github/pulls` |
| `github-oauth-legacy` | `/api/github-oauth/{*path}` | Use `/api/github-auth/login` |
| `arm-proxy-legacy` | `/api/arm-proxy/{*path}` | **Deprecated → `410 Gone`.** Use the typed `/api/azure/*` endpoints (subscriptions, locations, resource-groups, resources) instead. |

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

The handler also performs a **compare-and-swap** on `session.pendingUserAction` — clearing it before validation prevents a concurrent replay from re-firing the same action. See [Resume & session token](../agent-authoring/resume-and-session-token.md) for the full flow.

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
