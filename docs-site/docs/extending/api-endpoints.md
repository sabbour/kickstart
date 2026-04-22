---
sidebar_position: 5
---

# API Endpoints

Kickstart's backend runs on **Azure Functions v4** (Node.js), deployed as managed functions inside an Azure Static Web App. Endpoints handle LLM conversations, code generation, A2UI action processing, and proxy routes to external APIs.

This guide covers the endpoint pattern, SSE streaming, shared utilities, and how to add a new endpoint.

## How Endpoints Work

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
| `arm-proxy` | GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS | `/api/arm-proxy/{*path}` | Azure access token | JSON | Azure Resource Manager CORS proxy |
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

### SSE Streaming Pattern

Long-running AI operations use **Server-Sent Events** for real-time streaming. The client opts in by sending `Accept: text/event-stream`:

```typescript
// Check if the client wants SSE
const wantsStream = request.headers
  .get("accept")
  ?.includes("text/event-stream");

if (wantsStream) {
  return handleStreaming(/* ... */);
}

// Otherwise return a normal JSON response
return { status: 200, jsonBody: result };
```

The streaming response uses a `ReadableStream` with `TextEncoder`:

```typescript
function handleStreaming(/* params */): HttpResponseInit {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream content chunks
        controller.enqueue(
          encoder.encode(
            `event: chunk\ndata: ${JSON.stringify({ content: "..." })}\n\n`
          ),
        );

        // Stream tool calls and results
        controller.enqueue(
          encoder.encode(
            `event: tool_call\ndata: ${JSON.stringify({ name: "tool_name" })}\n\n`
          ),
        );

        // Final done event
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ sessionId, phase })}\n\n`
          ),
        );

        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: "message" })}\n\n`
          ),
        );
        controller.close();
      }
    },
  });

  return {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
    body: stream,
  };
}
```

#### SSE Event Types

The `converse` endpoint defines these event types:

| Event Type | Payload | Description |
|---|---|---|
| `chunk` | `{ content: string }` | Incremental text chunk from the LLM |
| `tool_call` | `{ name: string }` | LLM requested a tool call |
| `tool_result` | `{ name: string, result: unknown }` | Tool execution result |
| `message` | `{ content: string }` | Final complete message text |
| `a2ui` | A2UI component JSON | Structured UI component for rendering |
| `done` | `{ sessionId, phase, phaseLabel, model, ... }` | Stream complete — metadata payload |
| `error` | `{ error: string }` | Stream error — generic message only |

### Shared Utilities

Endpoints share a set of utility modules in `packages/web/api/src/lib/`:

| Module | Exports | Purpose |
|---|---|---|
| `runner.ts` | `Runner` | Orchestrates agent turns, guardrails, tool dispatch, and UserAction pause/resume |
| `session-store.ts` | `getSession()`, `createSession()`, `addMessage()` | In-memory session management with 1-hour TTL |
| `error-response.ts` | `safeErrorResponse()`, `safeStreamError()` | Generic error responses — logs details server-side, returns safe messages to clients |
| `rate-limiter.ts` | `checkRateLimit()`, `rateLimitResponse()` | Sliding-window rate limiting (30 req/min per client, 300 req/min global backstop) |

---

## Endpoint Reference

### Conversation & Session

#### `POST /api/converse`

**Auth:** None (rate-limited)  
**Body:** `{ sessionId?: string, message: string, messages?: ClientMessage[] }`  
**Returns:** SSE stream (if `Accept: text/event-stream`) or JSON `{ sessionId, phase, message, a2ui?, model?, usage?, ... }`  
**Source:** `packages/web/api/src/functions/converse.ts`

Main LLM conversation endpoint. Manages multi-round tool calling and streams incremental output. `sessionId` is optional — if omitted or the in-memory session has expired, a new session is created automatically. Pass `messages` (client-side message history) to rehydrate context across cold starts.

#### `POST /api/action`

**Auth:** Session required  
**Body:**
```json
{
  "sessionId": "string",
  "action": { "name": "string", "context": "Record<string, unknown> (optional)" },
  "context": { "phase": "string (optional)" },
  "messages": "ClientMessage[] (optional, for cold-start rehydration)"
}
```
**Returns:** JSON `{ success: boolean, sessionId, message?, phase?, a2uiMessages?, model? }`  
**Source:** `packages/web/api/src/functions/action.ts`

Processes an A2UI action event — called when the user interacts with a button, picker, or other A2UI component. Routes by action name prefix (`navigate:` / `nav:` = navigation, `api:` = stubbed, default = reply) and re-prompts the LLM.

