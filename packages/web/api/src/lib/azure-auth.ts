import type { HttpRequest } from "@azure/functions";
import { AzureApiError } from "./azure-errors.js";

const SWA_AAD_ACCESS_TOKEN_HEADER = "x-ms-token-aad-access-token";
const SWA_LOGIN_PATH = "/.auth/login/aad";

const SWA_ARM_BLOCKER_MESSAGE = [
  "Azure Static Web Apps built-in auth only gives this API the SWA principal headers.",
  "It does not provide a backend-usable delegated Azure Resource Manager token in the current architecture.",
  "Kickstart removed the rejected browser-bearer path, so real Azure deployment is blocked until the auth host supports server-side OBO or the product explicitly moves to app-owned Azure credentials.",
].join(" ");

export interface AzureAuthConfigResponse {
  authMode: "swa";
  loginPath: string;
  deploymentEnabled: boolean;
  blockerCode?: string;
  blocker?: string;
}

export function loadAzureAuthConfig(request: HttpRequest): AzureAuthConfigResponse {
  const delegatedAccessToken = request.headers.get(SWA_AAD_ACCESS_TOKEN_HEADER)?.trim();

  if (!delegatedAccessToken) {
    return {
      authMode: "swa",
      loginPath: SWA_LOGIN_PATH,
      deploymentEnabled: false,
      blockerCode: "swa_delegated_arm_unavailable",
      blocker: SWA_ARM_BLOCKER_MESSAGE,
    };
  }

  return {
    authMode: "swa",
    loginPath: SWA_LOGIN_PATH,
    deploymentEnabled: true,
  };
}

export function requireServerAzureAccessToken(request: HttpRequest): string {
  const accessToken = request.headers.get(SWA_AAD_ACCESS_TOKEN_HEADER)?.trim();
  if (!accessToken) {
    throw new AzureApiError(
      501,
      "swa_delegated_arm_unavailable",
      SWA_ARM_BLOCKER_MESSAGE,
      undefined,
      false,
      [
        "Move the Azure auth flow to a host that supports server-side OBO / provider token headers.",
        "Or explicitly switch to app-owned Azure credentials if user-delegated ARM access is no longer required.",
      ],
    );
  }

  return accessToken;
}
