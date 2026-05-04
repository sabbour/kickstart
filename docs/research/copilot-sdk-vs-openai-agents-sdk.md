# Pros/Cons: `github/copilot-sdk` vs `@openai/agents` in Kickstart

> **Research date:** 2026-05-03  
> **Scope:** `azure-management-and-platforms/kickstart` monorepo  
> **SDK under review:** `github/copilot-sdk` — `@github/copilot-sdk` on npm  
> **Status:** Complete — based on local codebase inspection + public SDK repos

---

## Executive Summary

The kickstart project already uses **`@openai/agents` v0.8.4** as its sole agent orchestration framework, deeply integrated into the 1,796-line `packages/harness/src/runtime/runner.ts`. The **`github/copilot-sdk`** (`@github/copilot-sdk`) is a different kind of tool: instead of being a framework for building agent loops, it is a pre-built agent runtime — it embeds the same engine that powers the Copilot CLI directly into your application via JSON-RPC. **Both SDKs solve the same problem** (agent orchestration) but at different abstraction levels. `@openai/agents` gives you full control of the agent loop; `github/copilot-sdk` delegates that loop to GitHub's production runtime. They can coexist but serve redundant purposes — replacing `@openai/agents` would mean surrendering the entire bespoke harness and rebuilding SSE streaming, A2UI, pack registry, OTel tracing, and structured output. A surgical coexistence path is possible: expose the existing harness agents as custom tools inside a Copilot SDK session.

---

## 1. Current State of the Project

The project is a 9-package npm workspaces monorepo (`package.json` / `package-lock.json`):

| Package | Role |
|---------|------|
| `@aks-kickstart/harness` | Core runtime: Runner, PackRegistry, SSE, guardrails, OTel, MCP sampling |
| `@aks-kickstart/pack-core` | Domain agents (triage, codesmith, reviewer), tools, skills, A2UI components |
| `@aks-kickstart/pack-azure` | Azure-specific agents, tools, user-actions |
| `@aks-kickstart/pack-github` | GitHub publisher agent, auth bridge |
| `@aks-kickstart/pack-aks-automatic` | AKS Automatic agents, tools, skills |
| `@aks-kickstart/api` | Azure Functions backend (SSE API for browser) |
| `@aks-kickstart/web` | React + Vite frontend (Fluent UI, Monaco) |
| `@aks-kickstart/mcp-server` | Standalone MCP server (exposes harness agents via MCP protocol) |
| `@aks-kickstart/sim-test` | Sim-as-regression-test harness — parser, scorer, CLI runner for sim transcripts |

**Current SDK dependencies:**[^1]

- **`@openai/agents@0.8.4`** — pinned in harness; `^0.8.4` in all packs
- **`@modelcontextprotocol/sdk@^1.12.1`** — in `mcp-server` only
- **No Copilot SDK** — zero references to `@github/copilot-sdk` confirmed

### How `@openai/agents` is used today

The harness wraps `@openai/agents` at every layer:[^2]

```typescript
// packages/harness/src/runtime/runner.ts:15
import {
  Agent, Runner as SDKRunner, handoff, tool,
  setDefaultModelProvider, setTraceProcessors,
  MaxTurnsExceededError, InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
} from '@openai/agents';
```

Key integrations:
- `Agent` + `SDKRunner.run()` — execution core for every turn
- `handoff()` / `tool()` — multi-agent routing and tool definitions
- `InputGuardrail` / `OutputGuardrail` — safety pipeline (parallel execution)
- `TracingProcessor` interface — custom OTel bridge to Azure Monitor
- `ModelProvider` / `Model` — Azure OpenAI + MCP sampling adapters
- `AgentInputItem[]` / `RunContext` — session and context threading
- `outputType: AgentOutput` (Zod schema) — structured JSON output from every agent

---

## 2. `github/copilot-sdk` — What It Actually Is

### Overview

`github/copilot-sdk` is a **multi-language agent runtime embedding SDK** that exposes the same production engine powering the GitHub Copilot CLI as a programmable library.[^3]

```
Your Application
      ↓
  CopilotClient (SDK)
      ↓  JSON-RPC over stdio/TCP
  @github/copilot CLI (spawned as subprocess, bundled in npm package)
      ↓
  Copilot Agent Runtime
  (planning, tool invocation, file edits, context compaction, MCP…)
```

