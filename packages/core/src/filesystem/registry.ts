/**
 * @module @kickstart/core/filesystem/registry
 *
 * FileSystemProviderRegistry — manages pluggable filesystem backends.
 * One provider is "active" at any time; tools call `registry.active`
 * to get the current backend without coupling to a specific implementation.
 */

import type { FileSystemProvider } from "./types.js";

export class FileSystemProviderRegistry {
  private readonly providers = new Map<string, FileSystemProvider>();
  private _activeName: string | null = null;

  /** Register a provider.  Overwrites any existing provider with the same name. */
  register(provider: FileSystemProvider): void {
    this.providers.set(provider.name, provider);
    // Auto-activate the first registered provider
    if (this._activeName === null) {
      this._activeName = provider.name;
    }
  }

  /** Retrieve a provider by name. */
  get(name: string): FileSystemProvider | undefined {
    return this.providers.get(name);
  }

  /** The currently active provider.  Throws if none is set. */
  get active(): FileSystemProvider {
    if (this._activeName === null) {
      throw new Error("No filesystem provider is active. Register one first.");
    }
    const provider = this.providers.get(this._activeName);
    if (!provider) {
      throw new Error(
        `Active filesystem provider "${this._activeName}" is no longer registered.`,
      );
    }
    return provider;
  }

  /** Whether any provider is currently active. */
  get hasActive(): boolean {
    return this._activeName !== null && this.providers.has(this._activeName);
  }

  /** Switch the active provider.  Throws if the name is not registered. */
  setActive(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(
        `Cannot activate filesystem provider "${name}": not registered. ` +
          `Available: ${this.listNames().join(", ") || "(none)"}`,
      );
    }
    this._activeName = name;
  }

  /** Unregister a provider by name. */
  unregister(name: string): void {
    this.providers.delete(name);
    if (this._activeName === name) {
      this._activeName = null;
    }
  }

  /** Names of all registered providers. */
  listNames(): string[] {
    return [...this.providers.keys()];
  }

  /** Number of registered providers. */
  get size(): number {
    return this.providers.size;
  }
}

/** Default global filesystem provider registry. */
export const defaultFileSystemRegistry = new FileSystemProviderRegistry();
