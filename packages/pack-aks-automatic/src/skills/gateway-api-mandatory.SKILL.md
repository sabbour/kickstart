---
name: gateway-api-mandatory
description: Gateway API is the mandatory ingress mechanism for AKS Automatic. Teaches Gateway and HTTPRoute authoring, listener configuration, and cross-namespace references. Forbids legacy Ingress.
version: 1.0.0
author: kickstart-squad
license: MIT
x-kickstart:
  appliesTo:
    - "aks.*"
  keywords:
    - aks
    - networking
    - gateway api
    - network policy
    - dns
    - ingress
  priority: 85
---

# AKS Networking

AKS Automatic uses **Gateway API** (not the legacy Ingress controller) as the standard for HTTP routing.

## Gateway API basics

- Use `Gateway` resources to define the entry point (managed by AKS).
- Use `HTTPRoute` resources to route traffic to services.
- `GatewayClass` named `azure-application-lb` is pre-installed in AKS Automatic.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-app-route
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: my-app-svc
          port: 80
```

## Network policies

AKS Automatic enables **Cilium** network policies by default. Always define explicit ingress/egress rules:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-ingress
spec:
  podSelector:
    matchLabels:
      app: my-app
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-system
```

## DNS

- CoreDNS is managed. Do not modify the `kube-dns` ConfigMap.
- Use `ExternalName` services to alias external endpoints.

## Private cluster

AKS Automatic clusters are private by default. The API server is accessible only via a private endpoint. Plan your build agent network connectivity accordingly.
