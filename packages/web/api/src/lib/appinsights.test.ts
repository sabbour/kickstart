import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module under test runs a side-effect at import time that calls
// `useAzureMonitor()` if APPLICATIONINSIGHTS_CONNECTION_STRING is set. To
// exercise both branches deterministically we re-import the module inside
// each test after mocking.

const useAzureMonitorMock = vi.fn();

vi.mock("@azure/monitor-opentelemetry", () => ({
  useAzureMonitor: (...args: unknown[]) => useAzureMonitorMock(...args),
  shutdownAzureMonitor: vi.fn(),
}));

vi.mock("applicationinsights", () => {
  const client = {
    trackTrace: vi.fn(),
    trackEvent: vi.fn(),
    trackException: vi.fn(),
    addTelemetryProcessor: vi.fn(),
    context: { tags: {} as Record<string, string> },
  };
  const chain = {
    setAutoCollectConsole() { return chain; },
    setAutoCollectExceptions() { return chain; },
    setAutoCollectRequests() { return chain; },
    setAutoCollectDependencies() { return chain; },
  };
  return {
    default: {
      setup: vi.fn(() => chain),
      start: vi.fn(),
      defaultClient: client,
      Contracts: { SeverityLevel: { Information: 1 } },
    },
  };
});

describe("appinsights module — Azure Monitor OTel distro wiring", () => {
  const prevConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  beforeEach(() => {
    useAzureMonitorMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    if (prevConn === undefined) {
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    } else {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = prevConn;
    }
  });

  it("eagerly starts the Azure Monitor OTel distro at module load when the connection string is set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      "InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";
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
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      "InstrumentationKey=00000000-0000-0000-0000-000000000002;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";
    const mod = await import("./appinsights.js");
    // module-load side effect = 1 call
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
    mod.initializeAppInsights();
    mod.initializeAppInsights();
    // startAzureMonitor guards on azureMonitorStarted flag, so no additional calls
    expect(useAzureMonitorMock).toHaveBeenCalledTimes(1);
  });

  it("isAppInsightsConfigured returns true when connection string is set", async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      "InstrumentationKey=00000000-0000-0000-0000-000000000003;IngestionEndpoint=https://example.in.applicationinsights.azure.com/";
    const mod = await import("./appinsights.js");
    expect(mod.isAppInsightsConfigured()).toBe(true);
  });

  it("isAppInsightsConfigured returns false when connection string is absent", async () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    const mod = await import("./appinsights.js");
    expect(mod.isAppInsightsConfigured()).toBe(false);
  });
});
