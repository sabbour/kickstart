/**
 * Core APIConnector types.
 *
 * An APIConnector is an authenticated API client adapter. It owns the
 * token lifecycle, CORS proxying, and request plumbing so the rest of the
 * app never has to think about auth.
 */

// ── HTTP primitives ──────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface APIConnectorRequestOptions {
  headers?: Record<string, string>;
  /** Abort signal — pass to cancel long-running requests. */
  signal?: AbortSignal;
}

// ── Auth strategies ──────────────────────────────────────────────────────────

/** OAuth2 flow — token obtained via MSAL or GitHub OAuth. */
export interface OAuth2AuthStrategy {
  readonly kind: 'oauth2';
  /** OAuth2 scopes to request. */
  readonly scopes: string[];
  /** Optional tenant ID (Azure AD). */
  readonly tenantId?: string;
  /** Optional client ID override. */
  readonly clientId?: string;
}

/** Static API key sent in a header. */
export interface APIKeyAuthStrategy {
  readonly kind: 'api-key';
  /** Header name (default: "Authorization"). */
  readonly headerName?: string;
  /** Header value prefix (e.g. "Bearer", "token"). */
  readonly prefix?: string;
}

/** Azure Managed Identity — tokens acquired automatically in cloud environments. */
export interface ManagedIdentityAuthStrategy {
  readonly kind: 'managed-identity';
  /** Resource URL to request a token for. */
  readonly resource: string;
  /** Optional client ID for user-assigned managed identity. */
  readonly clientId?: string;
}

/** No authentication required (public APIs like Azure Pricing). */
export interface NoAuthStrategy {
  readonly kind: 'none';
}

export type AuthStrategy =
  | OAuth2AuthStrategy
  | APIKeyAuthStrategy
  | ManagedIdentityAuthStrategy
  | NoAuthStrategy;

// ── Token management ─────────────────────────────────────────────────────────

export interface TokenInfo {
  /** The raw access token string. */
  accessToken: string;
  /** Expiry as Unix epoch seconds. */
  expiresAt: number;
  /** Scopes granted by the token. */
  scopes?: string[];
}

/**
 * A TokenProvider is an async function that acquires tokens.
 * Injected via `setTokenProvider()` so connectors stay browser-agnostic —
 * the web layer provides the MSAL / OAuth implementation.
 */
export type TokenProvider = (scopes: string[]) => Promise<TokenInfo>;

// ── Retry configuration ──────────────────────────────────────────────────────

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000). */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 30000). */
  maxDelayMs: number;
  /** Jitter factor 0–1 applied to each delay (default: 0.5). */
  jitterFactor: number;
  /** HTTP status codes that trigger a retry (default: [429, 500, 502, 503, 504]). */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: Readonly<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitterFactor: 0.5,
  retryableStatuses: [429, 500, 502, 503, 504],
};

// ── CORS proxy ───────────────────────────────────────────────────────────────

export interface CORSProxyConfig {
  /** Base URL of the CORS proxy (e.g. "/api/proxy" for SWA Functions). */
  proxyBaseUrl: string;
  /**
   * If true, rewrites the full target URL as a query parameter.
   * e.g. /api/proxy?url=https://management.azure.com/...
   * If false, appends the path directly: /api/proxy/subscriptions/...
   */
  useQueryParam?: boolean;
  /** Extra headers the proxy requires. */
  extraHeaders?: Record<string, string>;
}

// ── Connector configuration ──────────────────────────────────────────────────

export interface ConnectorConfig {
  /** Auth strategy for this connector. */
  auth: AuthStrategy;
  /** Optional CORS proxy to route requests through. */
  corsProxy?: CORSProxyConfig;
  /** Retry configuration (defaults to DEFAULT_RETRY_CONFIG). */
  retry?: Partial<RetryConfig>;
  /** Base URL override (useful for testing / staging). */
  baseUrl?: string;
}

// ── Error handling ───────────────────────────────────────────────────────────

export type ConnectorErrorCode =
  | 'AUTH_FAILED'
  | 'TOKEN_EXPIRED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: ConnectorErrorCode,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

// ── APIConnector interface ───────────────────────────────────────────────────

/**
 * The canonical interface every connector must implement.
 *
 * - `name` is the registry key (e.g. "azure-arm", "github", "pricing").
 * - `baseUrl` is the root endpoint this connector talks to.
 * - `authenticate()` acquires / refreshes auth tokens.
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
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response>;
  isAuthenticated(): boolean;
}
