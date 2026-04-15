# Kickstart API Reference

The Kickstart web surface exposes API endpoints through Azure Static Web Apps (SWA) managed Functions. These endpoints handle conversation, action processing, code generation, CORS proxying for Azure and GitHub APIs, and health checks.

> **Related docs:** [Prompt Architecture](./prompt-architecture.md) for system prompt details · [Deployment Guide](./deployment.md) for hosting setup

---

## Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/converse` | `POST` | Main LLM conversation proxy |
| `/api/action` | `POST` | A2UI action event processing |
| `/api/generate` | `POST` | Code generation (Codex model) |
| `/api/health` | `GET` | Health check |
| `/api/arm-proxy/{*path}` | `ANY` | CORS proxy → Azure Resource Manager |
| `/api/github-proxy/{*path}` | `ANY` | CORS proxy → GitHub REST API |
| `/api/pricing-proxy` | `GET` | CORS proxy → Azure Retail Prices API |

---

## `POST /api/converse`

Main LLM proxy endpoint. Accepts a user message, manages session state, calls Azure OpenAI, and returns the response with conversation phase metadata.

**Source:** [`packages/web/api/src/functions/converse.ts`](../packages/web/api/src/functions/converse.ts)

### Request

```http
POST /api/converse
Content-Type: application/json
```

#### Body

```typescript
interface ConverseRequest {
  sessionId?: string;  // Omit to start a new session
  message: string;     // User message (required, non-empty)
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | No | UUID of an existing session. Omit to create a new one. |
| `message` | `string` | Yes | The user's message. Must be non-empty after trimming. |

#### Example

```json
{
  "message": "I have a Node.js Express app that serves a REST API"
}
```

With an existing session:

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "It needs a PostgreSQL database"
}
```

### Response (Standard)

```typescript
interface ConverseResponse {
  sessionId: string;       // UUID — always returned
  phase: string;           // Current phase: "discover" | "design" | "generate" | "review" | "handoff" | "deploy"
  message: string;         // LLM-generated response text
  a2ui?: object[];         // A2UI components (ConversationPhase indicator)
  usage?: {
    turn: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd?: number;
      costStatus: "estimated" | "unavailable";
    };
    session: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      turnCount: number;
      estimatedCostUsd?: number;
      costStatus: "estimated" | "unavailable";
    };
  };
  systemPrompt?: string;   // Only returned on the first message of a new session
}
```

#### Example Response

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "phase": "discover",
  "message": "Great! A Node.js Express REST API — solid choice. What does your API do?",
  "a2ui": [
    {
      "type": "ConversationPhase",
      "id": "phase-indicator",
      "phases": [
        { "id": "discover", "label": "Discover", "status": "active" },
        { "id": "design", "label": "Design", "status": "pending" },
        { "id": "generate", "label": "Generate", "status": "pending" },
        { "id": "review", "label": "Review", "status": "pending" },
        { "id": "handoff", "label": "Handoff", "status": "pending" },
        { "id": "deploy", "label": "Deploy", "status": "pending" }
      ],
      "currentPhase": "discover"
    }
  ],
  "usage": {
    "turn": {
      "model": "gpt-5.3-chat",
      "inputTokens": 412,
      "outputTokens": 138,
      "totalTokens": 550,
      "costStatus": "unavailable"
    },
    "session": {
      "inputTokens": 412,
      "outputTokens": 138,
      "totalTokens": 550,
      "turnCount": 1,
      "costStatus": "unavailable"
    }
  },
  "systemPrompt": "You are **Kickstart**, a friendly..."
}
```

### Response (Streaming)

To receive streaming responses, set the `Accept` header:

```http
POST /api/converse
Content-Type: application/json
Accept: text/event-stream
```

The response is an SSE stream with NDJSON chunks:

```
data: {"content":"Great"}

data: {"content":"! A Node"}

data: {"content":".js Express"}

data: {"done":true,"sessionId":"...","phase":"discover","phaseLabel":"Discover","a2ui":[...]}
```

**Stream structure:**

| Event | Fields | Description |
|-------|--------|-------------|
| Content chunk | `{ content: string }` | Partial LLM output as it arrives |
| Final event | `{ done: true, sessionId, phase, phaseLabel, usage }` | Metadata sent after all content |
| Error | `{ error: string }` | Sent if an error occurs mid-stream |

**Response headers for streaming:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "message is required" }` | Missing or empty `message` field |
| `404` | N/A | Invalid session ID (session returns `undefined`, treated as new) |
| `500` | `{ "error": "<message>" }` | Azure OpenAI failure or internal error |

