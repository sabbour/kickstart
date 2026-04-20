import appInsights from "applicationinsights";
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

let client: appInsights.TelemetryClient | null = null;

function sanitizeProperties(properties: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? sanitizeText(value) : value,
    ]),
  );
}

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
    client = createNoOpClient();
    return client;
  }

  try {
    appInsights
      .setup(connString)
      .setAutoCollectConsole(false)
      .setAutoCollectExceptions(true)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(true);

    appInsights.start();
    client = appInsights.defaultClient;

    client.addTelemetryProcessor((envelope) => {
      const baseData = envelope.data?.baseData as {
        message?: string;
        exceptions?: Array<{ message?: string; stack?: string }>;
        properties?: Record<string, unknown>;
      } | undefined;

      if (!baseData) {
        return true;
      }

      if (baseData.message) {
        baseData.message = sanitizeText(baseData.message);
      }

      if (baseData.exceptions) {
        for (const exception of baseData.exceptions) {
          const sanitizedException = sanitizeError(
            new Error(exception.message ?? baseData.message ?? "Application Insights exception"),
          );
          exception.message = sanitizedException.message;
          if (exception.stack) {
            exception.stack = sanitizeText(exception.stack);
          }
        }
      }

      const sanitizedProperties = sanitizeProperties(baseData.properties);
      if (sanitizedProperties) {
        baseData.properties = sanitizedProperties;
      }

      return true;
    });

    client.trackTrace({
      message: "[AppInsights] Application Insights initialized successfully",
      severity: appInsights.Contracts.SeverityLevel.Information,
    });

    return client;
  } catch (err) {
    const sanitizedError = sanitizeError(err);
    console.error(`[AppInsights] Failed to initialize: ${sanitizedError.message}`);
    client = createNoOpClient();
    return client;
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
  return {
    trackTrace: () => undefined,
    trackEvent: () => undefined,
    trackException: () => undefined,
    trackRequest: () => undefined,
    trackDependency: () => undefined,
    addTelemetryProcessor: () => undefined,
  } as unknown as appInsights.TelemetryClient;
}

/**
 * Add custom properties to every telemetry item.
 */
export function setAppInsightsContext(key: string, value: string): void {
  if (client) {
    client.context.tags[`ai.cloud.${key}`] = sanitizeText(value);
  }
}
