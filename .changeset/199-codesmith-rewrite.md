---
"@aks-kickstart/pack-core": patch
---

fix(pack-core): rewrite codesmith.agent.md — Workload Identity 4-resource pattern, safeguard compliance, Helm values gen (#199)

Adds four explicit generation rule sections to the Codesmith agent prompt:

1. **Workload Identity 4-resource pattern (D10)** — every pod identity requires UAMI Bicep + FederatedCredential Bicep (with explicit `subject: system:serviceaccount:<ns>:<sa>` and OIDC issuer) + Kubernetes ServiceAccount (annotated with `azure.workload.identity/client-id`) + role assignment Bicep scoped to resource level. Hard rule: never generate API keys, connection strings, or K8s Secrets for Azure service access.

2. **Safeguard-compliant manifest generation** — all containers must include `resources.requests/limits`, `securityContext.runAsNonRoot: true`, and `securityContext.readOnlyRootFilesystem: true` where feasible. Prohibited: `hostNetwork`, `hostPID`, `hostIPC`, `privileged`. Pre-emit validation step required before any manifest is emitted.

3. **Helm chart generation rules** — all env-specific values in `values.yaml` (never hardcoded), resource requests/limits with sensible non-empty defaults, image tag in values. `values.schema.json` required for charts with >5 values.

4. **Multi-file generation ordering** — infrastructure (Bicep) first, then K8s resources, then app config. Each file as a separate artifact named `<resource-type>-<name>.<ext>`.
