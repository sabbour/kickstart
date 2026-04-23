# Observability contract — `@aks-kickstart/api`

This file is a **binding contract** for how the API Functions worker reports
telemetry to Application Insights. It exists because issue #1030 caused a
complete production telemetry blackout for ~45 min during the #1027 outage
and we never want to repeat the root causes.

## Init contract

1. `useAzureMonitor()` is called **exactly once per worker process**.
2. The **only** module in the API package that imports
   `@azure/monitor-opentelemetry` is `src/lib/appinsights.ts`. This is
   enforced by an ESLint `no-restricted-imports` rule in `eslint.config.js`.
3. The **classic `applicationinsights` SDK is banned** in API code (same
   ESLint rule). All manual telemetry flows through pure
   `@opentelemetry/api` / `@opentelemetry/api-logs` so it shares the same
   tracer/logger provider as auto-collected telemetry.

## Bundling contract

- OTel / Azure Monitor packages (`@azure/monitor-opentelemetry`,
  `@azure/monitor-opentelemetry-exporter`, `@opentelemetry/api`,
  `@opentelemetry/api-logs`, etc.) are **bundled inline** by esbuild into
  each function bundle. Only `@azure/functions-core` remains external
  (it is a virtual module injected by the Functions worker).
- The `@opentelemetry/api` package stores its provider registry on
  `globalThis[Symbol.for('opentelemetry.js.api.1')]`. Multiple bundled
  copies of the package in the same worker process all read/write the same
  `globalThis` slot — there is no provider wipeout from multiple copies.
  This is the canonical OTel singleton mechanism.
- `scripts/verify-api-externals.mjs` runs after every `npm run build` and
  fails the build if any package other than `@azure/functions-core` is
  marked external, or if OTel packages are absent from bundle inputs
  (proving they are inlined). The same guard is enforced as a vitest test
  (`.squad/scripts/verify-api-externals.test.mjs`).
- **`initializeAppInsights()` is called lazily** — as the first statement
  inside each handler body (wrapped in try/catch). There is no module-load
  IIFE. The `globalThis` STARTED flag (`Symbol.for('kickstart.azmon.started')`)
  ensures `useAzureMonitor()` is called only once per worker process even
  when multiple handlers are invoked concurrently.

## Telemetry contract

Every handler error path MUST:

```ts
trackException(err, { requestId, context: "<string>" });
await flushAppInsights();
return { status: 5xx, jsonBody: { error: "<opaque>", requestId } };
```

- `err.message` MUST NOT be placed in the response body. Response bodies
  carry only `requestId` for correlation plus a stable opaque label.
- `flushAppInsights()` is awaitable. Functions tears down the process fast
  after invocation; unflushed telemetry is lost.

## Redaction contract

- `RedactingSpanExporter` (Proxy wrapper) decorates the Azure Monitor trace
  exporter. Span attributes (`http.url`, `url.full`, `db.statement`, all
  string values) are sanitized, exception events' `exception.message` /
  `exception.stacktrace` are sanitized. Prototype methods (`spanContext()`)
  and getters (`duration`, `ended`, `droppedAttributesCount`, …) are
  preserved via the Proxy handler (object-spread would TypeError).
- `RedactingLogRecordProcessor` sanitizes `SdkLogRecord.body` and every
  string attribute before the batch exporter queues it.
- HTTP instrumentation hooks (`requestHook`, `responseHook`,
  `applyCustomAttributesOnSpan`) strip query strings from `http.url` /
  `url.full` / `http.target` / `http.route` / `url.path` with an empty
  allow-list. Defense-in-depth: the span exporter decorator runs the same
  scrub a second time.
- `headersToSpanAttributes` is explicitly NOT set so default auth / cookie
  / key headers never land in span attributes.

## host.json sampling

`logging.applicationInsights.samplingSettings.excludedTypes` MUST stay
`Request;Exception`. During an exception burst, host-level sampling must
not drop Exception telemetry before the SDK can flush it.

## If `verify-api-externals.mjs` fires

1. Check `dist/meta.json` — look for OTel packages in `outputs[bundle].imports`
   with `external: true`. Remove them from the `external` list in
   `esbuild.config.mjs`.
2. If an OTel package is missing from `meta.inputs`, check that it is imported
   (directly or transitively) by `src/lib/appinsights.ts` and that it is NOT
   in the `external` list.

## Test matrix (T1–T12)

See `.squad/decisions/inbox/bender-1030-implementation.md` + PR
description for the matrix status. Each `T#` maps to a specific test file;
the matrix is closed when all twelve pass in CI.
