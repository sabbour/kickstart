---
"@aks-kickstart/pack-aks-automatic": patch
---

fix(pack-aks-automatic): extend aks-reviewer.agent.md — readiness assessment, raw manifest + Helm review paths (#201)

- Added "When loaded with the readiness skill" section: activates when `azure-kubernetes-automatic-readiness` Microsoft skill v1.0.0 is loaded. Runs a structured 10-check readiness checklist (resource requests/limits, anti-affinity, probes, securityContext, host namespaces, image pull policy, PDB, NetworkPolicy) and emits structured ReviewCards via `core.show_card`.
- Added raw manifest review path (Sim #2): parses pasted YAML, runs readiness checklist per workload resource (Deployment/StatefulSet/DaemonSet), emits one ReviewCard per workload plus a session summary, offers to generate corrected snippets for FAIL items.
- Added Helm chart review path (Sim #7): runs `core.helm_template` to render charts first, applies readiness checklist to rendered output, flags Helm-specific patterns (missing resources in values.yaml, hardcoded mutable tags, absent anti-affinity).
- Updated frontmatter tools: added `core.helm_template` and `core.show_card`.
- Updated description to reflect readiness assessment capability.
