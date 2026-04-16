import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  APIConnectorRegistry,
  AzureARMConnector,
  GitHubConnector,
  PricingConnector,
} from '@kickstart/core';
import type { APIConnector } from '@kickstart/core';

interface APIConnectorContextValue {
  registry: APIConnectorRegistry;
  /** Convenience helper — equivalent to registry.get(name). */
  getConnector: (name: string) => APIConnector | undefined;
}

const APIConnectorContext = createContext<APIConnectorContextValue | null>(null);

function shouldUsePlaygroundStubRegistry(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('playground');
}

interface APIConnectorProviderProps {
  children: ReactNode;
  /**
   * Optional: pass a pre-configured registry (useful in tests or Storybook).
   * When omitted, a default registry with AzureARM + GitHub + Pricing connectors
   * is created automatically.
   */
  registry?: APIConnectorRegistry;
}

/**
 * Provides the APIConnector registry to the React tree.
 *
 * Place this near the top of your component tree (wrapping the whole app).
 * Connectors are initialized at mount time — no re-renders on connector state
 * changes.
 *
 * Usage:
 *   <APIConnectorProvider>
 *     <App />
 *   </APIConnectorProvider>
 */
export function APIConnectorProvider({
  children,
  registry: externalRegistry,
}: APIConnectorProviderProps) {
  const registry = useMemo(() => {
    if (externalRegistry) return externalRegistry;

    const r = new APIConnectorRegistry();
    // Playground intentionally omits auth-gated connectors so fat components
    // exercise their built-in offline/stub flows without live credentials.
    if (!shouldUsePlaygroundStubRegistry()) {
      r.register(new AzureARMConnector({
        auth: { kind: 'none' },
        corsProxy: {
          proxyBaseUrl: '/api/arm-proxy',
        },
      }));
      r.register(new GitHubConnector({
        auth: { kind: 'oauth2', scopes: ['read:user'] },
        serverBaseUrl: '/api/github',
      }));
    }
    r.register(new PricingConnector());
    return r;
  }, [externalRegistry]);

  // Pre-authenticate connectors that need it on mount.
  // Failures are swallowed here — each connector logs its own warning.
  useEffect(() => {
    for (const name of registry.names()) {
      const connector = registry.get(name);
      if (connector && connector.name !== 'github' && !connector.isAuthenticated()) {
        connector.authenticate().catch(() => {
          // Intentionally silent — stub connectors warn inside authenticate()
        });
      }
    }
  }, [registry]);

  const value = useMemo<APIConnectorContextValue>(
    () => ({
      registry,
      getConnector: (name: string) => registry.get(name),
    }),
    [registry],
  );

  return (
    <APIConnectorContext.Provider value={value}>{children}</APIConnectorContext.Provider>
  );
}

/**
 * Returns the connector registered under `name`, or `undefined` if not found.
 *
 * Must be used inside an `<APIConnectorProvider>`.
 *
 * Usage:
 *   const arm = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
 */
export function useAPIConnector(name: string): APIConnector | undefined {
  const ctx = useContext(APIConnectorContext);
  if (!ctx) {
    throw new Error('useAPIConnector must be used within an <APIConnectorProvider>');
  }
  return ctx.getConnector(name);
}

/**
 * Returns the full connector registry.
 *
 * Use this when you need to register connectors dynamically (e.g., from an
 * IntegrationKit) or when you want to enumerate all available connectors.
 */
export function useAPIConnectorRegistry(): APIConnectorRegistry {
  const ctx = useContext(APIConnectorContext);
  if (!ctx) {
    throw new Error('useAPIConnectorRegistry must be used within an <APIConnectorProvider>');
  }
  return ctx.registry;
}
