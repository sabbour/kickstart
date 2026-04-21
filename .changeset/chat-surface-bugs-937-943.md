---
'@aks-kickstart/harness': patch
'@aks-kickstart/web': patch
---

Fix chat surface: prevent double-encoded JSON responses by extracting prose from AgentOutput.message (#937); include resolved model name in SSE `end` event and surface it in the Debug panel (#943).
