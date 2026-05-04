---
"@aks-kickstart/pack-azure": patch
---

`azure.architect` can now consult `github.publisher` (via asTools) for PR convention questions — branch naming, required secrets, and CI/CD wiring — without handing off the conversation. Includes re-entrancy guard documentation for the bidirectional azure.architect ↔ github.publisher asTools relationship.
