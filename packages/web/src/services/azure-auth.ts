import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser';
import type { AzureARMConnector, AzureSubscription } from '@kickstart/core';
import { apiFetch } from './api-client';

const DEFAULT_ARM_SCOPE = 'https://management.azure.com/.default';

export interface AzureAuthConfig {
  configured: boolean;
  clientId?: string;
  tenantId?: string;
  authority?: string;
  redirectUri?: string;
  scopes: string[];
}

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

let configPromise: Promise<AzureAuthConfig> | null = null;
let clientPromise: Promise<PublicClientApplication | null> | null = null;
let activeAccount: AccountInfo | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length > 0 ? strings : undefined;
}

function readErrorMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  const direct = readString(record?.error);
  const nested = readString(asRecord(record?.error)?.message);
  return direct ?? nested ?? fallback;
}

function normalizeConfig(body: unknown): AzureAuthConfig {
  const root = asRecord(body) ?? {};
  const nested = asRecord(root.auth) ?? asRecord(root.msal) ?? root;
  const clientId = readString(nested.clientId) ?? readString(nested.applicationId) ?? readString(root.clientId);
  const tenantId = readString(nested.tenantId) ?? readString(nested.directoryId) ?? readString(root.tenantId);
  const scopes = readStringArray(nested.scopes) ?? readStringArray(root.scopes) ?? [DEFAULT_ARM_SCOPE];
  const redirectUri = readString(nested.redirectUri) ?? readString(root.redirectUri) ?? window.location.origin;
  const authority = readString(nested.authority)
    ?? readString(root.authority)
    ?? (tenantId ? `https://login.microsoftonline.com/${tenantId}` : undefined);
  const configured = typeof nested.configured === 'boolean'
    ? nested.configured
    : typeof root.configured === 'boolean'
      ? root.configured
      : Boolean(clientId);

  return {
    configured,
    clientId,
    tenantId,
    authority,
    redirectUri,
    scopes,
  };
}

function toUserSummary(account: AccountInfo | null, tenantId?: string): AzureUserSummary | undefined {
  if (!account) return undefined;
  return {
    name: account.name ?? undefined,
    username: account.username || undefined,
    tenantId: account.tenantId ?? tenantId,
  };
}

function toTokenInfo(result: AuthenticationResult) {
  return {
    accessToken: result.accessToken,
    expiresAt: result.expiresOn
      ? Math.floor(result.expiresOn.getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 3600,
  };
}

function setPreferredAccount(client: PublicClientApplication, account: AccountInfo | null) {
  activeAccount = account;
  if (account) {
    client.setActiveAccount(account);
  }
}

function getPreferredAccount(client: PublicClientApplication): AccountInfo | null {
  const current = activeAccount ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
  if (current) {
    setPreferredAccount(client, current);
  }
  return current;
}

function isInteractionError(error: unknown): boolean {
  return error instanceof InteractionRequiredAuthError
    || (error instanceof Error && typeof (error as Error & { errorCode?: unknown }).errorCode === 'string'
      && String((error as Error & { errorCode?: unknown }).errorCode).includes('interaction_required'));
}

export async function getAzureAuthConfig(): Promise<AzureAuthConfig> {
  configPromise ??= (async () => {
    const response = await apiFetch('/api/azure-auth/config');
    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(readErrorMessage(body, 'Unable to load Azure auth configuration.'));
    }
    return normalizeConfig(body);
  })();

  return configPromise;
}

async function getMsalClient(): Promise<PublicClientApplication | null> {
  clientPromise ??= (async () => {
    const config = await getAzureAuthConfig();
    if (!config.configured || !config.clientId) {
      return null;
    }

    const client = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: config.redirectUri,
      },
      cache: {
        cacheLocation: 'sessionStorage',
      },
    });

    await client.initialize();
    const redirectResult = await client.handleRedirectPromise().catch(() => null);
    setPreferredAccount(client, redirectResult?.account ?? getPreferredAccount(client));
    return client;
  })();

  return clientPromise;
}

