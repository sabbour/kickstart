/**
 * @module @kickstart/core/kits/registry
 *
 * IntegrationKitRegistry — central register for IntegrationKits.
 *
 * ## Trust Model
 *
 * Kits are trusted first-party code. No sandboxing is applied — lifecycle
 * hooks and tool/connector code run with full process privileges. If
 * third-party kits are needed in the future, implement capability
 * restrictions and sandboxing before allowing untrusted code.
 *
 * Registering a kit automatically:
 *   1. Validates auth schema (provider/scopes).
 *   2. Validates dependencies (all declared deps must be registered first).
 *   3. Detects circular dependencies via DFS.
 *   4. Detects tool/connector name collisions with existing kits.
 *   5. Records the kit in this registry (look up by name).
 *   6. Registers all kit tools into the provided ToolRegistry.
 *   7. Registers all kit connectors into the provided APIConnectorRegistry.
 *   8. Calls onActivate() lifecycle hook if provided.
 *   9. On onActivate failure, rolls back all changes (transactional).
 *
 * Usage:
 *   import { registerKit, defaultKitRegistry } from '@kickstart/core';
 *   await registerKit(azureKit);   // tools + connectors wired up automatically
 */

import type { IntegrationKit } from './types.js';
import { ToolRegistry, defaultRegistry } from '../tools/registry.js';
import { APIConnectorRegistry, defaultConnectorRegistry } from '../connectors/registry.js';

