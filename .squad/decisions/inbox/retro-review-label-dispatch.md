# DP: Systematic review-label dispatch checklist for PR authors

**Status**: Draft — awaiting @asabbour_microsoft review
**Proposed by**: Leela (squad-lead)
**Category**: process

## Problem

Several PRs in Phase 2 and Phase 3 (observed across PRs #385–#404) reached the review gate without the correct `review:{role}:requested` labels applied upfront. Labels were applied reactively — after a reviewer noticed they had not been pinged — rather than systematically at PR-ready time. This caused:

1. **Late review cycles**: A PR would sit idle because a required reviewer (docs, security) was not notified. The PR author would ping manually after noticing inactivity.
2. **Inconsistent label sets**: Some PRs had `review:security:requested` but not `review:docs:requested`, even though the change affected agent markdown files that Amy reviews. The PR author had to identify the correct reviewer set from memory.
3. **Review gate confusion**: The `squad-review-gate.yml` workflow checks for approved labels, but if the request labels were never applied, the gate never fires and the PR appears "stuck" rather than "waiting for reviewer."

The `squad_reviews_dispatch_review` tool exists and is documented, but the decision of *which roles to dispatch* was left to the PR author's judgment on each PR. There is no checklist or heuristic.

## Proposal

Add a **dispatch decision table** to `pr-workflow.md` under "Step 6 – Request reviews":

| Change type | Required reviewers |
|-------------|-------------------|
| New or modified TypeScript tool / user action / guardrail | security (Zapp), code-quality (Nibbler), architecture (Leela if new pack boundary) |
| Agent markdown (`.agent.md`) change | docs (Amy), code-quality (Nibbler) |
| GitHub Actions workflow change | devops (Kif), security (Zapp) |
| New or modified A2UI component (`.tsx`) | code-quality (Nibbler), docs (Amy if component is documented) |
| Docs-site only (`docs-site/`) | docs (Amy) |
| Config / JSON schema change | architecture (Leela), security (Zapp) if schema widens a trust boundary |
| Test-only change | code-quality (Nibbler) |
| `estimate:S` fast-lane | code-quality (Nibbler) minimum |

**Rule**: apply the table at PR-ready time, before calling `squad_reviews_dispatch_review`. Dispatch all matching roles in one call. If unsure, add Leela as a tiebreaker.

Additionally, add this table as a comment template in the PR body template in `pr-workflow.md` so agents fill it in explicitly when opening a PR.

## Impact

- **All agents** who open PRs — must apply the table at PR-ready time.
- **Leela** — architecture reviews fire more reliably; fewer "missed me" situations.
- **Amy, Zapp, Nibbler** — get pinged earlier, reducing review latency.
- **Kif** — may want to automate the dispatch table as a GitHub Actions step (future wave).

## Alternatives considered

- **Automate dispatch via CI**: A workflow that reads `files changed` and applies the dispatch table automatically. This is the ideal end state, but requires Kif to implement and is a separate tracked issue (estimate: M). This proposal is the process-level version that can ship today.
- **Rely on reviewer self-nomination**: Doesn't scale as the team grows. Reviewers can't monitor every PR.
- **Require Leela to dispatch all reviews**: Creates a bottleneck. Better to have the PR author dispatch and Leela spot-check.
