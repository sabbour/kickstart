/**
 * Azure authentication service.
 *
 * Provides helpers for reading Azure tokens from the session context and
 * constructing authenticated fetch headers for ARM API calls.
 *
 * Tokens are always read from the session context — NEVER from SSE events,
 * browser props, or environment variables at runtime.
 */
import type { SessionCtx } from '@aks-kickstart/harness';
export interface AzureTokens {
    armToken: string;
}
/**
 * Reads the Azure ARM token from the session context.
 * Throws if no token is present (user must authenticate via azure:select_subscription first).
 */
export declare function getAzureToken(session: SessionCtx | undefined): string;
/**
 * Returns fetch headers for an authenticated ARM request.
 */
export declare function armAuthHeaders(token: string): Record<string, string>;
/**
 * Returns the ARM base URL.
 */
export declare function armBaseUrl(): string;
/**
 * Builds a full ARM URL from a path and API version.
 */
export declare function armUrl(path: string, apiVersion: string): string;
/** ARM hosts that are permitted as LRO polling targets. */
export declare const ARM_POLLING_HOSTS: Set<string>;
/**
 * Validates that an LRO polling URL uses HTTPS and targets a known ARM host.
 * Throws if the URL is invalid, non-HTTPS, or targets an unrecognised host.
 */
export declare function assertArmPollingUrl(url: string): void;
/**
 * Handles ARM LRO (Long-Running Operation) polling.
 * Polls Azure-AsyncOperation or Location header until the operation completes.
 */
export declare function pollArmLro(operationUrl: string, token: string, options?: {
    maxAttempts?: number;
    intervalMs?: number;
}): Promise<Record<string, unknown>>;
//# sourceMappingURL=azure-auth.d.ts.map