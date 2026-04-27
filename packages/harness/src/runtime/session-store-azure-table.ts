import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';
import type { TableEntity } from '@azure/data-tables';
import { Session } from './session.js';
import type { IAsyncSessionStore } from './session-store.js';
import type { Phase } from '../index.js';

/** Maximum byte length for serialised session JSON stored in Azure Table Storage. */
const MAX_DATA_BYTES = 64 * 1024; // 64 KB (Azure Table property limit)

/** Fixed partition key for single-tenant deployments. */
const PARTITION_KEY = 'sessions';

interface SessionTableEntity extends TableEntity {
  partitionKey: string;
  rowKey: string;
  /** JSON-serialised Session snapshot. */
  data: string;
  /** ISO-8601 expiry timestamp for lazy TTL eviction. */
  expiresAt: string;
}

/**
 * Reconstructs a `Session` instance from the plain-object snapshot stored in
 * the `data` column. Mutable fields are restored; class methods come from the
 * prototype.
 */
function hydrateSession(raw: Record<string, unknown>): Session {
  const s = new Session({
    sessionId: raw.sessionId as string,
    user: raw.user as { oid: string; tid?: string; upn?: string },
    workspaceRoot: raw.workspaceRoot as string | undefined,
    currentPhase: raw.currentPhase as Phase | undefined,
  });
  if (Array.isArray(raw.recentTurns)) s.recentTurns = raw.recentTurns as Session['recentTurns'];
  if (Array.isArray(raw.a2uiEmissions)) s.a2uiEmissions = raw.a2uiEmissions as Session['a2uiEmissions'];
  if (raw.pendingUserAction !== undefined) s.pendingUserAction = raw.pendingUserAction as Session['pendingUserAction'];
  if (typeof raw.lastActiveAt === 'number') s.lastActiveAt = raw.lastActiveAt;
  if (typeof raw.activeAgent === 'string') s.activeAgent = raw.activeAgent;
  if (typeof raw.anonTokenHash === 'string') s.anonTokenHash = raw.anonTokenHash;
  if (typeof raw.responseId === 'string') s.responseId = raw.responseId;
  return s;
}

export interface AzureTableSessionStoreOptions {
  /** Azure Table Storage connection string. Falls back to env var `AZURE_STORAGE_CONNECTION_STRING`. */
  connectionString?: string;
  /** Storage account name. Falls back to env var `AZURE_STORAGE_ACCOUNT`. */
  accountName?: string;
  /** Storage account key. Falls back to env var `AZURE_STORAGE_KEY`. */
  accountKey?: string;
  /** Table name. Defaults to `'KickstartSessions'`. */
  tableName?: string;
  /**
   * Session TTL in seconds. Falls back to env var `KICKSTART_SESSION_TTL_SECONDS`.
   * Defaults to 86400 (24 hours).
   * Takes precedence over `ttlMs` when both are provided.
   */
  ttlSeconds?: number;
  /**
   * Session TTL in milliseconds. Defaults to 86400000 (24 hours).
   * Prefer `ttlSeconds` for clarity; `ttlSeconds` takes precedence if set.
   */
  ttlMs?: number;
  /**
   * Pre-built `TableClient` injected in tests to avoid real Azure calls.
   * When supplied, all credential options are ignored.
   */
  tableClient?: TableClient;
}

/**
 * Azure Table Storage–backed session store that implements {@link IAsyncSessionStore}.
 *
 * Each session is stored as a single entity:
 *   - **partitionKey**: `'sessions'`
 *   - **rowKey**: session ID
 *   - **data**: JSON-serialised `Session` snapshot (≤ 64 KB)
 *   - **expiresAt**: ISO-8601 expiry timestamp for lazy TTL eviction
 *
 * Configure via:
 *   - `AZURE_STORAGE_CONNECTION_STRING` (preferred), or
 *   - `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY`
 *
 * Call `init()` once on startup to ensure the backing table exists.
 */
export class AzureTableSessionStore implements IAsyncSessionStore {
  private readonly _client: TableClient;
  private readonly _ttlMs: number;

