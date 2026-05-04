---
sidebar_position: 3
---

# Debugging

Common debugging recipes for the harness, packs, and the SPA. For the App Insights wiring see [Observability](./observability.md); for "why is X broken" symptom→cause tables see [Troubleshooting](./troubleshooting.md).

---

## Live SSE inspection

Every conversation turn produces an SSE stream over `POST /api/converse`. Stream it directly with `curl` and the same JSON envelopes the browser sees:

```bash
curl -N -X POST http://localhost:7071/api/converse \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","sessionId":"dbg-1"}'
```

Useful filters:

```bash
... | grep '^event:'                 # event taxonomy only
... | grep -A1 'event: tool_start'   # tool calls + their first data line
... | grep 'GUARDRAIL_BLOCK'         # guardrail blocks (opaque codes only)
```

The full event taxonomy lives at the top of `packages/harness/src/runtime/sse.ts`.

---

## Recording un-redacted OTel content

In dev (only) set `KICKSTART_OTEL_RECORD_CONTENT=true` and point the API at a local OTel collector. The OTel bridge will attach un-redacted tool args and outputs to spans:

```bash
KICKSTART_OTEL_RECORD_CONTENT=true \
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=…" \
npm --workspace packages/web/api run start
```

In production the toggle is logged as a security warning at boot and content is still redacted regardless.

---

## Disabling guardrails (dev only)

```
KICKSTART_GUARDRAILS_DISABLED=true
```

Bypasses every guardrail at all stages. The API refuses to boot with this flag if `NODE_ENV=production`.

---

## Tracing a tool call

The OTel span tree pinpoints exactly which tool the model invoked and what the guardrail engine decided. From [Observability](./observability.md):

```
harness.runner.run
└─ openai.responses.create
   └─ tool.call <name>
      └─ guardrail.evaluate <id> <verdict>
```

Span attributes: `tool.name`, `tool.args` (redacted), `tool.result_preview` (redacted), `guardrail.id`, `guardrail.verdict`, `agent.name`, `model.id`, `turn`.

---

## Replaying a paused UserAction

If a UserAction stalls because the browser tab closed before resuming, the session is recoverable while the anon token has not expired. Inspect the live session:

```bash
node -e "import('./packages/harness/dist/runtime/session.js').then(m => console.log(m.sessionStore.list().map(s=>({id:s.sessionId,pending:!!s.pendingUserAction}))))"
```

Then `POST /api/converse/resume` with a synthetic result that satisfies the action's `resultSchema` (see [Resume & session token](../agent-authoring/resume-and-session-token.md)). The compare-and-swap on `pendingUserAction` means a duplicate replay safely returns `404`.

---

## Inspecting the sealed registry

`/api/packs` is the safe DTO; `getRegistry()` (server-side) gives the full sealed registry:

```ts
import { getRegistry } from './packages/web/api/dist/startup/packs.js';
const reg = getRegistry();
console.log(reg.toolsByName);          // every registered tool
console.log(reg.guardrailsByStage);    // per-stage guardrail lists
console.log(reg.playgroundScenarios);  // playground inventory
```

Loaded with errors? Use `getLoadErrors()` from the same module — those are surfaced through `/api/packs.loadErrors[]` in production.

---

## Diffing the prompt

To see the exact instructions the LLM received this turn, log inside `Runner.run` *or* enable `KICKSTART_OTEL_RECORD_CONTENT=true` so the assembled `instructions` lands on `harness.runner.run` as an attribute. The skill resolver attaches `harness.skill.resolve` spans with the included skill ids and their cumulative token cost.

---

## Replaying a hydrated session

Cold-rehydration (`hydrateColdSession`, `HYDRATION_DEFAULT_CAP = 20`, `HYDRATION_CONTENT_MAX_BYTES = 4096`) is deterministic. To reproduce a customer issue from logs:

1. Pull the persisted JSON from the session store.
2. Hand it to `hydrateColdSession(rawTurns)` in a local script.
3. Hand the resulting `Session` to `Runner.run` with the next user message.

Anything past turn 20 is intentionally truncated; if your repro needs older turns you must adjust the cap before hydrating.

---

## Diagnosing schema-strict failures

`assertStrictlyConformant()` wraps OpenAI's own error message with the offending tool name. Symptom:

```
[mypack.do_thing] Zod field at `properties/x` uses `.optional()` without `.nullable()`
```

Fix: replace `.optional()` with `strictOptional()` (`runtime/z-strict.ts`) and call `stripNulls(input)` in your `execute()` body if you prefer `undefined` semantics. See [Schema conformance](../architecture/schema-conformance.md).

---

## Useful env vars at a glance

| Variable | Effect |
|---|---|
| `KICKSTART_DEBUG_ALLOWED=true` | Enables the API debug routes. |
| `KICKSTART_GUARDRAILS_DISABLED=true` | Bypass guardrails. Dev only. |
| `KICKSTART_OTEL_RECORD_CONTENT=true` | Un-redact OTel content. Dev only. |
| `KICKSTART_PLAYGROUND=true` | Enable scenario stubs. |
| `HARNESS_ALLOW_ANON_HYDRATION=true` | Cold-rehydrate anon sessions. |
| `KICKSTART_PACKS=core,azure` | Load only the listed packs. |
| `KICKSTART_RUNNER_MAX_TURNS=N` | Hard cap turns per `Runner.run`. |
| `KICKSTART_SESSION_STORE=memory|azure-table` | Pick the session backend. |

The full reference is in [Environment variables](../getting-started/environment-variables.md).
