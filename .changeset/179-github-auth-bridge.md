---
"@aks-kickstart/pack-github": minor
"@aks-kickstart/web": patch
---

Sign in once on the GitHub login card and the repository, organization, and repo info cards instantly reflect the new session — no page refresh needed. Restores reactive auth across pack-github components after PR #190 moved the GitHub renderers out of the web package.

Under the hood: pack-github now exposes a single-assignment `setGitHubAuthHook(useGitHubAuth)` bridge that the web bootstrap wires once at startup. Pack components consume the injected hook and fail-fast with a clear error if the host application forgets to wire it.
