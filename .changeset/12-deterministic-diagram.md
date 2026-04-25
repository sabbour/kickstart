---
"@aks-kickstart/pack-aks-automatic": minor
---

Add `aks.build_architecture_diagram` tool — a deterministic builder that converts a plan artifact into an `ArchitectureDiagram`-compatible JSON (nodes, edges, title, description). Identical plans produce identical output across any number of runs (no LLM variation, no randomness). Includes node/edge templates for: AKS-Automatic control plane, user/system node pools, KAITO model pod, Foundry connection, ingress, storage, and CI/CD pipeline.
