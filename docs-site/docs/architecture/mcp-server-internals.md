---
title: MCP server internals
sidebar_position: 8
---

# MCP server internals

This page documents the **`@aks-kickstart/mcp-server`** package — the thin MCP
adapter that wraps the harness Runner and exposes Kickstart over the
[Model Context Protocol](https://modelcontextprotocol.io). It is intended for
contributors who need to understand or extend the adapter, not for end users.

The companion package, `@aks-kickstart/harness`, owns the runtime. This
adapter owns transport, manifest filtering, A2UI shaping, and interrupt
state. There is intentionally no duplicated runtime logic.

## Design goals

The adapter is built around four invariants. They are reflected in the
top-of-file design comment in
[`packages/mcp-server/src/index.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/mcp-server/src/index.ts):

1. **One tool call drives one Runner turn.** Session management, skill
   injection, guardrails, retry, and tool execution all live in the harness.
   The adapter never re-implements them.
2. **Manifest filtering is opt-in.** Only tools that explicitly set
   `mcpExposed: true` and do not require a user session appear in the MCP
   tool manifest. UserActions never appear as tools — they surface as
   structured interrupt blocks returned inline from `converse`.
3. **Identity is server-owned.** The `connectionId` is assigned by the
   adapter at the MCP `initialize` handshake and is never read from client
   parameters. This blocks a client from spoofing another connection's
   identity.
4. **Interrupt state is single-use, action-bound, TTL-guarded, and
   replay-protected.** A process restart clears all in-memory interrupt
   state by design, so any pending interrupt returns a 404 after restart.

## Adapter shape

The adapter is a single stdio MCP server registered against a sealed
`PackRegistry` constructed in
[`packages/mcp-server/src/startup/packs.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/mcp-server/src/startup/packs.ts).
Pack registration order is fixed (`core`, `azure`, `aks`, `github`) and is
filtered by the `KICKSTART_PACKS` environment variable; the `core` pack is
always registered because every other pack depends on it.

The adapter then registers exactly two static tools and dynamically
registers any pack tool that passes the manifest filter:

| Surface           | Source file                                                                                | Purpose                                                            |
|-------------------|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `converse` tool   | `packages/mcp-server/src/index.ts`                                                         | Primary entry. One call = one Runner turn for one session.         |
| `resume` tool     | `packages/mcp-server/src/index.ts`                                                         | Resume after a UserAction. CAS single-use, 404 on miss/expired.    |
| Dynamic tools     | `packages/mcp-server/src/index.ts` (loop over `buildMcpManifest(registry)`)                | Pack-contributed tools that opted in via `mcpExposed: true`.       |
| App resource      | `packages/mcp-server/src/index.ts` (URI `kickstart://app/main`)                            | Static HTML resource for IDE-native conversation UI.               |

There is no other adapter surface. There is, in particular, no way to
reach a UserAction directly from MCP — UserActions are only reachable via
the `converse` → interrupt block → `resume` round trip.

## Manifest filtering — `buildMcpManifest`

The list of pack tools that appear in the MCP manifest is computed by
`buildMcpManifest`, defined in
[`packages/harness/src/mcp/server.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/harness/src/mcp/server.ts).
It walks all registered tool contributions and includes one only if every
filter rule passes:

1. `mcpExposed === true` on the tool contribution. The default is
   `undefined` / `false`, so MCP exposure is an explicit opt-in.
2. `requiresSession !== true`. Tools that need an authenticated user
   session are excluded entirely; allowing them over MCP would let an
   unauthenticated MCP client reach a session-bound surface.
3. The tool name is not in the file-system deny list
   (`core.write_file`, `core.read_file`, `core.list_files`). Pack authors
   are expected to set `mcpExposed: false` on these; the deny list is
   defence-in-depth.

The `mcpExposed` and `requiresSession` flags are part of the
`ToolContribution` type in
[`packages/harness/src/types/tool.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/harness/src/types/tool.ts).
The same `mcpExposed` flag exists on agent and user-action contributions
(see `packages/harness/src/types/agent.ts` and `user-action.ts`); the
adapter ignores it for user actions on purpose, because user actions are
never tools.

There is **no** runtime escape hatch to expose a tool over MCP without
`mcpExposed: true`. Adding a new tool to MCP is therefore a code change
to the pack that owns the tool, not an environment-variable change.

## A2UI shaping — `buildA2UIContent`

When the Runner emits an `a2ui` SSE event, the adapter buffers the message
into an in-memory list for the duration of the turn. After the Runner
finishes, `buildA2UIContent` converts that list into MCP content items as
a plain-text summary — one line per message of the form `[A2UI <type>]`.
The raw JSON is intentionally not injected into the model context, because
MCP clients typically pass all content to the LLM and unmoderated A2UI
payloads would pollute the prompt.

## Interrupt model — `registerInterrupt` / `claimInterrupt`

When the Runner emits a `user_action_req` SSE event during a `converse`
call, the adapter:

1. Generates an `actionId` (or accepts the one supplied in the event),
2. Builds an `McpInterruptBlock` describing the action, its optional
   `confirmComponent`, and a JSON Schema for the expected result payload,
3. Calls `registerInterrupt({...})` to record the entry in the in-memory
   interrupt store.

The interrupt store lives in
[`packages/mcp-server/src/adapter/interrupt-store.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/mcp-server/src/adapter/interrupt-store.ts)
and enforces the following properties:

| Property            | Mechanism                                                                                                      |
|---------------------|----------------------------------------------------------------------------------------------------------------|
| Single-use          | `claimInterrupt` atomically sets `entry.consumed = true` before returning. A second call returns `null`.       |
| Action-bound        | The store is keyed by `${sessionId}:${actionId}`; an `actionId` issued for one session cannot be claimed from another. |
| TTL                 | `INTERRUPT_TTL_MS` (default 15 minutes). Expired entries are deleted on `claim` and by a periodic purge.       |
| Replay guard        | The `consumed` flag persists for the entry's lifetime; replays within the TTL window are rejected.             |
| Process restart → 404 | The store is a module-level `Map`. A restart clears it; any pending interrupt returns 404 on resume.         |
| Concurrent resume safety | All `claim` calls for a given `sessionId` are serialised through the per-session mutex before they reach the store. |

The `resume` tool wraps every claim in `withSessionMutex(sessionId, ...)`
so concurrent resumes for the same session are serialised. If the claim
returns `null`, `resume` returns a structured error with `code: 404`
rather than re-running the Runner.

A periodic cleanup timer (`setInterval` every 5 minutes, with `unref()`
so it does not block process exit) calls `purgeExpiredInterrupts` to
drop entries that have aged past the TTL.

## Per-session serialisation — `withSessionMutex`

Every Runner-driven path in the adapter — `converse`, `resume`, and the
dynamically registered pack tools — is wrapped in `withSessionMutex`
defined in
[`packages/mcp-server/src/adapter/session-mutex.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/mcp-server/src/adapter/session-mutex.ts).

The mutex is a chain-of-promises construction. Each session has at most
one in-flight Runner call; subsequent calls for the same session queue
in arrival order. The mutex is in-memory only — a process restart
clears all chains, which is correct because there are no in-flight
requests to serialise after a restart.

This mutex is what makes the interrupt store's CAS guarantee meaningful.
Without per-session serialisation, two concurrent `resume` calls could
both observe `consumed === false` before either set it to true.

## What this adapter intentionally does not do

These are not omissions — they are explicit design choices. Contributors
should not add them without an architectural review.

- **No retry.** Retry, circuit-breaking, and tool-result truncation are
  the harness Runner's responsibility (`packages/harness/src/runtime/runner.ts`).
- **No persistent interrupt store.** The 404-after-restart behaviour is
  a security property, not a bug. A persisted store would let stale
  actions survive restarts and be replayed.
- **No client-supplied `connectionId`.** The handshake assigns one; the
  client cannot override it.
- **No exposing UserActions as tools.** They surface as structured
  interrupt blocks only.
- **No additional transport.** The adapter binds to
  `StdioServerTransport`; alternative transports require a new entry
  point file, not a runtime flag.

## Cross-references

- [Architecture overview](./overview.md)
- [Extending — MCP tools](../extending/mcp-tools.md)
