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

| Endpoint | Method | Route | Response Format | Description |
|---|---|---|---|---|
| `converse` | POST | `/api/converse` | SSE or JSON | Main LLM conversation proxy — multi-round tool calling |
| `action` | POST | `/api/action` | JSON | A2UI action event processing |
| `generate` | POST | `/api/generate` | SSE or JSON | Codex-powered code generation |
| `health` | GET | `/api/health` | JSON | Health check (`{ status: "ok" }`) |
| `arm-proxy` | Various | `/api/arm-proxy/*` | JSON | Azure Resource Manager CORS proxy |
| `github-proxy` | Various | `/api/github-proxy/*` | JSON | GitHub API CORS proxy |
| `pricing-proxy` | Various | `/api/pricing-proxy/*` | JSON | Azure Pricing API CORS proxy |
| `inspirations` | GET | `/api/inspirations` | JSON | App inspiration templates |
| `widget-inspirations` | GET | `/api/widget-inspirations` | JSON | Widget catalog inspirations |
| `github-oauth` | Various | `/api/github-oauth/*` | JSON | GitHub OAuth Device Flow |
| `playground` | POST | `/api/playground` | SSE or JSON | Prompt playground for testing |

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
| `openai-client.ts` | `chatCompletion()`, `chatCompletionWithTools()`, `chatCompletionStream()`, `codexCompletion()` | Azure OpenAI client with JSON mode and tool support |
| `session-store.ts` | `getSession()`, `createSession()`, `hydrateSession()`, `addMessage()` | In-memory session management with 1-hour TTL |
| `error-response.ts` | `safeErrorResponse()`, `safeStreamError()` | Generic error responses — logs details server-side, returns safe messages to clients |
| `rate-limiter.ts` | `checkRateLimit()`, `rateLimitResponse()` | Sliding-window rate limiting (30 req/min per client, 300 req/min global backstop) |
| `response-processor.ts` | `processResponse()` | Parse LLM JSON envelope into message + A2UI components |
| `content-safety.ts` | `checkContentSafety()` | Content safety pre-flight check on user messages |
| `auto-continue.ts` | `chatCompletionWithAutoContinue()`, `isTruncated()` | Auto-continuation for truncated LLM responses |
| `sanitize-tool-output.ts` | `sanitizeToolOutput()` | Sanitize tool results before feeding back to the LLM |

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
npm run build -w @kickstart/api
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
