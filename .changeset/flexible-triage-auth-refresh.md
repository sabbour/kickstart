---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/web": patch
"@aks-kickstart/api": patch
---

Make triage routing more flexible for prose component selections, generic inference endpoints, non-ACR registries, and app requirements such as databases, external services, secrets, and scale constraints.

Improve Azure auth handling by refreshing expired Static Web Apps sessions before redirecting to login, preserving the active route across login redirects, and allowing inspiration endpoints to be called anonymously with rate limiting.
