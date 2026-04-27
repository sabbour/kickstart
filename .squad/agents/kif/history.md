# Kif — History & Learnings

## Project Context
Kickstart — AI-guided AKS onboarding. v2 on `@openai/agents` SDK with harness + packs architecture.
Repo: azure-management-and-platforms/kickstart
User: Ahmed Sabbour

## Background
Kif joined the team to own the DevOps and CI/CD layer. The squad was previously experiencing:
- PR review dismissals caused by Amy (docs agent) committing to PR branches after reviewers approved
- Workflow redundancy: squad-docs-gate.yml and squad-review-gate.yml both firing on same PR events (~4,059 min/week)
- squad-label-enforce.yml was deleted; issue-namespace enforcement (go:, release:, type:, priority:, estimate:) was lost as a side effect
- Mutual exclusivity for reviewer labels (approved/rejected) was folded into squad-auto-merge.yml

## Learnings

### 2026-04-27 — DevOps bottleneck audit

**Core finding:** Squad's ceremony overhead was designed for multi-agent coordination. When Ahmed works directly with a single Copilot session, those ceremonies add 3-6 hours of friction to changes that take 30 min to implement. The system optimizes for parallel multi-agent coordination that isn't actually happening.

**Structural redundancy discovered:**
- 5 workflows can independently add items to the project board: `squad-triage`, `squad-issue-assign`, `squad-project-sync`, `squad-heartbeat`, `squad-project-board-automate`. All idempotent, all burning minutes.
- 2 of those (triage + issue-assign) hardcode project `#3` instead of using `SQUAD_PROJECT_NUMBER` variable — config drift risk.
- `squad-review-gate` fires on `synchronize` (every push) even though gate result is deterministic until labels change.
- `squad-auto-merge` fires on both `labeled` and `workflow_run: [CI, Squad Review Gate]` completions — double-trigger pattern on the happy path.
- `squad-visible-trail` fires on every issue/PR label event with no early-exit guard for irrelevant labels.

**Ceremony math for a typical S-size fix:**
- DP write: ~30 min. DR (Leela + Zapp approval): ~30-60 min. Wait time between sessions: ~15-60 min.
- Total pre-code overhead: 1-2 hours for a ≤2h task. The ceremony exceeds the work.

**The Copilot-is-faster gap is structural, not accidental.** Squad adds governance coordination overhead proportional to team size. With one developer + one Copilot session, the coordination is self-referential — Ahmed is both product owner AND reviewer, so the multi-reviewer gates he's waiting on are sessions he has to spawn himself.

**Key pattern:** The most valuable Squad components for a solo-developer workflow are: CI, secret scan, review-gate (as merge guard), auto-merge, velocity reporting. The most cost-heavy relative to value: DP ceremony for S-size work, synchronous DR before coding, multi-reviewer PR gate for chore/bug-fix paths.

**Recommendations actioned in decisions inbox:** See `kif-devops-bottleneck-audit.md`.

### 2026-04-27 — Fast lane implementation

**Changes shipped:**

1. **ceremonies.md** — Added "Minimum Ceremony Path" reference table after ceremony overview. Added Fast Lane exemption (`estimate:S` or `squad:chore-auto`) to both DP and DR sections. Added Parallel DR mode for `estimate:M`: post DP, start coding, DR reviewers run concurrently; blockers resolved before PR opens. No hard time window — with Ralph running continuously, reviewers respond in minutes.

2. **squad-review-gate.yml** — Removed `synchronize` from `on.pull_request.types`. Gate is label-driven and deterministic; firing on every push was ~50 wasted runs/week.

3. **squad-triage.yml** + **squad-issue-assign.yml** — Removed "Add issue to project board" steps from both. Both hardcoded `projectNumber = 3` (config drift risk). `squad-project-board-automate.yml` is the authoritative handler.

4. **squad-heartbeat.yml** — Removed "Add triaged issues to project board" step. Ralph adds `squad:*` labels, which trigger `squad-project-board-automate.yml` on the label event — the heartbeat step was a duplicate add. Note: heartbeat has SYNC comment pointing at 3 template files; templates NOT touched — `squad upgrade` required to propagate.

5. **squad-visible-trail.yml** — Added label/branch guards to `issue-trail` and `pr-trail` job `if:` conditions. Skips runs where no `squad:*` label or `squad/` branch is present (~60-70% of event volume).

