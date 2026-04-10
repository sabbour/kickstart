/**
 * Abstract base class for all authenticated API connectors.
 *
 * Handles:
 * - Token lifecycle (acquire / cache / refresh via injected TokenProvider)
 * - Auth header injection
 * - CORS proxy URL rewriting
 * - Retry with exponential backoff
 * - Stub mode when no TokenProvider is set (auth: none)
 */

import type {
  APIConnector,
  APIConnectorRequestOptions,
  AuthStrategy,
  ConnectorConfig,
  CORSProxyConfig,
  HttpMethod,
  RetryConfig,
  TokenInfo,
  TokenProvider,
} from './types.js';
import { ConnectorError, DEFAULT_RETRY_CONFIG } from './types.js';
import { withRetry } from './retry.js';

/** Token expiry buffer — refresh 60 s before actual expiry. */
const TOKEN_BUFFER_S = 60;

export abstract class BaseConnector implements APIConnector {
  abstract readonly name: string;

  private readonly _auth: AuthStrategy;
  private readonly _corsProxy?: CORSProxyConfig;
  private readonly _retryConfig: RetryConfig;
  private readonly _baseUrlOverride?: string;

  private _tokenProvider: TokenProvider | null = null;
  private _cachedToken: TokenInfo | null = null;

  constructor(config?: ConnectorConfig) {
    this._auth = config?.auth ?? { kind: 'none' };
    this._corsProxy = config?.corsProxy;
    this._retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config?.retry };
    this._baseUrlOverride = config?.baseUrl;
  }

  /** The effective base URL (override > default). */
  get baseUrl(): string {
    return this._baseUrlOverride ?? this.defaultBaseUrl;
  }

  /** Subclasses provide the default base URL for the service. */
  protected abstract get defaultBaseUrl(): string;

  // ── Token management ─────────────────────────────────────────────────────

  /**
   * Inject a token provider.  The web layer calls this at init time
   * to wire in MSAL or GitHub OAuth without the core package depending
   * on browser APIs.
   */
  setTokenProvider(provider: TokenProvider): void {
    this._tokenProvider = provider;
    this._cachedToken = null; // invalidate cache when provider changes
  }

  /**
   * Authenticate by acquiring a fresh token via the injected provider.
   * No-op if auth strategy is "none" or no provider has been set (stub mode).
   */
  async authenticate(): Promise<void> {
    if (this._auth.kind === 'none' || !this._tokenProvider) return;

    const scopes = this._auth.kind === 'oauth2' ? this._auth.scopes : [];
    try {
      this._cachedToken = await this._tokenProvider(scopes);
    } catch (error: unknown) {
      throw new ConnectorError('Failed to acquire token', 'AUTH_FAILED', {
        retryable: false,
        cause: error,
      });
    }
  }

  isAuthenticated(): boolean {
    if (this._auth.kind === 'none') return true;
    if (!this._cachedToken) return false;
    return this._cachedToken.expiresAt > nowEpochS() + TOKEN_BUFFER_S;
  }

  /** Returns the current cached token, or null if not authenticated. */
  protected getToken(): string | null {
    if (!this._cachedToken) return null;
    if (this._cachedToken.expiresAt <= nowEpochS() + TOKEN_BUFFER_S) return null;
    return this._cachedToken.accessToken;
  }

  // ── Request pipeline ─────────────────────────────────────────────────────

  async request(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response> {
    // Auto-refresh token if expired
    if (this._tokenProvider && !this.isAuthenticated()) {
      await this.authenticate();
    }

    return withRetry(async () => {
      const url = this.resolveUrl(path);
      const headers = this.buildHeaders(options?.headers);

      return fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
    }, this._retryConfig);
  }

  // ── URL resolution ───────────────────────────────────────────────────────

  /**
   * Resolve a path into a full URL, applying CORS proxy rewriting if configured.
   */
  private resolveUrl(path: string): string {
    const directUrl = `${this.baseUrl}${path}`;

    if (!this._corsProxy) return directUrl;

    if (this._corsProxy.useQueryParam) {
      return `${this._corsProxy.proxyBaseUrl}?url=${encodeURIComponent(directUrl)}`;
    }

    // Path-based proxy: strip the base URL and append to proxy base
    return `${this._corsProxy.proxyBaseUrl}${path}`;
  }

  // ── Header construction ──────────────────────────────────────────────────

  /**
   * Build the full set of headers for a request, including auth + defaults.
   * Subclasses can override `defaultHeaders()` to add service-specific headers.
   */
  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders(),
    };

    // Auth header injection
    const token = this.getToken();
    if (token) {
      if (this._auth.kind === 'api-key') {
        const headerName = this._auth.headerName ?? 'Authorization';
        const prefix = this._auth.prefix ? `${this._auth.prefix} ` : '';
        headers[headerName] = `${prefix}${token}`;
      } else {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // CORS proxy extra headers
    if (this._corsProxy?.extraHeaders) {
      Object.assign(headers, this._corsProxy.extraHeaders);
    }

    // Caller overrides
    if (extra) {
      Object.assign(headers, extra);
    }

    return headers;
  }

  /**
   * Override in subclasses to provide service-specific default headers.
   * Called on every request, merged before auth and caller headers.
   */
  protected defaultHeaders(): Record<string, string> {
    return {};
  }
}

function nowEpochS(): number {
  return Math.floor(Date.now() / 1000);
}
