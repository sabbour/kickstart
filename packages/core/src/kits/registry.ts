/**
 * @module @kickstart/core/kits/registry
 *
 * IntegrationKitRegistry — central register for IntegrationKits.
 *
 * Registering a kit automatically:
 *   1. Records the kit in this registry (look up by name).
 *   2. Registers all kit tools into the provided ToolRegistry.
 *   3. Registers all kit connectors into the provided APIConnectorRegistry.
 *
 * Usage:
 *   import { registerKit, defaultKitRegistry } from '@kickstart/core';
 *   registerKit(azureKit);   // tools + connectors wired up automatically
 */

import type { IntegrationKit } from './types.js';
import { ToolRegistry, defaultRegistry } from '../tools/registry.js';
import { APIConnectorRegistry, defaultConnectorRegistry } from '../connectors/registry.js';

export class IntegrationKitRegistry {
  private readonly kits = new Map<string, IntegrationKit>();
  private readonly toolRegistry: ToolRegistry;
  private readonly connectorRegistry: APIConnectorRegistry;

  constructor(
    toolRegistry: ToolRegistry = defaultRegistry,
    connectorRegistry: APIConnectorRegistry = defaultConnectorRegistry,
  ) {
    this.toolRegistry = toolRegistry;
    this.connectorRegistry = connectorRegistry;
  }

  /**
   * Register a kit and auto-wire its tools and connectors into their
   * respective registries.  Overwrites any previously registered kit with
   * the same name.
   */
  register(kit: IntegrationKit): void {
    this.kits.set(kit.name, kit);
    this.toolRegistry.registerAll(kit.tools);
    for (const connector of kit.connectors) {
      this.connectorRegistry.register(connector);
    }
  }

  /** Look up a registered kit by name. Returns undefined if not found. */
  get(name: string): IntegrationKit | undefined {
    return this.kits.get(name);
  }

  /** Returns all registered kits. */
  getAll(): IntegrationKit[] {
    return Array.from(this.kits.values());
  }

  /** Returns all registered kit names. */
  names(): string[] {
    return Array.from(this.kits.keys());
  }

  /** Returns true if a kit with the given name is registered. */
  has(name: string): boolean {
    return this.kits.has(name);
  }

  /** Number of registered kits. */
  get size(): number {
    return this.kits.size;
  }
}

/** Singleton default registry backed by the default tool + connector registries. */
export const defaultKitRegistry = new IntegrationKitRegistry();

/**
 * Convenience function: register a kit into the default kit registry.
 * This is the primary entry point for wiring kits at app startup.
 *
 * Example (in main.tsx or app bootstrap):
 *   import { registerKit } from '@kickstart/core';
 *   import { azureKit } from '@kickstart/core/kits/azure-kit';
 *   registerKit(azureKit);
 */
export function registerKit(kit: IntegrationKit): void {
  defaultKitRegistry.register(kit);
}
