---
"@aks-kickstart/pack-core": minor
---

Add `core.helm_template` tool: renders a Helm chart to Kubernetes YAML locally
using `helm template`, with a source map that correlates rendered lines back to
their originating template files, and chart metadata extracted from Chart.yaml.
No cluster connection required — rendering is fully sandboxed with no outbound
network access.
