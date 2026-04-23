---
'@aks-kickstart/api': patch
'@aks-kickstart/harness': patch
---

Wire Azure Monitor OpenTelemetry auto-instrumentation for full observability into LLM workflows.

**API layer (`packages/web/api/`):** Add `@azure/monitor-opentelemetry` distro alongside the classic Application Insights SDK. The distro's OpenTelemetry auto-instrumentation covers `undici`/global `fetch` — which the classic SDK's `diagnostic-channel` patching does not — so outbound calls the `@openai/agents` SDK makes to Azure OpenAI now surface as dependency telemetry automatically (target, URL, status, duration). Classic SDK auto-collection is disabled to prevent double-counting; classic remains only for existing custom `trackEvent`/`trackException`/`trackTrace` call sites.

**Harness (`packages/harness/`):** Add an `OtelBridgeTraceProcessor` that mirrors `@openai/agents` SDK tracing events (AgentSpan / GenerationSpan / FunctionSpan / GuardrailSpan / HandoffSpan) into OpenTelemetry spans. Installed via `setTraceProcessors([...])` so agent spans flow only to Application Insights — not to OpenAI's traces dashboard. Result: App Insights now shows a full workflow → agent → generation (with model + token usage, GenAI semantic conventions) → outbound HTTPS dependency hierarchy, instead of flat uncorrelated rows. Tool inputs/outputs are NOT captured by default; set `KICKSTART_OTEL_RECORD_CONTENT=true` to opt in during debugging.

