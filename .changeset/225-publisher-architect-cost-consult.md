---
"@aks-kickstart/pack-github": patch
---

`github.publisher` can now consult `azure.architect` (via `ask_azure_architect`) for pre-publish cost lookups and quick resource-design questions, in addition to confirming deployment-target details. The asTools `maxTurns` budget is bumped from 2 → 3 to accommodate the broader scope, and the publisher charter no longer punts cost questions back to the user — it now invokes the tool inline and only hands off to the architect for sustained redesigns.
