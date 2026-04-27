import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzureTableSessionStore } from '../runtime/session-store-azure-table.js';
import { startEvictionScheduler, createSessionStore, InMemorySessionStore } from '../runtime/session-store.js';
import { Session } from '../runtime/session.js';

// ── Fake TableClient ─────────────────────────────────────────────────────────

function makeSession(id: string): Session {
  return new Session({ sessionId: id, user: { oid: 'test-user' } });
}

function makeFakeTableClient() {
  const store = new Map<string, Record<string, unknown>>();

  const upsertEntity = vi.fn(async (entity: Record<string, unknown>) => {
    store.set(entity['rowKey'] as string, { ...entity });
  });

  const getEntity = vi.fn(async (_pk: string, rowKey: string) => {
    const entity = store.get(rowKey);
    if (!entity) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    return entity;
  });

  const deleteEntity = vi.fn(async (_pk: string, rowKey: string) => {
    if (!store.has(rowKey)) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    store.delete(rowKey);
  });

  async function* listEntitiesGen(opts?: { queryOptions?: { filter?: string } }) {
    const filter = opts?.queryOptions?.filter ?? '';
    for (const entity of store.values()) {
      const expiresAt = entity['expiresAt'] as string | undefined;
      // Simulate OData `expiresAt lt '...'` for evictExpired
      if (filter.includes(' lt ') && expiresAt) {
        const cutoff = filter.match(/lt '([^']+)'/)?.[1];
        if (cutoff && expiresAt >= cutoff) continue;
      }
      // Simulate OData `expiresAt gt '...'` for list/entries
      if (filter.includes(' gt ') && expiresAt) {
        const cutoff = filter.match(/gt '([^']+)'/)?.[1];
        if (cutoff && expiresAt <= cutoff) continue;
      }
      yield entity;
    }
  }

  const listEntities = vi.fn((opts?: unknown) =>
    listEntitiesGen(opts as { queryOptions?: { filter?: string } }),
  );

  const createTable = vi.fn(async () => undefined);

  return { upsertEntity, getEntity, deleteEntity, listEntities, createTable, _store: store };
}

// ── evictExpired() ────────────────────────────────────────────────────────────

describe('AzureTableSessionStore.evictExpired()', () => {
  let fakeClient: ReturnType<typeof makeFakeTableClient>;
  let store: AzureTableSessionStore;

  beforeEach(() => {
    fakeClient = makeFakeTableClient();
    store = new AzureTableSessionStore({ tableClient: fakeClient as never });
  });

  it('deletes expired rows and returns the count', async () => {
    await store.set('live', makeSession('live'));
    await store.set('dead', makeSession('dead'));

    // Backdate expiry of 'dead'
    fakeClient._store.get('dead')!['expiresAt'] = new Date(Date.now() - 5000).toISOString();

    const count = await store.evictExpired();
    expect(count).toBe(1);
    expect(fakeClient.deleteEntity).toHaveBeenCalledWith('sessions', 'dead');
    expect(fakeClient.deleteEntity).not.toHaveBeenCalledWith('sessions', 'live');
  });

  it('returns 0 when nothing is expired', async () => {
    await store.set('a', makeSession('a'));
    await store.set('b', makeSession('b'));
    const count = await store.evictExpired();
    expect(count).toBe(0);
  });

  it('handles an empty store without error', async () => {
    const count = await store.evictExpired();
    expect(count).toBe(0);
  });
});

// ── TTL options ───────────────────────────────────────────────────────────────

