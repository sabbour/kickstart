---
"@aks-kickstart/web": minor
---

Browser-side OpenTelemetry tracing (Phase 1, flag-gated, default-disabled) —
#1042, DP-D revision 2.

Introduces the browser half of the end-to-end distributed trace. When
operators flip the `web.telemetry.browser.enabled` flag, the Playground now
starts a browser span per user action and propagates `traceparent` on the
outbound `/api/*` fetch, so server spans (harness agent loop, LLM, tool calls)
inherit the browser's trace context and land in the same App Insights
workspace under one trace id.

### What changed

- New `BrowserRedactingSpanExporter` that wraps the Azure Monitor exporter
  and mirrors the server-side `RedactingSpanExporter`: strips query +
  fragment from `http.url`/`url.full`, coarsens `http.user_agent` to browser
  family, strips `tracestate`, and runs every string attribute through the
  shared `sanitizeText` rule set.
- New `GET /api/config` Azure Function returning the feature flag and the
  App Insights connection string; anonymous route, 30s cache. The browser
  init checks `window.__appInsightsConnectionString` first, then falls back
  to `VITE_APPINSIGHTS_CONNECTION_STRING`.
- `FetchInstrumentation` scoped to `/api/*` only — third-party fetches never
  receive `traceparent` and never produce spans. Default sampling 10%.
- `W3CTraceContextPropagator` configured for `traceparent` only;
  `tracestate` propagation disabled.
- Five Playwright E2E scenarios covering traceparent propagation, ingestion
  assertion, redaction, SPA-nav flush, and third-party isolation.

### Guardrails

- Flag defaults to `false`. No telemetry emitted without an explicit opt-in.
- `BrowserRedactingSpanExporter` unit-tested against the full Zapp scrub
  table.
- Bundle-size delta enforced in CI via both
  `scripts/check-bundle-budget.mjs` and `size-limit`. Landing delta ≈78 KB
  gzipped — inside the ≤100 KB hard budget.
- CSP updated in `staticwebapp.config.json`: `connect-src` allow-lists the
  App Insights ingestion endpoint. `script-src 'self'` unchanged.
  `@microsoft/applicationinsights-web` is explicitly disqualified (would
  require `unsafe-inline`).
- Any init failure is swallowed so telemetry can never break app boot.
- CSP hardening: `packages/pack-*` declare `zod@^4` while `packages/web` is
  pinned to `zod@^3`; pack client renderers therefore drag Zod v4's module
  graph into the boot bundle, where v4's `allowsEval` probe (`new Function("")`)
  trips `script-src 'self'`. Fixed without a library swap, version bump, or
  CSP relaxation by (a) dynamic-importing `registerPackComponents` from
  `main.tsx` and routing `/node_modules/zod/v4/` to a dedicated
  `vendor-zod-v4` manual chunk so v4 is no longer in the boot preload
  payload, and (b) calling Zod v4's documented `config({ jitless: true })`
  via `src/lib/configure-zod.ts` (first import in `main.tsx`) so the `new
  Function` probe never runs. The Playwright CSP smoke scenario now boots
  under the production `script-src 'self'` with zero violations.

### Kill switch

Operators flip `WEB_TELEMETRY_BROWSER_ENABLED=false` in Azure Function App
settings. New tabs are disabled instantly; open tabs pick up the flip within
60 seconds.
