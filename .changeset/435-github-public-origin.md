---
"@aks-kickstart/api": patch
---

Fix GitHub OAuth 404: use `x-ms-original-url` for reliable public origin in SWA.

`getPublicOrigin` now checks the `x-ms-original-url` header (injected by SWA's
trusted reverse proxy with the full public URL) before falling back to
`x-forwarded-host`. In some SWA configurations, `x-forwarded-host` carries the
internal Function App hostname instead of the public SWA hostname, causing the
computed OAuth redirect URI to not match the registered GitHub OAuth App callback —
resulting in a 404 after the user authorizes.

Fallback priority:
1. `GITHUB_BASE_URL` env var (operator override, unchanged)
2. `x-ms-original-url` header origin (new — SWA public URL)
3. `x-forwarded-proto` + `x-forwarded-host` / `host` (unchanged)
4. `request.url` origin with a `console.warn` (unchanged)

Improved error messages for invalid `GITHUB_BASE_URL` values now include
remediation guidance. Five new tests cover the header fallback behaviour.
