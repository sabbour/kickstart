# Leela — Lead

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.


## Status (Summarized 2026-04-21)

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.


## Key Process Learnings (rolled)

- DP 3-step gate required before code: Issue → DP comment → Leela/Zapp approval → code
- Sprint planning gates feature work; ceremony gaps erode when not in coordinator logic
- Four-way review gate (Leela/Zapp/Nibbler/Docs) now enforced; all four labels required for merge
- PR comment resolution is non-optional; reply + resolve thread before merge
- v2 blocking chain: #474 → #475 → #476 (Step 1-3 gates); Step 4+ frozen until complete

## Recent Activity

- v2 sprint planning + #474 DP review: #474 → #475 → #476 blocking chain; APPROVE_WITH_CONDITIONS on #474
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS; DP #330 (Agents SDK) APPROVED + closed out
- PR #383 engineering docs rewrite (7 files); label-based review gate; comment-resolution process fix
- v0.6.1 deployment prep: vendor diagram assets, CI hardening, stepwise generation default


## 2026-04-21 — Four-way Review Gate + Ceremony Enforcement

Four-way PR Review Gate now live (Leela/Zapp/Nibbler/Docs). Merge blocked until all four approval labels present. Ceremony enforcement tightened with pre-dispatch blocking checkpoint. Docs gate added to DP + PR Review.

## 2026-04-21 — 6h Sprint Cadence Calibration (PR #993 pre-review amend)

Ahmed corrected post-merge that the squad runs **6-hour sprints**, not weekly. Recalibrated the just-shipped Sprint Planning + Cadence Retrospective ceremonies in PR #993 before flipping ready-for-review.

Anchor times set to **00:00 / 06:00 / 12:00 / 18:00 UTC** (Ahmed may override by editing the ceremony row directly). Sprint notes are timestamped per anchor: `.squad/sprints/{YYYY-MM-DDThh}Z.md` (e.g. `2026-04-21T12Z.md`).

**Estimate band recalibration (for 6h sprint):**
- `estimate:S` ~15 min (1 pt)
- `estimate:M` ~1 hour (3 pt)
- `estimate:L` ~3 hours (8 pt) — at most one per sprint
- `estimate:XL` >3 hours (20 pt) — **does not enter a sprint**

**XL-split rule (rationale):** the old weekly bands (2h / 8h / 24h / 80h) encoded "XL = big epic, stretches across sprints." In a 6h cadence, an XL by definition cannot fit, so the only honest way to preserve the "one PR maps to one issue, one sprint completes its scope" invariant is to refuse XL into planning and split it during triage. Keeps velocity math consistent and prevents a single item from eating an entire sprint plus silent carry-over.

**Cadence Retro output change:** instead of a new `Weekly Retro` issue, retros are appended as comments to a **rolling daily issue** `Cadence Retro · {YYYY-MM-DD}` (up to 4 comments/day, one per closed 6h sprint). Avoids 4 issues/day of noise while keeping an auditable record.

**Coordinator enforcement (`.github/agents/squad.agent.md`):** no text changes needed — the file never hardcoded "weekly," only referenced `.squad/ceremonies.md` as the source of truth. The pre-dispatch checkpoint is cadence-agnostic and still correct.

**Deferred:** did NOT retime `squad-weekly-pulse.yml` / `squad-velocity-report.yml` / `squad-daily-pulse.yml` crons — they're independent reporting workflows, not Sprint Planning inputs. Flagged in PR description as a follow-up for #992 (possible rename to `squad-sprint-pulse.yml` at 6h cadence).

### 2026-04-21 — PR #988 architecture re-review (post-nit push)
- **Outcome:** APPROVED (`leela:approved` applied).
- **Rationale:** Commit dd1e6c6 is strictly the requested nit sweep — JSDoc refresh, stale helper comment, `GalleryCardErrorBoundary`→`ComponentCardErrorBoundary` rename (def + both call sites), orphan CSS (`.playground-gallery` + breakpoints + `.playground-widget-card`) removed; `.playground-gallery-scroll` correctly retained. No layout/registry/behaviour drift.
