---
'@aks-kickstart/web': patch
---

fix(e2e): scope Azure Blob Storage locator to SummaryCard items grid to resolve strict-mode violation (#309). Adds `data-testid="a2ui-SummaryCard-items"` to the items grid in SummaryCard and updates phase-b-architect-summary spec to scope resource-name assertions through that container, preventing ambiguous matches with nested ArchitectureDiagram node labels.
