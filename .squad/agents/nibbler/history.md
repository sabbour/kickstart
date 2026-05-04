# Nibbler — History

## Project Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, OpenAI Agents SDK
- **Architecture:** Harness + Packs model (v2). See `docs/v2-implementation-brief.md`
- **User:** sabbour
- **Joined:** 2026-04-18


### Identity & process

- Acted as `squad-codereview[bot]`, role `codereview` (per `.squad/team.md`).
- Token resolved via `.squad/scripts/resolve-token.mjs --required codereview`. Never echoed.
- Review submitted with REQUEST_CHANGES; label `codereview:rejected` applied; any prior `codereview:approved` removed (404 — not present, expected).
- Post-flight checks ran clean for both the review and the label (kind=review and kind=label, login=squad-codereview[bot], type=Bot).
- DP-stage approval comment from r8 (#194 comment 4336058805) remains the design-stage record; this is the PR-stage rejection.

### Reference

- DP v3 approval: `.squad/decisions/inbox/nibbler-194-dp-v3-approval.md`
- PR-stage review: this entry

## Spawn: ralph-wave-2 (2026-05-01T12:13:25)
- **PR #338 gate loop**: codereview + security rejections resolved → **approved** ✅
  - Codereview: pass
  - Security: pass
  - Ready for merge
- **PR #337**: scaffold source drift fixed → **codereview approved** ✅

## Learnings

### PR #358 review (2026-05-02T10:53:32-07:00)

- Blocking review found that append-only Squad state must not be overwritten by scaffold placeholders during upgrade/source sync. In this PR, `.squad/history.md` and `.squad/orchestration-log.md` were reset to template content instead of preserving existing repo state.
- Runtime attestation artifacts also need explicit ignore protection. `.squad/attestation/log-20260502.jsonl` landed in the diff even though it is generated state, not source.
- For workflow/extension upgrade code, missing tests around failure handling and file-rewrite behavior deserve extra scrutiny before approval.

### PR #358 re-review (2026-05-02T11:07:38-07:00)

- Re-checked Bender's follow-up commit against `origin/dev`: `.squad/history.md` and `.squad/orchestration-log.md` now match dev exactly, so the prior data-loss blocker is resolved rather than papered over.
- Verified the runtime artifact fix end-to-end: `.squad/attestation/log-20260502.jsonl` is no longer in the PR diff, and `.gitignore` now excludes `.squad/attestation/`.
- Re-ran the new targeted Vitest coverage for squad-workflows (`upgrade`, `merge-check`, `init`): 33 tests passed. The new assertions exercise real behavior, including preserved upgrade error detail and docs/sensitive-path classification helpers.

### PR #453 review (2026-05-04T03:21:06-07:00)

- **🔴 CHANGES_REQUESTED** — docs-only restructure PR introduced 54 broken internal links.
- Root cause: Wave 3 description claimed it merged `extending/*` and `guides/*` into a `pack-authoring/` section, but that directory was never created. Wave 4 then updated links across 24 files to point at `../pack-authoring/*` and `../agent-authoring/*` sub-pages that don't exist.
- The new `agent-authoring/index.md` is self-referentially broken: all 5 link targets it lists (`conversation-phases`, `agent-as-tool`, `runner-chain`, `resume-and-session-token`, `/docs/pack-authoring`) point at non-existent paths.
- Two script files (`generate-skills-reference.mjs`, `generate-tools-reference.mjs`) had their link paths changed in a way that broke previously-working relative links by applying wrong relative depth.
- `extending-a2ui.md` is referenced via `../architecture/extending-a2ui.md` in 6 files, but the file lives at `components/extending-a2ui.md`.
- **Detection method**: automated link resolution check using `git ls-tree` to verify every relative link target in the branch — surfaced all 54 broken links systematically. Worth making this a reusable verification step for docs PRs.
- PR content (prose edits, new changeset, non-link portions) was accurate and well-written; problem was purely in the link targets.