**Install:** `npm install @github/copilot-sdk`  
**npm package:** `@github/copilot-sdk` (`@github/copilot-sdk/extension` for CLI extensions)  
**Version:** `0.3.0` (latest); `0.1.8` in source tree  
**Status:** Public preview — breaking changes possible  
**Languages:** TypeScript/Node.js, Python, Go, .NET, Java  
**Repo:** `github.com/github/copilot-sdk`[^4]

### Core concept

You don't build an agent from scratch. You control a pre-built, production-grade agent runtime. The CLI handles all LLM orchestration, tool call routing, retries, infinite context compaction, and multi-agent delegation.[^5]

### What it provides

| Feature | Description |
|---------|-------------|
| **`CopilotClient`** | Spawns/connects to CLI subprocess, manages sessions via JSON-RPC |
| **`CopilotSession`** | Sends prompts, subscribes to 40+ streaming events, abort |
| **`defineTool()`** | Type-safe custom tool definitions with Zod schema inference |
| **Custom agents** | Named sub-agents with scoped tool sets and system prompts |
| **Hooks** | `onPreToolUse`, `onPostToolUse`, `onUserPromptSubmitted`, `onSessionStart`, `onSessionEnd`, `onErrorOccurred` |
| **MCP servers** | Stdio and HTTP MCP servers per session, or auto-discovered from `.mcp.json` |
| **BYOK** | OpenAI, Azure OpenAI, Anthropic, Ollama — no GitHub auth required |
| **Session persistence** | Resume sessions across restarts |
| **Infinite sessions** | Automatic context compaction for long-running sessions |
| **OTel / telemetry** | OTLP endpoint, JSON-lines file export, W3C trace propagation |
| **Elicitation UI** | `session.ui.confirm()`, `.select()`, `.input()` for interactive flows |
| **Skills** | Load reusable prompt modules from directories |
| **Permission system** | `onPermissionRequest` gates: shell, write, mcp, read, url, custom-tool, memory, hook |

### Core API

```typescript
import { CopilotClient, defineTool } from "@github/copilot-sdk";
import { z } from "zod";

// Define a custom tool
const myTool = defineTool("lookup_fact", {
  description: "Returns a fact about a topic",
  parameters: z.object({ topic: z.string() }),
  handler: ({ topic }) => facts[topic] ?? `No fact for ${topic}.`,
});

// Start the runtime
const client = new CopilotClient({ logLevel: "info" });
await client.start();

// Create a session
const session = await client.createSession({
  model: "gpt-5.4",
  tools: [myTool],
  onPermissionRequest: async () => ({ kind: "approved" }),
});

// Stream events
session.on((event) => console.log(`[${event.type}]`, event.data));

// Send a prompt and await completion
const result = await session.sendAndWait({ prompt: "Analyze this repo" });
console.log(result?.data.content);

await session.disconnect();
await client.stop();
```[^6]

### Custom / sub-agents

The SDK supports declaring named sub-agents. The Copilot runtime automatically delegates to them:[^7]

```typescript
const session = await client.createSession({
  customAgents: [
    {
      name: "researcher",
      description: "Explores codebases using read-only tools",
      tools: ["grep", "glob", "view"],
      prompt: "You are a research assistant. Do not modify files.",
    },
    {
      name: "editor",
      description: "Makes targeted code changes",
      tools: ["view", "edit", "bash"],
      prompt: "You are a code editor. Make minimal surgical changes.",
    },
  ],
  onPermissionRequest: async () => ({ kind: "approved" }),
});
```

### BYOK (Azure OpenAI / Anthropic / Ollama)

No GitHub subscription required in BYOK mode:[^8]

```typescript
const session = await client.createSession({
  provider: {
    type: "azure",
    baseUrl: "https://my-resource.openai.azure.com",
    apiKey: process.env.AZURE_OPENAI_KEY,
    azure: { apiVersion: "2024-10-21" },
  },
  onPermissionRequest: async () => ({ kind: "approved" }),
});
```

---

## 3. `@openai/agents` — Current Stack

### What it is

A **TypeScript multi-agent orchestration framework** — you build and control the agent loop.[^9]

