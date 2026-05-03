---
"@aks-kickstart/harness": minor
"@sabbour/kickstart-mcp": minor
---

feat(mcp): host-managed sampling Option B — zero BYOK for MCP users

When the MCP client (VS Code / GitHub Copilot) declares the `sampling`
capability in the `initialize` handshake, the harness Runner delegates
inference to the host via `sampling/createMessage` instead of calling
Azure OpenAI directly.

**Changes**

- `harness/src/runtime/run-config.ts`: adds `samplingProvider?: ModelProvider`
  to `RunConfig`.  When set, the runner creates a short-lived `SDKRunner`
  with the supplied provider instead of the module-level singleton —
  the singleton is never mutated (SWA isolation preserved).
- `harness/src/index.ts`: re-exports `ModelProvider` from `@openai/agents`
  so callers can implement sampling providers without a direct
  `@openai/agents-core` dependency.
- `harness/src/runtime/runner.ts`: scoped SDKRunner branch wired into
  `run()`.  `resume()` also accepts an optional `RunConfig` so sampling
  is active on interrupt resumption too.
- `mcp-server/src/sampling/mcp-sampling-provider.ts` (new): `McpSamplingProvider`
  + `McpSamplingModel` translate `ModelRequest` ↔ MCP `sampling/createMessage`.
  Implements Zapp H1 (tool allowlist + argument schema validation before
  any `tool_use` block reaches the SDK runner; fail-closed on mismatch).
- `mcp-server/src/index.ts`: detects `sampling` capability at initialize;
  builds `buildConnectionRunConfig()` that wires the sampling provider for
  `converse`, `resume`, and manifest-tool calls when the host supports it.

**Invariants**
- Direct Azure OpenAI path (SWA Playground) is completely unaffected —
  no env-var or config change required.
- Tool allowlist is derived from `buildMcpManifest(registry)` at startup;
  tools not in the manifest are rejected before execution (Zapp H1).
- `getStreamedResponse` wraps `getResponse` (MCP sampling has no streaming
  surface).

Closes #408.
