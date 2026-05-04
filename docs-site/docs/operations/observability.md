---
sidebar_position: 1
---

# Observability

Kickstart's deployed API forwards traces, logs, and metrics to **Application Insights** via `@azure/monitor-opentelemetry`. The harness layers an additional tracer on top — the **OTel bridge** — that captures `@openai/agents` SDK events as OpenTelemetry spans with content-redacted attributes.

---

## App Insights wiring

Initialised in the API bootstrap (`packages/web/api/src/lib/appinsights.ts`):

- `APPLICATIONINSIGHTS_CONNECTION_STRING` — server-side connection string.
- `BROWSER_APPLICATIONINSIGHTS_CONNECTION_STRING` — separate browser-side string surfaced to the SPA bootstrap.
- `WEB_TELEMETRY_BROWSER_ENABLED=true` — opt-in to browser SDK ingestion.

Each Functions handler imports `Logger`, `extractTraceId`, `trackException`, and `flushAppInsights` from `lib/logger.ts` / `lib/appinsights.ts`. Trace ids extracted from the inbound headers (`extractTraceId(req)`) flow through SSE and span attributes so a single `traceId` correlates the browser session, the API call, the SDK trace, and downstream Azure SDK spans.

For the deployed App Insights URL conventions and dashboard layout, see [Browser telemetry](./browser-telemetry.md).

---

## OTel bridge — `runtime/agents-otel-bridge.ts`

`OtelBridgeTraceProcessor` adapts the SDK trace stream to OpenTelemetry. For every SDK span (turn, tool call, guardrail evaluation, handoff) it:

1. Opens an OTel span with `kind = SpanKind.INTERNAL`.
2. Pulls structured attributes (model, tool name, agent name, turn number) from the SDK event payload.
3. Redacts content-bearing attributes through `redact.ts` before they are recorded.
4. Closes the span with `Status.OK` or `Status.ERROR` based on the SDK outcome.

The bridge is wired into the runner once at boot — there is no per-request setup.

### `KICKSTART_OTEL_RECORD_CONTENT`

Setting `KICKSTART_OTEL_RECORD_CONTENT=true` bypasses redaction for content attributes (tool args, tool outputs, model deltas). **Development only.** In any deployment with `NODE_ENV=production` the env var is logged as a security warning at boot and the content is still redacted — production never trusts the toggle.

---

## Redaction — `runtime/redact.ts`

A small regex-based redactor with a fixed pattern set:

- Bearer tokens, Azure AD tokens, GitHub tokens, ARM connection strings.
- Email addresses (`no_pii_in_logs` guardrail mirror).
- Generic `***SECRET***` patterns surfaced by integrations.

Redaction runs before any content attribute reaches an OTel span or an App Insights `trackTrace`. The function is pure — `redact(input: string): string` — so it composes with `sanitize-error.ts`.

---

## Sanitised errors — `runtime/sanitize-error.ts`

`sanitizeError(err)` strips:

- Stack frames pointing inside `/node_modules/`.
- Any string property matching the `redact.ts` patterns.
- Inner `cause` chains (recursively sanitised).

Functions handlers route every thrown error through `sanitizeError` before logging or surfacing. SSE `error` frames are independently opaque (`{ code: 'GUARDRAIL_BLOCK' }` for guardrail rejections; opaque `INTERNAL_ERROR` codes elsewhere). The full sanitised error lives only in App Insights.

---

## Span layout

A single `/api/converse` turn produces this span tree:

```
HTTP POST /api/converse                           (Functions auto-instrumented)
└─ harness.runner.run                             (OtelBridge)
   ├─ harness.skill.resolve
   ├─ harness.guardrail.input                    (parallel SDK adapter)
   │  └─ guardrail.evaluate <id> <verdict>
   ├─ openai.responses.create                     (one per SDK iteration)
   │  ├─ tool.call <name>
   │  │  └─ guardrail.evaluate <id> <verdict>     (tool stage, sequential)
   │  └─ harness.a2ui.drain
   ├─ harness.guardrail.output                    (parallel SDK adapter)
   └─ harness.handoff <from→to>                   (only on transfer)
```

Every span carries: `session.id`, `session.user.oid` (hashed), `agent.name`, `phase`, `model.id`, `turn`. Guardrail spans carry verdict + redacted reason; tool spans carry tool name + (redacted) args and result preview.

---

## SSE telemetry

The SSE event stream is *not* an observability channel — it's a UI transport. Server-side logging happens in parallel:

| SSE event | App Insights signal |
|---|---|
| `start` / `end` | `RequestTelemetry` (Functions auto) + custom event `harness.turn` |
| `tool_start` / `tool_done` | `DependencyTelemetry` `Tool` |
| `phase` | custom event `harness.handoff` |
| `error` | `ExceptionTelemetry` (sanitised) |
| `guardrail_warn` | custom event `guardrail.redact` |
| `chain_step` | custom event `harness.chain` |

This duality means an operator can debug a session via App Insights without ever needing the browser-visible SSE.

---

## Local debugging

- Use `KICKSTART_OTEL_RECORD_CONTENT=true` and a local OTel collector to inspect un-redacted content.
- The MCP server (`packages/mcp-server/`) emits the same OTel spans over its stdio transport — point a collector at it for VS-Code-side debugging.
- See [Debugging](./debugging.md) and [Troubleshooting](./troubleshooting.md) for scenario-specific runbooks.
