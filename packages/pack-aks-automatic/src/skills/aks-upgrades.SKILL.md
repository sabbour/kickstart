---
id: aks.aks-upgrades
name: AKS Upgrades
description: Cluster and node upgrade strategy for AKS Automatic — auto-upgrade channels, maintenance windows, and blue-green rollout patterns.
version: 1.0.0
author: kickstart-squad
license: MIT
x-kickstart:
  appliesTo:
    - "aks.*"
  keywords:
    - aks
    - upgrades
    - auto-upgrade
    - maintenance window
    - node image
  priority: 65
---

# AKS Upgrades

## Auto-upgrade channels

AKS Automatic defaults to the **`patch`** auto-upgrade channel — automatically applies the latest Kubernetes patch version within the current minor.

Available channels:
| Channel | Behaviour |
|---|---|
| `none` | No automatic upgrades |
| `patch` | Latest patch within current minor (recommended) |
| `stable` | Latest stable release, N-1 minor |
| `rapid` | Latest GA release, N minor |
| `node-image` | Node OS image updates only |

## Maintenance windows

Define a `MaintenanceConfiguration` to control when upgrades apply:

```yaml
apiVersion: containerservice.azure.com/v1
kind: MaintenanceConfiguration
spec:
  maintenanceWindow:
    schedule:
      weekly:
        intervalWeeks: 1
        dayOfWeek: Sunday
    startTime: "02:00"
    durationHours: 4
```

## Node image upgrades

Node image upgrades can run independently of Kubernetes version upgrades. Set `nodeOSUpgradeChannel: NodeImage` to keep OS patches current without full cluster upgrade.

## Drain behaviour

AKS respects `PodDisruptionBudget` resources during upgrades. Always define PDBs for stateful workloads:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: my-stateful-app
```
