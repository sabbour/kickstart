---
"@aks-kickstart/pack-azure": patch
---

Fix Ingress Controller drift in `azure-architect.agent.md` plan-summary exemplar. The networking line now reads `Gateway API (App Routing add-on with managed Istio)` instead of the deprecated `Ingress Controller + TLS`, so the architect agent stops recommending the legacy pattern in its plan card. (Fixes #229.)
