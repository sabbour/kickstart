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
    // Return 403 (not 401) so the SWA responseOverrides.401 redirect does not
    // intercept this error before it reaches the browser. A 401 would be silently
    // converted to a 302 → login redirect, causing the frontend's fetch to receive
    // an HTML page and silently return an empty subscription list.
    // 403 is also semantically correct: the user IS authenticated, but their
    // session lacks an ARM-scoped token (typically a stale session predating the
    // management.azure.com scope addition to loginParameters).
    throw new AzureApiError(
      403,
      "azure_access_token_missing",
      "Azure access is unavailable for this session. Sign out and sign back in with Microsoft to refresh your Azure permissions.",
      undefined,
      false,
      [
        "Sign out of Kickstart using the account menu, then sign back in with Microsoft.",
        "This refreshes the session with the Azure management scope required for subscription access.",
      ],
    );
  }

  return accessToken;
}
