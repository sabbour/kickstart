export interface PublicApplicationInsightsConfig {
  enabled: boolean;
  connectionString?: string;
  frontendRoleName?: string;
}

const FRONTEND_ROLE_NAME = "kickstart-web";

function readNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getApplicationInsightsConnectionString(): string | undefined {
  return readNonEmptyEnv("APPLICATIONINSIGHTS_CONNECTION_STRING");
}

export function getPublicApplicationInsightsConfig(): PublicApplicationInsightsConfig {
  const connectionString = getApplicationInsightsConnectionString();
  if (!connectionString) {
    return { enabled: false };
  }

  return {
    enabled: true,
    connectionString,
    frontendRoleName: FRONTEND_ROLE_NAME,
  };
}
