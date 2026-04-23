/**
 * Binding tests for packages/web/api/src/lib/appinsights.ts.
 *
 * Covers DP #1030 amendments 1–3 and DP #1035 security fix:
 *   T2  — module-scope idempotency guard
 *   T3  — manual trackException flows through the exporter pipeline
 *   T4  — flushAppInsights awaits tracer+logger+meter forceFlush
 *   T_SINGLE_PATH — ONLY one BatchSpanProcessor wrapping RedactingSpanExporter
 *                   is registered; no raw AzureMonitorTraceExporter outside the
 *                   redacting wrapper (#1035 regression guard)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const CONN =
  "InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";

// Capture the NodeSDK config passed during initialization.
let capturedSdkConfig: Record<string, unknown> = {};
const sdkStartMock = vi.fn();

vi.mock("@opentelemetry/sdk-node", () => ({
  // Use a regular function (not an arrow) so it can be called with `new`.
  NodeSDK: function NodeSDKMock(this: Record<string, unknown>, cfg: Record<string, unknown>) {
    capturedSdkConfig = cfg;
    this.start = sdkStartMock;
  },
}));

vi.mock("@azure/monitor-opentelemetry-exporter", () => ({
  AzureMonitorTraceExporter: class {
    constructor(public readonly opts: unknown) {}
    export(_spans: unknown[], cb: (r: { code: number }) => void) { cb({ code: 0 }); }
    shutdown() { return Promise.resolve(); }
    forceFlush() { return Promise.resolve(); }
  },
  AzureMonitorLogExporter: class {
    constructor(public readonly opts: unknown) {}
    export(_records: unknown[], cb: (r: { code: number }) => void) { cb({ code: 0 }); }
    shutdown() { return Promise.resolve(); }
    forceFlush() { return Promise.resolve(); }
  },
  AzureMonitorMetricExporter: class {
    constructor(public readonly opts: unknown) {}
    export(_metrics: unknown[], cb: (r: { code: number }) => void) { cb({ code: 0 }); }
    shutdown() { return Promise.resolve(); }
    forceFlush() { return Promise.resolve(); }
  },
}));

vi.mock("@opentelemetry/sdk-logs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@opentelemetry/sdk-logs")>();
  return {
    ...original,
    BatchLogRecordProcessor: class {
      constructor(public readonly exporter: unknown) {}
      onEmit() {}
      async forceFlush() {}
      async shutdown() {}
    },
  };
});

vi.mock("@opentelemetry/sdk-metrics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@opentelemetry/sdk-metrics")>();
  return {
    ...original,
    PeriodicExportingMetricReader: class {
      constructor(public readonly opts: unknown) {}
      async forceFlush() {}
      async shutdown() {}
    },
  };
});

vi.mock("@opentelemetry/instrumentation-http", () => ({
  HttpInstrumentation: class {
    constructor(public readonly opts: unknown) {}
  },
}));

function clearStarted() {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")];
}

describe("appinsights module (NodeSDK wiring, DP #1030 amendments + #1035 fix)", () => {
  const prevConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  beforeEach(() => {
    sdkStartMock.mockClear();
    capturedSdkConfig = {};
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
  it("T2: initializeAppInsights is idempotent — NodeSDK.start() called exactly once", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const mod = await import("./appinsights.js");
    expect(sdkStartMock).toHaveBeenCalledTimes(1);
    mod.initializeAppInsights();
    mod.initializeAppInsights();
    expect(sdkStartMock).toHaveBeenCalledTimes(1);
  });

  it("T2b: cross-bundle flag — NodeSDK is skipped when globalThis STARTED is already set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")] = true;
    await import("./appinsights.js");
    expect(sdkStartMock).not.toHaveBeenCalled();
  });

  it("does not start the SDK when the connection string is missing", async () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    await import("./appinsights.js");
    expect(sdkStartMock).not.toHaveBeenCalled();
  });

  it("never imports the classic applicationinsights shim (no setup/start side-effects)", async () => {
    const appinsightsSource = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./appinsights.ts", import.meta.url), "utf8"),
    );
    expect(appinsightsSource).not.toMatch(/from ['"]applicationinsights['"]/);
    expect(appinsightsSource).not.toMatch(/TelemetryClient/);
  });

  // T_SINGLE_PATH -------------------------------------------------------
  it("T_SINGLE_PATH: registers exactly ONE BatchSpanProcessor wrapping RedactingSpanExporter — no raw exporter outside wrapper (#1035)", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    await import("./appinsights.js");

    const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");
    const { RedactingSpanExporter } = await import("./redacting-span-exporter.js");

    const processors = capturedSdkConfig.spanProcessors as unknown[];
    expect(processors, "spanProcessors should be defined in NodeSDK config").toBeDefined();
    expect(processors).toHaveLength(1);
    expect(processors[0]).toBeInstanceOf(BatchSpanProcessor);

    // The inner exporter on the BSP MUST be a RedactingSpanExporter.
    const bsp = processors[0] as { _exporter: unknown };
    expect(bsp._exporter).toBeInstanceOf(RedactingSpanExporter);

    // AzureMonitorTraceExporter must only appear inside the redacting wrapper,
    // never directly as a registered processor's exporter.
    const { AzureMonitorTraceExporter } = await import("@azure/monitor-opentelemetry-exporter");
    expect(bsp._exporter).not.toBeInstanceOf(AzureMonitorTraceExporter);
  });

  it("T_SINGLE_PATH: useAzureMonitor is NOT imported in appinsights.ts (regression guard — would re-enable double export)", async () => {
    const appinsightsSource = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./appinsights.ts", import.meta.url), "utf8"),
    );
    // If useAzureMonitor is imported again, the internal distro BSP would
    // register alongside ours, creating an unredacted duplicate export path.
    expect(appinsightsSource).not.toMatch(/import\s*\{[^}]*useAzureMonitor[^}]*\}\s*from/);
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
    const getTracerSpy = vi.spyOn(trace, "getTracer").mockReturnValue(
      tracer as unknown as ReturnType<typeof trace.getTracer>,
    );

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

    const delegateFlush = vi.fn().mockResolvedValue(undefined);
    const loggerFlush = vi.fn().mockResolvedValue(undefined);
    const meterFlush = vi.fn().mockResolvedValue(undefined);

    const fakeTracerProvider = {
      getTracer: () => ({ startSpan: () => ({ end: () => undefined }) }),
      getDelegate: () => ({ forceFlush: delegateFlush }),
      forceFlush: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof trace.getTracerProvider>;
    const fakeLoggerProvider = {
      forceFlush: loggerFlush,
      getLogger: () => ({ emit: () => undefined }),
    } as unknown as ReturnType<typeof logs.getLoggerProvider>;
    const fakeMeterProvider = {
      forceFlush: meterFlush,
      getMeter: () => ({}),
    } as unknown as ReturnType<typeof metrics.getMeterProvider>;

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
    const lpSpy = vi.spyOn(logs, "getLoggerProvider").mockReturnValue({
      forceFlush: vi.fn().mockResolvedValue(undefined),
      getLogger: () => ({ emit: () => undefined }),
    } as unknown as ReturnType<typeof logs.getLoggerProvider>);
    const mpSpy = vi.spyOn(metrics, "getMeterProvider").mockReturnValue({
      forceFlush: vi.fn().mockResolvedValue(undefined),
      getMeter: () => ({}),
    } as unknown as ReturnType<typeof metrics.getMeterProvider>);

    await expect(mod.flushAppInsights()).resolves.toBeUndefined();

    tpSpy.mockRestore();
    lpSpy.mockRestore();
    mpSpy.mockRestore();
  });

  it("T12: telemetry init failure does not break — NodeSDK.start() throws, module still loads", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    sdkStartMock.mockImplementationOnce(() => {
      throw new Error("simulated init failure");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("./appinsights.js")).resolves.toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[AppInsights] Azure Monitor init failed:"),
    );
    consoleSpy.mockRestore();
  });
});
