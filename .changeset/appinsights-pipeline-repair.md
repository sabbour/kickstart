---
"@aks-kickstart/api": patch
---

fix(observability): repair AppInsights telemetry pipeline (#1030)

Five confirmed gaps fixed:
1. Dual-init global wipe: replaced file-scoped `let azureMonitorStarted` guard with `globalThis[Symbol.for('kickstart.azmon.started')]` — survives per-bundle module isolation in esbuild.
2. Per-bundle OTel isolation: same globalThis guard prevents `useAzureMonitor()` re-registration across bundles sharing a worker process.
3. Classic SDK double-init: removed `applicationinsights.setup()/start()` chain; classic client now constructed via `new TelemetryClient(connString)` which does not re-call `useAzureMonitor()`.
4. No flush after exceptions: exported `flushAppInsights(): Promise<void>` — awaited in all `trackException` catch paths in `health.ts`, `packs.ts` (functions), and `converse.ts`.
5. Startup telemetry black hole: `getRegistry()` now calls `getAppInsightsClient().trackException()` in core-pack and seal-failure catch blocks before rethrowing.
6. host.json sampling: `excludedTypes` extended to `"Request;Exception"` — exceptions are no longer subject to host-level sampling during error bursts.
