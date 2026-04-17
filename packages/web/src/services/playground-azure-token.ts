/**
 * MSAL-based Azure token acquisition for Playground mode.
 *
 * IMPORTANT — App Registration Requirements:
 *   VITE_AZURE_CLIENT_ID must reference a PUBLIC client (SPA) registration:
 *   - Platform: Single-page application with the app's origin as redirect URI
 *   - No client secret (public client flow only)
 *   - API permissions: Azure Service Management → user_impersonation (delegated)
 *     or use the .default scope which includes all consented ARM scopes
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import type { TokenInfo } from '@kickstart/core';

// .default = all consented ARM scopes
const AZURE_MANAGEMENT_SCOPE = 'https://management.azure.com/.default';

let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
    if (!clientId) throw new Error('VITE_AZURE_CLIENT_ID is not configured');
    msalInstance = new PublicClientApplication({
      auth: { clientId, redirectUri: window.location.origin },
    });
  }
  return msalInstance;
}

/**
 * ARM-only token provider — always requests `management.azure.com/.default`
 * regardless of the `scopes` argument supplied by the `TokenProvider` contract.
 * This is intentional: the Playground Azure connector is exclusively ARM-scoped,
 * and MSAL requires a concrete resource scope string rather than a delegated
 * connector-level scope list.  If this provider is ever reused for a non-ARM
 * connector the caller should wrap it and supply the appropriate scope.
 */
export async function acquireAzureToken(_scopes: string[]): Promise<TokenInfo> {
  const msal = getMsalInstance();
  await msal.initialize();
  const accounts = msal.getAllAccounts();
  let result;
  try {
    result =
      accounts.length > 0
        ? await msal.acquireTokenSilent({ scopes: [AZURE_MANAGEMENT_SCOPE], account: accounts[0] })
        : await msal.acquireTokenPopup({ scopes: [AZURE_MANAGEMENT_SCOPE] });
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      result = await msal.acquireTokenPopup({ scopes: [AZURE_MANAGEMENT_SCOPE] });
    } else {
      throw e;
    }
  }
  return {
    accessToken: result.accessToken,
    expiresAt: result.expiresOn ? Math.floor(result.expiresOn.getTime() / 1000) : 0,
    scopes: result.scopes,
  };
}
