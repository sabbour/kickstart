---
'@aks-kickstart/harness': patch
'@aks-kickstart/pack-core': patch
'@aks-kickstart/pack-azure': patch
'@aks-kickstart/pack-aks-automatic': patch
'@aks-kickstart/pack-github': patch
---

Split agent model env vars by capability tier: chat agents use `KICKSTART_CHAT_MODEL`, code-generation agents use `KICKSTART_CODEX_MODEL`. Fix harness fallback to resolve via `AZURE_OPENAI_CHAT_DEPLOYMENT`/`AZURE_OPENAI_DEPLOYMENT` before throwing a user-friendly error without internal env var names.
