---
sidebar_position: 1
---

# Architecture Overview

Kickstart is a **harness + packs** system. The harness (under `packages/harness/`) is domain-agnostic — it owns the runner, session, registry, guardrail engine, MCP adapter, and SSE plumbing. **Packs** (under `packages/pack-core/`, `packages/pack-azure/`, `packages/pack-aks-automatic/`, `packages/pack-github/`) carry every piece of product knowledge: agents, skills, tools, user actions, components, and guardrail rules.

---

## Layers

| Layer | Where it lives | What it owns |
|---|---|---|
| **Browser SPA** | `packages/web/src/` | A2UI v0.9 renderer, surface management, chat, packs gallery, deploy diary, playground. |
| **API (Azure Functions)** | `packages/web/api/src/functions/` | Per-turn handlers (`converse`, `resume`, `action`, `inspirations`, `playground`, `health`, `packs`, `github-auth`, …). |
| **Harness runtime** | `packages/harness/src/runtime/` | `Runner`, `Session`, `PackRegistry`, `runGuardrails`, `SSEWriter`, schema-conformance, OTel bridge. |
| **MCP adapter** | `packages/harness/src/mcp/` + `packages/mcp-server/` | `buildMcpManifest`, `buildA2UIContent`, `buildInterruptContent`, session mutex, interrupt store. |
| **Packs** | `packages/pack-*/src/` | Agents (`*.agent.md`), skills (`skills/<slug>/SKILL.md`), tools, user actions, components, guardrails, playground scenarios. |

The harness exports its public surface from `packages/harness/src/index.ts` under the package name **`@aks-kickstart/harness`** (not `@kickstart/core`). Packs depend on this barrel; nothing else.

---

## Per-turn data flow

A single `POST /api/converse` request walks the following path. File references are exact.

1. **Functions handler** (`packages/web/api/src/functions/converse.ts`) opens an SSE stream using `SSE_RESPONSE_HEADERS` from `runtime/sse.ts` and emits `start`.
2. **Session lookup or create** via `getOrCreateSession()` (`runtime/session.ts`); anonymous sessions get an `anon_session_token` (10‑minute TTL — `ANON_SESSION_TTL_MS`) and the token is broadcast as the `session_token` SSE event.
3. **Hydration**: cold sessions are rebuilt from the persistent store (`hydrateColdSession`, capped by `HYDRATION_DEFAULT_CAP = 20` turns and `HYDRATION_CONTENT_MAX_BYTES = 4096` per turn).
4. **Runner.run()** (`runtime/runner.ts`) is invoked with the session, user message, an `SSEWriter`, an `AbortSignal`, and an optional `RunConfig` (`runtime/run-config.ts`). The runner wraps `@openai/agents` and is responsible for skill resolution, guardrail wiring, agent handoffs, A2UI emission, and tool-result truncation.
5. **Guardrails** run via `toSdkInputGuardrail` / `toSdkOutputGuardrail` for parallel input/output rules and via the sequential `runGuardrails()` engine for tool-stage rules (`runtime/guardrails.ts`). Verdicts are `pass | block | redact`; SSE only ever sees the opaque shape `{ code: 'GUARDRAIL_BLOCK', message: '…' }` and never a guardrail id, reason, or pattern.
6. **Tools and A2UI**: tool-call results are streamed as `tool_start` / `tool_done`. A2UI emissions queued during the tool call are drained after the LLM tool_call (per the post-tool A2UI drain rule documented at the top of `runner.ts`) and emitted as `a2ui` events.
7. **End**: the runner emits `end` with skill/tool counters; `phase` events fire on agent handoffs; `guardrail_warn` fires on redactions; `chain_step` for the deterministic codesmith→reviewer chain.

The full SSE event taxonomy lives in `packages/harness/src/runtime/sse.ts`:

```
start | chunk | a2ui | tool_start | tool_done | phase |
user_action_req | end | error | session_token | guardrail_warn | chain_step
```

`SSE_EVENT_TYPES` is a `Set` exported alongside, so any writer that adds a new event without updating the taxonomy fails type-check.

---

## Harness + packs registry

The `PackRegistry` (`runtime/registry.ts`) is the integration point. Packs register at startup in a fixed order — `core, azure, aks, github` — and the registry then `seal()`s itself:

- All inter-pack handoff targets are validated; cross-pack handoffs are rejected unless the source pack lists the target in `dependsOn` or `handoffTargets`.
- Playground stubs are snapshotted and frozen; post-seal mutations throw.
- `core/` guardrail ids are reserved for the core pack.

Active packs are filtered from the env var `KICKSTART_PACKS` (comma-separated; defaults to all four).

---

## What the harness deliberately does NOT own

- **No "default registry"**: there is no `defaultRegistry`, `ToolRegistry`, or singleton tool list. Tools are owned by packs and surface via `PackRegistry.getToolsForAgent(name)`.
- **No artifact store**: artifacts live on `Session.artifacts` (a `Map` per session). There is no `InMemoryArtifactStore` import.
- **No phase enum on the runner**: `Phase` is a const object exported from `packages/harness/src/index.ts` (`Discover → Design → Generate → Review → Handoff → Deploy`). The runner emits `phase` events on handoff; phase advancement is owned by agents and `advancePhase()`.

---

## Where to go next

- [Prompt pipeline](./prompt-pipeline.md) — how per-turn instructions are assembled.
- [Harness runtime](./harness-runtime.md) — Runner, session, guardrail, OTel-bridge internals.
- [A2UI integration](./a2ui-integration.md) — the v0.9 envelope, surfaces, and emission discipline.
- [MCP server internals](./mcp-server-internals.md) — manifest, interrupt store, session mutex.
- [Schema conformance](./schema-conformance.md) — strict-mode JSON Schema invariants.
