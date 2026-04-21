import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module under test runs a side-effect at import time that calls
// `useAzureMonitor()` if APPLICATIONINSIGHTS_CONNECTION_STRING is set. To
// exercise both branches deterministically we re-import the module inside
// each test after mocking.

const useAzureMonitorMock = vi.fn();
const flushAzureMonitorMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@azure/monitor-opentelemetry", () => ({
  useAzureMonitor: (...args: unknown[]) => useAzureMonitorMock(...args),
  shutdownAzureMonitor: vi.fn(),
}));

const mockClientFlush = vi.fn().mockResolvedValue(undefined);
const mockTelemetryClient = {
  trackTrace: vi.fn(),
  trackEvent: vi.fn(),
  trackException: vi.fn(),
  addTelemetryProcessor: vi.fn(),
  flush: mockClientFlush,
  context: { tags: {} as Record<string, string> },
};

vi.mock("applicationinsights", () => {
  return {
    default: {
      TelemetryClient: vi.fn(function(this: unknown) { return mockTelemetryClient; }),
      // setup/start/defaultClient are intentionally not used by the new init path
      setup: vi.fn(),
      start: vi.fn(),
    },
    flushAzureMonitor: (...args: unknown[]) => flushAzureMonitorMock(...args),
  };
});

const CONN =
  "InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";

describe("appinsights module — Azure Monitor OTel distro wiring", () => {
  const prevConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  beforeEach(() => {
    useAzureMonitorMock.mockClear();
    flushAzureMonitorMock.mockClear();
    mockClientFlush.mockClear();
    // Clear the globalThis singleton flag so each test starts fresh
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")];
    vi.resetModules();
  });

  afterEach(() => {
    if (prevConn === undefined) {
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    } else {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = prevConn;
    }
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")];
  });

  it("eagerly starts the Azure Monitor OTel distro at module load when the connection string is set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    await import("./appinsights.js");
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
    const [opts] = useAzureMonitorMock.mock.calls[0];
    expect(opts?.azureMonitorExporterOptions?.connectionString).toContain(
      "InstrumentationKey=",
    );
  });

  it("does not start the OTel distro when the connection string is missing", async () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    await import("./appinsights.js");
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
  });

  it("is idempotent — initializeAppInsights does not re-start the distro on subsequent calls", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const mod = await import("./appinsights.js");
    // module-load side effect = 1 call
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
    mod.initializeAppInsights();
    mod.initializeAppInsights();
    // globalThis guard prevents additional calls
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
  });

  it("never calls setup() or start() — only new TelemetryClient()", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const { default: appInsights } = await import("applicationinsights");
    const mod = await import("./appinsights.js");
    mod.initializeAppInsights();
    expect(appInsights.setup).not.toHaveBeenCalled();
    expect(appInsights.start).not.toHaveBeenCalled();
  });

  it("cross-bundle guard: useAzureMonitor is called exactly once even when the globalThis flag is already set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    // Simulate a prior bundle having already set the flag
    (globalThis as Record<symbol, unknown>)[Symbol.for("kickstart.azmon.started")] = true;
    const mod = await import("./appinsights.js");
    // Module-load side effect should be a no-op (flag already set)
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
    mod.initializeAppInsights();
    // Still not called
    expect(useAzureMonitorMock).not.toHaveBeenCalled();
  });

  it("flushAppInsights awaits client.flush() and flushAzureMonitor()", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    const mod = await import("./appinsights.js");
    mod.initializeAppInsights();
    await mod.flushAppInsights();
    expect(mockClientFlush).toHaveBeenCalledTimes(1);
    expect(flushAzureMonitorMock).toHaveBeenCalledTimes(1);
  });

  it("flushAppInsights does not throw when client.flush() rejects", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = CONN;
    mockClientFlush.mockRejectedValueOnce(new Error("network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mod = await import("./appinsights.js");
    mod.initializeAppInsights();
    await expect(mod.flushAppInsights()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[AppInsights] flush failed:"),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });
});
