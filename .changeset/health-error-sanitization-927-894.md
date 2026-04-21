---
'@aks-kickstart/api': patch
---

Harden the unauthenticated `/api/health` surface against information disclosure (closes #927, #894).

The 503 response body previously included a `detail` field containing the raw (credential-sanitized) error message, which could still expose filesystem paths (e.g., `ERR_MODULE_NOT_FOUND: cannot find module '/home/user/app/...'`) and internal endpoint URLs. This patch removes the `detail` and `message` fields from the public 503 body; the response now returns only opaque category fields (`status`, `phase`, `hint`). Full error context continues to flow server-side via structured logging and Application Insights telemetry for diagnostics.
