---
sidebar_position: 6
---

# MCP Tools

Kickstart ships an **MCP server** at `packages/mcp-server/` that exposes the harness conversation engine to IDE clients (VS Code Copilot, Claude Code, and any client speaking the [Model Context Protocol](https://modelcontextprotocol.io)) over stdio. Pack-contributed tools opt in to the MCP manifest with `mcpExposed: true`. See the architectural overview at [MCP server internals](../architecture/mcp-server-internals.md).

---

## What gets exposed

The manifest is built by `buildMcpManifest()` (`packages/harness/src/mcp/server.ts`):

- Every `ToolContribution` whose `mcpExposed === true` AND `requiresSession !== true`.
- Every `UserActionContribution` whose `mcpExposed === true`.
- Every `AgentContribution` whose `mcpExposed === true`.

Tools that need an active browser session (`requiresSession: true`) are **excluded** unconditionally — the MCP transport is stateless.

---

## Tool descriptors

`McpToolDescriptor` carries the OpenAI strict-mode JSON Schema produced by `getToolJsonSchema()` (`runtime/schema-conformance.ts`), so the same schema the LLM sees over the SDK is what MCP clients see over stdio. Schemas are validated against `assertStrictlyConformant()` at registration so the manifest can never contain a schema OpenAI would reject.

---

## A2UI as embedded resources

When the harness runs over MCP, A2UI envelopes are wrapped as **embedded resources** rather than SSE frames. `buildA2UIContent()` produces `A2UIEmbeddedResource` items:

- `mimeType: 'application/json+a2ui'`
- `audience: ['user']`
- `text` is the stringified envelope (`A2UIMessageEnvelopeSchema`).

Clients that don't recognise the mime type can ignore the block; clients that do (e.g. a future A2UI-aware IDE panel) render it. See [A2UI integration](../architecture/a2ui-integration.md).

---

## UserAction interrupts

When an agent emits a `user_action_req`, MCP clients receive an interrupt rather than streaming chunks. `buildInterruptContent()` produces an `McpInterruptBlock` — the client invokes the user-action tool with a result, the MCP adapter writes the result through, and the runner resumes via `handleResume()` (`runtime/resume.ts`).

The MCP adapter (`packages/mcp-server/src/adapter/`) provides:

- `interrupt-store.ts` — content-addressable storage for in-flight interrupts. TTL: `INTERRUPT_TTL_MS = 15 * 60 * 1000` (15 minutes).
- `session-mutex.ts` — per-session chain-of-promises mutex; serialises concurrent tool calls into a single per-session run loop.

---

## VS Code client detection

`isVsCodeClient()` (`packages/harness/src/mcp/server.ts`) sniffs the MCP `clientInfo` to decide when to emit VS-Code-specific framing. Other clients fall back to the generic envelope set.

---

## Startup wiring

Pack registration happens in `packages/mcp-server/src/startup/packs.ts` — same fixed order as the API (`core, azure, aks, github`), filtered by `KICKSTART_PACKS`. The registry is sealed before the stdio loop begins so all schema and handoff validation has run.

The server entry point (`packages/mcp-server/src/index.ts`) wires the `Runner`, `sessionStore`, `SSEWriter` (mapped onto MCP `notifications/message` frames), and the manifest into the MCP transport.

---

## How to opt a tool in

Set `mcpExposed: true` on the contribution. Then either:

- Make sure it does **not** set `requiresSession: true` (which would exclude it from MCP).
- Verify the tool's params schema passes `assertStrictlyConformant()` — pack tests already cover this for in-pack tools.

The auto-generated `extending/tools-reference.md` has an `MCP` column that shows which tools are currently exposed.

---

## Limits

- The MCP adapter does not transmit phase tracker components; phase is reflected in the conversation, not as a sidebar.
- A2UI surfaces with `sendDataModel: true` are still serialised, but clients without an A2UI renderer simply see opaque embedded resources.
- The MCP transport is stateless — anything requiring an active browser session (`requiresSession: true`) is unavailable.
