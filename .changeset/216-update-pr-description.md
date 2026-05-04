---
"@aks-kickstart/pack-github": minor
---

Add `github.update_pr_description` tool — wraps `PATCH /repos/{owner}/{repo}/pulls/{pull_number}`.
Supports replace mode (default) and `appendMode: true` which fetches the existing body first and appends the new text with a blank-line separator.
Enables the review pack to update or annotate PR descriptions programmatically (Stefan SRE handover sim, #216).
