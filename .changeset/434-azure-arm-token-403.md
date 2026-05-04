---
"@aks-kickstart/api": patch
---

Fix Azure subscriptions silently returning empty when ARM token is missing.

`requireAzureAccessToken` now returns **403** instead of 401 when the SWA-injected
ARM-scoped token (`x-ms-token-aad-access-token`) is absent. The previous 401 was
intercepted by SWA's `responseOverrides.401` redirect before reaching the browser,
causing `apiFetch` to receive an HTML login page, silently discard it, and return an
empty subscription list with no visible error.

403 is semantically correct (authenticated but missing ARM delegation) and bypasses
the SWA redirect. The frontend's `fetchAzureList` already handles 403 identically to
401. Actionable hints updated to guide users to sign out and sign back in.
