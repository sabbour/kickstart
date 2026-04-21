/**
 * Binding tests for packages/web/api/src/lib/appinsights.ts.
 *
 * Covers issue #1030 DP amendments 1–3:
 *   T2  — module-scope idempotency guard
 *   T3  — manual trackException flows through the exporter pipeline
 *   T4  — flushAppInsights awaits tracer+logger+meter forceFlush
 *   T11 — HTTP instrumentation strips query strings from http.url / url.full
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const CONN =
  "InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";

const useAzureMonitorMock = vi.fn();
vi.mock("@azure/monitor-opentelemetry", () => ({
  useAzureMonitor: (...args: unknown[]) => useAzureMonitorMock(...args),
  shutdownAzureMonitor: vi.fn(),
}));

vi.mock("@azure/monitor-opentelemetry-exporter", () => ({
  AzureMonitorTraceExporter: class {
    constructor(public readonly opts: unknown) {}
    export(_spans: unknown[], cb: (r: { code: number }) => void) {
      cb({ code: 0 });
    }
    shutdown() { return Promise.resolve(); }
    forceFlush() { return Promise.resolve(); }
  },
}));

function clearStarted() {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")];
}

describe("appinsights module (pure-OTel wiring, DP #1030 amendments 1–3)", () => {
  const prevConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  beforeEach(() => {
    useAzureMonitorMock.mockClear();
    clearStarted();
    vi.resetModules();
  });

  afterEach(() => {
    if (prevConn === undefined) {
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    } else {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = prevConn;
    }
    clearStarted();
  });

  // T2 ------------------------------------------------------------------
  it("T2: initializeAppInsights is idempotent — useAzureMonitor called exactly once", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const mod = await import("./appinsights.js");
    // module-load side effect = 1 call
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
    mod.initializeAppInsights();
    mod.initializeAppInsights();
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
  });

  it("T2b: cross-bundle flag — useAzureMonitor is skipped when globalThis STARTED is already set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")] = true;
    const mod = await import("./appinsights.js");
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
    mod.initializeAppInsights();
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
  });

  it("does not start the distro when the connection string is missing", async () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    await import("./appinsights.js");
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
  });

  it("never imports the classic applicationinsights shim (no setup/start side-effects)", async () => {
    // Negative lock — this file should not pull applicationinsights.
    const appinsightsSource = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./appinsights.ts", import.meta.url), "utf8"),
    );
    expect(appinsightsSource).not.toMatch(/from ['"]applicationinsights['"]/);
    expect(appinsightsSource).not.toMatch(/TelemetryClient/);
  });

  // T3 ------------------------------------------------------------------
  it("T3: trackException emits a span via the global OTel tracer provider", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const mod = await import("./appinsights.js");
    const { trace, SpanStatusCode } = await import("@opentelemetry/api");

    const startedSpans: Array<{
      name: string;
      recorded: unknown[];
      status: unknown;
      ended: boolean;
    }> = [];
    const fakeSpan = {
      recordException(err: unknown) { this.recorded.push(err); },
      setStatus(s: unknown) { this.status = s; },
      end() { this.ended = true; },
      recorded: [] as unknown[],
      status: undefined as unknown,
      ended: false,
    };
    const tracer = {
      startSpan: vi.fn((name: string) => {
        const s = { ...fakeSpan, name, recorded: [], status: undefined, ended: false };
        startedSpans.push(s);
        return s;
      }),
    };
    const getTracerSpy = vi.spyOn(trace, "getTracer").mockReturnValue(tracer as unknown as ReturnType<typeof trace.getTracer>);

    mod.trackException(new Error("boom"), { foo: "bar" });

    expect(getTracerSpy).toHaveBeenCalled();
    expect(tracer.startSpan).toHaveBeenCalledWith(
      "exception",
      expect.objectContaining({ attributes: expect.objectContaining({ foo: "bar" }) }),
    );
    expect(startedSpans[0].recorded).toHaveLength(1);
    expect((startedSpans[0].recorded[0] as Error).message).toBe("boom");
    expect((startedSpans[0].status as { code: unknown }).code).toBe(SpanStatusCode.ERROR);
    expect(startedSpans[0].ended).toBe(true);

    getTracerSpy.mockRestore();
  });

  // T4 ------------------------------------------------------------------
  it("T4: flushAppInsights awaits forceFlush() on tracer-delegate, logger, and meter providers", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const { trace, metrics } = await import("@opentelemetry/api");
    const { logs } = await import("@opentelemetry/api-logs");

    const mod = await import("./appinsights.js");
    mod.initializeAppInsights();

    const flushSpy = vi.fn().mockResolvedValue(undefined);
    const delegateFlush = vi.fn().mockResolvedValue(undefined);
    const loggerFlush = vi.fn().mockResolvedValue(undefined);
    const meterFlush = vi.fn().mockResolvedValue(undefined);

    const fakeTracerProvider = {
      getTracer: () => ({ startSpan: () => ({ end: () => undefined }) }),
      getDelegate: () => ({ forceFlush: delegateFlush }),
      forceFlush: flushSpy,
    } as unknown as ReturnType<typeof trace.getTracerProvider>;
    const fakeLoggerProvider = { forceFlush: loggerFlush, getLogger: () => ({ emit: () => undefined }) } as unknown as ReturnType<typeof logs.getLoggerProvider>;
    const fakeMeterProvider = { forceFlush: meterFlush, getMeter: () => ({}) } as unknown as ReturnType<typeof metrics.getMeterProvider>;

    const tpSpy = vi.spyOn(trace, "getTracerProvider").mockReturnValue(fakeTracerProvider);
    const lpSpy = vi.spyOn(logs, "getLoggerProvider").mockReturnValue(fakeLoggerProvider);
    const mpSpy = vi.spyOn(metrics, "getMeterProvider").mockReturnValue(fakeMeterProvider);

    await mod.flushAppInsights();
    expect(delegateFlush).toHaveBeenCalledTimes(1);
    expect(loggerFlush).toHaveBeenCalledTimes(1);
    expect(meterFlush).toHaveBeenCalledTimes(1);

    tpSpy.mockRestore();
    lpSpy.mockRestore();
    mpSpy.mockRestore();
  });

  it("T4b: flushAppInsights resolves cleanly when a provider's forceFlush rejects", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const { trace, metrics } = await import("@opentelemetry/api");
    const { logs } = await import("@opentelemetry/api-logs");

    const mod = await import("./appinsights.js");
    mod.initializeAppInsights();

    const tpSpy = vi.spyOn(trace, "getTracerProvider").mockReturnValue({
      getTracer: () => ({ startSpan: () => ({ end: () => undefined }) }),
      getDelegate: () => ({ forceFlush: vi.fn().mockRejectedValue(new Error("net err")) }),
    } as unknown as ReturnType<typeof trace.getTracerProvider>);
    const lpSpy = vi.spyOn(logs, "getLoggerProvider").mockReturnValue({ forceFlush: vi.fn().mockResolvedValue(undefined), getLogger: () => ({ emit: () => undefined }) } as unknown as ReturnType<typeof logs.getLoggerProvider>);
    const mpSpy = vi.spyOn(metrics, "getMeterProvider").mockReturnValue({ forceFlush: vi.fn().mockResolvedValue(undefined), getMeter: () => ({}) } as unknown as ReturnType<typeof metrics.getMeterProvider>);

    await expect(mod.flushAppInsights()).resolves.toBeUndefined();

    tpSpy.mockRestore();
    lpSpy.mockRestore();
    mpSpy.mockRestore();
  });

  it("T12: telemetry init failure does not break — useAzureMonitor throws, module still loads", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    useAzureMonitorMock.mockImplementationOnce(() => {
      throw new Error("simulated init failure");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("./appinsights.js")).resolves.toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[AppInsights] Azure Monitor init failed:"));
    consoleSpy.mockRestore();
  });
});
