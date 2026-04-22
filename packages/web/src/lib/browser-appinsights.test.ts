import { describe, expect, it, afterEach, vi } from "vitest";
import {
  resolveConnectionString,
  resolveFlagEnabled,
  initBrowserTelemetry,
  markBrowserTelemetryReady,
  getBrowserTelemetryReady,
  __resetBrowserTelemetryForTests,
} from "./browser-appinsights";

interface WindowExt {
  __appInsightsConnectionString?: string;
  __featureFlags?: Record<string, boolean | string | number | undefined>;
  __kickstartTelemetryReady?: Promise<void>;
  __kickstartFlushTelemetry?: () => Promise<void>;
}

// The Azure Monitor exporter is the realistic failure point in CI when a
// placeholder connection string is used (Leela round 2). Hoisted mock so the
// module's top-level import picks up the stub instead of the real SDK.
const exporterCtor = vi.hoisted(() => vi.fn(function MockAzureMonitorTraceExporter() {}));
vi.mock("@azure/monitor-opentelemetry-exporter", () => ({
  AzureMonitorTraceExporter: exporterCtor,
}));

afterEach(() => {
  const w = globalThis as unknown as WindowExt;
  delete w.__appInsightsConnectionString;
  delete w.__featureFlags;
  delete w.__kickstartTelemetryReady;
  delete w.__kickstartFlushTelemetry;
  __resetBrowserTelemetryForTests();
  exporterCtor.mockReset();
});

describe("resolveConnectionString — precedence", () => {
  it("prefers window.__appInsightsConnectionString over env", () => {
    (globalThis as unknown as WindowExt).__appInsightsConnectionString =
      "InstrumentationKey=runtime-win";
    expect(resolveConnectionString()).toBe("InstrumentationKey=runtime-win");
  });

  it("returns empty string when neither source is set", () => {
    expect(resolveConnectionString()).toBe("");
  });
});

describe("resolveFlagEnabled — precedence", () => {
  it("honours the config parameter when enabled:boolean is present", () => {
    expect(resolveFlagEnabled({ enabled: true })).toBe(true);
    expect(resolveFlagEnabled({ enabled: false })).toBe(false);
  });

  it("falls back to window.__featureFlags.telemetryBrowserEnabled", () => {
    (globalThis as unknown as WindowExt).__featureFlags = {
      telemetryBrowserEnabled: true,
    };
    expect(resolveFlagEnabled()).toBe(true);
  });

  it("defaults to false when nothing is configured", () => {
    expect(resolveFlagEnabled()).toBe(false);
  });
});

describe("initBrowserTelemetry — default-off & resilience (#1042 Leela round 2)", () => {
  it("short-circuits BEFORE constructing AzureMonitorTraceExporter when the flag is off", () => {
    const result = initBrowserTelemetry({
      enabled: false,
      connectionString: "InstrumentationKey=should-not-be-used",
    });
    expect(result).toBeNull();
    // DP default-off guarantee: the Azure Monitor code path is never
    // touched unless the flag is explicitly enabled.
    expect(exporterCtor).not.toHaveBeenCalled();
  });

  it("returns null (does not throw) when exporter construction fails", () => {
    exporterCtor.mockImplementation(() => {
      throw new Error("boom — simulated CI connection-string rejection");
    });
    expect(() =>
      initBrowserTelemetry({
        enabled: true,
        connectionString:
          "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://x/",
      }),
    ).not.toThrow();
    const result = initBrowserTelemetry({
      enabled: true,
      connectionString:
        "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://x/",
    });
    expect(result).toBeNull();
  });

  it("markBrowserTelemetryReady resolves the ready promise AND installs a no-op flush hook even when init never ran", async () => {
    // Simulates `main.tsx`'s `finally` block firing after a silent init
    // failure: we must still converge the barrier so Playwright doesn't
    // time out on it.
    //
    // `browser-appinsights.ts` guards the window-hook writes on
    // `typeof window !== "undefined"`. The unit test runs in node env,
    // so we stub a minimal `window` for the duration of the assertion.
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = globalThis;
    try {
      markBrowserTelemetryReady();
      await expect(getBrowserTelemetryReady()).resolves.toBeUndefined();

      const w = globalThis as unknown as WindowExt;
      expect(w.__kickstartTelemetryReady).toBeDefined();
      expect(typeof (w.__kickstartTelemetryReady as Promise<void>).then).toBe("function");
      expect(typeof w.__kickstartFlushTelemetry).toBe("function");
      await expect(w.__kickstartFlushTelemetry!()).resolves.toBeUndefined();
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });
});