#### `POST /api/generate`

**Auth:** None (rate-limited)  
**Body:** `{ prompt: string, type?: "dockerfile" | "kubernetes" | "pipeline" | "bicep" | "generic", context?: string }`  
**Returns:** SSE stream (if `Accept: text/event-stream`) or JSON `{ type, code, responseId }`  
**Source:** `packages/web/api/src/functions/generate.ts`

Codex-powered code generation endpoint. Accepts a prompt and optional type hint; returns generated code. No session state — stateless per-request. Streaming is opted into via `Accept: text/event-stream`.

#### `GET /api/health`

**Auth:** None  
**Returns:** JSON `{ status: "ok" }`  
**Source:** `packages/web/api/src/functions/health.ts`

Liveness probe. Returns immediately with no dependencies checked.

---

### GitHub Integration

#### `GET/POST /api/github-auth/{action}`

**Auth:** SWA principal (Kickstart sign-in required for `login`)  
**Route param:** `action` — one of `login`, `callback`, `session`, `logout`  
**Returns:** HTML (login/callback) or JSON (session/logout)  
**Source:** `packages/web/api/src/functions/github-auth.ts`

Manages the GitHub OAuth 2.0 popup flow:

| Action | Method | Description |
|---|---|---|
| `login` | GET | Redirects the popup window to GitHub's OAuth authorization page |
| `callback` | GET | Receives the OAuth code, exchanges it for a token, sets session cookies, closes popup |
| `session` | GET | Returns current GitHub session state `{ login, avatarUrl, connected }` |
| `logout` | POST | Clears GitHub session cookies (204 No Content) |

The `login` action accepts an optional `?returnTo=` query parameter to redirect back after sign-in.

#### `GET /api/github/repos`

**Auth:** GitHub session cookie  
**Query params:** `owner` (optional), `page` (default 1), `perPage` (default 20)  
**Returns:** JSON `{ repos: GitHubRepo[] }`  
**Source:** `packages/web/api/src/functions/github-repos.ts`

Lists GitHub repositories accessible to the authenticated user. Refreshes the session cookie on each call.

#### `POST /api/github/repos`

**Auth:** GitHub session cookie  
**Body:** `{ owner: string, name: string, description?: string, private?: boolean }`  
**Returns:** JSON `{ repo: GitHubRepo }` (201 Created)  
**Source:** `packages/web/api/src/functions/github-repos.ts`

Creates a new GitHub repository on behalf of the authenticated user.

#### `POST /api/github/pulls`

**Auth:** GitHub session cookie  
**Body:**
```json
{
  "owner": "string",
  "repo": "string",
  "head": "string",
  "base": "string (optional, defaults to default branch)",
  "title": "string",
  "body": "string (optional)",
  "commitMessage": "string (optional)",
  "files": [{ "path": "string", "content": "string" }]
}
```
**Returns:** JSON `{ pullRequest, branch, commit }` (201 Created)  
**Source:** `packages/web/api/src/functions/github-pulls.ts`

Commits files to a new branch and opens a pull request in a single call.

---

### Azure Integration

#### `ANY /api/arm-proxy/{*path}`

**Auth:** Azure access token (`X-Azure-AccessToken` header or SWA Azure auth cookie)  
**Methods:** GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS  
**Returns:** Proxied response from `management.azure.com`  
**Source:** `packages/web/api/src/functions/arm-proxy.ts`

CORS proxy for Azure Resource Manager. Forwards the request path, query parameters, and body to `management.azure.com`, injecting the caller's Bearer token. Adds a default `api-version=2024-03-01` if the caller omits one. Host-allowlisted — only `management.azure.com` is accepted.

#### `PUT /api/sessions/{sessionId}/azure-target`

**Auth:** Azure access token + SWA sign-in (`x-ms-client-principal-id` header required) + session ownership  
**Body:**
```json
{
  "subscriptionId": "string",
  "resourceGroup": "string",
  "location": "string",
  "createIfMissing": "boolean (or use resourceGroupMode: 'new')"
}
```
**Returns:** JSON `{ sessionId, azureContext, deployState }`  
**Source:** `packages/web/api/src/functions/azure-target.ts`

Stores the user's chosen Azure subscription and resource group against the session. Optionally creates the resource group if it doesn't exist.

#### `POST /api/sessions/{sessionId}/azure-deployments`

