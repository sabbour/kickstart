---
"@aks-kickstart/pack-azure": patch
---

The azure-ops agent now enforces a strict what-if-then-deploy chain: every template deployment must be preceded by a successful `azure.what_if`, single-resource PUTs are gated by user actions, and every resource deletion requires explicit user approval via the `azure:delete-resource` action. The agent also flags likely cost drivers based on what-if change analysis and provides a direct Azure Portal link (with URI-encoding safety) after deployment completes.
