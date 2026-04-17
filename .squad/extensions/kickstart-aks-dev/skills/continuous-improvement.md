# Continuous Improvement

**When to use:** you want to make the team faster, calmer, or more predictable.

## Context

Process improvement at Kickstart is not a meeting. It is a data loop. Every PR produces a metric. Every day Scribe publishes the picture. Every week the team gets one question. Every idea that lands becomes a `process` issue that the loop then grades.

No squad member opens a retro by hand. No human types "run sprint planning." If something needs to happen on a cadence, it is a GitHub Actions workflow.

## The loop

```
 PR merges ─► squad-pr-retro.yml ─► .squad/retro-log.md
                                      │
                                      ▼
 17:00 PT daily ─► squad-daily-pulse.yml ─► rolling 📊 Daily Pulse issue
                                      │
                                      ▼
 Monday 17:00 PT ─► squad-weekly-pulse.yml ─► Weekly Pulse issue
                                      │
                                      ▼
                         "Anything we should change?"
                                      │
                                      ▼
                   `process` issue opened by Leela
                                      │
                                      ▼
                      picked up by squad member or @copilot
                                      │
                                      ▼
                        merged PR ─► back to the retro-log
```

## Roles

- **Scribe** owns `retro-log.md`, the rolling Daily Pulse, and the Weekly Pulse. All writes are via workflow, never hand.
- **Leela** converts weekly-pulse replies into `process` issues. Leela also labels and milestones them.
- **Everyone** fixes `process` issues. Small ones first. No issue is sacred.
- **Ralph** monitors that the workflows ran. If a cron missed, Ralph nags.
- **@copilot** picks up `process` issues labeled 🟢 good-fit. It adopts the persona the issue names (`squad:scribe`, `squad:leela`, etc.) via the copilot-instructions contract.

## Signals worth watching

From the weekly pulse data:

| Signal | Concern |
|--------|---------|
| Median review time climbing week over week | reviewers overloaded, or PRs too large |
| `merged-with-rework` ratio > 30% | DPs not thorough enough, or scope drift |
| XL PRs appearing often | scope control problem |
| Aging-PR list growing | branches are starting to rot |
| Open `process` issues > 10 | ideas piling up faster than we fix them |

If a signal trips two weeks in a row, it warrants a `process` issue with a concrete fix, not a discussion.

## Rules

- **Every process change must be testable.** "We should communicate better" is not a process change. "Leela must triage `squad` label within 24h" is.
- **Every process change has an expiry.** When you open a `process` issue, set a revisit date. If the signal didn't move, revert.
- **Ceremonies that require humans to remember don't count.** If you propose one, propose the workflow that triggers it too.
- **No retros about retros.** Meta is where good intentions go to die.

## Files

- `.squad/retro-log.md` — append-only, workflow-owned
- `.squad/ceremonies.md` — table of cadences and their workflows
- `.github/workflows/squad-pr-retro.yml`
- `.github/workflows/squad-daily-pulse.yml`
- `.github/workflows/squad-weekly-pulse.yml`
- `.github/workflows/squad-release-cadence.yml`
- GitHub label `process` — all improvement issues
- GitHub label `pulse:daily` / `pulse:weekly` — pulse artifacts
