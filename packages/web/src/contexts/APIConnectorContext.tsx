import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  APIConnectorRegistry,
} from '@kickstart/harness';
import type { APIConnector, AzureARMConnector, GitHubConnector } from '@kickstart/harness';

interface APIConnectorContextValue {
  registry: APIConnectorRegistry;
  /** Convenience helper — equivalent to registry.get(name). */
  getConnector: (name: string) => APIConnector | undefined;
}

const APIConnectorContext = createContext<APIConnectorContextValue | null>(null);

interface APIConnectorProviderProps {
  children: ReactNode;
  /**
   * Optional: pass a pre-configured registry (useful in tests or Storybook).
   * When omitted, a default registry with AzureARM + GitHub stub connectors
   * is created automatically.
   */
  registry?: APIConnectorRegistry;
}

function createAzureARMConnectorStub(): AzureARMConnector {
  let subscriptionId: string | undefined;
  return {
    name: 'azure-arm',
    isAuthenticated: () => false,
    getToken: async () => null,
    getTenantId: () => undefined,
    getSubscriptionId: () => subscriptionId,
    setSubscriptionId: (id) => { subscriptionId = id; },
    authenticate: async () => undefined,
    request: async () => new Response(null, { status: 501, statusText: 'Not Implemented' }),
    listSubscriptions: async () => [],
    listLocations: async () => [],
    listResourceGroups: async () => [],
    listResources: async () => [],
  };
}

function createGitHubConnectorStub(): GitHubConnector {
  return {
    name: 'github',
    isAuthenticated: () => false,
    getToken: async () => null,
    getLogin: () => undefined,
    authenticate: async () => undefined,
    request: async () => new Response(null, { status: 501, statusText: 'Not Implemented' }),
    commitFilesAndCreatePullRequest: async () => { throw new Error('github connector not yet wired by pack'); },
  };
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
    r.register(createAzureARMConnectorStub());
    r.register(createGitHubConnectorStub());
    return r;
  }, [externalRegistry]);

  // Pre-authenticate connectors that need it on mount.
  // Failures are swallowed here — each connector logs its own warning.
  useEffect(() => {
    for (const name of registry.names()) {
      const connector = registry.get(name);
      if (connector && connector.name !== 'github' && !connector.isAuthenticated()) {
        void connector.authenticate().catch(() => {
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
