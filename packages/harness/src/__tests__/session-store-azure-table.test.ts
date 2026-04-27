import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AzureTableSessionStore } from '../runtime/session-store-azure-table.js';
import { Session } from '../runtime/session.js';

// ── Fake TableClient ─────────────────────────────────────────────────────────

function makeSession(id: string): Session {
  return new Session({ sessionId: id, user: { oid: 'test-user' } });
}

function makeFakeTableClient() {
  const store = new Map<string, Record<string, unknown>>();

  const upsertEntity = vi.fn(async (entity: Record<string, unknown>) => {
    const key = entity['rowKey'] as string;
    store.set(key, { ...entity });
  });

  const getEntity = vi.fn(async (_partitionKey: string, rowKey: string) => {
    const entity = store.get(rowKey);
    if (!entity) {
      const err = Object.assign(new Error('Entity not found'), { statusCode: 404 });
      throw err;
    }
    return entity;
  });

  const deleteEntity = vi.fn(async (_partitionKey: string, rowKey: string) => {
    if (!store.has(rowKey)) {
      const err = Object.assign(new Error('Entity not found'), { statusCode: 404 });
      throw err;
    }
    store.delete(rowKey);
  });

  async function* listEntitiesGen() {
    for (const entity of store.values()) {
      yield entity;
    }
  }

  const listEntities = vi.fn(() => listEntitiesGen());

  const createTable = vi.fn(async () => undefined);

  return {
    upsertEntity,
    getEntity,
    deleteEntity,
    listEntities,
    createTable,
    _store: store,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AzureTableSessionStore', () => {
  let fakeClient: ReturnType<typeof makeFakeTableClient>;
  let store: AzureTableSessionStore;

  beforeEach(() => {
    fakeClient = makeFakeTableClient();
    store = new AzureTableSessionStore({ tableClient: fakeClient as never });
  });

  it('set() stores a session and get() retrieves it', async () => {
    const session = makeSession('sess-1');
    await store.set('sess-1', session);
    const retrieved = await store.get('sess-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe('sess-1');
    expect(fakeClient.upsertEntity).toHaveBeenCalledOnce();
  });

  it('get() returns undefined for unknown session IDs', async () => {
    const result = await store.get('does-not-exist');
    expect(result).toBeUndefined();
  });

  it('delete() removes an existing session and returns true', async () => {
    const session = makeSession('sess-2');
    await store.set('sess-2', session);
    const removed = await store.delete('sess-2');
    expect(removed).toBe(true);
    expect(await store.get('sess-2')).toBeUndefined();
  });

  it('delete() returns false for non-existent sessions', async () => {
    const removed = await store.delete('ghost-session');
    expect(removed).toBe(false);
  });

  it('list() returns all non-expired sessions', async () => {
    await store.set('a', makeSession('a'));
    await store.set('b', makeSession('b'));
    const sessions = await store.list();
    expect(sessions.length).toBe(2);
    expect(sessions.map((s) => s.sessionId).sort()).toEqual(['a', 'b']);
  });

  it('list() skips expired sessions', async () => {
    const session = makeSession('expired');
    await store.set('expired', session);

    // Manually set the expiry to the past
    const entity = fakeClient._store.get('expired')!;
    entity['expiresAt'] = new Date(Date.now() - 1000).toISOString();

    const sessions = await store.list();
    expect(sessions).toHaveLength(0);
  });

  it('get() evicts expired sessions', async () => {
    const session = makeSession('stale');
    await store.set('stale', session);

    // Set expiry to the past
    const entity = fakeClient._store.get('stale')!;
    entity['expiresAt'] = new Date(Date.now() - 1000).toISOString();

    const result = await store.get('stale');
    expect(result).toBeUndefined();
    expect(fakeClient.deleteEntity).toHaveBeenCalledWith('sessions', 'stale');
  });

  it('entries() yields [id, session] pairs', async () => {
    await store.set('x', makeSession('x'));
    await store.set('y', makeSession('y'));
    const pairs: [string, Session][] = [];
    for await (const pair of store.entries()) {
      pairs.push(pair);
    }
    expect(pairs.length).toBe(2);
    expect(pairs.map(([id]) => id).sort()).toEqual(['x', 'y']);
  });

  it('clear() removes all sessions', async () => {
    await store.set('c1', makeSession('c1'));
    await store.set('c2', makeSession('c2'));
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });

  it('set() throws when serialised data exceeds 64 KB', async () => {
    const session = makeSession('big');
    // Inject a huge history to exceed the 64 KB limit
    session.recentTurns = Array.from({ length: 1000 }, (_, i) => ({
      role: 'user' as const,
      content: 'x'.repeat(100),
      timestamp: new Date().toISOString(),
    }));
    await expect(store.set('big', session)).rejects.toThrow(/exceeds/);
  });

  it('init() calls createTable on the client', async () => {
    await store.init();
    expect(fakeClient.createTable).toHaveBeenCalledOnce();
  });
});

// ── Factory integration ───────────────────────────────────────────────────────

describe('createSessionStore factory', () => {
  it("returns InMemorySessionStore for type 'memory'", async () => {
    const { createSessionStore, InMemorySessionStore } = await import('../runtime/session-store.js');
    const s = createSessionStore('memory');
    expect(s).toBeInstanceOf(InMemorySessionStore);
  });

  it("returns AzureTableSessionStore for type 'azure-table'", async () => {
    const { createSessionStore } = await import('../runtime/session-store.js');
    const { AzureTableSessionStore } = await import('../runtime/session-store-azure-table.js');
    const fakeClient = makeFakeTableClient();
    const s = createSessionStore('azure-table', { tableClient: fakeClient as never });
    expect(s).toBeInstanceOf(AzureTableSessionStore);
  });
});
