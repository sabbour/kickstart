# Retrospective

Three formats. Two are automated. Only the incident retro is human-driven, and only when things break.

## 1. Per-PR micro-retro (automated)

Runs on every PR close via `.github/workflows/squad-pr-retro.yml`. Scribe appends one line to `.squad/retro-log.md` with size, implementation minutes, review minutes, review cycles, outcome. The same line is mirrored as a PR comment. No human ceremony.

This is the data layer. Everything else reads from it.

## 2. Incident retrospective (in-session, ad-hoc)

**Trigger:** build failure, test failure, or a reviewer rejection that cost a rework cycle.
**Facilitator:** Leela
**Participants:** everyone involved in the failure.

### Agenda

1. What happened? Facts only, no blame.
2. Root cause. Trace back to the decision that caused it.
3. What should change? One concrete, testable action per root cause.
4. Open a `process` issue for each action item. The daily pulse tracks them.

## 3. Weekly pulse (automated, see `ceremonies.md`)

Replaces the old manual "sprint retro." Every Monday at 17:00 Pacific, `.github/workflows/squad-weekly-pulse.yml` opens an issue summarising the prior 7 days from `retro-log.md`:

- Merged vs closed vs merged-with-rework
- Median review time
- Size mix (S/M/L/XL)
- Aging PRs
- A single prompt: **Anything we should change?**

Replies that warrant work get converted to `process` issues by Leela. No separate retro meeting is required.

## Why we dropped manual sprint retros and planning

The old ceremonies depended on someone remembering to run them. They didn't happen reliably. The automated model trades a recurring meeting for a rolling data stream plus one weekly question. Less ceremony, more signal.

If you want deeper analysis (size→duration calibration, estimation accuracy), read the weekly pulse history. Four weeks of data tells you more than one meeting.