**Install:** `npm install @openai/agents zod`  
**Version in project:** `0.8.4` (latest public: `0.8.5`)  
**Repo:** `github.com/openai/openai-agents-js`

### Architecture (in the project)

```
PackRegistry (sealed at startup)
    │  pack-core, pack-azure, pack-github, pack-aks-automatic
    │  agents (from .agent.md frontmatter), tools, guardrails, components
    ▼
Runner.run(session, message, sseWrite)
    │  buildAgentInstance() → @openai/agents Agent + handoffs + tools
    │  SDKRunner.run(agent, input, { stream: true })
    │  for await event → SSE events to browser
    ▼
Azure OpenAI (via OpenAIProvider) or MCP sampling (via McpSamplingProvider)
```

---

## 4. Head-to-Head Comparison

| Dimension | `github/copilot-sdk` | `@openai/agents` |
|-----------|---------------------|-----------------|
| **Abstraction level** | High — pre-built runtime, you configure | Low — framework, you build the loop |
| **Orchestration ownership** | Copilot CLI owns the agent loop | You own the agent loop (harness/runner.ts) |
| **Multi-agent patterns** | ✅ Custom agents with auto-delegation by CLI | ✅ Handoffs, agent-as-tool, parallel, deterministic |
| **Tool calling** | ✅ `defineTool()` with Zod, permission system | ✅ `tool()` with Zod, `FunctionTool`, guardrail wrappers |
| **Streaming** | ✅ 40+ event types via JSON-RPC | ✅ Full event stream via SDK + custom SSE mapping |
| **Custom streaming events** | ❌ Fixed event vocabulary (cannot add `a2ui`, `user_action_req`) | ✅ Harness adds `a2ui`, `user_action_req`, `phase`, `chain_step`, etc. |
| **Model providers** | ✅ BYOK: Azure, Anthropic, Ollama, OpenAI | ✅ Azure, Anthropic, Google, any AI SDK model |
| **Azure OpenAI** | ✅ BYOK via `provider.type = "azure"` | ✅ `OpenAIProvider` with `AZURE_OPENAI_ENDPOINT` |
| **Guardrails** | ⚠️ `onPreToolUse` / `onPostToolUse` hooks only | ✅ Input/output/tool-stage guardrails, parallel execution |
| **Structured output** | ❌ No forced JSON schema on agent output | ✅ `outputType: AgentOutput` (Zod schema) per-agent |
| **A2UI components** | ❌ None — text responses only | ✅ Full A2UI rich components (Wizard, Scorecard, etc.) |
| **Session management** | ✅ Built-in persistence + infinite sessions | ⚠️ `MemorySession` built in; Azure Table Storage custom |
| **Infinite context** | ✅ Automatic context compaction | ❌ Manual token budget management (80% threshold trim) |
| **MCP integration** | ✅ Per-session MCP servers, auto-discovery | ✅ `mcpServers` on Agent; MCP server as alternate entry point |
| **OTel / tracing** | ✅ OTLP endpoint, W3C trace propagation | ✅ Custom `OtelBridgeTraceProcessor` → Azure App Insights |
| **Pack / plugin system** | ❌ No registry/pack concept | ✅ `PackRegistry` — packs, tools, skills, components all managed |
| **SSE to browser** | ❌ JSON-RPC to your app; SSE adapter is your job | ✅ 12 SSE event types, full browser streaming built-in |
| **User action interrupts** | ❌ No built-in user-confirmation workflow | ✅ `user_action_req` SSE → browser confirm → `/resume` |
| **Control / customization** | ⚠️ Limited — CLI owns the loop internals | ✅ Full control (runner.ts is 1,796 lines of your code) |
| **Status** | Public preview — breaking changes possible | Production-stable |
| **CLI subprocess overhead** | ❌ JSON-RPC + subprocess (latency, process management) | ✅ In-process, no subprocess |

---

## 5. Pros of Switching to `github/copilot-sdk`

