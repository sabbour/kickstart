---
name: generate-files
description: Guides the implementer agent in generating production-quality Bicep templates, Kubernetes manifests, Dockerfiles, and GitHub Actions workflows for AKS deployments.
version: 0.1.0
x-kickstart:
  appliesTo:
    - core.implementer
  keywords:
    - generate
    - files
    - code
    - bicep
    - terraform
  priority: 85
---

## Generating Kickstart Infrastructure Files

Use this skill when producing any infrastructure-as-code artifact. Follow the standards below for each file type.

### File inventory

Generate all files in one pass. The complete set for a typical deployment:

| File | Purpose |
|------|---------|
| `infra/main.bicep` | Top-level Bicep template — AKS cluster, ACR, managed identity |
| `infra/main.bicepparam` | Parameter file with safe defaults |
| `k8s/deployment.yaml` | Kubernetes Deployment manifest |
| `k8s/service.yaml` | Kubernetes Service (ClusterIP or LoadBalancer) |
| `k8s/hpa.yaml` | HorizontalPodAutoscaler (if autoscaling requested) |
| `.github/workflows/deploy.yml` | GitHub Actions build-and-deploy workflow |
| `Dockerfile` | Container image build (only if building from source) |

### Bicep standards

```bicep
// Every generated Bicep file must start with this header block:
// FILE: infra/main.bicep
// PURPOSE: Provisions the Azure resources required for <app name> on AKS Automatic.
// USAGE: az deployment group create -g <rg> -f main.bicep -p main.bicepparam

targetScope = 'resourceGroup'

@description('Name of the AKS cluster')
param clusterName string

@description('Azure region for all resources')
param location string = resourceGroup().location
```

Rules:
- Every `param` must have `@description`.
- No `@secure()` params with hard-coded defaults.
- Use `existing` resource references instead of re-creating shared resources.
- Prefer `Microsoft.ContainerService/managedClusters` with `sku.tier: 'Standard'` and `agentPoolProfiles[*].availabilityZones`.
- Use `Microsoft.ManagedIdentity/userAssignedIdentities` — never `servicePrincipalProfile` with a password.

### Kubernetes manifest standards

```yaml
# FILE: k8s/deployment.yaml
# PURPOSE: Deploys <app name> to AKS.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <app-name>
  labels:
    app: <app-name>
spec:
  replicas: 2
  selector:
    matchLabels:
      app: <app-name>
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: <app-name>
    spec:
      serviceAccountName: <app-name>
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
        - name: <app-name>
          image: <registry>/<image>:<tag>
          ports:
            - containerPort: <port>
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: <port>
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: <port>
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
```

### GitHub Actions workflow standards

```yaml
# FILE: .github/workflows/deploy.yml
# PURPOSE: Build, push, and deploy <app name> to AKS on every push to main.
name: Deploy to AKS

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA>

      - name: Azure login (OIDC)
        uses: azure/login@<SHA>
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

Pin every `uses:` to a full commit SHA. Never use mutable tags like `@v3`.

### After generation

1. Call `validate_artifacts` to verify all files before reporting completion.
2. List each generated file with a one-line summary.
3. Tell the user what manual steps remain (e.g., "Set the three AZURE_* secrets in your GitHub repo settings").
