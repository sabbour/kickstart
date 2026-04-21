---
'@aks-kickstart/api': patch
---

Wire Azure Monitor OpenTelemetry distro (`@azure/monitor-opentelemetry`) alongside the classic Application Insights SDK so that outbound `fetch`/undici calls — notably the `@openai/agents` SDK's calls to Azure OpenAI — are captured as dependency telemetry automatically. The classic SDK's diagnostic-channel auto-collection only hooks Node `http`/`https` and misses global `fetch`, which made the PR #933 404 invisible for ~2 days. OTel auto-collection now surfaces the resolved URL, HTTP status, and duration of every LLM call with zero runner changes. Classic SDK auto-collection is disabled to prevent double-counting; it remains enabled only for existing custom `trackEvent`/`trackException`/`trackTrace` call sites.
