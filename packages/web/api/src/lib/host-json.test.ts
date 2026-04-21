/**
 * T6 — host.json sampling lock (DP #1030).
 *
 * Guards against silent regression of the `samplingSettings.excludedTypes`
 * field. During an exception burst (see #1027 outage), host-level sampling
 * must NOT drop Exception telemetry before the SDK can flush it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

describe("host.json sampling (T6)", () => {
  it("logging.applicationInsights.samplingSettings.excludedTypes === 'Request;Exception'", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const hostJsonPath = resolve(here, "../../host.json");
    const host = JSON.parse(readFileSync(hostJsonPath, "utf8"));
    expect(host?.logging?.applicationInsights?.samplingSettings?.excludedTypes).toBe(
      "Request;Exception",
    );
    expect(host?.logging?.applicationInsights?.samplingSettings?.isEnabled).toBe(true);
  });
});
