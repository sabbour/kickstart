---
"@aks-kickstart/pack-aks-automatic": patch
---

fix(pack-aks-automatic): rewrite aks-architect.agent.md — R8 job table, Foundry WI, GPU quota, AGC trade-off (#200)

- R8 job-to-be-done table: when user asks for Container Apps / App Service / Functions, reshape-locally with AKS Automatic equivalents instead of recommending the other service
- Foundry / Azure OpenAI access: enforce Workload Identity (UAMI + FederatedCredential) via Service Connector; never API keys
- GPU quota preflight: call azure.quota_lookup before any KAITO manifest generation; emit QuotaCard with request-quota CTA if insufficient
- AGC trade-off guidance: App Routing addon as primary, AGC as alternative for advanced WAF / multi-site TLS; hard ban on legacy ingress-nginx
