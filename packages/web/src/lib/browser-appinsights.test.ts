import { describe, expect, it, afterEach } from "vitest";
import {
  resolveConnectionString,
  resolveFlagEnabled,
  __resetBrowserTelemetryForTests,
} from "./browser-appinsights";

interface WindowExt {
  __appInsightsConnectionString?: string;
  __featureFlags?: Record<string, boolean | string | number | undefined>;
}

afterEach(() => {
  const w = globalThis as unknown as WindowExt;
  delete w.__appInsightsConnectionString;
  delete w.__featureFlags;
  __resetBrowserTelemetryForTests();
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
