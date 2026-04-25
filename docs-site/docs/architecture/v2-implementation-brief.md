---
title: Browser telemetry (v2 implementation brief)
---

# Browser telemetry

> Companion to the server-side observability docs. Source of truth for the
> design is the **DP-D revision 2** comment on
> [issue #1042](https://github.com/azure-management-and-platforms/kickstart/issues/1042).

## Goal

One distributed trace in Application Insights that spans `[Browser click] →
fetch /api/converse → converse handler → agent loop → LLM/tool spans`. Before
this feature, the browser was uninstrumented and `/api/converse` arrived as a
root span with no link to the user action that produced it.

## SDK stack — Option B only

`@microsoft/applicationinsights-web` (Option A) is **disqualified** (Zapp
Decision 1): dynamic script injection would require widening CSP with
`unsafe-inline` / `unsafe-eval`.

- `@opentelemetry/sdk-trace-web`
- `@opentelemetry/instrumentation-fetch` — scoped to `/api/*` only
  (`ignoreUrls: [/^(?!.*\/api\/).*/]`)
- `@azure/monitor-opentelemetry-exporter`
- `BrowserRedactingSpanExporter` (new — mirrors the server-side
  `RedactingSpanExporter`, wraps the Azure Monitor exporter)

## Redaction (Zapp Decision 3, verbatim)

| Attribute | Scrub action |
| --- | --- |
| `http.url` / `url.full` | Strip query + fragment, path only |
| `http.user_agent` | Coarse browser family only (e.g. `Chrome`) |
| any string containing token/key/secret/password/auth/bearer | `[REDACTED]` via `sanitizeText` |
| `exception.message` / stack first line | Run through `sanitizeText` |
| `tracestate` | Stripped from `spanContext()` before export |

## Propagation

- `W3CTraceContextPropagator` configured for `traceparent` only; `tracestate`
  is not propagated.
- `FetchInstrumentation` allow-lists `/api/*` — third-party fetches (CDN,
  auth, external APIs) never receive `traceparent` and never produce spans.

## Feature flag — `web.telemetry.browser.enabled`

- Defaults to `false` in every environment.
- Served from `GET /api/config` as `featureFlags["web.telemetry.browser.enabled"]`.
- Backed by the Azure Function App setting `WEB_TELEMETRY_BROWSER_ENABLED`.
- Kill-switch latency ≤60s (SPA-nav re-fetch + 30s client cache).

## Connection-string delivery

Dual path, precedence:

1. `window.__appInsightsConnectionString` (runtime — key-rotation escape
   hatch).
2. `import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING` (build-time fallback;
   telemetry-only ingestion credential, public by design).

Both resolve to the same workspace as the server's
`APPLICATIONINSIGHTS_CONNECTION_STRING` so browser + server spans correlate.

## Sampling

Default: 10% `TraceIdRatioBasedSampler` (wrapped by `ParentBasedSampler` so
server-initiated parent spans are honoured).

## Bundle budget

Hard: ≤100 KB gzipped delta over `main`. Enforced by both the legacy
`scripts/check-bundle-budget.mjs` ceiling and the `size-limit` block in
`packages/web/package.json`. Measured delta at initial landing: ~78 KB
gzipped.

## 3-phase canary rollout

### Phase 1 — flag-behind, default-disabled

- Code merges with `web.telemetry.browser.enabled = false`.
- Bundle budget check green in CI.
- No telemetry emitted in any environment.
- **This PR ships Phase 1 only.**

### Phase 2 — internal canary

- Flag enabled for dogfood tenants / internal deploy slot.
- End-to-end distributed trace validated on ≥10 real sessions.
- Zapp spot-checks ≥20 spans for redaction correctness.
- Gate to Phase 3: zero CSP violations, zero redaction leaks, kill-switch
  rehearsal signed off.

### Phase 3 — GA

- Flag enabled for all users.
- All 6 Playwright scenarios green (scenarios 1/2/6 deferred to #1094 in
  Phase 1a must be re-enabled and passing before GA).
- Redaction audit on a sampled week of ingestion.
- IP anonymization verified on the App Insights resource.

### Rollback

Flip the flag to `false` — no redeploy. Active tabs stop emitting within
60 seconds; new loads are instant. Code removal is a separate, additive
change (revert the init call in `main.tsx` and delete
`browser-appinsights.ts`).

## CSP

`staticwebapp.config.json` `connect-src` must include the App Insights
ingestion endpoint for the configured region. Current allow-list:

```
connect-src 'self' https://*.openai.azure.com
  https://*.applicationinsights.azure.com
  https://*.in.applicationinsights.azure.com
  https://*.livediagnostics.monitor.azure.com
```

`script-src 'self'` remains unchanged. No `unsafe-inline`, no `unsafe-eval`.
