import type { APIConnector, ConfigurableConnector } from './types.js';

/**
 * Central registry for APIConnectors.
 *
 * Usage:
 *   const registry = new APIConnectorRegistry();
 *   registry.register(new AzureARMConnector());
 *   const arm = registry.get('azure-arm');
 *
 * IntegrationKits (B-10) call `registry.register()` at kit activation time
 * so they can contribute their own connectors without touching app bootstrap.
 */
export class APIConnectorRegistry {
  private readonly connectors = new Map<string, APIConnector>();

  /** Register a connector.  Overwrites any existing connector with the same name. */
  register(connector: APIConnector): void {
    this.connectors.set(connector.name, connector);
  }

  /**
   * Look up a connector by name.
   * Returns `undefined` if no connector with that name has been registered.
   */
  get(name: string): APIConnector | undefined {
    return this.connectors.get(name);
  }

  /**
   * Look up a connector by name and narrow to ConfigurableConnector.
   * Returns `undefined` if not found or if the connector doesn't support auth configuration.
   */
  getConfigurable(name: string): ConfigurableConnector | undefined {
    const connector = this.connectors.get(name);
    if (connector && 'setAuthProvider' in connector) {
      return connector as ConfigurableConnector;
    }
    return undefined;
  }

  /** Returns all registered connector names. */
  names(): string[] {
    return Array.from(this.connectors.keys());
  }

  /** Returns true if a connector with the given name is registered. */
  has(name: string): boolean {
    return this.connectors.has(name);
  }

  /** Remove a connector from the registry. */
  unregister(name: string): void {
    this.connectors.delete(name);
  }
}

/** Shared default registry — used by both the React app and server-side Azure Functions. */
export const defaultConnectorRegistry = new APIConnectorRegistry();
