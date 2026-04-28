---
'@aks-kickstart/pack-core': patch
---

`core_inspect_repo` now uses the GitHub REST API instead of `git clone` to fetch repo contents. This fixes silent failures on the Azure Functions host where no `git` binary is available and network restrictions block git-over-HTTPS. The tool fetches only the specific manifest files it needs (allowlisted), writes nothing to disk for remote repos, and surfaces API errors explicitly rather than swallowing them.
