# Zapp (Security) — Work History

## 2026-04 Summary

April 2026 focused on security reviews for Phase 2.0 foundation and authentication refactors.

**Key pattern:** OAuth token custody and browser-memory handling became central focus. Reviewed GitHub auth bridge, ARM token endpoint, fixture hygiene, and event payload safety across 12+ PRs and DPs. Conditions applied consistently around least-privilege boundaries, logging discipline, and secret non-echo in event surfaces. Post-flights all passed.

**Notable:** Zod v4 null-coerce trap identified in basic_functions_api migrations — binding requirement for future coercion migrations (preserve rejection envelope, never bare `z.coerce.number()` on formerly-guarded fields).

---
## Docs Restructure Audit (2026-05-01)
- Guardrails/agent docs audit: identified stale guardrail/SSE event docs, repo-only identity internals
- Security recommendations captured for implementation phase
- Approved single-PR strategy and user directive (no stubs, complete content)

## Spawn: ralph-wave-2 (2026-05-01T12:13:25)
- **PR #338 gate loop**: security rejections resolved → **approved** ✅
