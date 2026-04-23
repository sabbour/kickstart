---
"@aks-kickstart/api": patch
---

Rebuild the Application Insights telemetry pipeline on pure OpenTelemetry
(`@azure/monitor-opentelemetry`) so requests, dependencies, exceptions and
manual `trackException` / `trackEvent` / `trackTrace` calls actually reach
Azure Monitor. The classic `applicationinsights` SDK is no longer imported
from API code (double `useAzureMonitor()` was wiping the OTel global
provider and killing all telemetry).

- Single init point in `src/lib/appinsights.ts`, guarded by a
  `globalThis`-keyed flag so cross-bundle calls are no-ops.
- `RedactingSpanExporter` (Proxy-based) wraps the Azure Monitor trace
  exporter — strips query strings from `http.url` / `url.full`, runs
  `sanitizeText` on every string attribute, scrubs `exception.message` /
  `exception.stacktrace` from auto-collected spans.
- `RedactingLogRecordProcessor` scrubs `SdkLogRecord.body` and all string
  attributes so the console-bridge path never leaks bearer tokens / JWTs /
  connection strings.
- `flushAppInsights()` awaits tracer + logger + meter `forceFlush()`.
- `packs.ts` 500 response now returns `{ error, requestId }` only — no
  `err.message` leaks.
- esbuild externalizes the OTel / Azure Monitor distro so every bundle in
  the worker process shares one module identity. Post-build guard
  (`scripts/verify-api-externals.mjs`) fails the build if that regresses.
- ESLint `no-restricted-imports` bans `@azure/monitor-opentelemetry` and
  `applicationinsights` from every API file except `src/lib/appinsights.ts`.

Closes #1030.
