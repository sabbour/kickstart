---
name: architecture-review
description: Guides the architect agent in performing a structured review of a Kickstart deployment plan against AKS and Azure Well-Architected Framework principles.
version: 0.1.0
x-kickstart:
  appliesTo:
    - core.architect
  keywords:
    - architecture
    - review
    - patterns
  priority: 75
---

## Architecture Review — AKS Deployment Plans

When reviewing a Kickstart deployment plan, evaluate it against the five pillars of the Azure Well-Architected Framework: **Reliability**, **Security**, **Cost Optimisation**, **Operational Excellence**, and **Performance Efficiency**.

### Reliability checklist

- [ ] `minReplicas` ≥ 2 for any stateless workload exposed to external traffic.
- [ ] `PodDisruptionBudget` defined so cluster upgrades cannot drain all pods simultaneously.
- [ ] Liveness and readiness probes configured with appropriate `initialDelaySeconds` and `failureThreshold`.
- [ ] AKS cluster uses availability zones (at least two) for the system node pool.
- [ ] Container image tag is a digest or immutable tag — not `latest`.

### Security checklist

- [ ] Workload uses a dedicated Kubernetes `ServiceAccount` — not the `default` account.
- [ ] Managed identity is used for all Azure API access — no service principal secrets.
- [ ] Pod runs as non-root (`securityContext.runAsNonRoot: true`, `allowPrivilegeEscalation: false`).
- [ ] Network policies restrict ingress/egress to only necessary peers.
- [ ] ACR is not publicly accessible; pull is via managed identity attached to the kubelet identity.
- [ ] No sensitive values appear in `env` as plain text — use `secretKeyRef` or CSI Secret Store.

### Cost optimisation checklist

- [ ] User node pool uses spot instances if the workload tolerates interruption.
- [ ] Resource `requests` are sized to actual observed usage, not over-provisioned.
- [ ] `HorizontalPodAutoscaler` is configured so the cluster can scale down during off-peak hours.
- [ ] AKS Automatic tier is preferred over Standard for typical workloads (includes managed upgrades, auto-scaling, and security patching at lower operational overhead).

### Operational excellence checklist

- [ ] Deployment is managed via GitOps (GitHub Actions or Flux) — no manual `kubectl apply`.
- [ ] Container image builds are automated in CI; no manual `docker push`.
- [ ] Rollout strategy is `RollingUpdate` with `maxUnavailable: 0` for zero-downtime deploys.
- [ ] Cluster and workload logs are forwarded to Azure Monitor or a compatible sink.

### Performance efficiency checklist

- [ ] CPU and memory limits are not more than 4× the corresponding requests (tight ceiling → throttling).
- [ ] If the app is stateful, persistent volumes use `Premium_LRS` or better for I/O-sensitive workloads.
- [ ] Ingress is via an AKS-managed ingress controller (Application Gateway for Containers or NGINX) — not a `NodePort`.

### Review output format

```
## Architecture Review

### Verdict: [✅ Approved | ⚠️ Approved with conditions | ❌ Rejected]

### Findings

| # | Pillar | Severity | Finding | Recommendation |
|---|--------|----------|---------|----------------|
| 1 | Reliability | High | ... | ... |
| 2 | Security | Medium | ... | ... |

### Next steps

<Ordered list of actions before deployment proceeds>
```

Always explain the trade-off behind each high-severity finding in plain language.
