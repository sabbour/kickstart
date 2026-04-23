import type { AzureARMConnector, AzureSubscription } from '@aks-kickstart/harness';

export interface AzureUserSummary {
  name?: string;
  username?: string;
  tenantId?: string;
}

export interface AzureAuthSessionState {
  configured: boolean;
  authenticated: boolean;
  user?: AzureUserSummary;
  subscriptions: AzureSubscription[];
  error?: string;
}

interface SWAClaim {
  typ?: string;
  val?: string;
}

interface SWAClientPrincipal {
  identityProvider?: string;
  userDetails?: string;
  claims?: SWAClaim[];
}

interface SWAMeResponse {
  clientPrincipal?: SWAClientPrincipal | null;
}

const LOGIN_REDIRECT_PATH = '/.auth/login/aad';
const LOGOUT_REDIRECT_PATH = '/.auth/logout?post_logout_redirect_uri=/';

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function findClaim(principal: SWAClientPrincipal | null, type: string): string | undefined {
  return principal?.claims?.find((claim) => claim.typ === type)?.val;
}

function toUserSummary(principal: SWAClientPrincipal | null): AzureUserSummary | undefined {
  const username = readNonEmptyString(
    findClaim(principal, 'preferred_username')
      ?? findClaim(principal, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress')
      ?? principal?.userDetails,
  );
  const name = readNonEmptyString(
    findClaim(principal, 'name')
      ?? findClaim(principal, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
  );
  const tenantId = readNonEmptyString(findClaim(principal, 'tid'));

  if (!username && !name && !tenantId) {
    return undefined;
  }

  return {
    ...(name ? { name } : {}),
    ...(username ? { username } : {}),
    ...(tenantId ? { tenantId } : {}),
  };
}

function buildLoginRedirectPath(): string {
  const redirectTarget = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
  return `${LOGIN_REDIRECT_PATH}?post_login_redirect_uri=${encodeURIComponent(redirectTarget)}`;
}

async function getSwaPrincipal(): Promise<SWAClientPrincipal | null> {
  const response = await fetch('/.auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to check Microsoft sign-in status.');
  }

  const body = await response.json().catch(() => undefined) as SWAMeResponse | undefined;
  return body?.clientPrincipal ?? null;
}

async function listAzureSubscriptions(connector?: AzureARMConnector): Promise<AzureSubscription[]> {
  if (!connector) {
    throw new Error('Azure access is unavailable in this environment.');
  }

  try {
    return await connector.listSubscriptions();
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      throw error;
    }
    throw new Error('Unable to load Azure subscriptions.', { cause: error });
  }
}

export async function getAzureSession(
  connector?: AzureARMConnector,
): Promise<AzureAuthSessionState> {
  const principal = await getSwaPrincipal();
  const user = toUserSummary(principal);
  const isSignedIn = principal?.identityProvider === 'aad'
    || principal?.identityProvider === 'azureActiveDirectory';

  if (!principal || !isSignedIn) {
    return {
      configured: true,
      authenticated: false,
      subscriptions: [],
    };
  }

  try {
    const subscriptions = await listAzureSubscriptions(connector);
    return {
      configured: true,
      authenticated: true,
      ...(user ? { user } : {}),
      subscriptions,
    };
  } catch (error) {
    return {
      configured: true,
      authenticated: false,
      ...(user ? { user } : {}),
      subscriptions: [],
      error: error instanceof Error ? error.message : 'Azure sign-in needs to be refreshed.',
    };
  }
}

export async function signInToAzure(
  connector?: AzureARMConnector,
): Promise<AzureAuthSessionState> {
  const principal = await getSwaPrincipal().catch(() => null);
  if (!principal) {
    window.location.assign(buildLoginRedirectPath());
    return {
      configured: true,
      authenticated: false,
      subscriptions: [],
    };
  }

  return getAzureSession(connector);
}

export async function signOutAzure(): Promise<void> {
  window.location.assign(LOGOUT_REDIRECT_PATH);
}
