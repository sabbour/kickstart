import type { Session } from './session.js';
import type { AzureTableSessionStoreOptions } from './session-store-azure-table.js';
import { AzureTableSessionStore } from './session-store-azure-table.js';

/**
 * Synchronous abstraction over the session persistence layer (Map-compatible).
 *
 * Phase 1 ships `InMemorySessionStore` (this file).
 * Async backends (e.g., Azure Table Storage) implement {@link IAsyncSessionStore}.
 */
export interface ISessionStore {
  get(id: string): Session | undefined;
  set(id: string, session: Session): void;
  delete(id: string): boolean;
  /** Return all stored sessions as [id, session] pairs — used by TTL cleanup. */
  entries(): IterableIterator<[string, Session]>;
  /** Iterate all sessions directly (mirrors Map's default iterator). */
  [Symbol.iterator](): IterableIterator<[string, Session]>;
  /** Return all stored sessions as an array — convenience helper. */
  list(): Session[];
  /** Remove all sessions — used by tests. */
  clear(): void;
}

/**
 * Async abstraction over a remote session persistence backend.
 *
 * Implemented by {@link AzureTableSessionStore} (Phase 2, #133).
 * The `get`, `set`, `delete`, `list`, `entries`, and `clear` methods all
 * return Promises so they compose cleanly with `await` in API handlers.
 */
export interface IAsyncSessionStore {
  get(id: string): Promise<Session | undefined>;
  set(id: string, session: Session): Promise<void>;
  delete(id: string): Promise<boolean>;
  entries(): AsyncIterableIterator<[string, Session]>;
  list(): Promise<Session[]>;
  clear(): Promise<void>;
  /** Ensure the backing store is initialised (create table, etc.). */
  init?(): Promise<void>;
  /** Actively delete all sessions whose TTL has elapsed. Returns count deleted. */
  evictExpired?(): Promise<number>;
}

/** Handle returned by {@link startEvictionScheduler} — call `stop()` on shutdown. */
export interface EvictionSchedulerHandle {
  stop(): void;
}

/**
 * Starts a recurring background task that calls `store.evictExpired()` every
 * `intervalMs` milliseconds.  Returns a handle with a `stop()` method to
 * cancel the interval (e.g. in tests or on graceful shutdown).
 *
 * @param store      An {@link IAsyncSessionStore} that implements `evictExpired`.
 * @param intervalMs How often to run eviction (default: 5 minutes).
 */
export function startEvictionScheduler(
  store: IAsyncSessionStore & { evictExpired(): Promise<number> },
  intervalMs = 5 * 60 * 1000,
): EvictionSchedulerHandle {
  const timer = setInterval(() => {
    store.evictExpired().catch((err: unknown) => {
      // Non-fatal — log and continue; the next tick will retry
      console.error('[eviction-scheduler] evictExpired() failed:', err);
    });
  }, intervalMs);

  // Allow the process to exit even if the timer is still running
  if (typeof timer.unref === 'function') timer.unref();

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

/** In-memory adapter; exact behavioural replacement for the previous bare `Map`. */
export class InMemorySessionStore implements ISessionStore {
  private readonly _map = new Map<string, Session>();

  get(id: string): Session | undefined {
    return this._map.get(id);
  }

  set(id: string, session: Session): void {
    this._map.set(id, session);
  }

  delete(id: string): boolean {
    return this._map.delete(id);
  }

  entries(): IterableIterator<[string, Session]> {
    return this._map.entries();
  }

  [Symbol.iterator](): IterableIterator<[string, Session]> {
    return this._map.entries();
  }

  list(): Session[] {
    return Array.from(this._map.values());
  }

  clear(): void {
    this._map.clear();
  }
}

/**
 * Factory for creating a session store.
 *
 * - `'memory'` → synchronous {@link InMemorySessionStore} (default)
 * - `'azure-table'` → async {@link AzureTableSessionStore} backed by Azure Table Storage
 *
 * When called without an explicit `type` the factory reads the
 * `KICKSTART_SESSION_STORE` environment variable (`'memory'` | `'azure-table'`).
 * This allows multi-replica deployments on Azure Container Apps to opt in to
 * shared storage without any code changes:
 *
 * ```
 * KICKSTART_SESSION_STORE=azure-table
 * AZURE_STORAGE_CONNECTION_STRING=...
 * ```
 */
export function createSessionStore(type: 'memory', options?: undefined): ISessionStore;
export function createSessionStore(type: 'azure-table', options?: AzureTableSessionStoreOptions): IAsyncSessionStore;
export function createSessionStore(type?: undefined, options?: AzureTableSessionStoreOptions): ISessionStore | IAsyncSessionStore;
export function createSessionStore(
  type?: 'memory' | 'azure-table',
  options?: AzureTableSessionStoreOptions,
): ISessionStore | IAsyncSessionStore {
  const resolvedType = type ?? (process.env.KICKSTART_SESSION_STORE as 'memory' | 'azure-table' | undefined) ?? 'memory';
  switch (resolvedType) {
    case 'memory':
      return new InMemorySessionStore();
    case 'azure-table':
      return new AzureTableSessionStore(options);
    default: {
      const _exhaustive: never = resolvedType;
      throw new Error(`Unknown session store type: ${_exhaustive}`);
    }
  }
}
