---
sidebar_position: 6
---

# Session Store

Kickstart persists conversation history and metadata in a **session store** — an abstraction over whatever backing storage is appropriate for your deployment. This guide covers the `ISessionStore` interface, the built-in in-memory implementation, and how to write your own adapter (for example, an Azure Table Storage backend).

## Overview

Session stores implement the `ISessionStore` interface exported from `@aks-kickstart/harness`:

```typescript
import type { ISessionStore } from '@aks-kickstart/harness';
```

The harness ships with:
- **`InMemorySessionStore`** — a Map-backed store suitable for local development and single-instance deployments.
- **`createSessionStore(type)`** — a factory that returns the appropriate implementation. Currently supports `'memory'`; extended in later phases to support `'azure-table'`.

## The `ISessionStore` Interface

```typescript
export interface ISessionStore {
  /** Retrieve a session by ID. Returns undefined if not found. */
  get(id: string): Promise<Session | undefined>;

  /** Persist a session. Creates or updates. */
  set(id: string, session: Session): Promise<void>;

  /** Remove a session. No-op if not found. */
  delete(id: string): Promise<void>;

  /** Return all session IDs currently in the store. */
  list(): Promise<string[]>;

  /** Return all [id, session] entries. */
  entries(): Promise<Array<[string, Session]>>;

  /** Remove all sessions. Use with caution. */
  clear(): Promise<void>;
}
```

All methods are `async` — even the in-memory implementation returns `Promise`s — so that adapters for remote storage can be substituted without changing call sites.

## The Built-in `InMemorySessionStore`

`InMemorySessionStore` wraps a JavaScript `Map` and is the default for all deployments unless you configure an external adapter.

```typescript
import { InMemorySessionStore } from '@aks-kickstart/harness';

const store = new InMemorySessionStore();
await store.set('session-123', mySession);
const s = await store.get('session-123'); // Session | undefined
```

It is also accessible as the module-level `sessionStore` singleton:

```typescript
import { sessionStore } from '@aks-kickstart/harness';
// sessionStore is an InMemorySessionStore instance shared across the process
```

## Creating a Store via Factory

Use `createSessionStore` when you want callers to be decoupled from the concrete implementation:

```typescript
import { createSessionStore } from '@aks-kickstart/harness';

const store = createSessionStore('memory'); // ISessionStore
```

The factory is extensible: future adapters (for example `'azure-table'`) will be added as additional `type` values. Callers that use `createSessionStore` will not need to change.

## Writing a Custom Adapter

To implement your own backing store (Redis, Cosmos DB, etc.), implement `ISessionStore`:

```typescript
import type { ISessionStore, Session } from '@aks-kickstart/harness';

export class MyRedisSessionStore implements ISessionStore {
  constructor(private client: RedisClient) {}

  async get(id: string): Promise<Session | undefined> {
    const raw = await this.client.get(`session:${id}`);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  }

  async set(id: string, session: Session): Promise<void> {
    await this.client.set(`session:${id}`, JSON.stringify(session));
  }

  async delete(id: string): Promise<void> {
    await this.client.del(`session:${id}`);
  }

  async list(): Promise<string[]> {
    const keys = await this.client.keys('session:*');
    return keys.map((k) => k.replace('session:', ''));
  }

  async entries(): Promise<Array<[string, Session]>> {
    const ids = await this.list();
    const pairs = await Promise.all(ids.map(async (id) => [id, await this.get(id)] as [string, Session]));
    return pairs.filter(([, s]) => s !== undefined);
  }

  async clear(): Promise<void> {
    const ids = await this.list();
    await Promise.all(ids.map((id) => this.delete(id)));
  }
}
```

Then wire it in where the harness initialises `sessionStore`, or pass it to `Runner` via the `BuildContext`.

## Architecture Note

The `ISessionStore` interface is Phase 1 of the distributed session store work (issue #131). Phase 2 adds an Azure Table Storage adapter (`createSessionStore('azure-table')`), enabling multi-instance deployments and session TTL management. The interface is intentionally minimal so that all current callers are unchanged and new adapters slot in without disruption.
