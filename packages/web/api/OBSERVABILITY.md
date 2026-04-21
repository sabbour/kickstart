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

- `@azure/monitor-opentelemetry`,
  `@azure/monitor-opentelemetry-exporter`, and the OTel API packages
  (`@opentelemetry/api`, `@opentelemetry/api-logs`) are marked `external` in
  `esbuild.config.mjs`.
- `scripts/verify-api-externals.mjs` runs after every `npm run build` and
  fails the build if any required-external package ends up inlined or
  imports are not marked `external: true`. The same guard is enforced as a
  vitest test (`.squad/scripts/verify-api-externals.test.mjs`).
- `scripts/materialize-api-externals.mjs` (`postbuild`) installs the
  externalized packages into `packages/web/api/node_modules/` so they reach
  the SWA zip (which only ships `packages/web/api/`).

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

1. Check `dist/meta.json` — look for any leaked input path under
   `node_modules/@azure/monitor-opentelemetry/` or friends.
2. If someone added a new OTel package import, either add it to the
   `external` list in `esbuild.config.mjs` or vendor it into
   `src/lib/appinsights.ts` (only that file may import the distro).
3. If `require.resolve` fails for the API root, re-run the postbuild:
   `npm run postbuild -w @aks-kickstart/api`.

## Test matrix (T1–T12)

See `.squad/decisions/inbox/bender-1030-implementation.md` + PR
description for the matrix status. Each `T#` maps to a specific test file;
the matrix is closed when all twelve pass in CI.
