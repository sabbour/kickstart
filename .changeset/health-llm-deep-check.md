---
"@aks-kickstart/api": patch
---

Add `/health?deep=1` LLM canary check. The endpoint now accepts an optional `?deep=1` query parameter that fires a minimal single-token prompt against Azure OpenAI and reports `{ llm: { ok, latencyMs, model, errorCode? } }` in the response. Returns HTTP 503 when the LLM is unreachable. A 30-second module-level cache prevents hammering the endpoint on repeated probes. Default `/health` behaviour (shallow pack-registry check) is unchanged.