| Pro | Detail |
|-----|--------|
| **No orchestration code to write** | The Copilot runtime handles planning, tool routing, retries, context management — you don't maintain a 1,796-line runner[^10] |
| **Infinite context compaction** | Automatic — you don't need to manage the 128K token window manually |
| **Multi-language** | Expands beyond Node.js to Python, Go, .NET, Java |
| **Hooks system** | `onPreToolUse` / `onPostToolUse` provide auditing and control without building a guardrail pipeline |
| **Session persistence built-in** | Resume sessions without Azure Table Storage custom implementation |
| **BYOK parity** | Same Azure OpenAI support the project currently uses |
| **Copilot-CLI parity** | Same runtime as VS Code Copilot — benefits from all future GitHub improvements automatically |
| **CLI Extensions** | `@github/copilot-sdk/extension` allows lightweight tool injection into existing Copilot CLI sessions |

---

## 6. Cons of Switching to `github/copilot-sdk`

| Con | Detail |
|-----|--------|
| **Lose all custom harness features** | Runner.ts, PackRegistry, SSE streaming, A2UI components, user-action interrupts, structured output, OTel bridge — all gone; must rebuild from scratch |
| **No A2UI rich components** | The Copilot SDK emits text only — no Wizard blades, CompatibilityScorecard, Azure deploy actions |
| **No structured JSON output** | Cannot enforce `outputType: AgentOutput` Zod schema; agents produce text |
| **No custom SSE events** | The project's `a2ui`, `user_action_req`, `phase`, `chain_step`, `guardrail_warn` events do not exist in the SDK vocabulary |
| **Limited guardrails** | Only `onPreToolUse` / `onPostToolUse` hooks — no parallel input/output guardrail pipeline, no schema-enforced safety |
| **subprocess overhead** | JSON-RPC over stdio adds latency vs. in-process `@openai/agents`; subprocess must be managed (start/stop, health checks) |
| **Black-box orchestration** | The CLI owns the agent loop; you cannot customize handoff logic, input filtering, or per-handoff context |
| **No pack system** | No equivalent of `PackRegistry` — cannot plug in domain-specific packs (pack-azure, pack-aks-automatic) with their tools, skills, and components |
| **Preview stability** | `v0.3.0` — explicitly not stable; breaking changes between preview versions |
| **Node.js 20+ required** | Matches project, but the CLI subprocess adds a second Node.js process lifecycle to manage |
| **Azure Functions friction** | Spawning a CLI subprocess inside an Azure Function is non-trivial (cold start, process limits, side-car vs. singleton patterns) |

---

## 7. Can They Coexist?

**Yes — but redundantly.** Both orchestrate agents. Running both creates two independent agent loops with no natural bridge.

### Pattern A — Wrap harness agents as Copilot SDK tools (additive)

The cleanest coexistence: expose existing harness agents as `defineTool()` entries inside a Copilot SDK session. Copilot CLI decides when to invoke them; the harness executes the actual work.

```typescript
import { CopilotClient, defineTool } from "@github/copilot-sdk";
import { runner } from "@aks-kickstart/harness"; // existing harness

const aksTriageTool = defineTool("aks_triage", {
  description: "Analyze an AKS cluster configuration for migration readiness",
  parameters: z.object({ clusterConfig: z.string() }),
  handler: async ({ clusterConfig }) => {
    const result = await runner.runSync("core.triage", clusterConfig);
    return result.output;
  },
});

const session = await client.createSession({
  tools: [aksTriageTool],
  onPermissionRequest: async () => ({ kind: "approved" }),
});
```

**What this gives you:** Copilot CLI as the user-facing conversational layer; harness agents as domain-specific tools it can invoke.  
**What you lose:** A2UI rich components, structured output, SSE streaming to browser (Copilot SDK returns JSON-RPC events, not SSE).

### Pattern B — Use Copilot SDK as an alternate provider (parallel)

Keep the existing harness for the Azure Functions + browser path. Add Copilot SDK as a separate entry point for CLI or notebook use cases.

```
Browser → Azure Functions → harness (Runner + @openai/agents) → Azure OpenAI
CLI     → CopilotClient  → Copilot CLI subprocess              → BYOK/GitHub
```

**What this gives you:** Two independent surfaces, each optimized for its environment.  
**Complexity:** Two agent systems to maintain, potentially diverging behavior.

### What coexistence does NOT solve

- A2UI components don't exist in the Copilot SDK output model — they'd be lost in CLI path
- The pack system (pack-azure, pack-aks-automatic) would need to be re-registered as Copilot SDK tools
- Session state is not shared between the two paths — a user starting via CLI cannot continue via browser

