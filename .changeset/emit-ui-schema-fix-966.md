---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/harness": patch
---

fix(pack-core): replace `z.unknown()` in `core.emit_ui` schema with typed discriminated union

The `message` property in `EmitUiInputSchema` was typed as `z.unknown()`, which produces `{}` in JSON Schema (no `type` key). The OpenAI Responses API rejects tool definitions where any property is missing `type`, returning HTTP 400: "schema must have a 'type' key". This caused all A2UI output to fail silently.

Fix: replace `z.unknown()` with a `z.discriminatedUnion('op', [...])` that mirrors the four A2UI v0.9 envelope shapes. All properties carry explicit types; optional fields use `.nullable()` per strict-mode requirements. The runtime `A2UIMessageSchema.parse()` in `execute()` is unchanged.

Also fixes the runner error-path: on hard failure (400, network error, etc.), the SSE `end` event is now emitted with `agentName` and `model` so the Debug panel is not empty.
