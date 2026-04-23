---
name: "telemetry-sanitization"
description: "Sanitize API logs and telemetry so request diagnostics stay useful without leaking secrets or stable identifiers"
domain: "backend, security, observability"
confidence: "high"
source: "earned"
---

## Context
Use this when API handlers need richer telemetry or debugging traces but security review blocks raw identifiers, stack traces, or console capture. The goal is to keep request diagnosis useful while removing stable user/session identifiers and scrubbing common secret formats before they hit logs or telemetry sinks.

## Patterns
- **Prefer ephemeral correlation:** use a fresh request-scoped UUID for telemetry correlation instead of `oid`, `session.id`, or other long-lived identifiers.
- **Centralize secret scrubbing:** keep one sanitizer module (for example `packages/web/api/src/telemetry/sanitize-error.ts`) that handles error messages and stack text for all telemetry paths.
- **Scrub inline, keep stack shape:** preserve stack frames and context lines, but replace matching secret substrings in-place so exception telemetry stays debuggable.
- **Cover the common leak classes:** redact bearer tokens, JWTs, API keys, connection-string segments, Azure secret-style env values, and query-string secrets.
- **Make logger and telemetry share the sanitizer:** structured logs and `trackException` should use the same sanitizer so there is no “safe in one sink, unsafe in another” drift.
- **Disable broad console auto-collection:** rely on explicit telemetry calls and structured logs instead of shipping every console line through Application Insights.
- **Keep telemetry properties allowlist-like:** include request IDs, durations, counts, and coarse context labels; avoid raw principal, session, or env values.

## Examples
- Shared sanitizer: `packages/web/api/src/telemetry/sanitize-error.ts`
- App Insights processor: `packages/web/api/src/lib/appinsights.ts`
- Logger integration: `packages/web/api/src/lib/logger.ts`
- Handler callsites: `packages/web/api/src/functions/converse.ts`, `packages/web/api/src/functions/health.ts`
- Tests: `packages/web/api/src/telemetry/sanitize-error.test.ts`, `packages/web/api/src/lib/logger.test.ts`

## Anti-Patterns
- Hashing stable identifiers when request-scoped correlation is enough.
- Logging raw `session.id`, `oid`, env var values, or exception text and hoping downstream processors catch everything.
- Having separate redaction logic for logger output and telemetry export.
- Enabling console auto-collection on a service that can log error strings with secrets.
