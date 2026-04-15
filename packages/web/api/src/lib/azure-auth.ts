import { AzureApiError } from "./azure-errors.js";

const DEFAULT_CLIENT_ID = "e71a23c6-aeb4-459a-88fc-07ff96fc9b92";
const DEFAULT_TENANT_ID = "d91aa5af-8c1e-442c-b77c-0b92988b387b";
const DEFAULT_ARM_SCOPE = "https://management.azure.com/user_impersonation";

export interface AzureAuthConfigResponse {
  clientId: string;
  tenantId: string;
  authority: string;
  scopes: string[];
  armProxyBaseUrl: string;
}

export function loadAzureAuthConfig(): AzureAuthConfigResponse {
  const clientId = process.env.AZURE_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID?.trim() || DEFAULT_TENANT_ID;

  if (!clientId || !tenantId) {
    throw new AzureApiError(
      503,
      "azure_auth_not_configured",
      "Azure authentication is not configured on the server.",
      undefined,
      false,
      [
        "Set AZURE_CLIENT_ID and AZURE_TENANT_ID in the Static Web App application settings.",
      ],
    );
  }

  return {
    clientId,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    scopes: [process.env.AZURE_ARM_SCOPE?.trim() || DEFAULT_ARM_SCOPE],
    armProxyBaseUrl: "/api/arm-proxy",
  };
}
