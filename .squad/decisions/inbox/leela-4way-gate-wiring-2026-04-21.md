# Decision: Wire the 4-way review gate into CI (squad-review-gate + squad-auto-merge + visible trail)

**Author:** Leela (Lead)
**Date:** 2026-04-21
**Status:** Decided (pending PR #993 merge)
**Relates to:** PR #993, tracking issue #992, decision `leela-ceremony-enforcement-2026-04-21.md` (which declared the 4-way gate in `.squad/ceremonies.md` but did not wire it into CI)

## Context

The earlier ceremony-enforcement PR (#993 pre-recalibration) declared in `.squad/ceremonies.md` that the PR Review Gate is now four-way (Leela + Zapp + Nibbler + Docs). Ahmed's audit caught that the **enforcement was documentation-only** — `.github/workflows/squad-review-gate.yml`, `.github/workflows/squad-auto-merge.yml`, and `.github/scripts/squad-visible-trail.cjs` still only knew about Leela + Zapp. The status check would turn green without Nibbler, without a docs marker, and would not fail on `nibbler:rejected` or `docs:rejected`.

This decision captures the wiring changes folded into PR #993 before it goes ready-for-review.

## Decision

### 1. `squad/review-gate` status check requires 4 dimensions

- `leela:approved` — required on every path
- `nibbler:approved` — required on every path (including `squad:chore-auto`)
- `zapp:approved` — required on the standard path; required on the low-risk path only if the PR is security-sensitive or touches sensitive paths
- Exactly one of `docs:approved` or `docs:not-applicable` — required on every non-trusted path
- Any of `leela:rejected`, `zapp:rejected` (when Zapp is in-scope), `nibbler:rejected`, `docs:rejected` fails the gate immediately (state: `failure`, not `pending`).

### 2. `squad-auto-merge` clears 3 approval labels on `synchronize`

`APPROVAL_LABELS = ['leela:approved', 'zapp:approved', 'nibbler:approved']`. All three are cleared on every synchronize. **Migration impact:** in-flight PRs on other branches will need a fresh `nibbler:approved` label after this PR lands — the auto-merge workflow will clear any pre-existing `nibbler:approved` on the next push. The PR description calls this out.

### 3. Three-way rejection-preservation matrix

Old behaviour: if exactly one of (Leela, Zapp) was rejecting, the OTHER reviewer's approval was preserved across synchronize to avoid re-asking an uninvolved reviewer to re-approve. Extended to three reviewers: if exactly one of (Leela, Zapp, Nibbler) is rejecting, the other two approvals are preserved. If zero or two-or-more are rejecting, no preservation — all approvals clear.

Docs markers (`docs:approved`, `docs:not-applicable`) are **not** cleared on synchronize. They describe the PR's content (did docs land, or was it declared N/A in the DP) rather than a reviewer's per-commit signoff. Clearing them on every push would create churn for no gain.

### 4. Low-risk path decision — Nibbler stays required

`squad:chore-auto` PRs still require `nibbler:approved`. Rationale:

- Code-quality review is **cheap and fast** — Nibbler typically needs seconds to read a chore PR and approve.
- Many historical `squad:chore-auto` regressions (dead code, missing types, stale imports) would have been caught by a code-quality pass even though security and architecture were genuinely N/A.
- The policy is simpler with one exception (Zapp) than two — operators don't need to remember a per-reviewer matrix.
- If a specific chore truly shouldn't need Nibbler, Leela can apply `nibbler:approved` directly as part of the triage signoff; we do not carve out a "no Nibbler" path.

If this turns out to be friction in practice we will revisit, but the default is "Nibbler reviews every PR."

### 5. Docs gate on low-risk path

Low-risk path also requires a docs marker. `docs:not-applicable` is specifically designed as the cheap escape valve for chores that genuinely don't touch user-facing behaviour — the DP must have declared `Docs impact: N/A` with justification for `docs:not-applicable` to apply. A chore PR with `docs:not-applicable` + `leela:approved` + `nibbler:approved` (and `zapp:approved` if sensitive) is 30 seconds of reviewer time total.

### 6. Labels synced via `sync-squad-custom-labels.yml`

Added `docs:approved` (`0E8A16`), `docs:rejected` (`D93F0B`), `docs:not-applicable` (`BFD4F2`). Reused the existing colour scheme so the new labels blend with `leela:*` / `zapp:*` / `nibbler:*`. Also updated the stale `estimate:*` descriptions (they were still referencing 2h/8h/24h/80h from the weekly cadence — now reflect the 6h-sprint bands from the sibling decision `leela-6h-sprint-calibration-2026-04-21.md`).

### 7. Visible trail comment now renders 4 reviewers

`.github/scripts/squad-visible-trail.cjs` now reports Leela, Zapp, Nibbler, and Docs statuses on the sticky PR comment, and the gate-path summary string names all four. Docs is handled as a tri-state (`docs:approved` / `docs:not-applicable` / `docs:rejected`) rather than a binary approved/rejected because "not applicable" is a legitimate green state, not an absence.

## Alternatives considered and rejected

- **Nibbler optional on `squad:chore-auto`.** Rejected — see (4). Cost is near-zero, value is real.
- **Docs marker cleared on synchronize.** Rejected. Docs state is a PR-content property, not a per-commit reviewer signoff; clearing it would force the docs reviewer to re-apply the marker after every push with no new information.
- **Separate docs status check context.** Rejected. Keeping docs inside `squad/review-gate` means one status check, one branch-protection entry, one workflow to keep in sync.
- **Flip gate to `failure` only when explicit `*:rejected` is present, otherwise `pending`.** Adopted. Distinguishes "waiting for a reviewer" (benign) from "actively rejected" (needs fix), which drives different agent behaviour downstream.

## Action items

- [ ] After PR #993 merges, run the `Sync Squad Custom Labels` workflow once to create the three new `docs:*` labels in the repo
- [ ] Amend branch-protection required checks if the `squad/review-gate` context needs re-registering (it should re-post under the same name, so likely a no-op)
- [ ] Any in-flight PRs on long-running branches will lose `nibbler:approved` on their next push and need a fresh Nibbler pass — expected and correct
