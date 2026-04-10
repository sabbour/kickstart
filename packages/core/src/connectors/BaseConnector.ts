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
  AuthProvider,
  APIConnectorRequestOptions,
  AuthStrategy,
  ConfigurableConnector,
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

export abstract class BaseConnector implements ConfigurableConnector {
  abstract readonly name: string;

  private readonly _auth: AuthStrategy;
  private readonly _corsProxy?: CORSProxyConfig;
  private readonly _retryConfig: RetryConfig;
  private readonly _baseUrlOverride?: string;
  private readonly _allowStubMode: boolean;
  private readonly _allowedProxyHosts: string[];

  private _tokenProvider: TokenProvider | null = null;
  private _authProvider: AuthProvider | null = null;
  private _cachedToken: TokenInfo | null = null;
  private _cachedApiKey: string | null = null;

  constructor(config?: ConnectorConfig) {
    this._auth = config?.auth ?? { kind: 'none' };
    this._corsProxy = config?.corsProxy;
    this._retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config?.retry };
    this._baseUrlOverride = config?.baseUrl;
    this._allowStubMode = config?.allowStubMode ?? false;
    this._allowedProxyHosts = config?.allowedProxyHosts ?? [];
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
    this._authProvider = { kind: 'oauth2', getToken: provider };
    this._cachedToken = null;
    this._cachedApiKey = null;
  }

  /**
   * Inject a strategy-aware auth provider.
   * Supports oauth2, api-key, and managed-identity strategies.
   * Throws if the provider's kind doesn't match the configured auth strategy.
   */
  setAuthProvider(provider: AuthProvider): void {
    if (this._auth.kind !== 'none' && provider.kind !== this._auth.kind) {
      throw new ConnectorError(
        `Auth provider kind "${provider.kind}" does not match configured auth strategy "${this._auth.kind}" for connector "${this.name}"`,
        'AUTH_FAILED',
        { retryable: false },
      );
    }
    this._authProvider = provider;
    this._tokenProvider = provider.kind === 'oauth2' ? provider.getToken.bind(provider) : null;
    this._cachedToken = null;
    this._cachedApiKey = null;
  }

  /**
   * Authenticate by acquiring a fresh token via the injected provider.
   * No-op if auth strategy is "none" or no provider has been set (stub mode).
   */
  async authenticate(): Promise<void> {
    if (this._auth.kind === 'none') return;

    if (!this._authProvider && !this._tokenProvider) {
      if (this._allowStubMode) return;
      throw new ConnectorError(
        `Connector "${this.name}" has no auth provider and stub mode is not enabled`,
        'STUB_MODE_DISABLED',
        { retryable: false },
      );
    }

    try {
      if (this._authProvider) {
        switch (this._authProvider.kind) {
          case 'oauth2': {
            const scopes = this._auth.kind === 'oauth2' ? this._auth.scopes : [];
            this._cachedToken = await this._authProvider.getToken(scopes);
            break;
          }
          case 'api-key': {
            this._cachedApiKey = await this._authProvider.getApiKey();
            break;
          }
          case 'managed-identity': {
            const resource = this._auth.kind === 'managed-identity' ? this._auth.resource : '';
            const clientId = this._auth.kind === 'managed-identity' ? this._auth.clientId : undefined;
            this._cachedToken = await this._authProvider.getToken(resource, clientId);
            break;
          }
        }
      } else if (this._tokenProvider) {
        const scopes = this._auth.kind === 'oauth2' ? this._auth.scopes : [];
        this._cachedToken = await this._tokenProvider(scopes);
      }
    } catch (error: unknown) {
      throw new ConnectorError('Failed to acquire token', 'AUTH_FAILED', {
        retryable: false,
        cause: error,
      });
    }
  }

  isAuthenticated(): boolean {
    if (this._auth.kind === 'none') return true;
    if (this._auth.kind === 'api-key' && this._cachedApiKey) return true;
    if (!this._cachedToken) return false;
    return this._cachedToken.expiresAt > nowEpochS() + TOKEN_BUFFER_S;
  }

  /**
   * Returns true when stub/offline mode is active.
   * Stub mode requires explicit opt-in via `allowStubMode: true`.
   * Throws ConnectorError if not authenticated and stub mode is disabled.
   */
  protected isStubMode(): boolean {
    if (this.isAuthenticated()) return false;
    if (this._authProvider || this._tokenProvider) return false;
    if (this._allowStubMode) return true;
    throw new ConnectorError(
      `Connector "${this.name}" is not authenticated and stub mode is not enabled. ` +
      'Configure an auth provider, or set allowStubMode: true in config for offline use.',
      'STUB_MODE_DISABLED',
      { retryable: false },
    );
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
    if ((this._authProvider || this._tokenProvider) && !this.isAuthenticated()) {
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

    this.validateProxyTarget(directUrl);

    if (this._corsProxy.useQueryParam) {
      return `${this._corsProxy.proxyBaseUrl}?url=${encodeURIComponent(directUrl)}`;
    }

    // Path-based proxy: strip the base URL and append to proxy base
    return `${this._corsProxy.proxyBaseUrl}${path}`;
  }

  /**
   * Validate that the target URL host is in the allowed proxy hosts list.
   * Automatically includes the connector's own base URL host(s).
   */
  private validateProxyTarget(targetUrl: string): void {
    const allowedHosts = new Set(this._allowedProxyHosts);

    // Auto-allow the connector's own base URL hosts
    try { allowedHosts.add(new URL(this.defaultBaseUrl).hostname); } catch { /* skip */ }
    if (this._baseUrlOverride) {
      try { allowedHosts.add(new URL(this._baseUrlOverride).hostname); } catch { /* skip */ }
    }

    try {
      const targetHost = new URL(targetUrl).hostname;
      const isAllowed = [...allowedHosts].some(
        (h) => targetHost === h || targetHost.endsWith(`.${h}`),
      );
      if (!isAllowed) {
        throw new ConnectorError(
          `Proxy target host "${targetHost}" is not in the allowed hosts list`,
          'PROXY_HOST_BLOCKED',
          { retryable: false },
        );
      }
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      throw new ConnectorError(
        `Invalid proxy target URL: ${targetUrl}`,
        'BAD_REQUEST',
        { retryable: false, cause: error },
      );
    }
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
    if (this._auth.kind === 'api-key' && this._cachedApiKey) {
      const headerName = this._auth.headerName ?? 'Authorization';
      const prefix = this._auth.prefix ? `${this._auth.prefix} ` : '';
      headers[headerName] = `${prefix}${this._cachedApiKey}`;
    } else {
      const token = this.getToken();
      if (token) {
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
