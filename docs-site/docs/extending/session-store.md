---
sidebar_position: 6
---

# Session Store

Kickstart persists conversation state in a **session store**. The harness ships two implementations and a clean adapter contract for adding more.

---

## Interfaces — `runtime/session-store.ts`

```ts
export interface ISessionStore {        // synchronous, Map-shaped
  get(id: string): Session | undefined;
  set(id: string, session: Session): void;
  delete(id: string): boolean;
  entries(): IterableIterator<[string, Session]>;
  [Symbol.iterator](): IterableIterator<[string, Session]>;
  list(): Session[];
  clear(): void;
}

export interface IAsyncSessionStore {   // Promise-returning, remote backends
  get(id: string): Promise<Session | undefined>;
  set(id: string, session: Session): Promise<void>;
  delete(id: string): Promise<boolean>;
  entries(): AsyncIterableIterator<[string, Session]>;
  list(): Promise<Session[]>;
  clear(): Promise<void>;
  init?(): Promise<void>;             // create table, etc.
  evictExpired?(): Promise<number>;   // returns count deleted
}
```

`createSessionStore(kind)` returns an `ISessionStore` for `'memory'` and is the default for tests. The async store sits behind an internal sync façade in production.

---

## Bundled implementations

| Class | Module | Notes |
|---|---|---|
| `InMemorySessionStore` | `runtime/session-store.ts` | Map-backed; default; loses sessions on process restart. |
| `AzureTableSessionStore` | `runtime/session-store-azure-table.ts` | Azure Table Storage backend (#133). |

`AzureTableSessionStore` uses `@azure/data-tables` with `AzureNamedKeyCredential`. Configurable via:

- `AZURE_STORAGE_CONNECTION_STRING` *or* (`AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY`)
- `KICKSTART_SESSION_STORE=azure-table`

Implementation details:

- Single fixed `partitionKey: 'sessions'` (single-tenant deployments).
- Each row stores serialised JSON in a `data` column with hard cap `MAX_DATA_BYTES = 64 * 1024` (Azure Table property limit).
- An ISO `expiresAt` column drives lazy TTL eviction.
- `hydrateSession()` reconstructs a `Session` instance from the JSON snapshot and re-applies mutable fields by name (`recentTurns`, `a2uiEmissions`, `pendingUserAction`, `lastActiveAt`, `activeAgent`, `anonTokenHash`, `responseId`).

---

## Eviction scheduler

`startEvictionScheduler(store, intervalMs?)` returns a handle with `stop()`. Default interval is 5 minutes. The scheduler swallows errors and logs them so a transient backend failure doesn't crash the process. The timer is `unref()`-ed so it never blocks process exit.

```ts
import { startEvictionScheduler, AzureTableSessionStore } from '@aks-kickstart/harness';
const store = new AzureTableSessionStore({ /* opts */ });
await store.init?.();
const handle = startEvictionScheduler(store);
process.once('SIGTERM', () => handle.stop());
```

---

## What's stored

`SessionData` (`runtime/session.ts`) carries:

- `sessionId`, `user` (`{ oid, tid?, upn? }`), `workspaceRoot`, `currentPhase`, `activeAgent`.
- `recentTurns: Turn[]` — server-trusted history (`role`, `content`, `timestamp`, `provenance: 'server' | 'client'`).
- `a2uiEmissions` — queued A2UI envelopes drained by the runner after each tool_call.
- `pendingUserAction` — set when a tool requests a UserAction; cleared via compare-and-swap in `/api/converse/resume`.
- `artifacts: Map<string, Artifact>` — plan artifacts, generated files, etc. The plan-artifact gate in `Runner.run` reads `artifacts.has('plan')`.
- `responseId` — Responses API thread continuity (#114/#126 Phase 3).
- `anonTokenHash` — hash of the anonymous session token (#1079).
- `lastActiveAt` — used by hydration / eviction.

---

## Session TTL & anonymous lifecycle

- `KICKSTART_SESSION_TTL_SECONDS` controls maximum session lifetime (Azure Table eviction).
- Anonymous sessions get a stricter TTL: `ANON_SESSION_TTL_MS = 10 * 60 * 1000` (10 minutes), enforced by `getOrCreateSession()` and surfaced as the `session_token` SSE event.
- `HARNESS_ALLOW_ANON_HYDRATION=true` enables cold-rehydration of anonymous sessions; otherwise anon sessions expire with the process.

---

## Cold rehydration

`hydrateColdSession(rawTurns, opts?)` walks the persisted history and rebuilds the in-memory `Session` with bounded fidelity:

- `HYDRATION_DEFAULT_CAP = 20` — most-recent N turns.
- `HYDRATION_CONTENT_MAX_BYTES = 4096` per turn — long messages are truncated, not silently dropped.

The bound exists so a long session doesn't blow up the prompt budget on resume. Hydrated turns retain their original `provenance` marker.

---

## Writing your own adapter

1. Implement `IAsyncSessionStore`.
2. Cap the per-row payload: `JSON.stringify(snapshot)` must fit your backend's row size limits.
3. Implement `evictExpired()` — without it the eviction scheduler is a no-op.
4. Re-create the in-memory class invariants when hydrating: rebuild `recentTurns`, `a2uiEmissions`, `pendingUserAction`, `responseId`, `anonTokenHash`, `lastActiveAt`, `activeAgent`. Don't lose `provenance` markers.
5. Wire it via `createSessionStore` or directly in your API bootstrap.

The class to model on is `AzureTableSessionStore` — it covers serialisation, hydration, TTL filtering on read, and `evictExpired` in ~200 lines.
