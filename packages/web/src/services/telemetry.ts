import {
  ApplicationInsights,
  DistributedTracingModes,
} from "@microsoft/applicationinsights-web";

interface PublicApplicationInsightsConfig {
  enabled: boolean;
  connectionString?: string;
  frontendRoleName?: string;
}

interface ClientConfigResponse {
  applicationInsights?: PublicApplicationInsightsConfig;
}

let appInsights: ApplicationInsights | null = null;
let initPromise: Promise<void> | null = null;

async function fetchClientConfig(): Promise<ClientConfigResponse | undefined> {
  const response = await fetch("/api/client-config", {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return undefined;
  }

  return response.json().catch(() => undefined) as Promise<ClientConfigResponse | undefined>;
}

export function initializeTelemetry(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await fetchClientConfig().catch(() => undefined);
    const applicationInsightsConfig = config?.applicationInsights;
    const connectionString = applicationInsightsConfig?.connectionString?.trim();

    if (!applicationInsightsConfig?.enabled || !connectionString || appInsights) {
      return;
    }

    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true,
        enableCorsCorrelation: true,
        distributedTracingMode: DistributedTracingModes.AI_AND_W3C,
      },
    });

    appInsights.loadAppInsights();
    appInsights.addTelemetryInitializer((item) => {
      if (!applicationInsightsConfig.frontendRoleName) return;
      item.tags = item.tags ?? [];
      item.tags["ai.cloud.role"] = applicationInsightsConfig.frontendRoleName;
      item.tags["ai.cloud.roleInstance"] = window.location.hostname;
    });
    appInsights.trackPageView({
      name: document.title || window.location.pathname,
      uri: window.location.href,
      properties: {
        buildVersion: __BUILD_VERSION__,
        buildSha: __BUILD_SHA__,
      },
    });
  })();

  return initPromise;
}
