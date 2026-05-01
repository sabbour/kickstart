---
sidebar_position: 6
title: ARM call flow (browser-direct, Option A2)
---

# ARM call flow (browser-direct, Option A2)

> Source of truth for how the browser and the API talk to **Azure Resource
> Manager** (`https://management.azure.com`).
> Replaces the prior `/api/arm-proxy` round-trip with a thin token surface
> (`/api/azure/token`) and a memory-only browser ARM client (`armFetch`).
> Decision lineage: parent #237, DP v3 (Option A2) on #194, Wave-1/2/3
> implementation #317 / #318 / #319 / #320 / #321.

## TL;DR

- **Browser-initiated ARM calls** go **directly** from the SPA to
  `https://management.azure.com`. The Azure Function API does **not** sit on
  that path any more.
- The browser obtains its bearer token from a thin endpoint —
  `GET /api/azure/token` — that simply echoes the per-request Azure AD access
  token Static Web Apps already injects on the authenticated session. The
  token is held **only in module-scoped memory** in the SPA.
- **Server-initiated ARM calls** (pack tools such as `azure.arm_get`,
  `azure.arm_update_resource`, deployment polling) are **unchanged** — they
  still resolve a token server-side via `getAzureToken(session)` and call
  ARM directly from the Functions worker. They never went through
  `/api/arm-proxy`.
