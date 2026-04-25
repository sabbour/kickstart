---
"@aks-kickstart/pack-azure": minor
---
feat(aks-architect): add azure.propose_services tool with SKU recommendation engine

Implements the service list + SKU recommendation engine for Generation Phase C.
Deterministic lookup table maps model sizes (7B/13B/70B) to AKS GPU vmSizes.
KAITO branch returns workspace CRD inputs; Foundry branch returns project refs only.
