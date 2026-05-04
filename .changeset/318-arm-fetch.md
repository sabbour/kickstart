---
"@aks-kickstart/web": patch
---

feat(web): add `armFetch` + `acquireArmToken` browser ARM client (#318)

Adds `packages/web/src/lib/arm/armFetch.ts` — a memory-only, retry-once
browser ARM client that talks to `https://management.azure.com` directly
using a SWA-issued token from `/api/azure/token`.

This is a Wave 1 foundation module for #237 (Option A2 browser-direct
ARM). **No user-visible behaviour change** — existing `BrowserAzureARMConnector`
callers continue to use `services/arm-client.ts` until #320 migrates them
in Wave 2.

What ships:

- `armFetch(path, init?)` — direct `fetch` to ARM with `Authorization: Bearer <token>`,
  default `api-version` injection (parity with current connector behaviour),
  at-most-one 401-refresh-retry, and `Retry-After` honoured up to a 30s cap.
- `acquireArmToken({ forceRefresh? })` — returns the cached token or pulls a
  fresh one; concurrent callers share a single in-flight request via
  `fetchingTokenRef` (cleared in `finally` so failed refreshes don't wedge
  the cache).
- `ArmFetchError` — discriminated-union error
  (`{ kind: 'auth-error' | 'network-error' | 'arm-error', ... }`) so callers
  can branch on `err.kind` without parsing strings.
- MSW (Mock Service Worker) added as a dev dependency, with a shared
  `arm-msw-server` fixture that registers handlers against absolute ARM URLs.
- Unit tests covering all four error variants, the
  refresh-succeeded-but-second-call-still-401 case, the memory-only-token
  guarantees (`localStorage` / `sessionStorage` / cookies / `window`),
  api-version injection, `Retry-After` clamping, and concurrent
  `acquireArmToken` deduplication.

Tokens are held only in a module-scoped variable inside `armFetch.ts` —
never written to `localStorage`, `sessionStorage`, IndexedDB, cookies,
URL params, DOM attributes, or logs.
