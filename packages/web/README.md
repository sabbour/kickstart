# @aks-kickstart/web

The Vite + React Playground app that fronts the AKS Kickstart assistant. This
README documents operational knobs that live in this package; architecture
lives in `docs-site/docs/architecture/`.

## Browser telemetry (issue #1042, DP-D revision 2)

The browser emits OpenTelemetry spans into the same Application Insights
workspace as the server, giving one end-to-end distributed trace from a user
click through `/api/converse` into the harness agent loop.

### SDK stack (Option B)

- `@opentelemetry/sdk-trace-web`
- `@opentelemetry/instrumentation-fetch` (scoped to `/api/*` only)
- `@opentelemetry/context-zone`
- `@azure/monitor-opentelemetry-exporter`
- `BrowserRedactingSpanExporter` — mirrors the server `RedactingSpanExporter`
  and wraps the Azure Monitor exporter. Scrubs `http.url`/`url.full` to path
  only, coarsens `http.user_agent`, strips `tracestate`, and routes every
  string attribute through the shared `sanitizeText` rules.

`@microsoft/applicationinsights-web` is **not** an option — Zapp disqualified
it (dynamic script injection, would require widening CSP with
`unsafe-inline`/`unsafe-eval`).

### Runtime feature flag — `web.telemetry.browser.enabled`

- **Default: `false`.** No telemetry initialization, no network egress.
- **Where it lives:** the Azure Function App setting
  `WEB_TELEMETRY_BROWSER_ENABLED`. Surfaced to the SPA via `GET /api/config`.
- **Kill switch (<60s latency):**
  1. Azure Portal → *Function App* → *Configuration* → *Application settings*.
  2. Set `WEB_TELEMETRY_BROWSER_ENABLED=false` and save (App restarts).
  3. New page loads are disabled instantly; open tabs pick up the flip on the
     next `/api/config` re-fetch (≤60s per the SPA-nav poll).

### Connection-string resolution

The browser resolves the App Insights connection string with this precedence:

1. `window.__appInsightsConnectionString` (runtime — set from `/api/config`'s
   `appInsightsConnectionString` field by the boot loader).
2. `VITE_APPINSIGHTS_CONNECTION_STRING` (build-time fallback — a
   telemetry-only ingestion credential, public by design; documented
   alongside the build output).
3. Empty → telemetry is disabled.

Telemetry must resolve to the **same** App Insights resource as the server's
`APPLICATIONINSIGHTS_CONNECTION_STRING` so browser + server spans land in one
workspace.

### Sampling

Default: **10%** (`TraceIdRatioBasedSampler(0.1)` wrapped by
`ParentBasedSampler`). Configurable per deploy via the
`BrowserTelemetryConfig.samplingRatio` field.

### Bundle budget

Hard cap: **≤100 KB gzipped** delta over the merge-base of `main`. Enforced
by two independent checks in CI:

- `scripts/check-bundle-budget.mjs` (postbuild) — fails if the main entry
  gzipped size exceeds `331 KB` (228 642 baseline + 102 400 budget).
- `npm run size-limit -w @aks-kickstart/web` — the `size-limit` block in
  this package's `package.json`.

### Rollout (3 phases)

1. **Phase 1 — Flag off, default disabled.** Merged with no telemetry
   emitted. This PR.
2. **Phase 2 — Internal canary.** Operators flip the flag for dogfood
   tenants; Zapp spot-checks ingestion.
3. **Phase 3 — GA.** Flag on for all users; all 5 Playwright scenarios
   green; redaction audit signed off.

Rollback = flip the flag to `false`. No redeploy required.
