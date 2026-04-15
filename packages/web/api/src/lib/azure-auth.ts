import type { HttpRequest } from "@azure/functions";
import { AzureApiError } from "./azure-errors.js";

export function requireAzureAccessToken(request: HttpRequest): string {
  const principalId = request.headers.get("x-ms-client-principal-id")?.trim();
  if (!principalId) {
    throw new AzureApiError(
      403,
      "principal_required",
      "Sign in to Kickstart before accessing Azure resources.",
    );
  }

  const accessToken = request.headers.get("x-ms-token-aad-access-token")?.trim();
  if (!accessToken) {
    throw new AzureApiError(
      401,
      "azure_access_token_missing",
      "Azure access is unavailable for this session. Sign out and sign back in with Microsoft to refresh the Azure token.",
      undefined,
      false,
      [
        "Sign out of Kickstart and sign back in with Microsoft Entra ID.",
        "Ensure the Static Web App auth provider is configured with AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.",
      ],
    );
  }

  return accessToken;
}
