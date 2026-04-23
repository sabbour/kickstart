---
"@aks-kickstart/harness": patch
---

Sanitize `AgentSpanError` stack trace before OTel export so Application
Insights shows a real Call Stack / Failed method without leaking secrets
that may appear on the first line of `err.stack` (closes #1040).

The bridge at `packages/harness/src/runtime/agents-otel-bridge.ts` now
constructs a real `Error` for `recordException()` (so
`exception.stacktrace` populates) and rewrites stack line 0 with the
already-sanitized message. Frame lines are preserved. `error.cause` is
not forwarded — OTel only reads name/message/stack from the Error, and a
cause chain can carry upstream secrets.
