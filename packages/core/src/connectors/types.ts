/**
 * Core APIConnector types.
 *
 * An APIConnector is an authenticated API client adapter. It owns the
 * token lifecycle, CORS proxying, and request plumbing so the rest of the
 * app never has to think about auth.
 */

export interface APIConnectorRequestOptions {
  headers?: Record<string, string>;
  /** Abort signal — pass to cancel long-running requests. */
  signal?: AbortSignal;
}

/**
 * The canonical interface every connector must implement.
 *
 * - `name` is the registry key (e.g. "azure-arm", "github", "pricing").
 * - `baseUrl` is the root endpoint this connector talks to.
 * - `authenticate()` acquires / refreshes auth tokens.  Connectors that
 *   need no auth (PricingConnector) implement this as a no-op.
 * - `request()` sends an HTTP request through the connector, attaching
 *   whatever auth headers the connector manages.
 * - `isAuthenticated()` returns true if the connector currently holds a
 *   valid token (or doesn't require one).
 */
export interface APIConnector {
  readonly name: string;
  readonly baseUrl: string;
  authenticate(): Promise<void>;
  request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response>;
  isAuthenticated(): boolean;
}
