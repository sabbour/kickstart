---
sidebar_position: 6
---

# MCP Tools

Kickstart ships an **MCP server** (`packages/mcp-server/`) that integrates with IDE-based AI assistants — VS Code Copilot, Claude Code, and any other client that speaks the [Model Context Protocol](https://modelcontextprotocol.io). The server exposes Kickstart's conversation engine, manifest generation, and A2UI responses as MCP tools over stdio transport.

This guide covers the MCP server architecture, tool registration pattern, A2UI capability negotiation, and how to add a new tool.

## How MCP Tools Work

### Server Setup

The entry point is `packages/mcp-server/src/index.ts`. It creates an `McpServer` instance, registers tools and resources, and connects via `StdioServerTransport`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "kickstart",
  version: "0.1.0",
});

// Register tools here...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Registration Pattern

Tools are registered using `server.tool()` with [Zod](https://zod.dev) schemas for parameter validation:

```typescript
import { z } from "zod";

server.tool(
  "tool-name",
  "Human-readable description for the LLM",
  {
    paramName: z.string().describe("Parameter description"),
    optionalParam: z.number().optional().describe("Optional parameter"),
  },
  async (params) => handleToolName(sessions, params.paramName),
);
```

| Argument | Description |
|---|---|
| Name (`string`) | Unique tool identifier — this is what the IDE's LLM calls |
| Description (`string`) | Sent to the LLM to explain when to use the tool |
| Schema (`object`) | Zod schema — auto-validated before the handler runs |
| Handler (`function`) | Async function receiving validated params, returns `{ content: ContentItem[] }` |

### Existing Tools

| Tool | Description |
|---|---|
| `kickstart` | Start a new Kickstart conversation. Returns an A2UI phase indicator and welcome text. |
| `converse` | Continue a multi-turn conversation. Processes user message through the phase machine. |
| `generate-manifests` | Generate Kubernetes manifests and GitHub Actions workflows from conversation state. |
| `check-status` | Check deployment status for an active session. |
| `action` | Handle a user action from the A2UI interface (button click, form submission). |
| `app-message` | Relay a message from the MCP App HTML surface through the appropriate handler. |

Additionally, a **resource** is registered:

| Resource | URI | Description |
|---|---|---|
| `kickstart-app` | `kickstart://app/main` | HTML surface for IDE-native conversation UI (MCP App) |

### Handler Pattern

Tool handlers live in `packages/mcp-server/src/tools/` and follow a consistent pattern:

```typescript
type ContentItem =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export async function handleMyTool(
  sessions: Map<string, SessionState>,
  param: string,
  capability: A2UICapability = "kickstart",
): Promise<{ content: ContentItem[] }> {
  // 1. Validate session (if session-scoped)
  const session = sessions.get(param);
  if (!session) {
    return {
      content: [{ type: "text", text: "❌ Session not found." }],
    };
  }

  // 2. Perform logic using @aks-kickstart/harness
  const result = await doSomething(session);

  // 3. Build A2UI component (optional)
  const component = { type: "Card", id: "my-card", title: "Result", children: [] };

  // 4. Wrap with createA2UIResource() for capability degradation
  const a2uiResource = createA2UIResource(
    component,
    `a2ui://kickstart/session/${session.sessionId}/my-tool`,
    capability,
  );

  // 5. Return content items
  const content: ContentItem[] = [{ type: "text", text: result.summary }];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
```

### A2UI Capability Tiers

Not all MCP clients support A2UI. The server negotiates capabilities during the `initialize` handshake and degrades gracefully:

| Tier | Condition | Behavior |
|---|---|---|
| `kickstart` | Client advertises the Kickstart catalog ID | Full custom A2UI components |
| `basic` | Client advertises any A2UI catalog | Components degraded to Card + Text |
| `none` | No A2UI support | Text-only responses (A2UI resources omitted) |

Capability resolution is handled by `resolveA2UICapability()` in `packages/mcp-server/src/a2ui.ts`:

```typescript
export function resolveA2UICapability(
  clientCatalogs: readonly string[] | undefined,
): A2UICapability {
  if (!clientCatalogs || clientCatalogs.length === 0) return "none";
  if (clientCatalogs.includes(KICKSTART_CATALOG_ID)) return "kickstart";
  if (clientCatalogs.length > 0) return "basic";
  return "none";
}
```

Always wrap A2UI components with `createA2UIResource()` — it handles degradation automatically and returns `null` when the client has no A2UI support:

```typescript
const resource = createA2UIResource(component, uri, capability);
if (resource) content.push(resource);  // Only added when client supports A2UI
```

### Session Management

The MCP server uses an in-memory `Map<string, SessionState>` for session storage:

- **TTL:** 1 hour per session
- **Cleanup:** Stale sessions are purged every 10 minutes
- **Engine state:** Stored separately in a module-level `Map` in `packages/mcp-server/src/tools/kickstart.ts`

Sessions are created by the `kickstart` tool and referenced by `sessionId` in all subsequent tool calls.

---

## How to Add an MCP Tool

### Step 1 — Create the handler file

Create a new file in `packages/mcp-server/src/tools/`:

```
packages/mcp-server/src/tools/my-tool.ts
```

Implement the handler following the standard pattern:

```typescript
import type { SessionState } from "@aks-kickstart/harness";
import { createA2UIResource } from "../a2ui.js";
import type { A2UICapability } from "../a2ui.js";

