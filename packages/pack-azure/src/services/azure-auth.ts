/**
 * Azure authentication service.
 *
 * Provides helpers for reading Azure tokens from the session context and
 * constructing authenticated fetch headers for ARM API calls.
 *
 * Tokens are always read from the session context — NEVER from SSE events,
 * browser props, or environment variables at runtime.
 */

import type { SessionCtx } from '@kickstart/harness';

const ARM_AUDIENCE = 'https://management.azure.com';

export interface AzureTokens {
  armToken: string;
}

/**
 * Reads the Azure ARM token from the session context.
 * Throws if no token is present (user must authenticate via azure:select_subscription first).
 */
export function getAzureToken(session: SessionCtx | undefined): string {
  const tokens = (session as unknown as { tokens?: Record<string, string> })?.tokens;
  const token = tokens?.['azure'] ?? tokens?.['azure-token'];
  if (!token) {
    throw new Error(
      'No Azure access token found in session. ' +
      'Please authenticate first using the azure:select_subscription action.',
    );
  }
  return token;
}

/**
 * Returns fetch headers for an authenticated ARM request.
 */
export function armAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Returns the ARM base URL.
 */
export function armBaseUrl(): string {
  return ARM_AUDIENCE;
}

/**
 * Builds a full ARM URL from a path and API version.
 */
export function armUrl(path: string, apiVersion: string): string {
  return `${armBaseUrl()}${path}?api-version=${encodeURIComponent(apiVersion)}`;
}

/**
 * Handles ARM LRO (Long-Running Operation) polling.
 * Polls Azure-AsyncOperation or Location header until the operation completes.
 */
export async function pollArmLro(
  operationUrl: string,
  token: string,
  options: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<Record<string, unknown>> {
  const maxAttempts = options.maxAttempts ?? 30;
  const intervalMs = options.intervalMs ?? 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    const resp = await fetch(operationUrl, {
      headers: armAuthHeaders(token),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      throw new Error(`ARM LRO poll HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const status = (data['status'] as string | undefined)?.toLowerCase();

    if (status === 'succeeded') return data;
    if (status === 'failed') {
      const errDetail = JSON.stringify(data['error'] ?? data);
      throw new Error(`ARM LRO failed: ${errDetail}`);
    }
    if (status === 'canceled') {
      throw new Error('ARM LRO was canceled');
    }
    // 'Running' or 'InProgress' — keep polling
  }
  throw new Error(`ARM LRO polling timed out after ${maxAttempts} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