**Issues found but not fixed:**
- `squad-heartbeat.yml` template sync: 3 additional template file locations exist per the SYNC comment. Only `.github/workflows/squad-heartbeat.yml` was modified. Template propagation deferred to `squad upgrade`.
- `squad-auto-merge.yml` double-trigger (labeled + workflow_run): not in scope for this change set; tracked in prior bottleneck audit.
### 2026-04-27 — Actions minute reduction: merge docs-gate, add label filters

**Core finding:** Squad's ceremony overhead was designed for multi-agent coordination. When Ahmed works directly with a single Copilot session, those ceremonies add 3-6 hours of friction to changes that take 30 min to implement. The system optimizes for parallel multi-agent coordination that isn't actually happening.

**Structural redundancy discovered:**
- 5 workflows can independently add items to the project board: `squad-triage`, `squad-issue-assign`, `squad-project-sync`, `squad-heartbeat`, `squad-project-board-automate`. All idempotent, all burning minutes.
- 2 of those (triage + issue-assign) hardcode project `#3` instead of using `SQUAD_PROJECT_NUMBER` variable — config drift risk.
- `squad-review-gate` fires on `synchronize` (every push) even though gate result is deterministic until labels change.
- `squad-auto-merge` fires on both `labeled` and `workflow_run: [CI, Squad Review Gate]` completions — double-trigger pattern on the happy path.
- `squad-visible-trail` fires on every issue/PR label event with no early-exit guard for irrelevant labels.

**Ceremony math for a typical S-size fix:**
- DP write: ~30 min. DR (Leela + Zapp approval): ~30-60 min. Wait time between sessions: ~15-60 min.
- Total pre-code overhead: 1-2 hours for a ≤2h task. The ceremony exceeds the work.

**The Copilot-is-faster gap is structural, not accidental.** Squad adds governance coordination overhead proportional to team size. With one developer + one Copilot session, the coordination is self-referential — Ahmed is both product owner AND reviewer, so the multi-reviewer gates he's waiting on are sessions he has to spawn himself.

**Key pattern:** The most valuable Squad components for a solo-developer workflow are: CI, secret scan, review-gate (as merge guard), auto-merge, velocity reporting. The most cost-heavy relative to value: DP ceremony for S-size work, synchronous DR before coding, multi-reviewer PR gate for chore/bug-fix paths.

**Recommendations actioned in decisions inbox:** See `kif-devops-bottleneck-audit.md`.

### 2026-04-27 — Fast lane implementation

**Changes shipped:**

1. **ceremonies.md** — Added "Minimum Ceremony Path" reference table after ceremony overview. Added Fast Lane exemption (`estimate:S` or `squad:chore-auto`) to both DP and DR sections. Added Parallel DR mode for `estimate:M`: post DP, start coding, DR reviewers run concurrently; blockers resolved before PR opens. No hard time window — with Ralph running continuously, reviewers respond in minutes.

2. **squad-review-gate.yml** — Removed `synchronize` from `on.pull_request.types`. Gate is label-driven and deterministic; firing on every push was ~50 wasted runs/week.

3. **squad-triage.yml** + **squad-issue-assign.yml** — Removed "Add issue to project board" steps from both. Both hardcoded `projectNumber = 3` (config drift risk). `squad-project-board-automate.yml` is the authoritative handler.

4. **squad-heartbeat.yml** — Removed "Add triaged issues to project board" step. Ralph adds `squad:*` labels, which trigger `squad-project-board-automate.yml` on the label event — the heartbeat step was a duplicate add. Note: heartbeat has SYNC comment pointing at 3 template files; templates NOT touched — `squad upgrade` required to propagate.

5. **squad-visible-trail.yml** — Added label/branch guards to `issue-trail` and `pr-trail` job `if:` conditions. Skips runs where no `squad:*` label or `squad/` branch is present (~60-70% of event volume).

**Issues found but not fixed:**
- `squad-heartbeat.yml` template sync: 3 additional template file locations exist per the SYNC comment. Only `.github/workflows/squad-heartbeat.yml` was modified. Template propagation deferred to `squad upgrade`.
- `squad-auto-merge.yml` double-trigger (labeled + workflow_run): not in scope for this change set; tracked in prior bottleneck audit.
