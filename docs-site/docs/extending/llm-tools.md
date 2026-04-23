---
sidebar_position: 3
---

# LLM Tools

LLM tools are functions you expose to the AI via [OpenAI function calling](https://platform.openai.com/docs/guides/function-calling). When the LLM decides it needs more information or needs to take an action, it emits a structured tool call — Kickstart executes the function and feeds the result back into the conversation.

This guide covers the tool interface, the registry, and how to add a new tool.

## How Tools Work

### Tool Interface

Every tool implements the `Tool<TArgs>` interface defined in `packages/pack-core/src/tools/types.ts`:

```typescript
export interface Tool<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  requireApproval?: boolean;
  execute(args: TArgs, context: ToolContext): Promise<unknown>;
}

export interface ToolContext {
  artifactStore: ArtifactStore;
  fileSystem?: FileSystemProvider;
}
```

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Unique tool identifier — used as the function name in OpenAI calls |
| `description` | `string` | Sent to the LLM to explain what the tool does and when to use it |
| `parameters` | JSON Schema object | Describes the tool's arguments in OpenAI function-calling format |
| `requireApproval` | `boolean?` | If `true`, the user must confirm before the tool executes |
| `execute` | `function` | The implementation — receives typed args and a `ToolContext` |

The `ToolContext` gives your tool access to:

- **`artifactStore`** — read and write generated artifacts (Dockerfiles, manifests, etc.)
- **`fileSystem`** — optional filesystem provider (available in MCP context, not in web API)

### Tool Registry

`packages/pack-core/src/tools/registry.ts` exports a `ToolRegistry` class and a `defaultRegistry` singleton:

```typescript
const registry = new ToolRegistry();
registry.register(myTool);
registry.registerAll([tool1, tool2, tool3]);

// Convert to OpenAI function-calling format
const toolDefs = registry.toOpenAIFormat();

// Execute a tool by name
const result = await registry.execute("my_tool", args, context);
```

Tools registered on `defaultRegistry` are automatically available in the LLM conversation.

### Wiring to the LLM

In `packages/web/api/src/functions/converse.ts`:

1. `defaultRegistry.toOpenAIFormat()` produces the tool definitions array
2. The definitions are passed into the Azure OpenAI chat completion call
3. When the LLM returns a tool call, `registry.execute(name, args, context)` is called
4. The result is fed back to the LLM as a tool message
5. This loops up to `maxToolRounds = 5` times per user turn

Tool call events are streamed to the client as SSE events of type `tool_call` and `tool_result`.

### Built-in Tools

| Tool Name | Description |
|---|---|
| `github_repo_info` | Get metadata about a GitHub repository |
| `github_repo_tree` | List files and directories in a repo |
| `github_repo_file_read` | Read a specific file from a GitHub repo |
| `github_api_get` | Make an authenticated GitHub API GET request |
| `azure_resource_list` | List Azure resources in a subscription |
| `azure_resource_get` | Get details on a specific Azure resource |
| `estimate_cost` | Estimate monthly cost for a set of Azure services |
| `fetch_webpage` | Fetch and extract content from a URL |
| `generate_kubernetes_manifest` | Generate a Kubernetes manifest from a spec |
| `list_artifacts` | List artifacts currently in the artifact store |
| `get_artifact` | Read the content of a specific artifact |

---

## How to Add a Tool

### Step 1 — Create the tool file

Create a new file in `packages/pack-core/src/tools/`. Name it after your tool using kebab-case:

```
packages/pack-core/src/tools/my-tool.ts
```

Implement the `Tool<TArgs>` interface:

```typescript
import type { Tool, ToolContext } from "./types.js";

interface MyToolArgs {
  query: string;
  maxResults?: number;
}

export const myTool: Tool<MyToolArgs> = {
  name: "my_tool",
  description:
    "Searches for relevant documentation entries matching the query. " +
    "Use this when the user asks about a specific technology or framework.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
      },
    },
    required: ["query"],
  },
  requireApproval: false,

  async execute(args: MyToolArgs, context: ToolContext): Promise<unknown> {
    const { query, maxResults = 5 } = args;

    // Your implementation here
    const results = await fetchDocumentation(query, maxResults);

    return {
      results,
      count: results.length,
    };
  },
};
```

:::tip Write good descriptions
The LLM decides when to call your tool based entirely on the `description`. Be explicit about what the tool does, what it returns, and — crucially — **when** to use it. "Use this when..." phrasing is highly effective.
:::

### Step 2 — Add SSRF and input validation

If your tool makes outbound HTTP requests, validate inputs to prevent SSRF attacks. See `packages/pack-core/src/tools/fetch-webpage.ts` for the reference implementation — it validates the URL scheme, blocks private IP ranges, and restricts to HTTP/HTTPS:

```typescript
async execute(args, context) {
  const url = new URL(args.url); // throws on malformed URL
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }
  // ...
}
```

### Step 3 — Register the tool

Open `packages/pack-core/src/tools/index.ts` and add your tool to the registration block:

```typescript
import { myTool } from "./my-tool.js";

// Register all tools on the default registry
defaultRegistry.registerAll([
  // ... existing tools ...
  myTool,
]);
```

Alternatively, if your tool belongs to an integration, add it to your pack's tool contributions instead. See [Packs](./integration-kits.md) for details.

### Step 4 — Write tests

Add unit tests for your tool implementation. Test both the happy path and error conditions:

```typescript
import { myTool } from "../tools/my-tool.js";
import type { ToolContext } from "../tools/types.js";

const mockContext: ToolContext = {
  artifactStore: { /* mock */ } as any,
};

describe("myTool", () => {
  it("returns results for a valid query", async () => {
    const result = await myTool.execute({ query: "nginx" }, mockContext);
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("count");
  });

  it("respects maxResults", async () => {
    const result = await myTool.execute(
      { query: "nginx", maxResults: 2 },
      mockContext
    ) as any;
    expect(result.results.length).toBeLessThanOrEqual(2);
  });
});
```

### Step 5 — Build and verify

```bash
npm run build -w @kickstart/core
```

Start the dev server and open a conversation. Ask the AI to do something that should trigger your tool. Watch the SSE stream in browser DevTools (Network → `converse` → EventStream) to see `tool_call` and `tool_result` events.

---

## Key Files

| File | Purpose |
|---|---|
| `packages/pack-core/src/tools/types.ts` | `Tool<TArgs>` and `ToolContext` interfaces |
| `packages/pack-core/src/tools/registry.ts` | `ToolRegistry` class and `defaultRegistry` singleton |
| `packages/pack-core/src/tools/index.ts` | Tool registration entry point |
| `packages/pack-core/src/tools/fetch-webpage.ts` | Reference implementation with SSRF protection |
| `packages/web/api/src/functions/converse.ts` | LLM wiring: `toOpenAIFormat()`, `execute()`, multi-round loop |
