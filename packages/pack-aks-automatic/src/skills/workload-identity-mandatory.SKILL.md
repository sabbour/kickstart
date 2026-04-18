---
name: workload-identity-mandatory
description: Workload Identity is mandatory for AKS Automatic. Teaches the Azure Workload Identity wiring — managed identity, federated credential, service account annotation, and pod label. Forbids secretKeyRef for Azure credentials.
version: 1.0.0
author: kickstart-squad
license: MIT
x-kickstart:
  appliesTo:
    - "aks.*"
  keywords:
    - aks
    - identity
    - workload identity
    - managed identity
    - rbac
    - aad
    - entra
  priority: 85
---

# AKS Identity

## Azure Workload Identity

AKS Automatic uses **Azure Workload Identity** for pod-level Azure access. AADPODIDENTITY is deprecated — do not use it.

### Setup

1. Create a user-assigned managed identity.
2. Create a federated credential linking the identity to the Kubernetes service account.
3. Annotate the service account.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: default
  annotations:
    azure.workload.identity/client-id: "<managed-identity-client-id>"
```

4. Label the pod:

```yaml
metadata:
  labels:
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: my-app-sa
```

The Azure SDK picks up the token automatically via the OIDC projected volume.

## Kubernetes RBAC

AKS Automatic integrates with **Microsoft Entra ID** for Kubernetes RBAC. Use group-based role bindings:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: aks-admins
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: "<entra-group-object-id>"
```

## Managed identity for the cluster

AKS Automatic uses a **system-assigned managed identity** for the control plane. Do not modify its role assignments.

## Secret store

Use **Azure Key Vault Provider for Secrets Store CSI Driver** (pre-installed) to mount secrets from Azure Key Vault as Kubernetes volumes. Never store Azure credentials in Kubernetes secrets.