/**
 * Central registry for IntegrationKits.
 *
 * **Trust Model:** Kits are trusted first-party code. No sandboxing is
 * applied — lifecycle hooks (`onActivate`, `onDeactivate`) and tool
 * `execute` functions run with full process privileges. If third-party
 * kits are needed in the future, implement capability restrictions and
 * sandboxing before allowing untrusted code to register as a kit.
 */
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
   * Validates auth schema, dependencies, detects cycles and tool/connector
   * name collisions before registration. Re-registration of the same kit
   * name is allowed (overwrites) for backward compatibility.
   *
   * If `onActivate()` throws, all changes are rolled back: tools removed
   * from ToolRegistry, connectors from APIConnectorRegistry, kit from
   * the kits map, and ownership maps are restored.
   */
  async register(kit: IntegrationKit): Promise<void> {
    // ── Auth schema validation ───────────────────────────────────────────
    this.validateAuth(kit);

    // ── Self-dependency check ─────────────────────────────────────────
    if (kit.dependencies?.includes(kit.name)) {
      throw new Error(
        `Kit "${kit.name}" declares a dependency on itself.`,
      );
    }

    // ── Dependency validation ──────────────────────────────────────────
    if (kit.dependencies?.length) {
      const missing = kit.dependencies.filter((dep) => !this.kits.has(dep));
      if (missing.length > 0) {
        throw new Error(
          `Kit "${kit.name}" depends on unregistered kit(s): ${missing.join(', ')}. ` +
          `Register dependencies first.`,
        );
      }

      // ── Cycle detection ────────────────────────────────────────────────
      this.detectCycle(kit.name, kit.dependencies);
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

    // ── Snapshot previous state for rollback ──────────────────────────
    const previousKit = this.kits.get(kit.name);

    // ── Clean up previous registration (if re-registering same kit) ───
    if (previousKit) {
      for (const tool of previousKit.tools) {
        this.toolRegistry.unregister(tool.name);
      }
      for (const connector of previousKit.connectors) {
        this.connectorRegistry.unregister(connector.name);
      }
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

    // ── Lifecycle: onActivate (with rollback on failure) ───────────────
    if (kit.onActivate) {
      try {
        await kit.onActivate();
      } catch (err) {
        // Roll back: remove tools from ToolRegistry
        for (const tool of kit.tools) {
          this.toolRegistry.unregister(tool.name);
          this.toolOwners.delete(tool.name);
        }
        // Roll back: remove connectors from APIConnectorRegistry
        for (const connector of kit.connectors) {
          this.connectorRegistry.unregister(connector.name);
          this.connectorOwners.delete(connector.name);
        }
        // Roll back: remove kit from kits map
        this.kits.delete(kit.name);

        // Restore previous kit if re-registering
        if (previousKit) {
          this.kits.set(previousKit.name, previousKit);
          for (const tool of previousKit.tools) {
            this.toolOwners.set(tool.name, previousKit.name);
          }
          this.toolRegistry.registerAll(previousKit.tools);
          for (const connector of previousKit.connectors) {
            this.connectorOwners.set(connector.name, previousKit.name);
            this.connectorRegistry.register(connector);
          }
        }

        throw new Error(
          `Kit "${kit.name}" onActivate failed — registration rolled back. ` +
          `Cause: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }
  }

  /**
   * Unregister a kit and remove its tools/connectors from the sub-registries.
   *
   * Blocks if other registered kits declare this kit as a dependency.
   * Calls the kit's `onDeactivate()` hook before removal.
   *
   * If `onDeactivate()` throws, the kit is kept registered and the error
   * is re-thrown — preventing a partially torn-down state.
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

    // ── Lifecycle: onDeactivate (keep kit if it fails) ────────────────
    if (kit.onDeactivate) {
      try {
        await kit.onDeactivate();
      } catch (err) {
        throw new Error(
          `Kit "${name}" onDeactivate failed — kit remains registered. ` +
          `Cause: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }

    // ── Remove tools and connectors ────────────────────────────────────
    for (const tool of kit.tools) {
      this.toolRegistry.unregister(tool.name);
    }
    for (const connector of kit.connectors) {
      this.connectorRegistry.unregister(connector.name);
    }
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

  /**
   * DFS-based cycle detection. Checks whether adding `kitName` with the
   * given `dependencies` would create a circular dependency chain.
   *
   * Walks from each direct dependency through the existing dependency
   * graph. If any path leads back to `kitName`, a cycle exists.
   *
   * @throws Error with a human-readable cycle path (e.g. A → B → A)
   */
  private detectCycle(kitName: string, dependencies: string[]): void {
    for (const dep of dependencies) {
      const visited = new Set<string>();
      const path = [kitName, dep];

      const hasCycle = this.dfsVisit(dep, kitName, visited, path);
      if (hasCycle) {
        throw new Error(
          `Kit "${kitName}" has circular dependency: ${path.join(' → ')}`,
        );
      }
    }
  }

  /**
   * Recursive DFS helper. Returns true if `target` is reachable from
   * `current` through the dependency graph.
   */
  private dfsVisit(
    current: string,
    target: string,
    visited: Set<string>,
    path: string[],
  ): boolean {
    if (visited.has(current)) return false;
    visited.add(current);

    const kit = this.kits.get(current);
    if (!kit?.dependencies) return false;

    for (const dep of kit.dependencies) {
      path.push(dep);
      if (dep === target) return true;
      if (this.dfsVisit(dep, target, visited, path)) return true;
      path.pop();
    }
    return false;
  }

  /**
   * Validates KitAuthRequirement entries at registration time.
   * - `provider` must be a non-empty string
   * - `scopes` must be a non-empty array of non-empty strings
   * - Warns on duplicate provider declarations within the same kit
   */
  private validateAuth(kit: IntegrationKit): void {
    if (!kit.auth?.length) return;

    const seenProviders = new Set<string>();
    for (const req of kit.auth) {
      if (!req.provider || typeof req.provider !== 'string' || req.provider.trim() === '') {
        throw new Error(
          `Kit "${kit.name}" has invalid auth requirement: provider must be a non-empty string.`,
        );
      }
      if (
        !Array.isArray(req.scopes) ||
        req.scopes.length === 0 ||
        req.scopes.some((s) => typeof s !== 'string' || s.trim() === '')
      ) {
        throw new Error(
          `Kit "${kit.name}" has invalid auth requirement for provider "${req.provider}": ` +
          `scopes must be a non-empty array of non-empty strings.`,
        );
      }
      if (seenProviders.has(req.provider)) {
        // eslint-disable-next-line no-console -- intentional warning for kit authors
        console.warn(
          `Kit "${kit.name}": duplicate auth provider "${req.provider}" — ` +
          `only declare each provider once per kit.`,
        );
      }
      seenProviders.add(req.provider);
    }
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
