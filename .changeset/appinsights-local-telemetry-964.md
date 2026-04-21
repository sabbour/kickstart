---
"@aks-kickstart/api": patch
---

fix(api): add stdout diagnostic logs for AppInsights init so local telemetry issues are immediately visible; expose `isAppInsightsConfigured()` helper; surface appinsights state in `/api/health` response.