**Auth:** Azure access token + SWA sign-in (`x-ms-client-principal-id` header required) + session ownership  
**Body:**
```json
{
  "mainFile": "string",
  "files": [{ "path": "string", "content": "string" }],
  "deploymentName": "string (optional)",
  "parameters": "Record<string, unknown> (optional)",
  "appUrlOutput": "string (optional)",
  "healthCheckPath": "string (optional)"
}
```
**Returns:** JSON `{ runId, status }` (202 Accepted)  
**Source:** `packages/web/api/src/functions/azure-deployments.ts`

Starts an ARM template deployment. Returns a `runId` that the client polls with the status endpoint below.

#### `GET /api/azure-deployments/{runId}`

**Auth:** Azure access token + SWA sign-in (`x-ms-client-principal-id` header required) + principal ownership  
**Returns:** JSON `{ runId, status, outputs, error }`  
**Source:** `packages/web/api/src/functions/azure-deployments.ts`

Polls deployment status. The `runId` is opaque and encodes the principal identifier — a deployment run can only be polled by the user who started it.

#### `POST /api/sessions/{sessionId}/deploy-gates/cost`

**Auth:** SWA sign-in (`x-ms-client-principal-id` header required) + session ownership  
**Body:** `{ estimatedMonthlyTotal: number, currency?: string, source?: string }`  
**Returns:** JSON `{ sessionId, deployState }`  
**Source:** `packages/web/api/src/functions/deploy-cost-gate.ts`

Records that the user has acknowledged the estimated monthly cost before deployment. Updates the session's `deployState.costGatePassed` flag. The frontend uses this as a gate before calling the start-deployment endpoint.

#### `POST /api/sessions/{sessionId}/cost-estimate`

**Auth:** Session ownership  
**Rate limit:** 12 requests per minute (stricter than the default 30/min)  
**Body:** `{ region: string, lineItems: CostLineItem[] }` (see `packages/web/api/src/lib/cost-estimate.ts` for the full schema)  
**Returns:** JSON cost estimate with live prices, cache metadata, and fallback info  
**Source:** `packages/web/api/src/functions/cost-estimate.ts`

Fetches a cost estimate from the Azure Retail Prices API for the resource types in `lineItems`. Results are cached per region/SKU combination. Falls back to static prices if the upstream API is unavailable.

---

### Utility

#### `GET /api/pricing-proxy`

**Auth:** None  
**Query params:** Any OData `$filter` / `$orderBy` supported by the Azure Retail Prices API  
**Returns:** Proxied JSON from `prices.azure.com/api/retail/prices`  
**Source:** `packages/web/api/src/functions/pricing-proxy.ts`

Public CORS proxy for the Azure Retail Prices API. No authentication required — the pricing API is public. Responses are cached for 5 minutes (`Cache-Control: public, max-age=300`).

Example: `GET /api/pricing-proxy?$filter=serviceName eq 'Azure Kubernetes Service'`

#### `GET /api/inspirations`

**Auth:** None  
**Query params:** `stream=true` (optional) — stream a single idea token-by-token  
**Returns:** JSON `InspirationIdea[]` (array of `{ title, subtitle, prompt }`) or SSE stream  
**Source:** `packages/web/api/src/functions/inspirations.ts`

Returns carousel inspiration ideas for the landing page. Requires Azure OpenAI to be configured — returns `503 Service Unavailable` if `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and a deployment name are not set. When configured, generates creative app ideas via LLM (`AZURE_OPENAI_INSPIRE_DEPLOYMENT` is used if set, otherwise falls back to the chat deployment).

#### `GET /api/inspirations/widgets`

**Auth:** None  
**Query params:** `stream=true` (optional) — stream a widget prompt token-by-token  
**Returns:** JSON `WidgetIdea[]` (array of `{ title: string, subtitle: string, prompt: string }`) or SSE stream  
**Source:** `packages/web/api/src/functions/widget-inspirations.ts`

Returns Playground widget inspiration prompts. If Azure OpenAI is configured, generates AKS operational widget ideas via LLM. Otherwise returns a shuffled fallback idea from a built-in list. Used by the Playground Create tab to seed the prompt field.

#### `POST /api/playground`

> 🔧 **Internal** — used exclusively by the A2UI Playground Create tab. Not part of the public API contract.

**Auth:** None (rate-limited)  
**Body:** `{ message: string, sessionId?: string }`  
**Returns:** JSON `{ sessionId: string, message: string, a2ui?: object[] }`  
**Source:** `packages/web/api/src/functions/playground.ts`

Dedicated A2UI component design endpoint. Uses a specialised system prompt focused on iterating over A2UI component structures. Maintains its own lightweight in-memory session store (separate from the main conversation sessions, 1-hour TTL).

---

## How to Add an Endpoint

### Step 1 — Create the function file

Create a new file in `packages/web/api/src/functions/`. The filename doesn't matter for routing — the `route` parameter in `app.http()` controls the URL path.

```
packages/web/api/src/functions/my-endpoint.ts
```

### Step 2 — Implement the handler

Use the standard Azure Functions v4 pattern. Apply rate limiting and error handling:

```typescript
import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";

