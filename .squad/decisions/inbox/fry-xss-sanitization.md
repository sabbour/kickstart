# Decision: DOMPurify for all dangerouslySetInnerHTML

**Date:** 2026-04-10
**Author:** Fry
**Issues:** #81, #82
**PR:** #90

## Decision

All `dangerouslySetInnerHTML` usage in the web package must route HTML through `sanitizeHtml()` from `packages/web/src/utils/sanitize.ts` (DOMPurify with strict allowlist). Code highlight fallback paths must use `escapeHtml()` entity encoding to prevent raw content injection.

## Rationale

Security audit (Zapp) flagged ChatMessage, CodeBlock, and FileEditor as High-severity XSS vectors. DOMPurify is the industry standard for HTML sanitization with a minimal allowlist approach.
