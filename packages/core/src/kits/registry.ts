/**
 * @module @kickstart/core/kits/registry
 *
 * IntegrationKitRegistry — central register for IntegrationKits.
 *
 * Registering a kit automatically:
 *   1. Validates dependencies (all declared deps must be registered first).
 *   2. Detects tool/connector name collisions with existing kits.
 *   3. Records the kit in this registry (look up by name).
 *   4. Registers all kit tools into the provided ToolRegistry.
 *   5. Registers all kit connectors into the provided APIConnectorRegistry.
 *   6. Calls onActivate() lifecycle hook if provided.
 *
 * Usage:
 *   import { registerKit, defaultKitRegistry } from '@kickstart/core';
 *   await registerKit(azureKit);   // tools + connectors wired up automatically
 */

import type { IntegrationKit } from './types.js';
import { ToolRegistry, defaultRegistry } from '../tools/registry.js';
import { APIConnectorRegistry, defaultConnectorRegistry } from '../connectors/registry.js';

export class IntegrationKitRegistry {
  private readonly kits = new Map<string, IntegrationKit>();
  private readonly toolRegistry: ToolRegistry;
  private readonly connectorRegistry: APIConnectorRegistry;
  /** Maps tool name → owning kit name for collision detection */
  private readonly toolOwners = new Map<string, string>();
  /** Maps connector name → owning kit name for collision detection */
  private readonly connectorOwners = new Map<string, string>();

  constructor(
    toolRegistry: ToolRegistry = defaultRegistry,
    connectorRegistry: APIConnectorRegistry = defaultConnectorRegistry,
  ) {
    this.toolRegistry = toolRegistry;
    this.connectorRegistry = connectorRegistry;
  }

  /**
   * Register a kit and auto-wire its tools and connectors into their
   * respective registries.
   *
   * Validates dependencies and detects tool/connector name collisions
   * before registration. Re-registration of the same kit name is allowed
   * (overwrites) for backward compatibility.
   *
   * Calls the kit's `onActivate()` hook after successful registration.
   */
  async register(kit: IntegrationKit): Promise<void> {
    // ── Dependency validation ──────────────────────────────────────────
    if (kit.dependencies?.length) {
      const missing = kit.dependencies.filter((dep) => !this.kits.has(dep));
      if (missing.length > 0) {
        throw new Error(
          `Kit "${kit.name}" depends on unregistered kit(s): ${missing.join(', ')}. ` +
          `Register dependencies first.`,
        );
      }
    }

    // ── Collision detection ────────────────────────────────────────────
    // Allow re-registration of the same kit (overwrites)
    const collisions: string[] = [];

    for (const tool of kit.tools) {
      const owner = this.toolOwners.get(tool.name);
      if (owner && owner !== kit.name) {
        collisions.push(`tool "${tool.name}" (owned by kit "${owner}")`);
      }
    }
    for (const connector of kit.connectors) {
      const owner = this.connectorOwners.get(connector.name);
      if (owner && owner !== kit.name) {
        collisions.push(`connector "${connector.name}" (owned by kit "${owner}")`);
      }
    }
    if (collisions.length > 0) {
      throw new Error(
        `Kit "${kit.name}" has name collisions: ${collisions.join('; ')}. ` +
        `Each tool/connector name must be unique across kits.`,
      );
    }

    // ── Clean up previous registration (if re-registering same kit) ───
    if (this.kits.has(kit.name)) {
      this.clearOwnership(kit.name);
    }

    // ── Register ───────────────────────────────────────────────────────
    this.kits.set(kit.name, kit);

    for (const tool of kit.tools) {
      this.toolOwners.set(tool.name, kit.name);
    }
    this.toolRegistry.registerAll(kit.tools);

    for (const connector of kit.connectors) {
      this.connectorOwners.set(connector.name, kit.name);
      this.connectorRegistry.register(connector);
    }

    // ── Lifecycle: onActivate ──────────────────────────────────────────
    if (kit.onActivate) {
      await kit.onActivate();
    }
  }

  /**
   * Unregister a kit and remove its tools/connectors from the sub-registries.
   *
   * Blocks if other registered kits declare this kit as a dependency.
   * Calls the kit's `onDeactivate()` hook before removal.
   */
  async unregister(name: string): Promise<void> {
    const kit = this.kits.get(name);
    if (!kit) {
      throw new Error(`Kit "${name}" is not registered.`);
    }

    // ── Reverse-dependency check ───────────────────────────────────────
    const dependents = this.getDependents(name);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister kit "${name}" — it is depended on by: ${dependents.join(', ')}. ` +
        `Unregister dependent kits first.`,
      );
    }

    // ── Lifecycle: onDeactivate ────────────────────────────────────────
    if (kit.onDeactivate) {
      await kit.onDeactivate();
    }

    // ── Remove tools and connectors ────────────────────────────────────
    this.clearOwnership(name);
    this.kits.delete(name);
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

  /**
   * Returns names of all kits that list the given kit as a dependency.
   */
  getDependents(kitName: string): string[] {
    const dependents: string[] = [];
    for (const kit of this.kits.values()) {
      if (kit.dependencies?.includes(kitName)) {
        dependents.push(kit.name);
      }
    }
    return dependents;
  }

  /**
   * Returns the kit that owns a given tool name, if any.
   */
  getToolOwner(toolName: string): string | undefined {
    return this.toolOwners.get(toolName);
  }

  /**
   * Returns the kit that owns a given connector name, if any.
   */
  getConnectorOwner(connectorName: string): string | undefined {
    return this.connectorOwners.get(connectorName);
  }

  /** Remove ownership records for a kit's tools and connectors. */
  private clearOwnership(kitName: string): void {
    for (const [toolName, owner] of this.toolOwners) {
      if (owner === kitName) {
        this.toolOwners.delete(toolName);
      }
    }
    for (const [connectorName, owner] of this.connectorOwners) {
      if (owner === kitName) {
        this.connectorOwners.delete(connectorName);
      }
    }
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
 *   await registerKit(azureKit);
 */
export async function registerKit(kit: IntegrationKit): Promise<void> {
  await defaultKitRegistry.register(kit);
}