interface MyEndpointRequest {
  query: string;
}

app.http("myEndpoint", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "my-endpoint",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    // Rate limit check
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const body = (await request.json()) as MyEndpointRequest;

      if (!body.query?.trim()) {
        return { status: 400, jsonBody: { error: "query is required" } };
      }

      // Your logic here
      const result = await processQuery(body.query);

      return { status: 200, jsonBody: result };
    } catch (err) {
      return safeErrorResponse(err, context, "MyEndpoint error");
    }
  },
});
```

### Step 3 — Add SSE streaming (if applicable)

If your endpoint calls the LLM or performs long-running work, support SSE streaming. Check the `Accept` header and return a `ReadableStream`:

```typescript
const wantsStream = request.headers
  .get("accept")
  ?.includes("text/event-stream");

if (wantsStream) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream your data
        for (const item of results) {
          controller.enqueue(
            encoder.encode(
              `event: chunk\ndata: ${JSON.stringify(item)}\n\n`
            ),
          );
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ complete: true })}\n\n`
          ),
        );
        controller.close();
      } catch (err) {
        const safeMsg = safeStreamError(err, context, "Stream error");
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: safeMsg })}\n\n`
          ),
        );
        controller.close();
      }
    },
  });

  return {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
    body: stream,
  };
}
```

### Step 4 — Build and verify

The API uses esbuild and auto-discovers function files — no manual registration needed:

```bash
npm run build -w @aks-kickstart/api
```

Start the development server and test your endpoint:

```bash
# JSON response
curl -X POST http://localhost:7071/api/my-endpoint \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# SSE streaming
curl -X POST http://localhost:7071/api/my-endpoint \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"query": "test"}'
```

### Step 5 — Add SWA route config (if needed)

If your endpoint needs specific routing rules (e.g., CORS headers, auth requirements), update `swa-cli.config.json` or add route rules to `staticwebapp.config.json`. The default wildcard `/api/*` proxies all API calls, so new endpoints under `/api/` typically work without changes.

---

## Patterns to Follow

### Error Handling

Always use `safeErrorResponse()` for non-streaming endpoints and `safeStreamError()` for SSE streams. These log the full error server-side but return only a generic message to clients — preventing internal details from leaking.

```typescript
// JSON endpoint — 3 args: error, context, label
return safeErrorResponse(err, context, "MyEndpoint error");

// SSE stream — 3 args: error, context, label — returns a safe string
const safeMsg = safeStreamError(err, context, "Stream error");
```

### Rate Limiting

Apply `checkRateLimit()` at the top of every public handler. Pass the request object directly — the limiter extracts the client identifier from SWA principal headers or falls back to IP headers:

```typescript
const rateCheck = checkRateLimit(request);
if (!rateCheck.allowed) {
  return rateLimitResponse(rateCheck.retryAfterMs!);
}
```

Limits: **30 requests per minute** per client, **300 per minute** global backstop.

### Content Safety

For endpoints that accept user-generated text, run `checkContentSafety()` before processing:

```typescript
const safetyResult = await checkContentSafety(body.message);
if (!safetyResult.safe) {
  return { status: 400, jsonBody: { error: safetyResult.error } };
}
```

---

## Key Files

| File | Purpose |
|---|---|
| `packages/web/api/src/functions/converse.ts` | Main LLM conversation endpoint with SSE streaming and tool calling |
| `packages/web/api/src/functions/generate.ts` | Code generation endpoint (Codex) with SSE streaming |
| `packages/web/api/src/functions/health.ts` | Minimal health check — good template for simple endpoints |
| `packages/web/api/src/functions/action.ts` | A2UI action event processing (JSON only) |
| `packages/web/api/src/lib/openai-client.ts` | Azure OpenAI client with streaming async generator |
| `packages/web/api/src/lib/session-store.ts` | In-memory session management with TTL |
| `packages/web/api/src/lib/error-response.ts` | `safeErrorResponse()` and `safeStreamError()` utilities |
| `packages/web/api/src/lib/rate-limiter.ts` | Sliding-window rate limiter (per-client + global backstop) |
