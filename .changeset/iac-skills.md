---
"@aks-kickstart/pack-core": minor
---

feat(pack-core): add gen-helm, gen-kaito-crd, gen-foundry-wiring IaC skills

Implements issue #49: three branch-isolated IaC generation skills for Generation Phase C.

- gen-helm: AKS-Automatic-compatible Helm chart (Chart.yaml, values.yaml, deployment, service, serviceaccount) with least-privilege ServiceAccount, resource limits, GPU node toleration only on KAITO track
- gen-kaito-crd: KAITO Workspace CRD from azure.propose_services output
- gen-foundry-wiring: Kubernetes Secret with {{ secrets.* }} placeholders only — no real values
