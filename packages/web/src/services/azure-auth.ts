import type { AzureSubscription } from '@kickstart/core';
import { listAzureSubscriptions } from './azure-resources';

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

const AZURE_LOGIN_PATH = '/.auth/login/aad';
const AZURE_LOGOUT_PATH = '/.auth/logout';
const AZURE_IDENTITY_PROVIDERS = new Set(['aad', 'azureactivedirectory', 'entra', 'microsoft']);
const AZURE_SIGNIN_UNAVAILABLE = 'Azure sign-in is unavailable in this environment.';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readClaim(principal: Record<string, unknown>, claimType: string): string | undefined {
  const claims = Array.isArray(principal.userClaims) ? principal.userClaims : [];

  for (const claim of claims) {
    const record = asRecord(claim);
    if (readString(record?.typ)?.toLowerCase() === claimType.toLowerCase()) {
      return readString(record?.val);
    }
  }

  return undefined;
}

function getCurrentRelativeUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname || '/'}${window.location.search}${window.location.hash}`;
}

function normalizeRedirectUri(value: string): string {
  if (!value) return '/';
  if (value.startsWith('/')) return value;

  if (typeof window === 'undefined') {
    return value.startsWith('http') ? '/' : `/${value.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    return `${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function buildRedirectUrl(path: string, paramName: string, redirectUri: string): string {
  return `${path}?${paramName}=${encodeURIComponent(normalizeRedirectUri(redirectUri))}`;
}

function parseClientPrincipal(body: unknown): Record<string, unknown> | undefined {
  const root = Array.isArray(body) ? body[0] : body;
  return asRecord(asRecord(root)?.clientPrincipal);
}

function isAzureIdentityProvider(provider?: string): boolean {
  return !provider || AZURE_IDENTITY_PROVIDERS.has(provider.toLowerCase());
}

function toUserSummary(principal: Record<string, unknown>): AzureUserSummary {
  const username = readString(principal.userDetails)
    ?? readClaim(principal, 'preferred_username')
    ?? readClaim(principal, 'email')
    ?? readClaim(principal, 'emails');

  return {
    name: readClaim(principal, 'name') ?? username,
    username,
    tenantId: readClaim(principal, 'tid') ?? readString(principal.tenantId),
  };
}

function unavailableSessionState(): AzureAuthSessionState {
  return {
    configured: false,
    authenticated: false,
    subscriptions: [],
    error: AZURE_SIGNIN_UNAVAILABLE,
  };
}

async function loadSubscriptionsIfAvailable(): Promise<AzureSubscription[]> {
  try {
    return await listAzureSubscriptions();
  } catch {
    return [];
  }
}

export async function getAzureSession(): Promise<AzureAuthSessionState> {
  try {
    const response = await fetch('/.auth/me', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return unavailableSessionState();
    }

    const body = await response.json().catch(() => undefined);
    const principal = parseClientPrincipal(body);
    if (!principal) {
      return {
        configured: true,
        authenticated: false,
        subscriptions: [],
      };
    }

    const user = toUserSummary(principal);
    const hasIdentity = Boolean(
      user.username
      || user.name
      || readString(principal.userId),
    );

    if (!hasIdentity || !isAzureIdentityProvider(readString(principal.identityProvider))) {
      return {
        configured: true,
        authenticated: false,
        user,
        subscriptions: [],
      };
    }

    return {
      configured: true,
      authenticated: true,
      user,
      subscriptions: await loadSubscriptionsIfAvailable(),
    };
  } catch {
    return unavailableSessionState();
  }
}

export function getAzureSignInUrl(postLoginRedirectUri = getCurrentRelativeUrl()): string {
  return buildRedirectUrl(AZURE_LOGIN_PATH, 'post_login_redirect_uri', postLoginRedirectUri);
}

export function redirectToAzureSignIn(postLoginRedirectUri = getCurrentRelativeUrl()): void {
  if (typeof window !== 'undefined') {
    window.location.assign(getAzureSignInUrl(postLoginRedirectUri));
  }
}

export function getAzureSignOutUrl(postLogoutRedirectUri = getCurrentRelativeUrl()): string {
  return buildRedirectUrl(AZURE_LOGOUT_PATH, 'post_logout_redirect_uri', postLogoutRedirectUri);
}

export function redirectToAzureSignOut(postLogoutRedirectUri = getCurrentRelativeUrl()): void {
  if (typeof window !== 'undefined') {
    window.location.assign(getAzureSignOutUrl(postLogoutRedirectUri));
  }
}
