# Continuous Improvement

**When to use:** you want to make the team faster, calmer, or more predictable.

## Context

Process improvement at Kickstart is not a meeting. It is a data loop. Every PR produces a metric. Every day Scribe publishes the picture. Every week the team gets one question. Every idea that lands becomes a `process` issue that the loop then grades.

No squad member opens a retro by hand. No human types "run sprint planning." If something needs to happen on a cadence, it is a GitHub Actions workflow.

## Workflow enforcement map

| Concern | Workflow | Status | Notes |
|---------|----------|--------|-------|
| PR outcome capture | `.github/workflows/squad-pr-retro.yml` | live | Writes `.squad/retro-log.md` on every closed PR |
| Daily process picture | `.github/workflows/squad-daily-pulse.yml` | live | Maintains the rolling daily pulse issue |
| Weekly team question | `.github/workflows/squad-weekly-pulse.yml` | live | Publishes the weekly pulse issue |
| Velocity + quality SLO panel | `.github/workflows/squad-velocity-report.yml` | pending `#803` / PR `#836` | Becomes the source of truth for throughput, estimate accuracy, and quality SLOs |
| Process experiment grading | `.github/workflows/squad-process-grader.yml` | pending `#805` | Posts the grade for each expired `process` experiment |
| Safety brake on quality regressions | `.github/workflows/squad-review-gate.yml` | live now, quality brake pending `#806` / PR `#837` | The workflow exists today; #806 adds the quality-SLO fail-closed behavior |

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

Use the workflow artifacts as the source of truth, not memory or ceremony prose:

| Signal | Concern |
|--------|---------|
| Median review time climbing week over week | reviewers overloaded, or PRs too large (`.github/workflows/squad-weekly-pulse.yml`) |
| `merged-with-rework` ratio > 30% | DPs not thorough enough, or scope drift (`.github/workflows/squad-pr-retro.yml`) |
| XL PRs appearing often | scope control problem (`.github/workflows/squad-weekly-pulse.yml`) |
| Quality SLO panel turns 🔴 | stop optimizing for speed and run a focused retro (`.github/workflows/squad-velocity-report.yml`, issue `#803`) |
| Open `process` issues > 10 | ideas piling up faster than we fix them (`.github/workflows/squad-daily-pulse.yml`) |

If a signal trips two weeks in a row, it warrants a `process` issue with a concrete fix, not a discussion.

## Rules

- **Every process change must be testable.** "We should communicate better" is not a process change. "Leela must triage `squad` label within 24h" is.
- **Every process change has an expiry.** The grading path lives in `.github/workflows/squad-process-grader.yml` once `#805` lands. Until then, keep revisit dates explicit in the issue body.
- **Ceremonies that require humans to remember don't count.** The enforcing workflow must be named in the proposal. If it does not have a workflow file, it is still aspirational.
- **No retros about retros.** Meta is where good intentions go to die.
- **Superseded prose loses.** When a workflow exists, the workflow file and its generated artifact beat this skill. Update the workflow reference here; do not add parallel human-only rules.

## Files

- `.squad/retro-log.md` — append-only, workflow-owned
- `.squad/velocity.md` — workflow-owned once `#803` lands
- `.squad/ceremonies.md` — table of cadences and their workflows
- `.github/workflows/squad-pr-retro.yml`
- `.github/workflows/squad-daily-pulse.yml`
- `.github/workflows/squad-weekly-pulse.yml`
- `.github/workflows/squad-velocity-report.yml` — pending `#803`
- `.github/workflows/squad-process-grader.yml` — pending `#805`
- `.github/workflows/squad-review-gate.yml` — quality safety brake extended by `#806`
- `.github/workflows/squad-release-cadence.yml`
- GitHub label `process` — all improvement issues
- GitHub label `pulse:daily` / `pulse:weekly` — pulse artifacts
