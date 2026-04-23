---
"kickstart": patch
---

Fix SWA production deploy guard that was greping for a removed symbol (#1095).

The `Verify OTel externals bundled` step in `.github/workflows/deploy-swa.yml`
greped `packages/web/api/dist/functions/health.js` for `useAzureMonitor`, but
`useAzureMonitor()` was intentionally removed in DP #1035 (PII double-export
security fix). The guard was failing on every main deploy (9+ consecutive red
runs) even though the bundle is correct.

Swap the marker to `AzureMonitorTraceExporter`, which is the named export
imported directly by `packages/web/api/src/lib/appinsights.ts` and listed in
`MUST_BE_INLINED` inside `scripts/verify-api-externals.mjs`. This re-aligns the
workflow guard with the local verifier. The `node_modules/@azure/monitor-opentelemetry`
negative assertion (defense against accidental externalization) is preserved
unchanged. Error message also improved to point oncall at `esbuild.config.mjs`
and `scripts/verify-api-externals.mjs`.
