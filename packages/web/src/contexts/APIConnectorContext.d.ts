import React, { type ReactNode } from 'react';
import { APIConnectorRegistry } from '@kickstart/core';
import type { APIConnector } from '@kickstart/core';
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
export declare function APIConnectorProvider({ children, registry: externalRegistry, }: APIConnectorProviderProps): React.JSX.Element;
/**
 * Returns the connector registered under `name`, or `undefined` if not found.
 *
 * Must be used inside an `<APIConnectorProvider>`.
 *
 * Usage:
 *   const arm = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
 */
export declare function useAPIConnector(name: string): APIConnector | undefined;
/**
 * Returns the full connector registry.
 *
 * Use this when you need to register connectors dynamically (e.g., from an
 * IntegrationKit) or when you want to enumerate all available connectors.
 */
export declare function useAPIConnectorRegistry(): APIConnectorRegistry;
export {};
//# sourceMappingURL=APIConnectorContext.d.ts.map