---
"@aks-kickstart/harness": minor
---

Anonymous users now get a per-session security token that prevents session hijacking via sessionId guessing. The token is returned in the SSE `session_token` event and the `X-Anon-Session-Token` response header on first connection. Subsequent requests must include the token in the `X-Anon-Session-Token` header. Anonymous session TTL is also reduced to 10 minutes (from 30) as a belt-and-suspenders defense.
