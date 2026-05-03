# ADR: MCP Apps Option B — Host-Managed Sampling

**Date:** 2026-05-05  
**Status:** Implemented  
**Issue:** #408  
**Authors:** Fry (squad-frontend), Bender (squad-backend)

---

## Context

When Kickstart runs as an MCP server inside VS Code / GitHub Copilot, users
should not need to supply Azure OpenAI credentials (zero BYOK).  Instead,
inference should be delegated to the host via the MCP `sampling/createMessage`
protocol so the host (Copilot) provides the LLM.

The SWA Playground path must remain unchanged — it continues to use
Azure OpenAI directly.

## Decision

Implement **Option B: host-managed sampling** as a scoped, opt-in override
in the harness `RunConfig`:

1. **`samplingProvider?: ModelProvider`** in `RunConfig` — when set, the
   harness runner creates a local `SDKRunner` with the supplied provider
   instead of the module-level singleton.  The singleton is never mutated.

2. **`McpSamplingProvider`** in `packages/mcp-server/src/sampling/` —
   implements `ModelProvider` using `server.createMessage()`.  The MCP
   server detects the `sampling` capability at the `initialize` handshake
   and passes an instance of this provider via `RunConfig.samplingProvider`
   on every `converse`, `resume`, and manifest-tool call.

3. **Tool allowlist validation (Zapp H1)** — before forwarding any `tool_use`
   block from the host back to the SDK runner, the provider validates:
   - Tool name is in the offered-tools allowlist (derived from
     `buildMcpManifest(registry)` at startup).
   - Arguments pass the tool's JSON Schema (structural check: required
     fields present, property types match).
   Fail-closed: a validation failure throws, preventing tool execution.

## Consequences

- **SWA isolation preserved**: the module-level `_sdkRunner` singleton is
  never mutated; the sampling SDKRunner is ephemeral (created per-turn).
- **No silent fallback**: if `hostSupportsSampling` is `false`, an empty
  `RunConfig` is returned and the runner uses its default model provider
  (Azure OpenAI / standard OpenAI).  There is no silent Option A fallback.
- **`getStreamedResponse` is non-streaming**: MCP `sampling/createMessage`
  has no streaming surface; the model wraps `getResponse()` and emits a
  single `response_done` event.  Stream-based telemetry (OTel spans)
  still fires because the harness runner's event loop processes the response.
- **Tool allowlist is static per process**: derived once at startup from
  `buildMcpManifest(registry)`.  A process restart picks up registry changes.

## Deferred / Follow-up

- **Native streaming** (if MCP adds a streaming sampling surface in a future
  spec version).
- **Deeper AJV schema validation** for Zapp H1 (current implementation
  validates required fields and top-level property types; nested objects are
  not recursively validated).
- **OTel continuity in the sampling path** — the scoped SDKRunner does not
  share the OTel trace processor chain of the singleton runner.  A follow-up
  should wire OTel into the sampling SDKRunner.
- **CSP regression test** for the MCP App HTML surface.
- **Label-gate workflow** (Zapp H2) — `.github/workflows/squad-implementation-gate.yml`
  was not created in this PR (out of scope; tracked in #408 comments).
