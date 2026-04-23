# Decision: Recalibrate Sprint Planning + Cadence Retro for 6-hour sprint cadence

**Author:** Leela (Lead)
**Date:** 2026-04-21
**Status:** Decided (pending PR #993 merge)
**Supersedes:** the weekly-sprint language shipped earlier the same day on branch `squad/process-ceremony-enforcement-2026-04-21`
**Relates to:** Ahmed directive `copilot-directive-6h-sprints-2026-04-21.md`, tracking issue #992, PR #993

## Context

PR #993 originally defined Sprint Planning as "weekly (Monday)" and Cadence Retrospective as "weekly," with estimate bands sized for a week of work (2h / 8h / 24h / 80h). Ahmed clarified post-merge of the ceremony text that the squad's actual cadence is **6-hour sprints on a fixed UTC schedule**, not weekly. This decision captures the recalibration made before #993 is flipped ready-for-review.

## Decision

### Sprint Planning cadence
Runs **every 6 hours** on fixed UTC anchors: **00:00 / 06:00 / 12:00 / 18:00 UTC**. Ahmed (PO) may override by editing the anchor row in `.squad/ceremonies.md` directly — coordinator consumes whatever is written there, no separate config flag.

### Sprint goal file
Timestamped per 6h anchor: `.squad/sprints/{YYYY-MM-DDThh}Z.md` (e.g. `.squad/sprints/2026-04-21T12Z.md` for the 12:00 UTC sprint that runs until 18:00 UTC).

### Estimate bands (sized for a single 6h sprint)

| Label | Time band | Points | Fits in a 6h sprint? |
|-------|-----------|--------|----------------------|
| `estimate:S` | ~15 min | 1 | ✅ |
| `estimate:M` | ~1 hour | 3 | ✅ |
| `estimate:L` | ~3 hours | 8 | ✅ (at most one per sprint) |
| `estimate:XL` | >3 hours | 20 | ❌ |

### XL-split rule
`estimate:XL` means "does not fit in a 6h sprint." XL issues **never enter sprint scope**. Leela splits them during triage into `S` / `M` / `L` children, each with their own estimate label. DPs landing with `Estimate: XL` are rejected with a split plan.

### Cadence Retrospective
Runs **end of each 6h sprint** (at the next anchor, immediately before the next Sprint Planning). Output is appended as a **comment** to a rolling daily issue `Cadence Retro · {YYYY-MM-DD}` — up to 4 comments per UTC day, one per closed sprint. Scribe creates the rolling daily issue on the first retro of each UTC day. This avoids 4 new retro issues every day.

### Deferred (not in PR #993)
The existing weekly/daily cron workflows — `squad-weekly-pulse.yml`, `squad-velocity-report.yml`, `squad-daily-pulse.yml` — are independent reports, **not** Sprint Planning inputs. They are **not** retimed in PR #993. Tracked as an acceptance item on #992: decide whether `squad-weekly-pulse.yml` should become `squad-sprint-pulse.yml` at 6h cadence.

## Rationale

- **Anchor times**: aligning to `00 / 06 / 12 / 18 UTC` gives predictable globally-readable timestamps, keeps all four sprints in a single UTC day, and makes the daily retro-bucketing issue clean. Any other choice (e.g. anchoring to local PT) would break the "four clean sprints per UTC day" invariant used by the retro rollup.
- **Estimate bands** chosen so that: S = a trivial change anyone can finish without context-switching cost; M = a single focused task; L = the sprint's hero item with headroom left; XL = physical impossibility for the cadence, which forces the split instead of pretending it fits.
- **XL-split over "XL spans multiple sprints"**: the alternative (let XL span sprints) destroys the "one PR = one issue = one sprint of scope" invariant and makes velocity tracking meaningless. Forcing the split during triage is cheap because Leela is already reading each new `squad` issue; the split happens at the same moment the estimate is applied.
- **Retro as daily-bucketed comments, not per-sprint issues**: four new `Retro` issues per day is noise, not signal. A single rolling daily issue preserves auditability, cuts notification volume by 4×, and groups an entire UTC-day's sprints in one place for trend-reading.

## Action items (picked up after merge)

- [ ] Flip PR #993 ready-for-review once Ahmed has reviewed the recalibration
- [ ] Follow-up on #992: decide fate of `squad-weekly-pulse.yml` (rename to `squad-sprint-pulse.yml` at 6h cadence, or leave as weekly summary alongside the 6h retros)
- [ ] First 6h Sprint Planning ceremony at the next UTC anchor after merge — confirms the new file path `.squad/sprints/{YYYY-MM-DDThh}Z.md` works end-to-end
- [ ] First Cadence Retro at the following anchor — confirms the rolling daily issue pattern works
