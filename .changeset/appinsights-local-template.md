---
"@aks-kickstart/api": patch
---

Add `local.settings.json.template` documenting `APPLICATIONINSIGHTS_CONNECTION_STRING` as a required env var for local development. Previously this key was absent from any committed template, causing telemetry to silently fall through to the no-op client for all local runs.
