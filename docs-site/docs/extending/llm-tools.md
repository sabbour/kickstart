---
sidebar_position: 3
---

# LLM Tools

LLM tools are functions you expose to the model via OpenAI function calling. The model emits a structured tool call, the harness runs your function, and the result feeds back into the conversation as a `tool` turn. Tool definitions live inside packs.

---

## Contribution shape

`ToolContribution` (`packages/harness/src/types/tool.ts`):

```ts
import type { Tool as SDKTool } from '@openai/agents';

export interface ToolContribution {
  name: string;            // "<pack>.<tool>" — e.g. "core.emit_ui"
  tool: SDKTool;
  mcpExposed?: boolean;    // appears in MCP tool manifest. Default: false (opt-in)
  requiresSession?: boolean; // requires an active user session — excluded from MCP entirely
}
```

Tools are added by listing them in a pack's `tools[]` (`packages/harness/src/types/pack.ts`). The `core` pack composes tools in `packages/pack-core/src/core-tools.ts` (`createCoreTools(coreComponents)`); other packs construct `ToolContribution[]` directly.

---

## Authoring a tool

Tools wrap an `@openai/agents` `tool(...)` call. Use Zod for params, but constrain schemas to OpenAI's strict-mode contract by importing helpers from `@aks-kickstart/harness` (`runtime/z-strict.ts`):

```ts
import { tool } from '@openai/agents';
import { z } from 'zod';
import { strictOptional } from '@aks-kickstart/harness';

export const myTool = tool({
  name: 'mypack.do_thing',
  description: 'Does the thing.',
  parameters: z.object({
    target: z.string(),
    notes: strictOptional(z.string()),
  }).strict(),
  async execute({ target, notes }) {
    // notes is `string | null` (strictOptional). Convert to undefined if you need it.
    return { ok: true, target, notes: notes ?? undefined };
  },
});
```

The full strict-mode rule table is in [Schema conformance](../architecture/schema-conformance.md). The non-negotiable rules:

- No `.optional()` — use `strictOptional()` so the field is in `required[]` as nullable.
- No `z.record()` — use a closed `z.object({...}).strict()`.
- No `z.unknown()` in tool params — give it a `type`.
- No `z.string().url()` — `format: "uri"` is rejected; use `.refine(isHttpsUrl, …)`.

Pack unit tests assert this with `assertStrictlyConformant(getToolJsonSchema(tool), tool.name)`.

---

## Allowlists, never globals

There is **no** default tool registry, no `defaultRegistry`, no `ToolRegistry` global. Tools are surfaced per-agent via `PackRegistry.getToolsForAgent(agentName)` and only if the agent's frontmatter `tools:` list names them. Cross-pack tool reuse requires the dependent pack to declare `dependsOn`.

```yaml
---
name: aks.architect
tools:
  - core.emit_ui
  - core.read_file
  - aks.list_kubernetes_versions
---
```

---

## A2UI emission from tools

Tools that push UI emit A2UI envelopes. The harness queues them on `session.a2uiEmissions` during the tool call and drains the queue **after** each LLM tool_call returns (the post-tool A2UI drain rule documented at the top of `runtime/runner.ts`). This guarantees A2UI frames cannot overtake their producing tool.

The canonical emission helper is `core.emit_ui`. See [Components → Extending A2UI](../architecture/extending-a2ui.md) for component-typed tool patterns.

---

## Guardrails at tool-stage

Tool-stage guardrails run sequentially via `runGuardrails()` (`runtime/guardrails.ts`) because `@openai/agents` has no tool-arg hook. A `block` verdict at tool stage halts **all** remaining tool calls for the turn. SSE frames stay opaque (`{ code: 'GUARDRAIL_BLOCK' }`) — never an id or reason. See [Guardrails](./guardrails.md).

Tool args can also be `redact`ed (`GuardrailResult.redactedArgs`); the runner re-evaluates downstream guardrails against the redacted form (dual-eval chaining).

---

## MCP exposure

Set `mcpExposed: true` to surface a tool in the MCP manifest produced by `buildMcpManifest()` (`packages/harness/src/mcp/server.ts`). Tools with `requiresSession: true` are excluded from the MCP manifest entirely — the MCP transport is stateless and cannot guarantee an active SPA session. See [MCP tools](./mcp-tools.md).

---

## Telemetry & redaction

Tool input and output are forwarded to OpenTelemetry via `OtelBridgeTraceProcessor` (`runtime/agents-otel-bridge.ts`). `runtime/redact.ts` strips secrets and PII before content is attached as span attributes; setting `KICKSTART_OTEL_RECORD_CONTENT=true` in development bypasses redaction. See [Observability](../operations/observability.md).

---

## Where tools live

| Pack | Directory |
|---|---|
| `core` | `packages/pack-core/src/tools/` (composed in `core-tools.ts`) |
| `azure` | `packages/pack-azure/src/tools/` |
| `aks` | `packages/pack-aks-automatic/src/tools/` |
| `github` | `packages/pack-github/src/tools/` |

The auto-generated `extending/tools-reference.md` lists every tool with its pack, MCP flag, session flag, and one-line description.