async function acquireAzureToken(scopes: string[], interactive: boolean): Promise<AuthenticationResult> {
  const client = await getMsalClient();
  if (!client) {
    throw new Error('Azure sign-in is not configured on the server.');
  }

  const requestedScopes = scopes.length > 0 ? scopes : (await getAzureAuthConfig()).scopes;
  const account = getPreferredAccount(client);

  if (account) {
    try {
      const silentResult = await client.acquireTokenSilent({
        account,
        scopes: requestedScopes,
      });
      setPreferredAccount(client, silentResult.account ?? account);
      return silentResult;
    } catch (error) {
      if (!interactive || !isInteractionError(error)) {
        throw error;
      }

      const popupResult = await client.acquireTokenPopup({
        account,
        scopes: requestedScopes,
      });
      setPreferredAccount(client, popupResult.account ?? account);
      return popupResult;
    }
  }

  if (!interactive) {
    throw new Error('Sign in to Azure before continuing.');
  }

  const loginResult = await client.loginPopup({
    scopes: requestedScopes,
    prompt: 'select_account',
  });
  const resolvedAccount = loginResult.account ?? getPreferredAccount(client);
  if (!resolvedAccount) {
    throw new Error('Azure sign-in did not return an account.');
  }

  setPreferredAccount(client, resolvedAccount);

  if (loginResult.accessToken) {
    return loginResult;
  }

  const tokenResult = await client.acquireTokenSilent({
    account: resolvedAccount,
    scopes: requestedScopes,
  });
  setPreferredAccount(client, tokenResult.account ?? resolvedAccount);
  return tokenResult;
}

export async function ensureAzureConnectorConfigured(
  connector?: AzureARMConnector,
): Promise<AzureAuthConfig> {
  const config = await getAzureAuthConfig();

  if (connector && config.configured) {
    connector.setTokenProvider(async (scopes) => {
      const result = await acquireAzureToken(scopes, true);
      return toTokenInfo(result);
    });
  }

  return config;
}

export async function getAzureSession(
  connector?: AzureARMConnector,
): Promise<AzureAuthSessionState> {
  const config = await ensureAzureConnectorConfigured(connector);
  if (!config.configured) {
    return {
      configured: false,
      authenticated: false,
      subscriptions: [],
      error: 'Azure sign-in is not configured on the server.',
    };
  }

  const client = await getMsalClient();
  const account = client ? getPreferredAccount(client) : null;
  if (!account) {
    return {
      configured: true,
      authenticated: false,
      subscriptions: [],
    };
  }

  try {
    await acquireAzureToken(config.scopes, false);
    const subscriptions = connector ? await connector.listSubscriptions() : [];
    return {
      configured: true,
      authenticated: true,
      user: toUserSummary(account, config.tenantId),
      subscriptions,
    };
  } catch (error) {
    return {
      configured: true,
      authenticated: false,
      user: toUserSummary(account, config.tenantId),
      subscriptions: [],
      error: error instanceof Error ? error.message : 'Azure sign-in needs to be refreshed.',
    };
  }
}

export async function signInToAzure(
  connector?: AzureARMConnector,
): Promise<AzureAuthSessionState> {
  const config = await ensureAzureConnectorConfigured(connector);
  if (!config.configured || !connector) {
    return {
      configured: false,
      authenticated: false,
      subscriptions: [],
      error: 'Azure sign-in is not configured on the server.',
    };
  }

  await connector.authenticate();
  const subscriptions = await connector.listSubscriptions();
  const client = await getMsalClient();
  const account = client ? getPreferredAccount(client) : null;

  return {
    configured: true,
    authenticated: connector.isAuthenticated(),
    user: toUserSummary(account, config.tenantId),
    subscriptions,
  };
}

export async function signOutAzure(connector?: AzureARMConnector): Promise<void> {
  const client = await getMsalClient();
  if (client) {
    const account = getPreferredAccount(client);
    await client.logoutPopup({
      account: account ?? undefined,
      mainWindowRedirectUri: window.location.href,
    });
    setPreferredAccount(client, null);
  }

  if (connector) {
    await ensureAzureConnectorConfigured(connector);
  }
}