> **Note:** An invalid `sessionId` doesn't return 404 — the API creates a new session instead. The old `sessionId` is silently discarded.

---

## Session Lifecycle

Sessions are managed in-memory by the API session store.

**Source:** [`packages/web/api/src/lib/session-store.ts`](../packages/web/api/src/lib/session-store.ts)

### Creation

A new session is created when:
- `sessionId` is omitted from the request, OR
- The provided `sessionId` doesn't match any existing session

On creation:
1. A UUID is generated via `crypto.randomUUID()`
2. The conversation engine is initialized in the **Discover** phase
3. A system prompt is composed via `buildSystemPrompt()` and stored as the first message
4. The session is stored in the in-memory `Map`

### TTL & Cleanup

| Setting | Value |
|---------|-------|
| Session TTL | **1 hour** (60 × 60 × 1000 ms) |
| Cleanup interval | **Every 10 minutes** |

```typescript
const SESSION_TTL_MS = 60 * 60 * 1000;
const cleanupInterval = setInterval(() => { /* purge stale */ }, 10 * 60 * 1000);
cleanupInterval.unref(); // Don't keep process alive for cleanup
```

Sessions are purged when `Date.now() - session.lastAccessed > SESSION_TTL_MS`. The cleanup timer uses `.unref()` so it doesn't prevent the process from exiting.

### Session State Shape

```typescript
interface ApiSession {
  state: SessionState;         // Core session state (messages, appDefinition, phase)
  engineState: ConversationState;  // FSM state (phase transitions)
  lastAccessed: number;        // Timestamp for TTL tracking
}
```

---

## Environment Variables

The API requires Azure OpenAI connection settings, plus optional pricing inputs if you want estimated per-turn/session cost totals:

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint URL | `https://my-openai.openai.azure.com` |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | Chat model deployment name | `gpt-5.3-chat` |
| `AZURE_OPENAI_CODEX_DEPLOYMENT` | Codex model deployment name | `gpt-5.3-codex` |
| `AZURE_OPENAI_DEPLOYMENT` | Legacy fallback deployment name | `gpt-4o` |
| `AZURE_OPENAI_API_KEY` | API key for the Azure OpenAI resource | `abc123...` |
| `AZURE_OPENAI_CHAT_INPUT_PRICE_PER_1K_USD` | Optional estimated chat input-token price | `0.0015` |
| `AZURE_OPENAI_CHAT_OUTPUT_PRICE_PER_1K_USD` | Optional estimated chat output-token price | `0.0060` |
| `AZURE_OPENAI_CODEX_INPUT_PRICE_PER_1K_USD` | Optional estimated codex input-token price | `0.0015` |
| `AZURE_OPENAI_CODEX_OUTPUT_PRICE_PER_1K_USD` | Optional estimated codex output-token price | `0.0060` |

**Source:** [`packages/web/api/src/lib/openai-client.ts`](../packages/web/api/src/lib/openai-client.ts)

The client uses the Azure OpenAI REST API directly via `fetch()`:

```
${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview
```

Default parameters:
- `temperature`: 0.7
- `max_tokens`: 2048

If any variable is missing, the API throws:
```
Missing Azure OpenAI configuration. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_KEY.
```

---

## Local Development

### Prerequisites

- Node.js 20+
- [Azure SWA CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/local-development) (`npm install -g @azure/static-web-apps-cli`)

### Setup

1. **Install dependencies and build:**

```bash
npm ci
npm run build -w @kickstart/core
npm run build -w @kickstart/api
```

2. **Create local settings** (`packages/web/api/local.settings.json`):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_API_KEY": "your-key-here"
  }
}
```

> ⚠️ `local.settings.json` is in `.gitignore` — never commit API keys.

3. **Start SWA CLI:**

```bash
swa start packages/web --api-location packages/web/api
```

This serves the static frontend on `http://localhost:4280` and proxies `/api/*` to the Azure Functions backend.

### Testing the API

```bash
# Start a new conversation
curl -X POST http://localhost:4280/api/converse \
  -H "Content-Type: application/json" \
  -d '{"message": "I have a Python Flask app"}'

# Continue with the returned sessionId
curl -X POST http://localhost:4280/api/converse \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "RETURNED_SESSION_ID", "message": "It needs a PostgreSQL database"}'

# Test streaming
curl -X POST http://localhost:4280/api/converse \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Hello"}'
```

