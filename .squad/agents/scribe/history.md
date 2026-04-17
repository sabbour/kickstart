# Project Context

- **Project:** Kickstart — AI-guided AKS onboarding
- **Created:** 2026-04-08

## Responsibilities

- Maintain `.squad/orchestration-log/` — log every agent spawn with outcome
- Maintain `.squad/log/` — brief session summaries
- Merge decision inbox to `.squad/decisions.md`, delete inbox files
- Update agent histories with learnings and outcomes
- Commit `.squad/` changes with descriptive messages

## Learnings

- **2026-04-09:** Always timestamp UTC; format decisions with author/date/status/rationale/impact.
- **Wave scanning:** `grep -c` can give false 0 — verify with `grep -n` or `tail` when unsure.
- **Wave numbering:** Internal counter (18+) differs from user-labelled waves. Match user label in commit msg.
- **Worktree stale files:** Many worktrees carry already-merged copies. Verify by content grep, not filename.
- **Scribe charter:** `.squad/decisions/inbox/` is gitignored — never `git add` inbox files. Stage only: decisions.md, agents/*/history.md, agents/*/history-archive.md, log/*, orchestration-log/*.
- **Summarization gate:** 15,360 bytes (15 KB). Archive old waves to history-archive.md; rewrite active history to ~5 KB target.

## Archived Waves Summary

*Waves 3–17: `.squad/agents/scribe/history-archive.md` (Waves 3–17 section)*
*Waves 18–30: `.squad/agents/scribe/history-archive.md` (Waves 18–30 section)*

## Wave 31 — 2026-04-17

**Files merged:** 3 (`zapp-483-dp-review` BLOCKED, `leela-483-dp-review` A/C, `leela-484-dp-review` A/C)
**decisions.md:** 200,872 → 216,746 bytes | **leela:** → 9,932B | **zapp:** → 12,523B (81%)

## Wave 32 — 2026-04-17

**Files merged:** 2 (`zapp-484-dp-review` BLOCKED, `leela-483-dp-recheck` ✅)
**decisions.md:** 216,746 → 225,555 bytes | **leela:** → 11,231B | **zapp:** → 14,169B (92%)

## Wave 33 — 2026-04-17

**Files merged:** 1 (`zapp-483-dp-recheck` ✅ all 3 blockers cleared)
**decisions.md:** 225,555 → 227,308 bytes | **zapp:** → 14,897B (97% — critical)

## Wave 34 — 2026-04-17

**Files merged:** 2 (`zapp-484-dp-recheck` ✅, `zapp-485-dp-review` BLOCKED)
**decisions.md:** 227,308 → 233,696 bytes
**Summarized:** zapp 17,000 → 3,133B ✅; leela self-post + fry self-post committed

## Wave 35 — 2025-07-15

**Files merged:** 3 (`leela-485-dp-review` A/C, `leela-485-dp-recheck` ✅, `leela-486-dp-review` A/C+migration)
**decisions.md:** 233,696 → 239,049 bytes
**Summarized:** leela 17,526 → 3,832B ✅ (archived to leela/history-archive.md)

## Wave 36 — 2026-04-17

**Files merged:** 6 + 3 milestones
- `zapp-485-dp-recheck` ✅ (Crit1+B1–B4 cleared; Step 10 PR conditions set)
- `zapp-486-dp-review` BLOCKED (Crit1 SSE oracle; Crit2 credential leak; B1–B6)
- `leela-486-dp-recheck` ✅ (C1+C2 resolved; migrate 3 guardrails in same PR)
- `leela-pr550-review` A/C (BLOCK-1: `_lastActiveAt` must be constructor field; 4 arch decisions)
- `zapp-pr550-review` BLOCKED (3 high: HTTP 200 for auth; session fixation; pending action schema)
- `zapp-484-dp-recheck` ✅ (B1–B4 all cleared)
- **Milestones:** PR #549 MERGED ✅ | DP #484 FULLY APPROVED ✅ | DP #485 FULLY APPROVED ✅
**Self-posts staged:** fry +DP #487 MCP rewrite row
**decisions.md:** 239,049 → 255,922 bytes (+16,873)
**Summarized:** scribe 16,194 → this file (~5 KB); waves 18–30 archived

**Sizes post-wave:** bender 7,924 / fry ~10,400 / hermes 11,926 (77%) / leela 5,819 / ralph 225 / zapp 5,511
**Watch:** hermes (77%) — summarize next meaningful entry

**Still absent:** `zapp-pr549-review/recheck`, `hermes-549-test`, `fry-486-dp-revision`, `fry-485-dp-revision`, `bender-pack-skills-fix`, `leela-484-dp-recheck`, `fry-484-dp-revision`