type ContentItem =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export async function handleMyTool(
  sessions: Map<string, SessionState>,
  sessionId: string,
  capability: A2UICapability = "kickstart",
): Promise<{ content: ContentItem[] }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      content: [{
        type: "text",
        text: `❌ Session \`${sessionId}\` not found. Start a new conversation with the \`kickstart\` tool.`,
      }],
    };
  }

  // Your logic here — use @aks-kickstart/harness APIs
  const summary = `Processed session ${sessionId}`;

  return {
    content: [{ type: "text", text: summary }],
  };
}
```

### Step 2 — Register in index.ts

Open `packages/mcp-server/src/index.ts` and add the import and tool registration:

```typescript
import { handleMyTool } from "./tools/my-tool.js";

// ... after existing tool registrations ...

server.tool(
  "my-tool",
  "Description of what this tool does — the IDE LLM uses this to decide when to call it.",
  {
    sessionId: z.string().describe("Active session ID from a kickstart conversation"),
  },
  async (params) => handleMyTool(sessions, params.sessionId, clientCapability),
);
```

:::tip Write clear descriptions
The IDE's LLM reads the tool description to decide when to call it. Be specific about what the tool does, what input it needs, and what it returns. If your tool requires a session, say so.
:::

### Step 3 — Add A2UI responses (optional)

If your tool should return structured UI, build A2UI components and wrap them with `createA2UIResource()`:

```typescript
import type { CardComponent, TextComponent } from "@aks-kickstart/harness";

const text: TextComponent = {
  type: "Text",
  id: "my-result-text",
  content: "Here are the results...",
};

const card: CardComponent = {
  type: "Card",
  id: "my-result-card",
  title: "My Tool Results",
  children: [text],
};

const resource = createA2UIResource(
  card,
  `a2ui://kickstart/session/${sessionId}/my-tool`,
  capability,
);

const content: ContentItem[] = [{ type: "text", text: summary }];
if (resource) content.push(resource);
```

### Step 4 — Write tests

Add tests in `packages/mcp-server/src/__tests__/`:

```typescript
import { handleMyTool } from "../tools/my-tool.js";
import type { SessionState } from "@aks-kickstart/harness";
import { InMemoryArtifactStore } from "@aks-kickstart/harness";

describe("handleMyTool", () => {
  const sessions = new Map<string, SessionState>();

  beforeEach(() => {
    sessions.set("test-session", {
      sessionId: "test-session",
      currentPhase: "discover",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      appDefinition: {},
      messages: [],
      artifactStore: new InMemoryArtifactStore(),
    });
  });

  it("returns results for a valid session", async () => {
    const result = await handleMyTool(sessions, "test-session", "none");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("returns error for unknown session", async () => {
    const result = await handleMyTool(sessions, "nonexistent", "none");
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("not found"),
    });
  });
});
```

### Step 5 — Build and test locally

```bash
npm run build -w @aks-kickstart/mcp-server
npm run test -w @aks-kickstart/mcp-server
```

### Step 6 — Configure IDE clients

To test with an IDE client, add the MCP server to the client's configuration.

**VS Code Copilot** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "kickstart": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  }
}
```

**Claude Code** (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "kickstart": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  }
}
```

After configuring, restart the IDE extension and verify your tool appears in the tool list.

---

## Key Files

| File | Purpose |
|---|---|
| `packages/mcp-server/src/index.ts` | Server entry point — tool and resource registration |
| `packages/mcp-server/src/a2ui.ts` | `createA2UIResource()`, capability resolution, degradation helpers |
| `packages/mcp-server/src/tools/kickstart.ts` | `handleKickstart()` — session creation and engine state management |
| `packages/mcp-server/src/tools/converse.ts` | `handleConverse()` — multi-turn conversation processing |
| `packages/mcp-server/src/tools/generate-manifests.ts` | `handleGenerateManifests()` — manifest generation with safeguard validation |
| `packages/mcp-server/src/tools/check-status.ts` | `handleCheckStatus()` — deployment status check |
| `packages/mcp-server/src/tools/action.ts` | `handleAction()` — A2UI action event processing |
| `packages/mcp-server/src/app/protocol.ts` | MCP App postMessage protocol parsing |
| `packages/mcp-server/package.json` | Package config — binary entry point at `kickstart-mcp` |
