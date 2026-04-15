import { afterEach, describe, expect, it } from "vitest";
import { getPublicApplicationInsightsConfig } from "./observability.js";

const originalConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

afterEach(() => {
  if (originalConnectionString === undefined) {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  } else {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalConnectionString;
  }
});

describe("getPublicApplicationInsightsConfig", () => {
  it("returns a disabled payload when no connection string is configured", () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    expect(getPublicApplicationInsightsConfig()).toEqual({ enabled: false });
  });

  it("returns the public browser payload when telemetry is configured", () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=test-key";

    expect(getPublicApplicationInsightsConfig()).toEqual({
      enabled: true,
      connectionString: "InstrumentationKey=test-key",
      frontendRoleName: "kickstart-web",
    });
  });
});