- **`/api/arm-proxy/{*path}`** is in a one-week zero-traffic observation
  window post-Wave 3 cut-over (#320). It is scheduled for retirement under
  #321 and **must not be re-introduced** as a calling path.

## Why we moved off `/api/arm-proxy`

The legacy proxy added a hop for every browser ARM call (subscription /
resource-group / resource picker, catalog browsing) without adding any value:
the user already had an Azure AD token via SWA, the proxy could only forward
that exact token, and the SWA token's audience already authorises ARM
directly. The proxy cost one extra latency hop, a 401-retry doubling on
expiry, and a server-side surface area that had to be SSRF-guarded.

Option A2 keeps the SWA AAD identity provider as the single source of token
truth and lets the browser talk to ARM with the same credential, removing the
hop without weakening trust boundaries.

## Call flow — browser-initiated

```
  ┌────────────┐      1. armFetch('/subscriptions?...')
  │   SPA      │
  │ (React +   │      2. acquireArmToken()
  │  armFetch) │─────────────────────────────────┐
  └─────┬──────┘                                 ▼
        │                                  ┌────────────────────┐
        │                                  │  Azure Functions   │
        │      3. GET /api/azure/token     │  /api/azure/token  │
        │     ─────────────────────────────▶                    │
        │      4. { token, expiresAt? }    │  echoes SWA-       │
        │     ◀─────────────────────────────  injected AAD      │
        │                                  │  access token      │
        │                                  └────────────────────┘
        │
        │      5. fetch https://management.azure.com/...
        │         Authorization: Bearer <token>
        │     ────────────────────────────────────────────────▶
        │                                  ┌────────────────────┐
        │      6. ARM JSON response        │  Azure Resource    │
        │     ◀────────────────────────────│  Manager           │
        ▼                                  └────────────────────┘
   render
```

On a `401` from ARM, the SPA refreshes the token from `/api/azure/token`
**at most once** and retries the original request **at most once** before
surfacing an `auth-error` and prompting re-sign-in (ADR-0002).

### Token contract — memory only

The browser ARM client (`packages/web/src/lib/arm/armFetch.ts`) holds the
token **only** in a module-scoped variable. The token is **never**:

- written to `localStorage`
- written to `sessionStorage`
- written to IndexedDB
- set as a cookie
- placed in URL params or DOM attributes
- logged

Concurrent token refreshes are deduplicated via an in-flight promise ref;
a failed refresh clears the ref in `finally` so the next caller is not
wedged. Unit tests in
[`packages/web/src/lib/arm/__tests__/armFetch.test.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/web/src/lib/arm/__tests__/armFetch.test.ts)
lock these guarantees in.

### Errors are a discriminated union

`armFetch` throws `ArmFetchError` with a `kind` discriminator so callers can
branch without parsing strings:

| `kind`          | When                                                       |
| --------------- | ---------------------------------------------------------- |
| `auth-error`    | `/api/azure/token` returned 401/403, or ARM 401 after the one allowed refresh-retry |
| `network-error` | `fetch` rejected (offline, DNS, TLS)                       |
| `arm-error`     | Any other non-2xx ARM (or token-endpoint) response         |

The Azure auth-error UI surface follows ADR-0002 — refresh once, then route
the user to a sign-in prompt instead of stacking retries.

## Call flow — server-initiated (pack tools, unchanged)

Pack tools that talk to ARM from the Functions worker do **not** use
`armFetch` and do **not** call `/api/azure/token`. They resolve the user's
token from the session context and call ARM directly:

```
  ┌──────────────┐    tool call (azure.arm_get, azure.arm_update_resource, …)
  │  Agent loop  │
  │  (Runner)    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  pack-azure tool             │
  │   getAzureToken(session)     │  ← reads SWA AAD token captured into the
  │   armAuthHeaders(token)      │    session at login time
  └──────┬───────────────────────┘
         │
         │   fetch https://management.azure.com/...
         │   Authorization: Bearer <token>
         ▼
  ┌──────────────────────────────┐
  │  Azure Resource Manager      │
  └──────────────────────────────┘
```

Source:
[`packages/pack-azure/src/services/azure-auth.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/pack-azure/src/services/azure-auth.ts)
exposes `getAzureToken`, `armAuthHeaders`, `armBaseUrl`, `armUrl`,
`pollArmLro`, and `assertArmPollingUrl`. Tools that use it include
`azure.arm_get`, `azure.arm_update_resource`, and the
`POST /api/sessions/{sessionId}/azure-deployments` /
`GET /api/azure-deployments/{runId}` deployment endpoints.

This split — **browser-direct for read-heavy SPA picker traffic, server-side
for tool-and-deployment workflows** — is intentional. The server-side path
needs the session context (cost gates, deployment-state machine, deployment
polling URL allow-listing via `ARM_POLLING_HOSTS`); the browser path needs
only the user's own AAD token to render UI.

## Trust boundaries

| Path                                       | Token source                                         | Trust note |
| ------------------------------------------ | ---------------------------------------------------- | ---------- |
| Browser → ARM                              | `/api/azure/token` (echoes per-request SWA header)   | Caller can only ever receive their own token; endpoint performs no ARM calls and no `/.auth/me` calls |
| Browser → `/api/azure/token`               | SWA-injected `x-ms-token-aad-access-token` header    | `401 azure_access_token_missing` if header absent (fail-closed); `405` for non-`GET`; `Cache-Control: no-store` |
| Pack tool → ARM (Functions worker)         | `getAzureToken(session)` from session-captured token | Same trust scope as the user's session; allow-listed polling hosts via `assertArmPollingUrl` |
| `ANY /api/arm-proxy/{*path}` *(retiring)*  | SWA-injected `x-ms-client-principal-id` (principal required) **and** `x-ms-token-aad-access-token` (forwarded as `Authorization: Bearer …`) | Fail-closed: `403 principal_required` if no principal, `401 azure_access_token_missing` if no AAD token; host-allowlisted (`management.azure.com` only) via `isAllowedHost`; zero-traffic observation window prior to #321 retirement. See [`requireAzureAccessToken`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/web/api/src/lib/azure-auth.ts) and [`arm-proxy.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/web/api/src/functions/arm-proxy.ts). |

## CSP

Browser-direct ARM requires
`https://management.azure.com` in the `connect-src` directive of
[`packages/web/public/staticwebapp.config.json`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/web/public/staticwebapp.config.json).
Removal is blocked by the `csp-check` GitHub Actions workflow
(`.github/workflows/csp-check.yml`, issue #319) which runs
[`packages/web/scripts/check-csp.mjs`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/web/scripts/check-csp.mjs)
on every PR that touches CSP-owning files and exits non-zero if any required
origin disappears.

## Tombstone status of `/api/arm-proxy`

| Stage                     | Status as of Wave 3 cut-over (#320)                              |
| ------------------------- | ---------------------------------------------------------------- |
| Browser callers           | **Migrated.** `BrowserAzureARMConnector` and the catalog pickers all route through `armFetch` — no SPA call site targets `/api/arm-proxy` |
| Server callers            | None historically — pack tools never used the proxy              |
| Endpoint                  | **Still deployed**, receiving zero traffic, monitored as a one-week rollback safety net |
| Removal                   | Tracked under **#321** (Wave 3 retirement)                       |
| Re-introduction guidance  | **Forbidden.** Treat `/api/arm-proxy` as deprecated for all new code; new browser ARM call sites must use `armFetch` |

When #321 lands, the route will join the existing **Deprecated (410 Gone)**
table in [API Endpoints](../extending/api-endpoints.md#deprecated-410-gone)
and the proxy file will be deleted.

## See also

- [API Endpoints — Azure integration](../extending/api-endpoints.md#azure-integration) — full HTTP surface for `/api/azure/token` and the still-deployed `/api/arm-proxy`.
- [ADR-0002 — Auth-error UI surface on retry](./decisions/ADR-0002-auth-error-ui-surface-on-retry.md) — the one-refresh / one-retry contract that `armFetch` implements.
- [Architecture overview](./overview.md) — how ARM calls fit the broader Five-Primitives request flow.
