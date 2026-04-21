---
'@aks-kickstart/api': patch
---

Provision Application Insights (workspace-based) and Log Analytics workspace in Bicep. `APPLICATIONINSIGHTS_CONNECTION_STRING` is now auto-wired as a SWA app setting so the Functions API emits telemetry to a live App Insights dashboard on every deploy. Completes the observability story started in #946.
