---
"@aks-kickstart/pack-azure": minor
"@aks-kickstart/pack-github": minor
"@aks-kickstart/web": minor
---

Move Azure and GitHub UI components from the web layer into their respective packs (`pack-azure`, `pack-github`).

**New in `pack-azure`:** `azure/AzureLoginCard`, `azure/AzureResourceForm`, `azure/AzureResourcePicker` — passive `ComponentContribution` renderers that display Azure sign-in status, resource creation forms, and resource pickers without any direct context imports.

**New in `pack-github`:** `github/GitHubLoginCard`, `github/GitHubCommit` — passive `ComponentContribution` renderers for GitHub sign-in status and commit/PR preparation workflows.

**Removed from web:** `AzureAction`, `AzureLoginCard`, `AzureResourceForm`, `AzureResourcePicker`, `CostEstimate`, `GitHubAction`, `GitHubCommit`, `GitHubLoginCard`, `GitHubRepoPicker` are no longer registered as bare-named web components. Use their pack-qualified names instead:
- `azure/AzureAction`, `azure/CostEstimate`, `azure/AzureLoginCard`, `azure/AzureResourceForm`, `azure/AzureResourcePicker`
- `github/Action` (was `GitHubAction`), `github/RepoPicker` (was `GitHubRepoPicker`), `github/GitHubLoginCard`, `github/GitHubCommit`

This eliminates the circular dependency between packs and web context imports, unblocking GitHub auth context work (#179).
