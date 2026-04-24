---
"@aks-kickstart/web": patch
---

fix: resolve 403 on pick_track in dev mode via SWA CLI + token propagation

- Default `npm run dev` now uses SWA CLI emulator for proper auth context
- Frontend propagates `x-anon-session-token` via sessionStorage on resumed sessions
- Added health-check retry loop to dev-swa.mjs startup
- Improved 403 error responses with structured JSON codes (ANON_TOKEN_INVALID, SESSION_OID_MISMATCH)
- Added CI regression gate to prevent auth bypass references in API code
