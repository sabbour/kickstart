---
"@aks-kickstart/api": patch
---

Retire the legacy `/api/arm-proxy/*` route. The browser-direct ARM client and `/api/azure/token` endpoint shipped earlier (#318/#320) — this release replaces the proxy handler with a minimal `410 Gone` tombstone (matching `/api/github-proxy` and `/api/github-oauth`) and drops `arm-proxy` from the upstream host allowlist. Any straggling caller now gets an explicit migration message pointing at `armFetch` + `/api/azure/token` instead of a generic missing-route response.
