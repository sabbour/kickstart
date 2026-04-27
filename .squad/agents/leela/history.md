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
Key findings:
- Primitive coverage complete (all 12 type files match brief). ✅
- AgentOutput Zod contract correct. ✅
- A2UI schemas must be discriminated unions with `version: 'v0.9'` literal — not v1 all-optional transcription. (C1)
- `SessionCtx` forward refs (`AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, `AzureCredential`) must be resolved. (C2)
- `ComponentContribution.renderer` typed as `unknown` in harness — React-aware narrowing deferred to pack-core. (C3)
- `package.json` missing `zod` and `@openai/agents` as runtime dependencies. (C4)

## Archived History Note

For comprehensive work history prior to 2026-04-20, see git log and .squad/orchestration-log/. Recent sessions tracked above.

### Work queue unblocked

**Immediate (no dependencies):**
- **#998** (Bender) — Chat regression fix (S)
- **#995** (Fry) — Core tab rendering (M)
- **#997** (Fry) — Workspace layout (S)
- **#1001** (automated) — Merge ready

**Blocked on #991 merge:**
- **#987** (Fry) — Ideas tab restoration (M)

**Blocked on #998 resolution:**
- **#996** (Bender) — AKS inspiration prompt audit (M) [loose dependency; can start earlier if needed]

**Waiting on gate closure:**
- **#1000** — Pack rendering engine (Zapp + Nibbler approvals required)

---

**Decision closure:** Appended to `.squad/decisions/inbox/leela-round3-2026-04-21.md`

## 2026-04-21 — Round 3 Ceremony Closure + Post-Gate Decisions

**Five DPs Approved (2026-04-21T04:30Z):**
- #998 (chat regression, Bender, S, HIGH) → APPROVED + READY FOR IMPLEMENTATION
- #995 (Core rendering, Fry, M) → APPROVED + READY FOR IMPLEMENTATION
- #996 (AKS brittleness, Bender, M) → APPROVED but depends on #1000
- #997 (workspace black void, Fry, S) → APPROVED + READY FOR IMPLEMENTATION
- #987 (Ideas tab, Fry, M) → APPROVED but depends on #991 merge

**Two PRs Under Review:**
- **PR #1000** (pack rendering, #991) → **REJECTED** by Zapp + Nibbler. Red CI (TS2307/TS2352) + missing CI grep rule. Fry locked out; bender-1000-revise assigned to add CI step + allow-list comment.
- **PR #1001** (emit_ui fixture, #980) → ✅ **MERGED.** All gates green. Shipped explicit-op discriminator coverage.

**Process Milestone:**
- PR #993 (ceremony enforcement) merged (commit c90f5da). Mechanical 4-way gate + docs gate now active on all future PRs.
- All future PRs require: `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` ∨ `docs:not-applicable`) + green CI.
- No override path; gate is blocking at merge time.

**In-flight Dispatches:**
- bender-998 (chat fix, HIGH) — unblocked, implementation ready
- bender-1000-revise (pack rendering fix) — Reviewer Rejection Protocol applies; Fry locked out
- fry-995 (density bugs) — ready, unblocked
- fry-997 (black void) — ready, unblocked

**Key DP-Time Security Decisions:**
1. Structural invariant test for strict-mode schema compliance (Object.keys(properties) ⊆ required)
2. Ideas-tab curated-only model; future user-supplied inspirations will reopen threat
3. Composition-reliability harness constraints: fail-loud, ≤2 retries, redacted logs
4. DP-time conditions enforce at PR time non-negotiable (Reviewer Rejection Protocol on #1000 sets precedent)

## Learnings (2026-04-27 — Harness patterns audit against OpenAI Agents SDK)
- **Agent.asTool()** available in `@openai/agents-core` v0.8.4 — we don't use it. Critical gap for flexible triage orchestration.
- **Handoff input filters** (`handoff({ inputFilter })`) and `RunConfig.handoffInputFilter` — we pass full context on every handoff, causing token bloat.
- **RunConfig** has `callModelInputFilter`, `handoffInputFilter`, `inputGuardrails`, `outputGuardrails` — we use none of these. Wrapping our options in RunConfig is shovel-ready.
- **Our guardrails are home-rolled** in `guardrails.ts` — sequential, blocking. SDK-native guardrails run in parallel with agent inference.
- **MaxTurnsExceededError** — we catch generically, should handle specifically with user-friendly recovery.
- **History threading** — our `toAgentInputItems()` strips tool calls. SDK's `callModelInputFilter` is the right place for selective trimming.
- **useResponses: false** blocks tool search, hosted tools, server-managed history. Worth revisiting as Azure OpenAI v1 matures.
- **Deterministic chaining** (codesmith → reviewer → quality gate) and **LLM-as-Judge** are high-value patterns we don't implement.
- **Key files:** `runner.ts`, `guardrails.ts`, `schema-conformance.ts`, `agent-output.ts`, `triage.agent.md`
- **Decision written to:** `.squad/decisions/inbox/leela-harness-patterns-audit-2026-04-27.md`

## Learnings (2026-04-27 — PR Review Gate simplification, PR #80)
- **Phase split:** Amy's docs commits must precede approval reviews. Split gate into Phase 1 (Amy docs, parallel with CI) and Phase 2 (Nibbler + Zapp approval reviews). Phase 1 must fully complete before Phase 2 begins — this prevents post-approval commits from dismissing existing reviews.
- **Simplified gate:** `nibbler:approved` + `zapp:approved` are the required set. `leela:approved` is now conditional — only required for PRs with `architecture` label or touching pack boundaries.
- **Hermes removed from PR Review Gate:** Test coverage is enforced by CI status checks, not manual reviews. Hermes no longer participates in the PR Review Gate.
- **Duplicate-review guard added:** Before submitting a review, check `gh pr reviews {N}` for the current HEAD. Do not submit if a review already exists for that commit.
- **No-commit-after-approval rule added:** Once any Phase 2 approval is submitted, no further commits are permitted to the branch. Any needed commit restarts the cycle from Phase 1.
