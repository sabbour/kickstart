---
"@aks-kickstart/web": patch
---

Centralise `AUTH_REDIRECT_PENDING_KEY` constant in `api-client.ts` to eliminate string literal duplication across `App.tsx` and `useStreaming.ts`.