describe('AzureTableSessionStore TTL configuration', () => {
  let fakeClient: ReturnType<typeof makeFakeTableClient>;

  beforeEach(() => {
    fakeClient = makeFakeTableClient();
  });

  afterEach(() => {
    delete process.env.KICKSTART_SESSION_TTL_SECONDS;
  });

  it('accepts ttlSeconds option and stores a future expiresAt', async () => {
    const store = new AzureTableSessionStore({
      tableClient: fakeClient as never,
      ttlSeconds: 3600,
    });
    const before = Date.now();
    await store.set('s1', makeSession('s1'));
    const entity = fakeClient._store.get('s1')!;
    const expiresAt = new Date(entity['expiresAt'] as string).getTime();
    expect(expiresAt).toBeGreaterThan(before + 3500 * 1000);
    expect(expiresAt).toBeLessThan(before + 3700 * 1000);
  });

  it('reads KICKSTART_SESSION_TTL_SECONDS env var', async () => {
    process.env.KICKSTART_SESSION_TTL_SECONDS = '7200';
    const store = new AzureTableSessionStore({ tableClient: fakeClient as never });
    const before = Date.now();
    await store.set('s2', makeSession('s2'));
    const entity = fakeClient._store.get('s2')!;
    const expiresAt = new Date(entity['expiresAt'] as string).getTime();
    expect(expiresAt).toBeGreaterThan(before + 7000 * 1000);
  });

  it('ttlSeconds takes precedence over ttlMs', async () => {
    const store = new AzureTableSessionStore({
      tableClient: fakeClient as never,
      ttlSeconds: 60,
      ttlMs: 999_999_999,
    });
    const before = Date.now();
    await store.set('s3', makeSession('s3'));
    const entity = fakeClient._store.get('s3')!;
    const expiresAt = new Date(entity['expiresAt'] as string).getTime();
    expect(expiresAt).toBeLessThan(before + 120 * 1000);
  });

  it('defaults to 24 hours when no TTL option is given', async () => {
    const store = new AzureTableSessionStore({ tableClient: fakeClient as never });
    const before = Date.now();
    await store.set('s4', makeSession('s4'));
    const entity = fakeClient._store.get('s4')!;
    const expiresAt = new Date(entity['expiresAt'] as string).getTime();
    const twentyFourH = 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(before + twentyFourH - 5000);
    expect(expiresAt).toBeLessThan(before + twentyFourH + 5000);
  });
});

// ── startEvictionScheduler() ──────────────────────────────────────────────────

describe('startEvictionScheduler()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls evictExpired() on each tick', async () => {
    const evictExpired = vi.fn(async () => 0);
    const fakeStore = { evictExpired } as never;

    const handle = startEvictionScheduler(fakeStore, 1000);
    expect(evictExpired).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(evictExpired).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(evictExpired).toHaveBeenCalledTimes(2);

    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(evictExpired).toHaveBeenCalledTimes(2); // no more calls after stop
  });

  it('continues running after evictExpired() rejects', async () => {
    let callCount = 0;
    const evictExpired = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('transient failure');
      return 0;
    });
    const fakeStore = { evictExpired } as never;

    const handle = startEvictionScheduler(fakeStore, 500);
    await vi.advanceTimersByTimeAsync(500); // tick 1 — throws
    await vi.advanceTimersByTimeAsync(500); // tick 2 — succeeds
    expect(evictExpired).toHaveBeenCalledTimes(2);
    handle.stop();
  });
});

// ── KICKSTART_SESSION_STORE env-var routing ───────────────────────────────────

describe('createSessionStore() env-var routing', () => {
  afterEach(() => {
    delete process.env.KICKSTART_SESSION_STORE;
  });

  it("returns InMemorySessionStore by default (no env var)", () => {
    const s = createSessionStore();
    expect(s).toBeInstanceOf(InMemorySessionStore);
  });

  it("returns InMemorySessionStore when KICKSTART_SESSION_STORE=memory", () => {
    process.env.KICKSTART_SESSION_STORE = 'memory';
    const s = createSessionStore();
    expect(s).toBeInstanceOf(InMemorySessionStore);
  });

  it("returns AzureTableSessionStore when KICKSTART_SESSION_STORE=azure-table", async () => {
    process.env.KICKSTART_SESSION_STORE = 'azure-table';
    const fakeClient = makeFakeTableClient();
    // Provide tableClient via options to avoid needing real Azure credentials
    const s = createSessionStore(undefined, { tableClient: fakeClient as never });
    expect(s).toBeInstanceOf(AzureTableSessionStore);
  });

  it("explicit type overrides env var", () => {
    process.env.KICKSTART_SESSION_STORE = 'azure-table';
    const s = createSessionStore('memory');
    expect(s).toBeInstanceOf(InMemorySessionStore);
  });
});
