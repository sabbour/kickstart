# Extending Kickstart

This guide covers the five main extension points in Kickstart. Each section walks through the interfaces, files to modify, and step-by-step instructions with real code examples from the codebase.

> **Audience:** Developers building on the Kickstart platform — adding new conversation phases, LLM tools, integration kits, API endpoints, or MCP tools.

---

## Table of Contents

- [A. Adding a New Conversation Phase](#a-adding-a-new-conversation-phase)
- [B. Adding a New LLM Tool](#b-adding-a-new-llm-tool)
- [C. Adding a New Integration Kit](#c-adding-a-new-integration-kit)
- [D. Adding a New API Endpoint](#d-adding-a-new-api-endpoint)
- [E. Adding MCP Tools](#e-adding-mcp-tools)

---

## A. Adding a New Conversation Phase

Kickstart's conversation flow is a finite state machine with six sequential phases: **Discover → Design → Generate → Review → Handoff → Deploy**. Each phase has entry/exit conditions, a prompt template injected into the LLM context, and a pointer to the next phase.

### Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/engine/types.ts` | `Phase` enum and `PhaseDefinition` interface |
| `packages/core/src/engine/phases.ts` | `PHASE_DEFINITIONS` array — all phase configurations |
| `packages/core/src/engine/machine.ts` | State machine: `transition()`, `createInitialState()`, `handleImplicitFlags()` |
| `packages/core/src/prompts/system-prompt.ts` | `buildSystemPrompt()` — composes the 3-layer prompt using phase definitions |

### How Phase Transitions Work

The conversation state machine is driven by `ConversationEvent` objects processed through a pure `transition()` function:

```typescript
// packages/core/src/engine/types.ts
export type ConversationEvent =
  | { type: "START" }
  | { type: "ADVANCE"; data?: Record<string, unknown> }
  | { type: "SKIP" }
  | { type: "RESET" }
  | { type: "USER_INPUT"; input: string }
  | { type: "PHASE_COMPLETE"; phase: Phase; data: Record<string, unknown> };
```

When `ADVANCE` fires, the state machine marks the current phase `"complete"`, moves `currentPhase` to `nextPhase`, and sets the new phase to `"active"`. The LLM can also trigger this implicitly by returning `"phaseComplete": true` in its JSON response envelope — the harness calls `handleImplicitFlags()` to auto-advance.

### Step-by-Step: Add a New Phase

**1. Add the phase to the `Phase` enum** in `packages/core/src/engine/types.ts`:

```typescript
export enum Phase {
  Discover = "discover",
  Design = "design",
  Generate = "generate",
  Review = "review",
  Handoff = "handoff",
  Deploy = "deploy",
  // ↓ Your new phase
  Monitor = "monitor",
}
```

**2. Add a `PhaseDefinition`** to the `PHASE_DEFINITIONS` array in `packages/core/src/engine/phases.ts`. Insert it at the position matching the conversation flow order, and update the `nextPhase` pointer of the preceding phase:

```typescript
// packages/core/src/engine/phases.ts
{
  id: Phase.Monitor,
  label: "Monitor",
  description: "Let's set up monitoring so you know when things go wrong.",
  entryConditions: ["deployment is initiated or skipped"],
  exitConditions: ["monitoring is configured"],
  promptTemplate: `App context:
{{appContext}}

Monitoring config:
{{monitoringConfig}}`,
  nextPhase: null,  // Terminal phase, or point to the next one
},
```

Update the previous terminal phase (`Deploy`) to chain into yours:

```typescript
// Change Deploy's nextPhase from null to Phase.Monitor
nextPhase: Phase.Monitor,
```

**3. Update `createInitialState()`** in `packages/core/src/engine/machine.ts`. No code change is needed — `createInitialState()` dynamically reads `getPhaseOrder()`, so your new phase is automatically initialized as `"pending"`.

**4. Add phase-specific prompt content.** The `buildSystemPrompt()` function in `packages/core/src/prompts/system-prompt.ts` uses `getPhaseDefinition(phase).promptTemplate` to inject phase context. You can also add phase-specific instructions via IntegrationKit `phasePrompts`:

```typescript
// In your kit definition
phasePrompts: {
  [Phase.Monitor]: [
    "When configuring monitoring, recommend Azure Monitor and Application Insights.",
  ],
},
```

**5. Update the frontend phase indicator.** The `ConversationPhase` A2UI component reads the phase list from the API. Both the web endpoint (`packages/web/api/src/functions/converse.ts`) and the MCP server (`packages/mcp-server/src/tools/kickstart.ts`) build this dynamically from `getPhaseOrder()`, so no changes are needed there — your new phase appears automatically.

### Key Concepts

- **Pure transitions:** `transition(state, event)` never mutates the input — it returns a new state object.
- **Implicit flags:** The LLM signals `phaseComplete: true` in its JSON response to auto-advance phases without user action.
- **Skip support:** Users can skip phases via the `SKIP` event — the phase is marked `"skipped"` and the machine moves to `nextPhase`.

---

## B. Adding a New LLM Tool

LLM tools are functions exposed to the model via OpenAI function calling. The LLM decides when to call them based on their `description` and `parameters` schema. Tools are registered in a `ToolRegistry` and auto-converted to OpenAI format for the chat completion API.

### Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/tools/types.ts` | `Tool` interface, `ToolContext`, `OpenAIToolDefinition` |
| `packages/core/src/tools/registry.ts` | `ToolRegistry` class and `defaultRegistry` singleton |
| `packages/core/src/tools/*.ts` | Built-in tool implementations |

### The Tool Interface

```typescript
// packages/core/src/tools/types.ts
export interface Tool<TArgs = Record<string, unknown>> {
  name: string;                    // Unique identifier (valid function name)
  description: string;             // LLM reads this to decide when to call
  parameters: {
    type: "object";
    properties: Record<string, unknown>;  // JSON Schema
    required?: string[];
  };
  requireApproval?: boolean;       // true = blocked from automatic execution
  execute(args: TArgs, context: ToolContext): Promise<unknown>;
}

export interface ToolContext {
  artifactStore: ArtifactStore;    // Session-scoped artifact storage
  fileSystem?: FileSystemProvider; // Optional filesystem (Cloud Shell, local)
}
```

### Step-by-Step: Add a New Tool

**1. Create the tool file** in `packages/core/src/tools/`. Here's a minimal example:

```typescript
// packages/core/src/tools/my-lookup.ts
import type { Tool, ToolContext } from "./types.js";

interface MyLookupArgs {
  query: string;
  limit?: number;
}

export const myLookup: Tool<MyLookupArgs> = {
  name: "my_lookup",
  description: "Search the internal knowledge base for deployment patterns matching the query.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query for pattern lookup.",
      },
      limit: {
        type: "number",
        description: "Max results to return. Defaults to 5.",
      },
    },
    required: ["query"],
  },
  // Set to true if this tool modifies state or accesses sensitive resources
  requireApproval: false,

  async execute(args: MyLookupArgs, _context: ToolContext): Promise<unknown> {
    const limit = args.limit ?? 5;
    // Your implementation here
    return {
      query: args.query,
      results: [],
      count: 0,
    };
  },
};
```

**2. Register the tool.** There are two approaches:

**Option A — Standalone registration** (if the tool doesn't belong to a kit):

```typescript
// packages/core/src/tools/index.ts
import { myLookup } from "./my-lookup.js";
import { defaultRegistry } from "./registry.js";

defaultRegistry.register(myLookup);
```

**Option B — Via an IntegrationKit** (preferred — tools are auto-registered):

```typescript
// In your kit definition
const myKit: IntegrationKit = {
  name: "my-kit",
  description: "Custom lookup integration",
  tools: [myLookup],  // Auto-registered when the kit is registered
  connectors: [],
};
```

**3. The tool is now available to the LLM.** The `ToolRegistry.toOpenAIFormat()` method converts all registered tools to OpenAI function definitions, and the converse endpoint passes them to the chat completion call.

### How Tool Execution Works

The execution loop (in `packages/web/api/src/functions/converse.ts`) works as follows:

1. The LLM returns `finish_reason: "tool_calls"` with one or more tool call requests
2. The harness looks up each tool in the `ToolRegistry`
3. Tools with `requireApproval: true` are blocked — the LLM gets an error message back
4. Auto-approved tools are executed with a session-scoped `ToolContext`
5. Results are appended as `role: "tool"` messages and sent back to the LLM
6. This loop repeats (up to 5 rounds) until the LLM returns a final text response

### Security Notes

- Set `requireApproval: true` for any tool that writes data, calls external APIs with side effects, or accesses sensitive resources.
- Tools receive a session-scoped `ToolContext` — use `context.artifactStore` for artifact isolation, never global state.
- The `fetch_webpage` tool (`packages/core/src/tools/fetch-webpage.ts`) is a good reference for SSRF protection, timeout handling, and input validation patterns.

---

## C. Adding a New Integration Kit

An IntegrationKit is a composable bundle that wires tools, API connectors, system prompts, skills, components, and auth requirements into Kickstart as a single unit. The Azure and GitHub kits are the two built-in examples.

### Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/kits/types.ts` | `IntegrationKit` interface, `KitAuthRequirement`, `ComponentRegistration` |
| `packages/core/src/kits/registry.ts` | `IntegrationKitRegistry` class, `registerKit()` convenience function |
| `packages/core/src/kits/azure-kit.ts` | Azure kit — tools, connectors, auth, skills, components |
| `packages/core/src/kits/github-kit.ts` | GitHub kit — tools, connectors, auth, phase prompts |

### The IntegrationKit Interface

```typescript
// packages/core/src/kits/types.ts
export interface IntegrationKit {
  name: string;                              // Unique identifier
  description: string;
  tools: Tool<any>[];                        // Auto-registered into ToolRegistry
  connectors: APIConnector[];                // Auto-registered into APIConnectorRegistry
  prompts?: string[];                        // System prompt augmentations (all phases)
  phasePrompts?: Partial<Record<Phase, string[]>>;  // Per-phase prompt augmentations
  components?: ComponentRegistration[];      // A2UI component type registrations
  skills?: Skill[];                          // Domain knowledge (keyword-activated, per-phase)
  auth?: KitAuthRequirement[];               // Declarative auth requirements
  dependencies?: string[];                   // Kits that must be registered first
  onActivate?: () => Promise<void>;          // Called after registration
  onDeactivate?: () => Promise<void>;        // Called before removal
}
```

### The Registration Lifecycle

When you call `registerKit(myKit)`, the `IntegrationKitRegistry` performs these steps transactionally:

1. **Auth validation** — checks that `provider` is non-empty and `scopes` is a non-empty string array
2. **Dependency validation** — ensures all declared `dependencies` are already registered
3. **Cycle detection** — DFS walk to prevent circular dependency chains
4. **Collision detection** — rejects if any tool or connector name conflicts with another kit
5. **Tool/connector auto-wiring** — registers all tools into `ToolRegistry` and all connectors into `APIConnectorRegistry`
6. **`onActivate()` lifecycle hook** — if this throws, all changes are rolled back (tools removed, connectors removed, kit removed)

### Step-by-Step: Add a New Kit

**1. Create your tools** (see [Adding a New LLM Tool](#b-adding-a-new-llm-tool)):

```typescript
// packages/core/src/tools/my-service-query.ts
import type { Tool, ToolContext } from "./types.js";

export const myServiceQuery: Tool<{ resourceId: string }> = {
  name: "my_service_query",
  description: "Query the status of a My Service resource.",
  parameters: {
    type: "object",
    properties: {
      resourceId: { type: "string", description: "Resource identifier." },
    },
    required: ["resourceId"],
  },
  async execute(args, _ctx) {
    return { resourceId: args.resourceId, status: "running" };
  },
};
```

**2. Create your connector** (if you need authenticated API access):

```typescript
// packages/core/src/connectors/MyServiceConnector.ts
import type { APIConnector } from "./types.js";

export const MyServiceConnector: APIConnector = {
  name: "MyServiceConnector",
  baseUrl: "https://api.myservice.com/v1",
  authenticate: async (request) => {
    // Add auth headers to outgoing requests
    request.headers.set("Authorization", `Bearer ${getToken()}`);
    return request;
  },
};
```

**3. Define the kit** in `packages/core/src/kits/`:

```typescript
// packages/core/src/kits/my-service-kit.ts
import type { IntegrationKit } from "./types.js";
import { Phase } from "../engine/types.js";
import { myServiceQuery } from "../tools/my-service-query.js";
import { MyServiceConnector } from "../connectors/MyServiceConnector.js";

export const myServiceKit: IntegrationKit = {
  name: "my-service",
  description: "Integrates My Service for resource management",

  tools: [myServiceQuery],
  connectors: [MyServiceConnector],

  // Auth requirements (web layer wires providers)
  auth: [
    {
      provider: "my-service-oauth",
      scopes: ["read", "write"],
      optional: false,
    },
  ],

  // Phase-specific prompts injected into the system prompt
  phasePrompts: {
    [Phase.Design]: [
      "When the user mentions My Service, suggest integration patterns.",
    ],
    [Phase.Generate]: [
      "Generate My Service configuration files alongside Kubernetes manifests.",
    ],
  },

  // Domain knowledge skills (keyword-activated)
  skills: [
    {
      id: "my-service-best-practices",
      name: "My Service Best Practices",
      phases: [Phase.Design, Phase.Generate],
      keywords: ["my-service", "myservice", "integration"],
      priority: 5,
      content: "## My Service Guidelines\n\nAlways use managed identity...",
    },
  ],

  // A2UI component registrations (frontend binds React components)
  components: [
    {
      type: "myServicePicker",
      description: "Resource picker for My Service instances",
      promptMeta: {
        category: "interactive",
        example: '{ "type": "myServicePicker", "id": "ms-picker-1" }',
        notes: "Requires My Service authentication.",
      },
    },
  ],

  // Register after azure kit (if it depends on it)
  dependencies: ["azure"],

  async onActivate() {
    // Setup logic — runs after registration
    console.log("My Service kit activated");
  },

  async onDeactivate() {
    // Cleanup logic — runs before removal
    console.log("My Service kit deactivated");
  },
};
```

**4. Register the kit** at app startup:

```typescript
import { registerKit } from "@kickstart/core";
import { myServiceKit } from "@kickstart/core/kits/my-service-kit";

await registerKit(myServiceKit);
```

### Skills vs. Prompts

IntegrationKits offer three levels of prompt injection:

| Mechanism | Scope | Activation |
|-----------|-------|------------|
| `prompts` | All phases | Always injected |
| `phasePrompts` | Specific phases | Injected when the conversation is in that phase |
| `skills` | Specific phases + keywords | Injected when the phase matches AND conversation context contains trigger keywords |

Skills provide the most targeted injection. They are defined with the `Skill` interface:

```typescript
// packages/core/src/engine/types.ts
export interface Skill {
  id: string;          // e.g., "iac-bicep-modules"
  name: string;        // Human-readable
  phases: Phase[];     // When this skill is relevant
  keywords: string[];  // Trigger words
  content: string;     // Prompt content to inject
  priority?: number;   // Higher = injected first (default: 0)
}
```

### Trust Model

Kits are **trusted first-party code**. No sandboxing is applied — lifecycle hooks and tool functions run with full process privileges. If you need third-party kits in the future, implement capability restrictions and sandboxing before allowing untrusted code to register.

---

## D. Adding a New API Endpoint

The Kickstart web API runs on Azure Functions (Node.js). Each endpoint is a separate file in `packages/web/api/src/functions/` using the Azure Functions v4 programming model.

### Key Files

| File | Purpose |
|------|---------|
| `packages/web/api/src/functions/converse.ts` | Main LLM proxy — SSE streaming, tool execution, session management |
| `packages/web/api/src/functions/action.ts` | Button click / form submission handler |
| `packages/web/api/src/functions/generate.ts` | Code generation (Codex) endpoint |
| `packages/web/api/src/functions/health.ts` | Health check |
| `packages/web/api/src/lib/session-store.ts` | In-memory session store |
| `packages/web/api/src/lib/rate-limiter.ts` | Per-IP rate limiting |
| `packages/web/api/src/lib/error-response.ts` | Safe error response utilities |

### Step-by-Step: Add a New Endpoint

**1. Create the function file** in `packages/web/api/src/functions/`:

```typescript
// packages/web/api/src/functions/my-endpoint.ts
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";

interface MyRequest {
  sessionId: string;
  data: string;
}

app.http("my-endpoint", {
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
      const body = (await request.json()) as MyRequest;

      if (!body.sessionId?.trim()) {
        return { status: 400, jsonBody: { error: "sessionId is required" } };
      }

      // Your logic here
      return {
        status: 200,
        jsonBody: { success: true, sessionId: body.sessionId },
      };
    } catch (err) {
      return safeErrorResponse(err, context, "my-endpoint error");
    }
  },
});
```

**2. The endpoint is auto-discovered.** Azure Functions v4 uses `app.http()` registration — no additional routing config is needed. The function is available at `/api/my-endpoint`.

### SSE Streaming Pattern

For endpoints that need to stream responses (like `/api/converse`), return a `ReadableStream` with SSE-formatted events:

```typescript
const encoder = new TextEncoder();

const stream = new ReadableStream({
  async start(controller) {
    try {
      // Emit typed events
      controller.enqueue(
        encoder.encode(`event: chunk\ndata: ${JSON.stringify({ content: "..." })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`)
      );
      controller.close();
    } catch (err) {
      controller.enqueue(
        encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "..." })}\n\n`)
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
```

The converse endpoint uses these SSE event types:

| Event | Purpose |
|-------|---------|
| `chunk` | Streamed text content fragment |
| `message` | Final parsed message content |
| `a2ui` | A2UI component JSON |
| `tool_call` | LLM requested a tool execution |
| `tool_result` | Tool execution result |
| `done` | Stream complete — includes session metadata |
| `error` | Error occurred during streaming |

### Session Management

Sessions are stored in an in-memory `Map` in `packages/web/api/src/lib/session-store.ts`. Key functions:

- `createSession()` — creates a new session with a UUID
- `getSession(id)` — retrieves an existing session
- `hydrateSession(messages, artifacts?)` — recreates a session from client-provided history (cold-start recovery)
- `addMessage(sessionId, role, content)` — appends to conversation history

### Error Handling

Always use `safeErrorResponse()` from `packages/web/api/src/lib/error-response.ts`. It returns a generic error message to the client while logging full details server-side — preventing information leakage.

---

## E. Adding MCP Tools

The MCP server (`packages/mcp-server`) exposes Kickstart as an IDE integration for VS Code Copilot and Claude Code. Tools are registered using the `@modelcontextprotocol/sdk` and use Zod schemas for parameter validation.

### Key Files

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/index.ts` | Server setup, tool registration, resource serving |
| `packages/mcp-server/src/tools/kickstart.ts` | `kickstart` tool handler — starts a conversation |
| `packages/mcp-server/src/tools/converse.ts` | `converse` tool handler — multi-turn conversation |
| `packages/mcp-server/src/tools/action.ts` | `action` tool handler — UI actions |
| `packages/mcp-server/src/a2ui.ts` | A2UI capability negotiation, resource creation |
| `packages/mcp-server/src/app/protocol.ts` | PostMessage relay protocol for MCP App iframe |

### How MCP Tool Registration Works

Tools are registered on the `McpServer` instance using `server.tool()` with Zod schemas:

```typescript
// packages/mcp-server/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "kickstart", version: "0.1.0" });

server.tool(
  "tool-name",                          // Tool name
  "Description for the LLM",           // Description
  {                                     // Zod parameter schema
    sessionId: z.string().describe("Active session ID"),
    message: z.string().describe("User message"),
  },
  async (params) => {                   // Handler
    // params is typed from the Zod schema
    return {
      content: [{ type: "text", text: "Response text" }],
    };
  },
);
```

### Step-by-Step: Add a New MCP Tool

**1. Create the handler** in `packages/mcp-server/src/tools/`:

```typescript
// packages/mcp-server/src/tools/my-tool.ts
import type { SessionState } from "@kickstart/core";

type ContentItem =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export async function handleMyTool(
  sessions: Map<string, SessionState>,
  sessionId: string,
): Promise<{ content: ContentItem[] }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      content: [{ type: "text", text: `Session not found: ${sessionId}` }],
    };
  }

  // Your logic here
  return {
    content: [{ type: "text", text: "Tool executed successfully." }],
  };
}
```

**2. Register the tool** in `packages/mcp-server/src/index.ts`:

```typescript
import { handleMyTool } from "./tools/my-tool.js";

server.tool(
  "my-tool",
  "Does something useful with the current session.",
  {
    sessionId: z.string().describe("Active session ID"),
  },
  async (params) => handleMyTool(sessions, params.sessionId),
);
```

**3. Done.** The MCP SDK handles serialization, transport (stdio), and error handling.

### A2UI Capability Negotiation

MCP clients may or may not support A2UI rendering. The server negotiates capability during the MCP `initialize` handshake:

```typescript
// packages/mcp-server/src/a2ui.ts
export type A2UICapability = "kickstart" | "basic" | "none";

export function resolveA2UICapability(
  clientCatalogs: readonly string[] | undefined,
): A2UICapability {
  if (!clientCatalogs || clientCatalogs.length === 0) return "none";
  if (clientCatalogs.includes(KICKSTART_CATALOG_ID)) return "kickstart";
  if (clientCatalogs.length > 0) return "basic";
  return "none";
}
```

When returning A2UI content from a tool handler, use `createA2UIResource()` to wrap components as MCP embedded resources:

```typescript
import { createA2UIResource } from "../a2ui.js";

const a2uiResource = createA2UIResource(
  myComponent,                                    // A2UI component tree
  `a2ui://kickstart/session/${sessionId}/my-view`, // Resource URI
  capability,                                      // Client capability tier
);

const content: ContentItem[] = [{ type: "text", text: "Here's the result." }];
if (a2uiResource) content.push(a2uiResource);
return { content };
```

The three capability tiers determine how components are rendered:

| Tier | Behavior |
|------|----------|
| `"kickstart"` | Full custom component rendering |
| `"basic"` | Components degraded to generic Card + Text (JSON shown as code) |
| `"none"` | No A2UI — text-only responses |

### PostMessage Protocol (MCP App)

The MCP server also serves an HTML app as an embedded resource (`kickstart://app/main`) for IDE-native UX. Communication between the app iframe and server uses the `app-message` tool and a typed PostMessage protocol:

```typescript
// packages/mcp-server/src/app/protocol.ts
type AppToServerMessage =
  | { type: "kickstart" }
  | { type: "converse"; sessionId: string; message: string }
  | { type: "action"; sessionId: string; actionType: string; payload: Record<string, unknown> };

type ServerToAppMessage =
  | { type: "response"; sessionId: string; phase: string; a2ui?: unknown; text?: string }
  | { type: "error"; message: string };
```

### Session Management

The MCP server maintains its own in-memory session store (`Map<string, SessionState>`) with a 1-hour TTL and cleanup every 10 minutes. Sessions are independent from the web API sessions — each surface manages its own state, but both share `@kickstart/core` for the conversation engine.

---

## Architecture Reference

For a deeper understanding of the systems described here, see:

- **[Architecture](./architecture.md)** — System overview, conversation phases, IntegrationKit pattern, tool system
- **[API Reference](./api-reference.md)** — REST API endpoint schemas and streaming details
- **[A2UI Catalog](./a2ui-catalog.md)** — Component library and fat component pattern
- **[MCP Server](./mcp-server.md)** — IDE integration architecture
- **[Prompt Architecture](./prompt-architecture.md)** — 3-layer system prompt, skill resolver
