---
sidebar_position: 5
---

# Tool Usage Framework

This document describes how Kickstart agents discover, select, and invoke tools at runtime. It covers the registration model, the two tool categories (model-invocable vs user actions), per-agent security controls, and the cross-agent `asTool` pattern.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **ToolContribution** | A named wrapper around an `@openai/agents` `Tool` instance registered on a pack manifest |
| **UserActionContribution** | LLM-invoked, user-executed actions. The LLM requests the action via a tool call; the runner pauses and emits a `user_action_req` event; the browser completes the action; the runner resumes with the typed result. |
| **Server Manifest** | A JSX-free pack export (`server-manifest.ts`) that declares tools, user actions, components, and guardrails |
| **`asTool`** | A harness utility that wraps an entire Agent as a callable tool for cross-agent consultation |

## Tool Registration via Server Manifests

Every pack exposes a **server manifest** — a plain TypeScript module with no React/JSX dependencies — that lists the pack's contributions:

```typescript
// Simplified — imports and type definitions omitted for brevity
// packages/pack-aks-automatic/src/server-manifest.ts
import { validateManifestsTool } from './tools/validate-manifests.js';
import { aksDeployUserAction } from './user-actions/deploy.js';

export const aksAutomaticPackServer: Pack = {
  name: 'aks',
  tools: [validateManifestsTool, validateSafeguardsTool],
  userActions: [aksDeployUserAction],
  components: serverComponents,
  guardrails: [noPrivilegedContainersGuardrail],
};
```

The harness collects all registered packs at startup and merges their `tools` arrays into a unified registry that the LLM can call.

### ToolContribution Interface

```typescript
export interface ToolContribution {
  name: string;
  tool: SDKTool;            // @openai/agents Tool instance
  mcpExposed?: boolean;     // Expose in MCP tool manifest (opt-in)
  requiresSession?: boolean; // Exclude from MCP manifest entirely
}
```

- **`mcpExposed`** — when `true`, the tool appears in the MCP server's tool list for external clients.
- **`requiresSession`** — marks tools that need an active user session context (e.g., `core.emit_ui`).

## Model-Invocable Tools vs User Actions

Kickstart distinguishes two categories:

### Model-Invocable Tools

These are functions the LLM autonomously decides to call during a conversation turn. Examples:

| Tool | Pack | Purpose |
|------|------|---------|
| `core.emit_ui` | core | Render UI components to the client surface |
| `core.read_file` | core | Read a workspace file (with confinement) |
| `aks.validate_manifests` | aks-automatic | Lint Kubernetes manifests against safeguards |
| `aks.build_architecture_diagram` | aks-automatic | Generate an architecture visualization |

The LLM receives tool definitions in OpenAI function-calling format and emits structured `tool_call` messages when it determines a tool is needed.

### User Actions

User actions are LLM-requested but user-executed. The LLM invokes a user-action tool; the runner emits a `user_action_req` SSE event, pauses the run, and resumes after the browser completes the action and returns a typed result.

```typescript
// Subset of fields shown — full type also includes confirmComponent and cancellation
export interface UserActionContribution {
  name: string;
  wireName: string;
  description: string;
  parameters: z.ZodTypeAny;
  resultSchema: z.ZodTypeAny;
  scopes?: string[];
  mcpExposed?: boolean;
}
```

User actions can define a `confirmComponent` that renders a confirmation dialog before execution, and declare `scopes` to restrict which agents may trigger them.

## `core.emit_ui` — UI Rendering

The `core.emit_ui` tool allows an agent to push rich UI components to the client. It accepts an A2UI message payload describing which components to render and their property bindings.

```typescript
// core.emit_ui accepts an A2UI v0.9 envelope:
core.emit_ui({
  message: {
    version: "v0.9",
    op: "createSurface",
    surfaceId: "deployment-summary",
    components: [
      { id: "root", type: "Card", props: { title: "Deployment Summary" }, children: ["status"] },
      { id: "status", type: "Text", props: { text: "Deploying..." } }
    ]
  }
})
```

> **Note:** `core.emit_ui` is deprecated in favor of focused tools (`core.show_card`, `core.show_form`, `core.confirm`, `core.navigate`) — see issue #112 for migration details.

## `core.read_file` — Workspace File Access

`core.read_file` provides confined filesystem access with two layers of defence:

1. **Workspace-root confinement** — resolved paths must remain within the workspace directory (symlink-aware).
2. **Per-agent filename allowlists** — certain agents (e.g., `core.triage`) are restricted to a hard-coded set of filenames regardless of workspace boundaries.

```typescript
// Actual export (Map<agentName, Set<relativePath>>):
export const READ_FILE_AGENT_ALLOWLIST = new Map([
  ["core.triage", new Set([".kickstart/state.json", "plan.md", "safeguards-report.md"])],
  // ... other agents
]);
```

This defence-in-depth approach ensures that even a misconfigured prompt cannot silently broaden file access for sensitive agents.

## Cross-Agent Tool Invocation (`asTool`)

The `asTool()` harness utility wraps any `Agent` instance as a callable `ToolContribution`, enabling bounded specialist consultation without spawning a full conversation:

```typescript
import { asTool } from '@aks-kickstart/harness';
import { securityAgent } from './agents/security';

const consultSecurity = asTool(securityAgent, {
  toolName: 'consult_security',
  description: 'Ask the security specialist a focused question.',
  maxTurns: 5,
});
```

The parent agent calls `consult_security` like any other tool — the harness runs the specialist for up to `maxTurns` turns and returns the final answer as the tool result.

### When to Use `asTool`

- A parent agent needs expert consultation on a sub-problem (security review, code analysis).
- The specialist's response should be bounded and stateless — no long-running dialogue.
- You want tool-call observability (the consultation appears as a single tool call in traces).

### Constraints

- The specialist agent runs in an isolated context with its own tool access.
- `maxTurns` defaults to 5 (exported as `AS_TOOL_MAX_TURNS_DEFAULT`).
- The specialist cannot access the parent's conversation history.

## Tool Selection at Runtime

When the LLM receives a user message, the runtime:

1. **Collects tools** — merges all `ToolContribution` entries from loaded packs.
2. **Filters by agent scope** — each agent declares which tools it can access; unlisted tools are excluded.
3. **Formats for the LLM** — converts tools to OpenAI function-calling JSON schema format.
4. **Executes calls** — when the LLM emits a `tool_call`, the runtime dispatches to the matching tool's `execute` function.
5. **Loops** — tool results are fed back as tool messages; the loop continues up to `maxTurns` (OpenAI Agents SDK loop cap used by `sdkRunner.run(...)`) per turn.

## Adding a New Tool

1. Create a tool file in your pack's `src/tools/` directory using `@openai/agents`'s `tool()` helper:

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

export const myTool: ToolContribution = {
  name: 'mypck.my_tool',
  tool: tool({
    name: 'mypck.my_tool',
    description: 'Does something useful.',
    parameters: z.object({ input: z.string() }),
    execute: async (args) => { /* ... */ },
  }),
};
```

2. Add the tool to your pack's `server-manifest.ts`:

```typescript
export const myPackServer: Pack = {
  tools: [myTool, ...otherTools],
};
```

3. The tool is now available to any agent whose scope includes it.

## Related Documentation

- [LLM Tools](../extending/llm-tools.md) — detailed tool interface and registry API
- [Agent as Tool](../extending/agent-as-tool.md) — full `asTool()` API reference
- [MCP Tools](../extending/mcp-tools.md) — exposing tools over MCP
