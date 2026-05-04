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

## Learnings

- **2026-05-02T10:53:32-07:00 — PR #358 (Fixing) security review:** Reviewed token lease handling, gate-status role requirement logic, merge-check review gates, and workflow permissions for `squad-review-gate`, `squad-label-enforce`, and `squad-heartbeat`. Verdict: **REQUEST_CHANGES** (High) due to lease secret-retention regression in `.github/extensions/squad-identity/lib/token-lease-store.mjs` where expired/revoked/exhausted leases are no longer pruned in normal read flow, increasing plaintext token persistence on disk.
- Pattern to retain: for token lease stores, enforce TTL/revocation pruning on normal mutation/read paths (not only optional cleanup paths) so installation tokens do not outlive lease validity in persistent storage.
- **2026-05-02T11:07:38-07:00 — PR #358 (Fixing) security re-review:** Re-validated only the lease-pruning fix in `.github/extensions/squad-identity/lib/token-lease-store.mjs`; stale leases are now deterministically pruned on read/mutate paths, writes are lock-guarded, file mode `0o600` remains enforced, and public exports are unchanged. Reviewed the new 8-test pruning suite and re-ran it locally (8/8 passing). Verdict: **APPROVE**.
- **2026-05-03T21:38:37-07:00 — PR #419 security review:** Reviewed publish-mcp.yml in PR #419 (research doc PR). No blocking issues, security cleared. Applied `security:approved` label.
