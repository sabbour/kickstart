---
"@aks-kickstart/harness": minor
---

Add TTL eviction scheduler + KICKSTART_SESSION_STORE env routing (#129)

- `ttlSeconds` option (+ `KICKSTART_SESSION_TTL_SECONDS` env var) on `AzureTableSessionStore`; default changed to 24 hours
- `evictExpired()` method: OData-filtered active sweep, returns count deleted
- `startEvictionScheduler(store, intervalMs)` exported from `session-store.ts`; returns `{ stop() }` handle
- `createSessionStore()` factory reads `KICKSTART_SESSION_STORE` env var (`'memory'` | `'azure-table'`) when no explicit type is passed — enables zero-code-change ACA multi-replica deployments
- `evictExpired?()` added to `IAsyncSessionStore` interface
- `EvictionSchedulerHandle` type exported from package index
