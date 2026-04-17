---
name: aks-best-practices
description: Cross-cutting AKS and Kubernetes best practices injected into any agent context. Covers cluster configuration, workload design, security hardening, and operational recommendations.
appliesTo:
  - "*"
keywords:
  - aks
  - kubernetes
  - best-practices
priority: 60
---

## AKS Best Practices — Quick Reference

These practices apply across all Kickstart agents. Reference them when evaluating, generating, or advising on AKS deployments.

### Cluster configuration

- **AKS Automatic** is the recommended tier for most workloads. It handles node provisioning, OS patching, cluster upgrades, and basic security policies automatically. Use **AKS Standard** only when you need fine-grained node pool control.
- Enable **availability zones** for the system node pool across at least two zones.
- Use **Azure CNI Overlay** as the network plugin for efficient IP address usage in large clusters.
- Enable **Microsoft Defender for Containers** at the cluster level for runtime threat detection.
- Keep Kubernetes version within two minor versions of the current GA release.

### Workload design

- **Stateless over stateful** — prefer external state (Azure Cache for Redis, Azure SQL, Cosmos DB) over in-cluster persistent volumes for resilience.
- Set **resource requests and limits** on every container. Over-provisioned limits waste money; missing requests break the scheduler.
- Configure **HorizontalPodAutoscaler** for any user-facing workload. Target 60–70% CPU utilisation to leave headroom for burst.
- Use **PodDisruptionBudget** to ensure cluster upgrades do not drain all pods simultaneously.
- Prefer **Deployment** over bare Pods. Always set `minReadySeconds` ≥ 5.

### Security hardening

- Run containers as **non-root** (`runAsNonRoot: true`, `runAsUser` ≥ 1000).
- Set `allowPrivilegeEscalation: false` and `readOnlyRootFilesystem: true` on every container.
- Use **Workload Identity** (managed identity + federated credential) for all Azure API access from pods — no secrets mounted as env vars.
- Apply **Kubernetes Network Policies** to restrict pod-to-pod traffic to what the workload actually needs.
- Use **Azure Key Vault Provider for Secrets Store CSI Driver** to inject secrets as files, not environment variables.
- Scan container images in ACR with **Microsoft Defender for Containers** or an equivalent tool before deployment.

### Operational excellence

- Deploy via **GitOps** (GitHub Actions, Flux, or ArgoCD). Never apply manifests manually in production.
- Use **rolling updates** with `maxUnavailable: 0` for zero-downtime deployments.
- Forward **cluster logs and metrics** to Azure Monitor or a compatible observability platform.
- Tag all Azure resources with at minimum `environment`, `owner`, and `application` tags for cost attribution.
- Use **Azure Policy** for AKS to enforce guardrails at the cluster level (e.g., disallow privileged containers, require resource limits).

### Cost management

- Use **spot node pools** for batch workloads or non-critical background processing.
- Set **cluster autoscaler** min/max bounds that reflect actual off-peak baselines — don't set min=0 for user-facing workloads.
- Use **Azure Cost Management** budgets and alerts to catch runaway spend early.
- Review **unused persistent volumes** and **orphaned load balancer IPs** in the Azure portal after each deployment.

### References

- [AKS Best Practices](https://learn.microsoft.com/azure/aks/best-practices)
- [Azure Well-Architected Framework — AKS](https://learn.microsoft.com/azure/architecture/framework/services/compute/azure-kubernetes-service/azure-kubernetes-service)
- [AKS Security Best Practices](https://learn.microsoft.com/azure/aks/operator-best-practices-cluster-security)
- [AKS Cost Optimisation](https://learn.microsoft.com/azure/aks/best-practices-cost)
