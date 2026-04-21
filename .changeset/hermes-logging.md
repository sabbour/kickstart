---
'@kickstart/api': minor
---

Add structured JSON logging to Azure Functions using Application Insights. Introduces:
- Logger factory with automatic secret redaction
- Trace ID propagation from request headers
- Comprehensive startup, request/response, and error logging
- Child loggers with session context injection
- Performance overhead < 2.5ms per log entry

All logs are formatted as JSON for native Azure Portal ingestion and queryability.
