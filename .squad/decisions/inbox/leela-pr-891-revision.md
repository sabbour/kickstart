# Decision: PR #891 reviewer-rejection revision

**Date:** 2025-04-20T18:05:00Z  
**Author:** Leela (Lead)  
**Status:** Implemented

## Context

PR #891 was authored by Bender and then rejected by Zapp on security grounds. Per reviewer-rejection protocol, the original author is locked out of revisions after a rejection, so the follow-up work had to be done by a different squad member.

The branch also predated the mainline changes that renamed packages to `@aks-kickstart/*`, introduced the structured logger, tightened the health-check diagnostics, and fixed the API esbuild bundling path. The shortest safe path was to rebase onto main, preserve those mainline fixes, and then reapply only the telemetry changes that still made sense under the current architecture.

## Decision

1. **Reviewer-rejection protocol enforced:** Bender remained locked out after Zapp's rejection, and Leela performed the revision work on PR #891.
2. **Use per-request correlation IDs instead of hashed persistent identifiers:** telemetry now correlates with a fresh `crypto.randomUUID()` request ID rather than `oid` or `session.id`. This avoids leaking stable user/session identifiers and removes the need to manage hash semantics or salt policy for this slice.
3. **Centralize telemetry scrubbing in a shared sanitizer:** `packages/web/api/src/telemetry/sanitize-error.ts` is the canonical sanitizer for exception messages and stack text. It uses a focused regex list for bearer tokens, JWTs, API keys, connection-string segments, Azure secret-style env values, and query-string secrets.
4. **Keep stack shape, scrub secret substrings:** the sanitizer preserves stack frames for diagnosis but replaces matching sensitive substrings inline. This preserves troubleshooting value without shipping raw secrets into telemetry.
5. **Do not rely on console auto-collection:** Application Insights console auto-collection stays disabled. Structured logger output and explicit `trackEvent` / `trackException` calls remain the supported observability path for this API surface.

## Consequences

- Security review can verify one sanitizer path instead of auditing multiple ad hoc regex callsites.
- Request-flow diagnosis still works through `requestId`, while long-lived identity/session correlation is intentionally dropped from telemetry.
- Future API telemetry work should reuse the shared sanitizer and keep correlation ephemeral by default unless there is a stronger product requirement for cross-request linkage.
