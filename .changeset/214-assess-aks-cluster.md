---
"@aks-kickstart/pack-azure": patch
---

feat: add azure.assess_aks_cluster tool for cluster readiness assessment

Implements the `azure.assess_aks_cluster` tool in pack-azure that checks an existing AKS cluster's compatibility with AKS Automatic. Returns a structured readiness report covering Kubernetes version, CNI overlay mode, workload identity, OIDC issuer, enabled add-ons, incompatible add-on detection, and per-node-pool SKU details.
