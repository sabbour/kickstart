---
"@aks-kickstart/pack-core": minor
---

Add `core.kustomize_build` tool for GitOps workflows.

Shells out to `kustomize build <overlayPath>` and returns the fully-rendered multi-document YAML alongside a source map that attributes each resource block to its originating file (classified as `base`, `overlay`, or `patch`). Network access is disabled during build (`--network-policy=none`). Subprocess timeout is 60 seconds.
