# Design Proposal: MCP Apps for VS Code — Option B (Host-Managed Sampling)

> **Tracking issue:** [#1044 — MCP Apps for VS Code: Option B (Host-managed sampling)](https://github.com/sabbour/kickstart/issues/1044)
>
> **Status:** 🚧 Work in progress. Tracked on [issue #1044](https://github.com/sabbour/kickstart/issues/1044). Additive — SWA Playground path is frozen and MUST NOT regress.
>
> **Owner:** Nibbler (v2 author, per Reviewer Rejection Protocol — Leela locked out on v1 rejection)
>
> **Estimate:** L · **Gates pending:** `nibbler:approved` (Ahmed reviewing in Nibbler's stead), `human:approved-implementation` (Ahmed final sign-off)
>
> **Already have:** `leela:approved-with-conditions`, `zapp:approved-with-conditions`
>
> **Supersedes:** v1 (leela-authored, rejected); v2 (Nibbler-authored, Scribe-deleted). This file is v2.1.

**Author:** Nibbler (Code Reviewer & Watchdog)  
**Date:** 2026-04-22  
**Status:** DRAFT v2.1 — reconstructed into canonical docs home; implementation remains blocked pending issue-label gate  
**Revised:** 2026-04-21 — v2 replaced parser-first with native MCP sampling-tools, scoped provider override, and fail-closed capability checks  
**Revised:** 2026-04-22 — v2.1 reconstructed from the surviving decision-ledger excerpt plus v1/v2 reviews; folded in all 5 binding conditions and re-review nits  
**Audience:** Ahmed Sabbour, squad

---

> ## ⚠️ Additive Constraint
> 
> **MCP Apps is an ADDITIVE execution path.** The existing SWA + Azure Functions playground is the production deployment and **MUST NOT regress**.
> 
> - The existing SWA runtime path keeps its current provider lifecycle: `buildModelProvider()` and the lazily initialized `_sdkRunner` remain the default path for hosted web traffic in `packages/harness/src/runtime/runner.ts:54-72` and `packages/harness/src/runtime/runner.ts:75-113`.
> - The MCP-server path adds a **scoped host-managed sampling provider**; it does **not** mutate the singleton used by SWA.
> - `packages/web/api/src/functions/converse.ts` and the rest of the SWA surface stay behaviorally unchanged.
> - No implementation of Option B may call `setDefaultModelProvider()` from an MCP-server code path.
> - Existing Playwright coverage in `.github/workflows/ci.yml:141-148` remains the regression gate for the SWA UX.
>
> This DP is intentionally additive in architecture, approval flow, telemetry posture, and docs routing.

## Docs impact

- `docs-site/docs/extending/mcp-tools.md` — VS Code host-managed sampling setup, capability requirements, consent model, and approval flow
- `docs-site/docs/guides/packs-and-skills.md` — provider-isolation diagram and SWA non-regression contract
- `docs-site/docs/getting-started/vs-code-mcp-apps.md` — new end-user quick start for VS Code MCP Apps
- `docs/design/README.md` — canonical design-doc index entry for this DP

## Changes from v1

- Replaces the rejected parser-first core with the SDK-native tools path: `server.createMessage({ messages, tools, toolChoice, ... })` and `tool_use` / `tool_result` blocks from the checked-in MCP SDK.
- Replaces the fictional constructor-injection story with the real runner lifecycle: module-scope `_sdkRunner`, `getSdkRunner()`, and `Runner.run()` calling that singleton today in `packages/harness/src/runtime/runner.ts:75-113`, `:316-317`, and `:423-425`.
- Picks a scoped-provider design that does **not** mutate shared SWA runner state.
- Removes JSON parsing as the primary mechanism; any text-parsing fallback is explicitly deferred to P2, opt-in, and redaction-safe.
- Adds a fail-closed capability contract for both `converse` and `resume`, with machine-readable error codes and no silent Option A route.
- Separates sampling consent from destructive-action confirmation and forbids bundling those prompts.
- Validates `KICKSTART_MODEL_HINTS` with hard bounds and redaction-safe telemetry.
- Strengthens the SWA non-regression contract with merge-blocking invariant tests.
- Wires the human gate as an issue-label workflow, not prose.
- Fixes the stale docs-site references caught in v2 re-review: the implementation-facing docs paths are `docs-site/docs/extending/mcp-tools.md` and `docs-site/docs/guides/packs-and-skills.md`; `docs-site/docs/architecture/overview.md` exists and is not the file this work updates.

## TL;DR

Option B is viable **only** if we use the MCP SDK's native sampling-tools contract already present in the pinned SDK, and **only** if the MCP server gets a scoped model-provider path that bypasses the harness singleton used by SWA. The happy path is:

1. `packages/mcp-server/src/index.ts:100-109` grows from a VS Code detection hook into a capability-snapshot hook that persists `hasSampling`, `hasSamplingTools`, and `hasElicitation` on server state.
2. The MCP-server path builds a scoped `SamplingModelProvider` and passes it through a new runner-facing override rather than touching `_sdkRunner` in `packages/harness/src/runtime/runner.ts:75-113`.
3. The adapter translates `ModelRequest` → `CreateMessageRequestParamsWithTools` and `CreateMessageResultWithTools` → `ModelResponse` using native `tool_use` / `tool_result` blocks and `FunctionCallItem`s.
4. If the host lacks `sampling` or `sampling.tools`, both `converse` and `resume` return a structured capability error. There is no silent Azure/OpenAI fallback in the MCP binary.
5. SWA keeps its existing provider path and remains covered by the repo's Playwright gate in `.github/workflows/ci.yml:141-148`.

## 1. Problem & Goal

The Kickstart MCP server must drive LLM-powered agent runs inside VS Code without shipping API keys or requiring user BYOK configuration. Today, the shared harness resolves its provider through `buildModelProvider()` and the lazily initialized `_sdkRunner` singleton in `packages/harness/src/runtime/runner.ts:54-72` and `packages/harness/src/runtime/runner.ts:75-113`. That is correct for the SWA path, but it is the wrong ownership model for an MCP host-managed inference path.

For the MCP Apps experience in VS Code, the goals are:

- zero-BYOK inference for MCP users;
- native MCP sampling with native MCP tools;
- no regressions to the SWA Playground directive recorded in earlier decisions;
- no code path in the MCP-server binary that can accidentally fall back to the SWA/Azure provider path; and
- a real, enforceable human-approval gate before implementation dispatch.

Non-goals for P0:

- inventing a new parser-based function-calling protocol;
- changing pack schemas, A2UI contracts, or SWA frontend behavior;
- adding a second LLM route to the MCP-server binary; or
- pretending streaming exists when the current MCP sampling API is still request/response.

## 2. Architecture Overview (Summary)

Option B is viable **only** if we use the MCP SDK's native sampling-tools contract, and **only** if the MCP server gets a scoped model-provider path that bypasses the harness singleton used by SWA. The implementation enforces:

- scoped `SamplingModelProvider` without mutating `_sdkRunner`;
- fail-closed capability contracts with machine-readable error codes;
- no silent fallback to an Azure/OpenAI provider path in the MCP binary; and
- SWA Playground non-regression covered by invariant tests plus the existing Playwright CI gate.

## 3. Architecture — MCP-server adapter + scoped provider

### 3.1 Why the adapter belongs in `packages/mcp-server/`

The transport story is already solved: the MCP server speaks JSON-RPC over stdio via the MCP SDK `Server` abstraction. The missing piece is not transport; it is **provider ownership**. The harness already builds an `Agent` and delegates execution to the SDK runner in `packages/harness/src/runtime/runner.ts:403-425`. Option B keeps that harness behavior, but swaps in a host-managed model provider **only for MCP-scoped runs**.

That split gives the design its core property:

- harness logic stays shared;
- SWA continues to use the default provider path;
- MCP Apps use host-managed sampling through a provider adapter; and
- the isolation boundary lives in the MCP server, not in pack code or the web app.

### 3.2 Initialize handshake and capability snapshot

Today `packages/mcp-server/src/index.ts:100-109` uses `oninitialized` to assign `connectionId`, derive `isVsCode`, and log the client name. v2.1 extends that same post-initialize hook to snapshot host capabilities from the completed MCP handshake:

```ts
interface HostCapabilitiesSnapshot {
  hasSampling: boolean;
  hasSamplingTools: boolean;
  hasElicitation: boolean;
}
```

Source anchors:

- The current MCP server already has an `oninitialized` seam at `packages/mcp-server/src/index.ts:100-109`.
- The pinned SDK defines client capability flags at `node_modules/@modelcontextprotocol/sdk/dist/esm/spec.types.d.ts:300-312`, including `sampling` and `sampling.tools`.

Required behavior:

1. `hasSampling = Boolean(clientCapabilities?.sampling)`
2. `hasSamplingTools = Boolean(clientCapabilities?.sampling?.tools)`
3. `hasElicitation = Boolean(clientCapabilities?.elicitation)` when present
4. The snapshot is stored in server-local state and included in structured error responses
5. The snapshot is treated as **advisory but binding for routing**: if the host does not declare support, Kickstart fails closed rather than probing or falling back

### 3.3 `SamplingModelProvider` in `packages/mcp-server/src/sampling/provider.ts`

New file: `packages/mcp-server/src/sampling/provider.ts`

This class implements `Model` from `@openai/agents-core` (`node_modules/@openai/agents-core/dist/model.d.ts:418-434`). Its job is to translate the `@openai/agents` runtime contract into the MCP host's `sampling/createMessage` contract.

Minimum P0 shape:

```ts
class SamplingModelProvider implements Model {
  constructor(private readonly deps: {
    server: Server;
    sessionId: string;
    capabilities: HostCapabilitiesSnapshot;
    modelHints?: ModelPreferences | undefined;
    logger: SamplingLogger;
  }) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    // translate request -> server.createMessage(...)
    // validate tool_use blocks
    // translate result -> ModelResponse
  }

  async *getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent> {
    // P0 compatibility wrapper around getResponse(); no fake token stream
  }
}
```

Responsibilities:

- transform `ModelRequest.messages`, `tools`, `toolChoice`, `systemPrompt`, and `outputType` expectations into `CreateMessageRequestParamsWithTools`;
- call `server.createMessage(...)` using the tools-enabled overload from `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts:137-155`;
- translate `CreateMessageResultWithTools` back into a `ModelResponse`, including `FunctionCallItem`s using the Agents-core protocol shape at `node_modules/@openai/agents-core/dist/types/protocol.d.ts:375-389`;
- echo `tool_result` blocks back into the next request turn for multi-round agent execution;
- preserve host-managed inference ownership; and
- expose only redaction-safe diagnostics.

#### Data-egress contract

Host-managed sampling is a real trust-boundary crossing. The adapter may transmit only the context required for the active turn:

- active system/developer instructions needed to run the agent;
- conversation history for the current session;
- tool schemas for tools actually declared on the current request; and
- validated tool results needed for the next round.

The adapter must **not** transmit:

- unrelated internal-only payloads from other sessions;
- secrets sourced from server env vars or unrelated provider configuration;
- raw telemetry/exporter state; or
- diagnostic payloads gathered only for logging or tracing.

In short: sampling forwards prompt and tool context for the active turn, but not secrets and not arbitrary Kickstart-internal state.

### 3.4 Scoped runner injection sketch

The harness currently constructs `Runner` with only `registry` (`packages/harness/src/runtime/runner.ts:316-317`) and resolves the SDK runner through module scope inside `run()` (`packages/harness/src/runtime/runner.ts:423-425`). That is the real injection seam.

Required change:

- add `providerOverride?: Model` to `Runner.run()` (or add a sibling `runScoped()` if that proves cleaner);
- when `providerOverride` is present, build a **local SDK runner** for that call path instead of calling `getSdkRunner()`;
- keep the existing `getSdkRunner()` path untouched when `providerOverride` is absent.

Design sketch:

```ts
async run(session, userMessage, sseWrite, signal?, providerOverride?) {
  const sdkRunner = providerOverride
    ? getScopedSdkRunner(providerOverride)
    : getSdkRunner();

  const result = await sdkRunner.run(agent, guardedMessage, { ... });
}
```

Where `getScopedSdkRunner(providerOverride)` must:

1. call `installOtelBridgeOnce()` before constructing the local runner so tracing continuity matches the default path in `packages/harness/src/runtime/runner.ts:95-113`;
2. **not** call `setDefaultModelProvider()`;
3. **not** assign to `_sdkRunner`; and
4. return an `SDKRunner` whose `modelProvider` is the injected `providerOverride`.

#### Structured-output note (binding condition)

The harness already runs agents with `outputType: AgentOutput` in `packages/harness/src/runtime/runner.ts:406-412`, and later resolves the structured `finalOutput` object to clean prose in `packages/harness/src/runtime/runner.ts:482-500`. That means the scoped provider must preserve **non-string** output semantics. If the SDK expects a structured payload, the adapter must carry it through native tool calls or an explicit structured `output` content block inside `ModelResponse`. It must **not** flatten structured output into plain text just to squeeze it through the host path.

This is a P0 correctness requirement, not a future enhancement: forcing structured output through a text channel would silently corrupt the same `AgentOutput` contract the hosted runner already depends on.

### 3.5 Isolation contract

#### 3.5.1 SWA path remains the default

The existing SWA flow continues unchanged:

- `buildModelProvider()` selects Azure OpenAI or standard OpenAI in `packages/harness/src/runtime/runner.ts:54-72`.
- `getSdkRunner()` installs the OTel bridge, calls `setDefaultModelProvider(provider)`, and memoizes `_sdkRunner` in `packages/harness/src/runtime/runner.ts:95-113`.
- `Runner.run()` keeps using `getSdkRunner()` whenever no override is supplied.

The SWA call site never passes `providerOverride`, so it keeps using `getSdkRunner()` exactly as it does today.

#### 3.5.2 Scoped-provider isolation

This path never calls `setDefaultModelProvider()` and never mutates the singleton. That is an explicit contract, not an implementation preference.

Required invariants:

- `_sdkRunner` before a scoped MCP run is the same binding after the scoped MCP run.
- `setDefaultModelProvider()` is never invoked from `packages/mcp-server/` code paths.
- the scoped path may create ephemeral runner instances, but they are request-local and discarded after use.
- the MCP server never stores the host-managed provider in module scope.

The merge-blocking proof for this contract lives in §9 and §11: an invariant test imports `_sdkRunner` and asserts it is unchanged after a scoped MCP run.

## 4. Native sampling-tools path (replaces v1 parser-first)

### 4.1 Pinned SDK surface

The checked-in MCP SDK already exposes the tools-enabled sampling overloads in `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts:137-155`:

- `createMessage(params: CreateMessageRequestParamsBase, ...)`
- `createMessage(params: CreateMessageRequestParamsWithTools, ...)`
- `createMessage(params: CreateMessageRequest['params'], ...)`

Relevant schemas/types in the pinned SDK:

- `CreateMessageRequestParamsWithTools` — `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:8116-8118`
- request `toolChoice` — `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:3935-3941`
- `ToolUseContentSchema` — `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:1969-1975`
- `ToolResultContentSchema` — `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:3013-3065`
- `CreateMessageResultWithToolsSchema` — `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:4384-4448`

This is why parser-first is explicitly rejected in v2.1: the stronger native contract already exists.

### 4.2 Translation matrix

| Source contract | Target contract | Notes |
|---|---|---|
| `ModelRequest.messages[]` | `CreateMessageRequestParamsWithTools.messages[]` | Preserve turn order and content-type fidelity |
| `ModelRequest.tools[]` | `CreateMessageRequestParamsWithTools.tools[]` | Carry name, description, and JSON schema allowlist |
| `ModelRequest.toolChoice` | `.toolChoice` | Map to MCP `required` / `auto` / `none` mode at `types.d.ts:3935-3941` |
| request-level model hints | `.modelPreferences` | Populated from validated `KICKSTART_MODEL_HINTS`; see §8.2 |
| `CreateMessageResultWithTools.content` text blocks | assistant message content | Preserve prose blocks as assistant output |
| `CreateMessageResultWithTools.content` `tool_use` blocks | `FunctionCallItem` | Shape must match Agents-core `FunctionCallItem` at `protocol.d.ts:375-389` |
| tool execution results from the agent runtime | `tool_result` blocks in the next MCP request turn | Multi-turn continuation path |
| structured final output | structured `ModelResponse` output payload | Never coerce to plain text; see §3.4 |

### 4.3 `tool_use` validation (binding condition)

Before the adapter returns a `FunctionCallItem`, it must validate the translated `tool_use` block against the request's declared tool contract.

Fail-closed rules:

1. **Allowlist validation:** the `tool_use.name` must exist in the current request's declared `ModelRequest.tools[]` set.
2. **Schema validation:** the `tool_use.input` object must parse against that tool's JSON schema.
3. **No execution on failure:** invalid tool-use blocks produce a structured `E_TOOL_USE_INVALID` error and are **not** executed.
4. **Redacted diagnostics only:** logs include the tool name and validation-error summary, but never raw arguments, prompt text, or full serialized payloads.

Suggested error payload:

```json
{
  "type": "error",
  "code": "E_TOOL_USE_INVALID",
  "message": "Host sampling returned a tool invocation that failed validation.",
  "details": {
    "toolName": "azure.deploy",
    "reason": "schema_validation_failed"
  }
}
```

This replaces the rejected parser-first authenticity story with a stronger, host-native, schema-bound contract.

### 4.4 Multi-turn semantics

`tool_use` / `tool_result` is the core loop:

1. the adapter sends messages + tools to `server.createMessage(...)`;
2. the host may return text, `tool_use`, or a mixed array in `CreateMessageResultWithTools.content`;
3. each validated `tool_use` becomes a `FunctionCallItem` for the Agents runtime;
4. executed tool outputs are translated back into MCP `tool_result` blocks for the next turn; and
5. the cycle repeats until the host returns a non-tool turn.

The result schema explicitly supports array content and `stopReason: "toolUse"` in `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:4384-4448`, so the design does not need ad hoc fenced JSON or synthetic delimiters.

### 4.5 Parser fallback policy

Text parsing is deferred to P2 and is **off by default**.

If a future compatibility mode is needed for a non-conforming host, it must be:

- guarded by an explicit environment variable;
- disabled in CI by default;
- limited to a narrow, dedicated fence format; and
- instrumented with redaction-safe diagnostics only.

Any parse-fallback diagnostic must redact prompt and arguments payloads. Logging raw model text, raw JSON slices, or raw tool arguments is explicitly forbidden.

## 5. Host capability gate — fail-closed

### 5.1 Gate locations

Both MCP entry points must enforce the capability gate at handler entry:

- `converse` at `packages/mcp-server/src/index.ts:119-221`
- `resume` at `packages/mcp-server/src/index.ts:229-299`

Required check:

```ts
if (!hasSampling || !hasSamplingTools) {
  return capabilityError(snapshot);
}
```

### 5.2 Error contract

If either capability is missing, the MCP server returns a structured error with machine-readable code `E_HOST_SAMPLING_REQUIRED` plus a human hint and the echoed capability snapshot.

Canonical shape:

```json
{
  "type": "error",
  "code": "E_HOST_SAMPLING_REQUIRED",
  "message": "This MCP host does not advertise sampling with tool support, so Kickstart cannot run Option B.",
  "hint": "Use a VS Code MCP host with sampling and sampling.tools enabled.",
  "capabilities": {
    "hasSampling": false,
    "hasSamplingTools": false,
    "hasElicitation": true
  }
}
```

Requirements:

- same code for both `converse` and `resume`;
- content payload is stable enough for client-side handling and tests;
- capability snapshot is echoed for debugging;
- no retries into Azure/OpenAI provider code; and
- no downgrade to a text-only parser mode in P0.

### 5.3 Why fail-closed matters

The MCP binary is not allowed to contain a shadow provider route. Even after `@openai/agents` is added to `packages/mcp-server/package.json`, the binary still must not own OpenAI/Azure credentials or a fallback path. Capability absence is a terminal error, not a route-selection input.

## 6. Consent UX

Two separate consent layers exist and must stay separate:

1. **Sampling consent** — once per session, owned by the host's sampling-consent UX. This is the user's approval for the host to send prompt/tool context to host-managed inference.
2. **Destructive-action confirmation** — per action, owned by Kickstart's A2UI `ConfirmPanel` / existing user-action widgets.

### 6.1 Explicit non-goal: no bundled prompt

Bundling both into a single prompt is forbidden. It conflates:

- model invocation / data egress risk; and
- side-effectful tool execution risk.

Those are different trust decisions and must remain legible as different prompts.

### 6.2 Ownership split

- Host-side sampling consent is owned by VS Code's sampling provider. Kickstart does **not** implement custom sampling-consent UI.
- Destructive-action consent continues to use existing A2UI components and interrupt/resume semantics.

### 6.3 UX copy requirements

The implementation docs must state:

- sampling consent copy describes host-managed inference and transmitted context;
- destructive-action copy describes the concrete side effect;
- neither prompt should imply the other has already been granted; and
- retry copy should avoid click-through normalization.

## 7. Streaming

### 7.1 Current constraint

The pinned MCP SDK has no streaming variant of `createMessage`; the documented surface is request/response only at `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts:137-155`.

### 7.2 P0 behavior

P0 must not fake token streaming.

Instead:

- emit tool-status/progress updates between tool rounds using standard MCP progress notifications;
- surface per-round assistant text through existing `emit_ui` / A2UI messages when available;
- treat each `createMessage` exchange as a completed response unit; and
- keep the user informed with honest round-based status, not synthetic token dribble.

### 7.3 Deferred work

If a future SDK release adds a streaming sampling API, adoption belongs in a follow-up design/update. Until then, the design intentionally prefers correctness and transparency over faux streaming.

## 8. Config & telemetry

### 8.1 Telemetry continuity and privacy

The scoped override path still needs tracing continuity.

`installOtelBridgeOnce()` in `packages/harness/src/runtime/runner.ts:95-104` is provider-agnostic; it installs the OTel bridge and prevents outbound OpenAI tracing side effects. The scoped provider path must therefore call that bridge initializer before creating a local SDK runner, even though it must not call `setDefaultModelProvider()`.

Telemetry rules:

- log capability snapshots, gate failures, and validation outcomes with bounded fields;
- never log raw prompts, raw tool arguments, or raw parse-fallback payloads;
- preserve the existing no-third-party-tracing posture described in `packages/harness/src/runtime/runner.ts:78-94`; and
- record whether the call used the scoped provider path without including user content.

### 8.2 `KICKSTART_MODEL_HINTS`

`KICKSTART_MODEL_HINTS` supplies the host-facing `modelPreferences` hint for `createMessage` (`node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:3878-3895`).

Required validation with Zod:

- top-level `hints` array length ≤ 5
- each hint `name` length ≤ 200 characters
- `intelligencePriority`, `speedPriority`, `costPriority` are numbers in `[0, 1]`
- malformed JSON, oversized arrays, or invalid numeric bounds are handled as **soft failures**

Soft-failure behavior:

1. log one redaction-safe warning;
2. proceed with no hints;
3. do not crash the server; and
4. do not log the raw environment-variable string.

Example accepted shape:

```json
{
  "hints": [{ "name": "gpt-4.1" }],
  "intelligencePriority": 0.8,
  "speedPriority": 0.4,
  "costPriority": 0.2
}
```

Telemetry for this env var logs the parsed shape only, not raw env contents.

## 9. SWA non-regression contract

The existing SWA provider path is unchanged. That means:

- `packages/web/api/src/functions/converse.ts` keeps using the harness exactly as it does today;
- `packages/harness/src/runtime/runner.ts` keeps its default provider construction path for SWA callers;
- the MCP path is strictly additive and scoped; and
- any implementation that mutates `_sdkRunner` from an MCP call path is a merge blocker.

### 9.1 Merge-blocking invariant

A new test file under `packages/mcp-server/src/__tests__/invariants.test.ts` must import the module-scope `_sdkRunner` binding and verify that a scoped MCP run does **not** mutate it.

```ts
// MERGE-BLOCKER: SWA non-regression invariant
expect(beforeSdkRunner).toBe(afterSdkRunner)
```

That test also spies on `setDefaultModelProvider()` and asserts the MCP scoped path never invokes it.

### 9.2 Existing CI coverage remains relevant

The repo already runs Playwright E2E in `.github/workflows/ci.yml:141-148`. No new SWA-specific CI job is required beyond ensuring harness-touching PRs still exercise that gate.

## 10. File-touch map

| Path | Change | Reason |
|---|---|---|
| `packages/mcp-server/src/sampling/provider.ts` | **NEW** | `SamplingModelProvider` implementing `Model` and bridging `ModelRequest` ↔ MCP sampling |
| `packages/mcp-server/src/sampling/translate.ts` | **NEW** | Pure translation helpers for `ModelRequest` ↔ `CreateMessageRequestParamsWithTools` and result mapping |
| `packages/mcp-server/src/index.ts:100-109,119-221,229-299` | **MODIFY** | capability snapshot in `oninitialized`; fail-closed `converse`/`resume` gates; scoped provider wiring |
| `packages/mcp-server/package.json:11-27` | **MODIFY** | add `@openai/agents@0.8.4` to match harness and support provider/runner integration |
| `packages/harness/src/runtime/runner.ts:316-317,423-425` | **MODIFY** | add optional `providerOverride` path and scoped SDK-runner creation without singleton mutation |
| `packages/mcp-server/src/__tests__/invariants.test.ts` | **NEW** | `_sdkRunner` immutability invariant test — `// MERGE-BLOCKER: SWA non-regression invariant` |
| `packages/mcp-server/src/__tests__/translation.test.ts` | **NEW** | native-tools translation tests and schema-rejection cases |
| `packages/mcp-server/src/__tests__/mock-host.integration.test.ts` | **NEW** | in-process mock MCP host implementing `sampling.createMessage` |
| `packages/mcp-server/src/__tests__/capability-gate.test.ts` | **NEW** | explicit `E_HOST_SAMPLING_REQUIRED` coverage for `converse` and `resume` |
| `packages/mcp-server/src/__tests__/tool-use-validation.test.ts` | **NEW** | allowlist rejection, schema rejection, and redacted logging assertions |
| `packages/mcp-server/src/__tests__/model-hints-validation.test.ts` | **NEW** | `KICKSTART_MODEL_HINTS` validation and soft-failure behavior |
| `.changeset/mcp-apps-option-b.md` | **NEW** | semver bump entry for implementation PR |
| `.github/workflows/squad-implementation-gate.yml` | **NEW** | label-gate workflow enforcing issue #1044 approval preconditions |
| `.github/workflows/sync-squad-custom-labels.yml:35-59` | **MODIFY** | add/ensure label sync for `leela:approved`, `zapp:approved`, `nibbler:approved`, `human:approved-implementation`, `go:needs-dp-review`, plus the `leela:approved-dp`, `zapp:approved-dp`, `nibbler:approved-dp`, and related `-dp` counterparts already used in the DP workflow |
| `docs-site/docs/extending/mcp-tools.md` | **MODIFY** | implementation docs for VS Code host-managed sampling and capability/consent contract |
| `docs-site/docs/guides/packs-and-skills.md` | **MODIFY** | provider-isolation story and additive SWA contract |
| `docs-site/docs/getting-started/vs-code-mcp-apps.md` | **NEW** | quick start for end users |
| `docs/design/README.md` | **MODIFY** | add canonical DP index entry |

## 11. Testing plan

Native-tools coverage replaces the rejected parser-edge-case plan.

| Test file / area | Coverage | Why it matters |
|---|---|---|
| `translation.test.ts` | `ModelRequest` → `CreateMessageRequest` (`tools`, `toolChoice`, messages), `CreateMessageResult` → `ModelResponse` (text + `tool_use` + mixed), schema rejection cases | Proves the adapter speaks the native contract rather than an invented parser contract |
| `mock-host.integration.test.ts` | full `converse` round trip with an in-process MCP host stub implementing `sampling.createMessage` | Proves end-to-end viability without VS Code in the loop |
| `capability-gate.test.ts` | `converse` / `resume` return `E_HOST_SAMPLING_REQUIRED` when capabilities are missing | Enforces fail-closed capability behavior |
| `invariants.test.ts` | **MERGE-BLOCKER** — `_sdkRunner` identity unchanged before/after scoped MCP run; `setDefaultModelProvider()` spy never fires from MCP code paths | Guards the SWA singleton and additive contract |
| `tool-use-validation.test.ts` | unknown tool name → `E_TOOL_USE_INVALID`; schema-invalid args → `E_TOOL_USE_INVALID`; redacted logging verified | Covers the prompt-injection / confused-deputy surface |
| `model-hints-validation.test.ts` | valid JSON accepted; oversized/invalid input proceeds with no hints; server does not crash | Ensures config robustness and redaction-safe logging |
| CSP regression assertion | verify `kickstart-app.html` keeps strict CSP / origin-validation invariants while Option B lands | Carries forward the webview hardening requirement from prior MCP work |
| SWA Playwright gate | existing `.github/workflows/ci.yml:141-148` remains required on harness-touching PRs | Proves hosted UX still works |

Additional notes:

- The invariant test is a **merge blocker**, not a nice-to-have.
- Parser fallback, if ever enabled in P2, needs separate tests proving default-off behavior and redacted diagnostics.
- Structured-output coverage must include a case where the SDK returns non-string `finalOutput` so the adapter proves it preserves structured output rather than flattening it.

## 12. Human approval gate

### 12.1 Required issue labels before implementation starts

Implementation cannot begin until issue #1044 carries all four labels:

- `leela:approved`
- `zapp:approved`
- `nibbler:approved` (or Ahmed's manual equivalent since Nibbler authored v2/v2.1)
- `human:approved-implementation`

This is intentionally stricter than prose approval in a comment. The labels are the source of truth.

### 12.2 Label-gate workflow spec (binding condition)

New workflow: `.github/workflows/squad-implementation-gate.yml`

**Name:** `Squad Implementation Gate`

**Trigger:**

- `pull_request` on any branch matching `squad/*mcp-apps*`, **or**
- `pull_request` where the PR body references issue `#1044`

**Permissions:**

```yaml
permissions:
  issues: read
  pull-requests: read
```

**Job:** `gate`

Implementation sketch:

1. Use `actions/github-script` to inspect the PR body and resolve the referenced issue (`#1044`).
2. Fetch the issue's current labels.
3. Assert that all required labels are present.
4. Query the issue timeline / labeled events to find who applied `human:approved-implementation`.
5. Reject self-approval if the issue author and the human-approval label applier are the same user.
6. Fail the check with a clear message naming any missing label or invalid self-approval.

Pseudo-flow:

```yaml
name: Squad Implementation Gate
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  gate:
    permissions:
      issues: read
      pull-requests: read
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            // 1. Resolve referenced issue (#1044)
            // 2. Read labels
            // 3. Assert leela/zapp/nibbler/human labels present
            // 4. Read labeled-event timeline for human:approved-implementation
            // 5. Compare issue.user.login to label event sender
            // 6. core.setFailed(...) on any violation
```

Operational requirements:

- status check name must be **`Squad Implementation Gate`**;
- add that check to branch protection on `main`;
- gate must run before merge, not only before dispatch; and
- workflow output should point reviewers back to issue #1044 when the gate fails.

## 13. Open questions

1. **Does VS Code's sampling provider emit progress callbacks we can surface mid-round?**  
   P0 safe default: assume **no** and rely on tool-status events / round completion UI.

2. **If a tool takes longer than the host's sampling timeout, what is the right UX?**  
   Deferred to P1. P0 only needs a clear failure path and resumable semantics.

3. **If the MCP SDK later ships a streaming sampling variant, how do we adopt it without regressing SWA?**  
   Deferred. Any adoption should be additive and benchmarked.

4. ~~Does `createMessage` exist?~~ **CLOSED** — yes. The pinned SDK exposes it directly in `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts:137-155`.

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SWA singleton mutation | High | High | scoped-provider design forbids singleton mutation; `invariants.test.ts` is a **MERGE-BLOCKER** |
| Prompt-injection-driven `tool_use` | Medium | High | allowlist + JSON-schema validation + fail-closed `E_TOOL_USE_INVALID` + redacted logs |
| Parser fallback re-enabled accidentally | Low | Medium | keep fallback opt-in via env var, off by default, explicitly documented as P2 |
| Host does not implement `sampling.tools` | Medium | Medium | capability gate returns `E_HOST_SAMPLING_REQUIRED` with hint and capability snapshot |
| `@openai/agents` version drift between harness and mcp-server | Medium | Medium | declare the same pin (`0.8.4`) in both packages and keep updates synchronized |
| Structured output flattened to text | Medium | High | §3.4 explicitly forbids text-only coercion; translation tests must cover non-string output |
| Approval gate bypass by prose-only review | Low | High | issue-label gate workflow and branch-protection check make labels authoritative |
| Telemetry leakage from invalid payload logging | Low | High | bounded, redacted diagnostics only; no raw prompt/args logging in validation or fallback paths |

## Recommendation

Approve this DP for implementation routing **only after** the v2.1 conditions above are satisfied in issue labels and the implementation PR adopts the merge-blocking invariant tests. The architecture is now correct because it uses the native MCP tools contract, isolates host-managed sampling to the MCP path, and keeps SWA as the untouched default provider route.
