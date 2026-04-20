import appInsights from "applicationinsights";

let client: appInsights.TelemetryClient | null = null;

/**
 * Initialize Application Insights SDK.
 * Call this as early as possible in the function startup.
 */
export function initializeAppInsights(): appInsights.TelemetryClient {
  if (client) {
    return client;
  }

  const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connString) {
    console.warn("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set; disabling telemetry");
    // Return a no-op client
    return createNoOpClient();
  }

  try {
    appInsights
      .setup(connString)
      .setAutoCollectConsole(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(true);

    appInsights.start();
    client = appInsights.defaultClient;

    client.trackTrace({
      message: "[AppInsights] Application Insights initialized successfully",
      severity: appInsights.Contracts.SeverityLevel.Information,
    });

    return client;
  } catch (err) {
    console.error(`[AppInsights] Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    return createNoOpClient();
  }
}

/**
 * Get the existing Application Insights client, or initialize if needed.
 */
export function getAppInsightsClient(): appInsights.TelemetryClient {
  if (!client) {
    return initializeAppInsights();
  }
  return client;
}

/**
 * No-op telemetry client for when App Insights is disabled.
 */
function createNoOpClient(): appInsights.TelemetryClient {
  // Create a minimal client that discards all telemetry
  return {
    trackTrace: () => undefined,
    trackEvent: () => undefined,
    trackException: () => undefined,
    trackRequest: () => undefined,
    trackDependency: () => undefined,
  } as unknown as appInsights.TelemetryClient;
}

/**
 * Add custom properties to every telemetry item.
 */
export function setAppInsightsContext(key: string, value: string): void {
  if (client) {
    client.context.tags[`ai.cloud.${key}`] = value;
  }
}
