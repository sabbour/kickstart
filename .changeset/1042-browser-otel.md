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
- Three active Playwright E2E scenarios covering SPA-nav flush (3),
  third-party fetch isolation (4), and CSP smoke under production CSP (5).
  Scenarios covering traceparent propagation (1), mock ingestion + trace-id
  correlation (2), and bearer/query-string redaction on the wire (6) are
  carried in the spec as `test.skip(...)` and deferred to #1094; bodies are
  preserved verbatim so re-enabling is a one-line flip. Phase-1a scope is
  therefore: CSP unblock (Zod v4 `jitless` + `zod/v4` root alias), the
  redacting exporter wiring, and 10% default head sampling.

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
- CSP hardening: Zod v4 ships an `allowsEval` probe (`new Function("")`)
  that fires when the first v4 `z.object` schema is constructed. It reaches
  the web bundle transitively via `openai` + `zod-to-json-schema` (both
  hoisted to the monorepo root, where `zod@4` lives), not via workspace
  pack imports. Fixed without a library swap, version bump, or CSP
  relaxation: `src/lib/configure-zod.ts` calls Zod v4's documented
  `config({ jitless: true })` as the first import in `main.tsx`, and
  `vite.config.ts` aliases `zod/v4` to the root `node_modules/zod/v4`
  install so the mutation targets the exact `globalConfig` singleton the
  bundled v4 code reads. No
  `'unsafe-eval'`, no schema edits, no pack/harness dependency changes.

### Kill switch

Operators flip `WEB_TELEMETRY_BROWSER_ENABLED=false` in Azure Function App
settings. New tabs are disabled instantly; open tabs pick up the flip within
60 seconds.
