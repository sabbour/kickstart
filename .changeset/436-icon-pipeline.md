---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/pack-aks-automatic": patch
---

fix: architecture diagram icons now render for structured nodes/edges

Added `iconKey` field to `DiagramNode` (both the TypeScript interface and the
`ArchitectureDiagramSchema`). `nodeToMermaid` now prepends `%%icon:key%%` to
the label when a valid `iconKey` is provided, allowing `expandIconPlaceholders`
to inject the correct `<img>` element after Mermaid renders the SVG.

`buildArchitectureDiagram` in `pack-aks-automatic` now populates `iconKey` on
every node: `azure/aks-automatic` for the control plane, `azure/aks` for node
pools, `k8s/deploy` for workloads, `k8s/ing` for ingress, `azure/storage` for
storage, `azure/acr` for container registries, and `azure/cognitive-services`
for Azure AI Foundry connections.

Closes #436
