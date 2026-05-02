# Bender — Backend Dev

## Current Focus (2026-04-28 onwards)

**Recent Work:**
- Zod v4 migration (PR #247): multi-domain harness refactor, z.toJSONSchema() transition
- ARM direct call endpoint (PR #239): /api/azure/token SWA passthrough, CSP updates
- Phase 2 config extracts (PR #238): schema validation, handoff rules normalization
- Design decision: oneOf→anyOf guard layer for OpenAI strict-schema compatibility

**Pending:**
- PR #239 merged; PR #238 in review (Leela/Zapp/Nibbler/Amy gates)
- Phase 2 issue #229 shipped (PR #240 opened, fast-lane)

---

For detailed work history, see `history-archive.md`.
## Docs Restructure Audit (2026-05-01)
- Runtime/harness/packs docs audit completed — identified stale/missing coverage
- Findings fed into Leela's IA proposal and single-PR execution plan
- Stand-by for docs implementation phase

## Learnings

### Lease pruning pattern (PR #358 security fix, 2026-05-02)

When a store holds plaintext secrets (installation tokens), **pruning must be deterministic on every access path, not relegated to an optional cleanup routine**. The pattern:

1. Add `isStale(lease, ts)` and `pruneStore(store, ts)` as internal helpers. `pruneStore` returns `{ pruned, changed }` — only active leases, plus a flag indicating whether anything was dropped.
2. On every **mutation** path (`createLease`, `exchangeLease`, `revokeLease`): call `pruneStore` before `writeStore`. Exhausted leases should be deleted immediately (not written back with `remainingOps: 0`).
3. On every **read** path that already iterates (`validateLease`, `listLeases`): if `changed`, write the pruned store back inside `withLock`.
4. Use the **original (pre-prune) store** when forming error messages in mutation paths, so error strings stay stable for callers.
5. Wrap ALL writes in `withLock` — three functions (`exchangeLease`, `validateLease`, `revokeLease`) were previously unguarded races; fix those at the same time.
6. `cleanupExpired` becomes a one-liner: `pruneStore(readStore(), now())` → `writeStore`.

## 2026-05-02 — PR #358 Nibbler fix

**Issue**: Nibbler's 4 CHANGES_REQUESTED findings on PR #358

**Findings addressed**:
- Blank-scaffold problem: PR branch had reset `.squad/history.md` and `.squad/orchestration-log.md` to empty scaffolds. Always restore these from `origin/dev` when working on branches that diverged from dev.
- Runtime JSONL files (`.squad/attestation/`) must be gitignored; `git rm --cached` removes already-committed ones.
- Always preserve original error details in rethrows: use `err instanceof Error ? err.message : String(err)`.
- Export pure-function helpers from modules so they can be unit-tested independently.

**Silent rebase corruption pattern**: After `git rebase`, always verify that files with function-level conflicts don't contain duplicate function definitions. Git may report no conflicts but produce a file with two definitions for the same function — the outer one returns `undefined` because the inner one is declared inside a `try` block and never called.