  constructor(opts: AzureTableSessionStoreOptions = {}) {
    const envTtlSeconds = process.env.KICKSTART_SESSION_TTL_SECONDS
      ? parseInt(process.env.KICKSTART_SESSION_TTL_SECONDS, 10)
      : undefined;
    const ttlSeconds = opts.ttlSeconds ?? envTtlSeconds;
    if (ttlSeconds !== undefined) {
      this._ttlMs = ttlSeconds * 1000;
    } else {
      this._ttlMs = opts.ttlMs ?? 86_400_000; // default 24 hours
    }

    if (opts.tableClient) {
      this._client = opts.tableClient;
      return;
    }

    const connStr = opts.connectionString ?? process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = opts.accountName ?? process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = opts.accountKey ?? process.env.AZURE_STORAGE_KEY;
    const tableName = opts.tableName ?? 'KickstartSessions';

    if (connStr) {
      this._client = TableClient.fromConnectionString(connStr, tableName);
    } else if (accountName && accountKey) {
      const cred = new AzureNamedKeyCredential(accountName, accountKey);
      this._client = new TableClient(
        `https://${accountName}.table.core.windows.net`,
        tableName,
        cred,
      );
    } else {
      throw new Error(
        'AzureTableSessionStore: missing credentials. ' +
        'Set AZURE_STORAGE_CONNECTION_STRING or ' +
        'AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY.',
      );
    }
  }

  /** Ensure the backing table exists. Idempotent — safe to call on startup. */
  async init(): Promise<void> {
    await this._client.createTable();
  }

  async get(id: string): Promise<Session | undefined> {
    try {
      const entity = await this._client.getEntity<SessionTableEntity>(PARTITION_KEY, id);
      if (entity.expiresAt && new Date(entity.expiresAt) < new Date()) {
        await this._client.deleteEntity(PARTITION_KEY, id).catch(() => undefined);
        return undefined;
      }
      return hydrateSession(JSON.parse(entity.data) as Record<string, unknown>);
    } catch (err: unknown) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  async set(id: string, session: Session): Promise<void> {
    const data = JSON.stringify(session);
    const byteLen = Buffer.byteLength(data, 'utf8');
    if (byteLen > MAX_DATA_BYTES) {
      throw new Error(
        `AzureTableSessionStore: serialised session exceeds ${MAX_DATA_BYTES} bytes ` +
        `(got ${byteLen}). Trim recentTurns or a2uiEmissions before persisting.`,
      );
    }
    const entity: SessionTableEntity = {
      partitionKey: PARTITION_KEY,
      rowKey: id,
      data,
      expiresAt: new Date(Date.now() + this._ttlMs).toISOString(),
    };
    await this._client.upsertEntity(entity, 'Replace');
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this._client.deleteEntity(PARTITION_KEY, id);
      return true;
    } catch (err: unknown) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  async list(): Promise<Session[]> {
    const sessions: Session[] = [];
    const now = new Date().toISOString();
    const iter = this._client.listEntities<SessionTableEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}' and expiresAt gt '${now}'` },
    });
    for await (const entity of iter) {
      // Client-side TTL guard — defense-in-depth if the server filter is absent
      if (entity.expiresAt && entity.expiresAt <= now) continue;
      try {
        sessions.push(hydrateSession(JSON.parse(entity.data) as Record<string, unknown>));
      } catch {
        // Skip malformed rows silently
      }
    }
    return sessions;
  }

  async *entries(): AsyncIterableIterator<[string, Session]> {
    const now = new Date().toISOString();
    const iter = this._client.listEntities<SessionTableEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}' and expiresAt gt '${now}'` },
    });
    for await (const entity of iter) {
      // Client-side TTL guard — defense-in-depth if the server filter is absent
      if (entity.expiresAt && entity.expiresAt <= now) continue;
      try {
        yield [entity.rowKey, hydrateSession(JSON.parse(entity.data) as Record<string, unknown>)];
      } catch {
        // Skip malformed rows silently
      }
    }
  }

  async clear(): Promise<void> {
    const iter = this._client.listEntities<SessionTableEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    });
    const deletes: Promise<unknown>[] = [];
    for await (const entity of iter) {
      deletes.push(this._client.deleteEntity(PARTITION_KEY, entity.rowKey).catch(() => undefined));
    }
    await Promise.all(deletes);
  }

  /**
   * Actively evict all sessions whose `expiresAt` timestamp is in the past.
   * Uses an OData server-side filter to minimise data transfer, then issues
   * parallel delete requests for matched rows.
   *
   * @returns The number of rows deleted.
   */
  async evictExpired(): Promise<number> {
    const now = new Date().toISOString();
    const iter = this._client.listEntities<SessionTableEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}' and expiresAt lt '${now}'` },
    });
    const deletes: Promise<unknown>[] = [];
    for await (const entity of iter) {
      deletes.push(this._client.deleteEntity(PARTITION_KEY, entity.rowKey).catch(() => undefined));
    }
    await Promise.all(deletes);
    return deletes.length;
  }
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { statusCode?: number; status?: number };
  return (e.statusCode ?? e.status) === 404;
}

