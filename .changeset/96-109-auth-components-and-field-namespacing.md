---
"@aks-kickstart/web": patch
---

feat: add auth components to Playground Components tab; separate KAITO/Foundry form fields

- #96: Add `AzureLoginCard` and `GitHubLoginCard` to Playground Components tab with live previews
- #109: Namespace KAITO and Foundry questionnaire question IDs (`kaito.*` / `foundry.*`) to prevent state bleed when switching inference modes
