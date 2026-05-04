---
"@aks-kickstart/pack-azure": patch
---

The azure-ops agent now enforces a strict what-if-then-deploy chain: every deployment must be preceded by a successful `azure.what_if`, and every resource deletion requires explicit user confirmation. The agent also surfaces cost deltas after what-if and provides a direct Azure Portal link after deployment completes.
