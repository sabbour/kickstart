# Decision — Application Insights auto-instrumentation via Azure Monitor OpenTelemetry distro

**Date:** 2026-04-20
**Author:** Bender (Backend Dev)
**Scope:** `packages/web/api/` (API layer)
**Related issues:** #940 (closes), #942 (stays open — infra-side)

## Decision
Adopt `@azure/monitor-opentelemetry` alongside the existing classic `applicationinsights@^3.14.0` SDK.

- **OTel distro owns auto-collection** — outbound HTTP (undici/`fetch`, the class of calls the classic SDK misses), incoming HTTP requests, exceptions, console-log bridge.
- **Classic SDK retains only custom `trackEvent`/`trackException`/`trackTrace` call sites.** Its auto-collection (`setAutoCollectRequests/Dependencies/Exceptions`) is **explicitly disabled** to prevent double-counting.
- **Eager init at module load** of `packages/web/api/src/lib/appinsights.ts` via a side-effect block, so OTel instruments the global `fetch` before any handler issues a request.

## Why
The classic `applicationinsights` SDK's auto-collection relies on `diagnostic-channel` to patch Node's `http`/`https` modules. It does **not** patch `undici` or global `fetch` (Node 18+ runtime default). The `@openai/agents` SDK issues its outbound calls through global `fetch`, so every call to Azure OpenAI was invisible to our dependency telemetry — this was the root cause of the 2-day debug on PR #933 (Leela's audit trail).

`@azure/monitor-opentelemetry` uses the official OpenTelemetry Node auto-instrumentations, which include `@opentelemetry/instrumentation-undici` — closing the gap.

## Consequences
- **Bundle size:** +~300–400 KB per bundled function after minification. Acceptable (well under SWA caps).
- **Cold start:** +50–150 ms one-time for OTel SDK bootstrap. Negligible vs existing pack-registry-seal cost.
- **No portal double-counting:** classic auto-collection is disabled; OTel is the sole auto-telemetry source.
- **Rollback path:** unset `APPLICATIONINSIGHTS_CONNECTION_STRING` → both SDKs become no-ops.
- **Infra dependency (#942):** code is ready; lighting up the portal view requires the Bicep resource to be provisioned.

## What this closes
- **#940** — yes. Auto-instrumentation surfaces resolved URL, status, and duration for every LLM call without any runner-side code change.

## What it does NOT close
- **#942** — Bicep-side provisioning is Fry/Nibbler's lane; leaving open.
- **#941** — `/health` end-to-end LLM ping. Separate concern.
- **#943** — Model name in SSE stream. Separate concern.

## Alternatives rejected
- *Enable auto-collection on the existing classic SDK* — does not solve the problem; classic does not instrument `undici`/`fetch`.
- *Migrate fully off the classic SDK* — touches every `trackEvent`/`trackException` call site; larger blast radius with no marginal observability benefit. Viable future cleanup.
