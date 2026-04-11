import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { APIConnectorRegistry, AzureARMConnector, GitHubConnector, PricingConnector, } from '@kickstart/core';
const APIConnectorContext = createContext(null);
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
export function APIConnectorProvider({ children, registry: externalRegistry, }) {
    const registry = useMemo(() => {
        if (externalRegistry)
            return externalRegistry;
        const r = new APIConnectorRegistry();
        r.register(new AzureARMConnector());
        r.register(new GitHubConnector());
        r.register(new PricingConnector());
        return r;
    }, [externalRegistry]);
    // Pre-authenticate connectors that need it on mount.
    // Failures are swallowed here — each connector logs its own warning.
    useEffect(() => {
        for (const name of registry.names()) {
            const connector = registry.get(name);
            if (connector && !connector.isAuthenticated()) {
                connector.authenticate().catch(() => {
                    // Intentionally silent — stub connectors warn inside authenticate()
                });
            }
        }
    }, [registry]);
    const value = useMemo(() => ({
        registry,
        getConnector: (name) => registry.get(name),
    }), [registry]);
    return (<APIConnectorContext.Provider value={value}>{children}</APIConnectorContext.Provider>);
}
/**
 * Returns the connector registered under `name`, or `undefined` if not found.
 *
 * Must be used inside an `<APIConnectorProvider>`.
 *
 * Usage:
 *   const arm = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
 */
export function useAPIConnector(name) {
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
export function useAPIConnectorRegistry() {
    const ctx = useContext(APIConnectorContext);
    if (!ctx) {
        throw new Error('useAPIConnectorRegistry must be used within an <APIConnectorProvider>');
    }
    return ctx.registry;
}
//# sourceMappingURL=APIConnectorContext.js.map