---

## 8. Recommendation

| Scenario | Recommendation |
|----------|---------------|
| **Status quo — no CLI embedding needed** | Keep `@openai/agents` only. The harness is deeply invested; no migration benefit. |
| **Want Copilot CLI session embedding** | Wrap harness agents as `defineTool()` entries (Pattern A). Additive, no replacement. |
| **Replace `@openai/agents` with Copilot SDK** | ❌ **Do not do this.** You would lose PackRegistry, A2UI, structured output, SSE streaming, OTel, user-action interrupts, and all guardrail logic. Estimated rebuild: months. |
| **Add CLI-native surface alongside browser app** | Pattern B: parallel systems. Acceptable if clearly separated by surface. |
| **Reduce orchestration maintenance burden** | The Copilot SDK would reduce that burden — but only by giving up fine-grained control. The harness exists precisely because that control is valuable (A2UI, structured output, custom events). Evaluate whether you actually need those features before switching. |

**Bottom line:** `github/copilot-sdk` and `@openai/agents` both orchestrate agents. The Copilot SDK is higher-abstraction and lower-maintenance; `@openai/agents` gives you full control. The project has built significant value on top of that control (harness features). **Do not replace `@openai/agents` unless you're willing to discard those harness features.** If you want Copilot SDK, add it as a thin CLI-facing surface and keep the harness for the browser path.

---

## 9. Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| Project uses `@openai/agents@0.8.4` exclusively | **High** | Direct dep read from package.json files |
| `@github/copilot-sdk` is not currently used | **High** | Local grep + source inspection: 0 matches |
| Copilot SDK communicates via JSON-RPC with CLI subprocess | **High** | `nodejs/package.json` deps + README architecture diagram[^11] |
| BYOK supports Azure OpenAI | **High** | `docs/auth/byok.md` and `types.ts` ProviderConfig[^12] |
| Copilot SDK is public preview | **High** | README + npm dist-tag `prerelease` |
| Harness cannot emit A2UI events via Copilot SDK | **High** | SDK event vocabulary is fixed; no `a2ui` event type |
| Pattern A (tool wrapping) is feasible | **Medium** | Architecturally clean, but async/streaming mismatch needs validation |
| Subprocess overhead is significant in Azure Functions | **Medium** | General knowledge of Azure Functions process limits; not benchmarked |

---

## Key Repositories

| Repo | URL |
|------|-----|
| `github/copilot-sdk` (main) | https://github.com/github/copilot-sdk |
| `github/copilot-sdk-java` | https://github.com/github/copilot-sdk-java |
| `github/awesome-copilot` (examples) | https://github.com/github/awesome-copilot |
| OpenAI Agents JS SDK | https://github.com/openai/openai-agents-js |

---

## Footnotes

[^1]: `packages/harness/package.json:94`, `packages/pack-core/package.json`, `packages/mcp-server/package.json:18`

[^2]: `packages/harness/src/runtime/runner.ts:15-80` — all `@openai/agents` imports

[^3]: `github/copilot-sdk:README.md` — "Embed Copilot's agentic workflows in your application"

[^4]: `github/copilot-sdk:nodejs/package.json` — `name: "@github/copilot-sdk"`, `version: "0.1.8"` (npm latest: `0.3.0`)

[^5]: `github/copilot-sdk:README.md` (Architecture section) — JSON-RPC diagram

[^6]: `github/copilot-sdk:nodejs/examples/basic-example.ts:1-40`

[^7]: `github/copilot-sdk:docs/features/custom-agents.md:29-59`

[^8]: `github/copilot-sdk:nodejs/src/types.ts:1444-1489`; `docs/auth/byok.md:1-60`

[^9]: `openai/openai-agents-js:README.md` + `packages/agents/package.json` (v0.8.5)

[^10]: `github/copilot-sdk:README.md` — "No need to build your own orchestration"

[^11]: `github/copilot-sdk:nodejs/package.json` — dep on `@github/copilot@^1.0.40` (bundled CLI), `vscode-jsonrpc@^8.2.1`

[^12]: `github/copilot-sdk:nodejs/src/types.ts:1444-1489` — `ProviderConfig` with `type: "azure"` field
