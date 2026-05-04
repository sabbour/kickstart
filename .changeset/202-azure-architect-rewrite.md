---
"@aks-kickstart/pack-azure": patch
---

fix(azure-architect): replace deprecated Ingress Controller with Gateway API in plan exemplar and add hard guardrail against ingress-nginx / AKS App Routing NGINX mode

- ArchitectureDiagram node "Ingress Controller" → "App Routing (Gateway API)" in the plan-summary exemplar JSON
- Added explicit guardrail: never recommend ingress-nginx (retired March 2026) or AKS App Routing NGINX mode (EOL November 2026) for new deployments; use App Routing add-on with Gateway API or managed Istio control plane instead