---

## `POST /api/action`

A2UI action event processing. Receives action events fired by A2UI components in the browser, routes them by type, and returns updated conversation state with a fresh LLM response.

**Source:** [`packages/web/api/src/functions/action.ts`](../packages/web/api/src/functions/action.ts)

### Action routing

Per decision F17, **all action types re-prompt the LLM** — the LLM stays in full control of state transitions.

| Action prefix | Behaviour |
|---------------|-----------|
| *(default)* `reply` | Translate action to natural language, re-prompt |
| `navigate:` / `nav:` | Update phase intent, re-prompt framed as navigation |
| `api:` | Stubbed — returns `not_implemented` |

### Request

```http
POST /api/action
Content-Type: application/json
```

```typescript
interface ActionRequest {
  sessionId: string;
  action: {
    name: string;                     // Action name (may include prefix)
    context?: Record<string, unknown>; // Payload from the component
  };
}
```

### Response

Same shape as `/api/converse` response — `{ sessionId, phase, message, a2ui? }`.

---

## `POST /api/generate`

Code generation endpoint powered by the Azure OpenAI Responses API (Codex model). Returns generated code for a given prompt and type hint. Supports SSE streaming.

**Source:** [`packages/web/api/src/functions/generate.ts`](../packages/web/api/src/functions/generate.ts)

### Request

```http
POST /api/generate
Content-Type: application/json
```

```typescript
interface GenerateRequest {
  prompt: string;
  type?: "dockerfile" | "kubernetes" | "pipeline" | "bicep" | "generic";
  context?: string;  // Optional additional context
}
```

### Response

```typescript
interface GenerateResponse {
  type: string;
  code: string;
  responseId: string;
}
```

Supports streaming via `Accept: text/event-stream` — same SSE format as `/api/converse`.

### Additional environment variable

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_CODEX_DEPLOYMENT` | Codex model deployment name (e.g. `gpt-5.3-codex`) |

---

## `GET /api/health`

Health check. Returns `{ "status": "ok" }` with HTTP 200. Used by Azure Static Web Apps and monitoring tools.

**Source:** [`packages/web/api/src/functions/health.ts`](../packages/web/api/src/functions/health.ts)

---

## `ANY /api/arm-proxy/{*path}`

CORS proxy for the Azure Resource Manager API. Forwards requests to `management.azure.com`, passing the caller's `Authorization` header and all query parameters. Injects a default `api-version` if the caller omits one.

**Source:** [`packages/web/api/src/functions/arm-proxy.ts`](../packages/web/api/src/functions/arm-proxy.ts)

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

Rate-limit response headers are forwarded from ARM: `x-ratelimit-*`, `retry-after`, `x-ms-ratelimit-*`, `x-ms-request-id`, `x-ms-correlation-request-id`.

**Example:**

```bash
# List AKS clusters in a subscription
curl http://localhost:4280/api/arm-proxy/subscriptions/{subId}/providers/Microsoft.ContainerService/managedClusters \
  -H "Authorization: Bearer <token>"
```

---

## `ANY /api/github-proxy/{*path}`

CORS proxy for the GitHub REST API. Forwards requests to `api.github.com`, injecting the GitHub API `Accept` header and passing through the caller's `Authorization` token.

**Source:** [`packages/web/api/src/functions/github-proxy.ts`](../packages/web/api/src/functions/github-proxy.ts)

Rate-limit response headers are forwarded: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-ratelimit-used`, `x-ratelimit-resource`.

**Example:**

```bash
# List repos for the authenticated user
curl http://localhost:4280/api/github-proxy/user/repos \
  -H "Authorization: Bearer ghp_..."
```

---

## `GET /api/pricing-proxy`

CORS proxy for the Azure Retail Prices API. Forwards query parameters to `prices.azure.com/api/retail/prices`. No authentication required — the Azure pricing API is public.

**Source:** [`packages/web/api/src/functions/pricing-proxy.ts`](../packages/web/api/src/functions/pricing-proxy.ts)

**Example:**

```bash
# Get AKS pricing
curl "http://localhost:4280/api/pricing-proxy?\$filter=serviceName eq 'Azure Kubernetes Service'"
```
