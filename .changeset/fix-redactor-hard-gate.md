---
"@aks-kickstart/api": patch
---

Close PII leak in OpenTelemetry export path (#1035): ensure RedactingSpanExporter is the only exporter reachable via useAzureMonitor. Extend redaction to span.links[] and resource attributes (#1036).
