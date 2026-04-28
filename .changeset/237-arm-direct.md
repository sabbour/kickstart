---
"@aks-kickstart/web": minor
---

Azure management calls now go directly from your browser to `https://management.azure.com` using a token issued by your Microsoft sign-in, instead of round-tripping through the `/api/arm-proxy/*` endpoint. You'll see fewer hops on the network panel and faster ARM responses, and there's a new `GET /api/azure/token` endpoint that hands the active SWA-issued Azure access token to the page (memory-only — never written to localStorage, sessionStorage, IndexedDB, or cookies). On a 401 from ARM the page refreshes the token once and retries the call once before surfacing a sign-in prompt. The Content Security Policy has been updated so `connect-src` allows `https://management.azure.com`. The legacy `/api/arm-proxy` endpoint stays live for one week as a rollback safety net before being removed in a follow-up release.
