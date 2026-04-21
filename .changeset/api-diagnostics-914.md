---
'@kickstart/api': patch
'@kickstart/web': patch
---

Add structured diagnostic error messages to API health endpoint. Health check now returns phase-based error classification (env-validation, pack-import, registry-seal) with specific hints instead of generic "API not available" message. Frontend displays actionable root cause to help developers debug initialization failures.
