/**
 * GET /api/config — browser runtime configuration.
 *
 * Returns the small JSON blob the SPA needs at boot to decide whether to
 * initialize browser telemetry and which Application Insights workspace to
 * target. Callers MUST treat this endpoint as public: the connection string
 * we return is a telemetry-only ingestion credential (public by design —
 * same class as an AI instrumentation key). Never put a management,
 * storage, or write-plane credential in this payload.
 *
 * See issue #1042 / DP-D revision 2 (Zapp Decision 2) for the contract.
 *
 * Response shape:
 *   {
 *     appInsightsConnectionString?: string,
 *     featureFlags: { "web.telemetry.browser.enabled": boolean }
 *   }
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface BrowserConfigResponse {
  appInsightsConnectionString?: string;
  featureFlags: Record<string, boolean>;
}

function parseBooleanEnv(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export async function config(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  // Flag name mirrors `BROWSER_TELEMETRY_FLAG` in
  // packages/web/src/lib/browser-appinsights.ts. Keep both in sync.
  const telemetryEnabled = parseBooleanEnv(
    process.env.WEB_TELEMETRY_BROWSER_ENABLED,
  );

  // The browser exporter reuses the same App Insights workspace as the
  // server. We never invent a second connection string. If the env is unset
  // we simply omit the field and the browser falls back to the build-time
  // `VITE_APPINSIGHTS_CONNECTION_STRING` (or disables itself).
  const connectionString =
    process.env.BROWSER_APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    undefined;

  const body: BrowserConfigResponse = {
    featureFlags: {
      "web.telemetry.browser.enabled": telemetryEnabled,
    },
  };
  if (telemetryEnabled && connectionString) {
    body.appInsightsConnectionString = connectionString;
  }

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Short cache — operators need <60s kill-switch latency per DP §2.
      "Cache-Control": "private, max-age=30",
    },
    jsonBody: body,
  };
}

app.http("config", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "config",
  handler: config,
});
