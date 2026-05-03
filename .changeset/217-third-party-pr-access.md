---
'@aks-kickstart/pack-github': minor
---

Add `github.check_repo_access` tool and third-party PR support to `github.publisher`

Introduces a write-access preflight check for the GitHub Publisher agent when targeting external repositories (e.g. `contoso/iac` central monorepos per Sim #4 Erin enterprise scenario).

- New `github.check_repo_access` tool calls the GitHub collaborators permission API and returns structured access result (`permission`, `hasWriteAccess`, `suggestedAction`)
- 403/404 responses are treated as `none` access (not a collaborator)
- `github.publisher` agent now uses `github.check_repo_access` before `github:create_pr` when targeting third-party repos
- If no write access: agent surfaces two fallback options to the user (R-honest-gap): fork-and-PR or request-review-from-maintainer
- If write access: proceeds normally with `github:create_pr`
