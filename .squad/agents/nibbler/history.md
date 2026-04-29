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

## 2026-04-28T10:39Z — Consensus checkpoint ack #197 (Phase 1.6)

**Requested by:** Ahmed Sabbour
**Ceremony:** 197-ack-codereview

**Verdict:** ✅ Acked D1–D14, AKS Automatic constraint spec v1.1.1 §2.7 — full ack, no dissents.

**Code-review rationale:**
- All 14 decisions are reviewable as rejection criteria (detectable, grep-able invariants in generated Bicep/YAML).
- Four-way PR review gate unchanged; triage rewrite routes but does not approve.
- Reviewer-rejection lockout semantics intact.
- Gap 9 (self-review loop): `scribe-escalation-guard.mjs` still in place; no new self-approval vector introduced.
- Gaps 3/4: `post-flight-check.mjs` enforces dismissal-not-deletion + Bot type verification — both previously shipped.

**PR-stage reminders logged (not dissents):**
- §2.7 rule 2: generated YAML must pass all 25 deny + PSS Baseline + seccomp/AppArmor/non-root on first commit.
- §2.7 rule 3: probes informational only — any PR gating admission on probes is a reject.
- D9: Bicep must explicitly enable observability (no relying on auto-attach).
- Handoff-briefing contract (R5 from #198 DP review): "Handoff Briefing Schema v1" doc/ADR required before downstream #199–#20x PRs can earn codereview:approved.

**Writes:**
- Comment: https://github.com/azure-management-and-platforms/kickstart/issues/197#issuecomment-4337779388 (as `squad-codereview[bot]`)
- Post-flight: exit 0 — kind=comment, login=squad-codereview[bot], type=Bot


---

### 2026-04-28T17:39:30Z: Phase 1.6 Consensus Checkpoint #197 — Complete

**Ceremony:** phase-1.6-consensus-197  
**Outcome:** 7/7 acks, 0 dissents. Critical-path (Bender+Fry+Zapp+Nibbler) cleared.

All decisions D1–D14 and section 2.7 rules approved. Phase 2.0 critical path (#198 triage rewrite) **officially unblocked**. Orchestration logs written to `.squad/orchestration-log/{ISO8601}-{agent}.md` per ceremony spec.

**For Kif:** Investigate Fry post-flight-check.mjs exit 3 anomaly (identity verified correct, script exit unexpected).

---

## 2026-04-28 — Ceremony: phase-2.0-prep-243-244-242 — DP code reviews pending

**Awaiting your review:**
- **Issue #243:** Design Proposal for microsoft-skills.json schema + CI gate (Bender, Backend)
  - DP comment: https://github.com/azure-management-and-platforms/kickstart/issues/243#issuecomment-4337975352
  - Architecture approval: present (carries D8 from #197)
  - Security approval: pending (Zapp)
  - Awaiting: `codereview:approved` (you)

- **Issue #244:** Design Proposal for Handoff Briefing Schema v1 (Leela, Lead)
  - DP comment: https://github.com/azure-management-and-platforms/kickstart/issues/244#issuecomment-4337971979
  - Architecture approval: posted (Leela self-ack, Lead privilege)
  - Security approval: pending (Zapp)
  - Awaiting: `codereview:approved` (you)

**Key context:**
- D8 binding (microsoft-skills.json) inherited from #197 consensus; Bender DP spec includes schema structure (const-true `citeNameOnly`, strict additionalProperties) and CI gate topology
- Handoff briefing schema introduces five typed fields (ingressMode, kaitoEnabled, gpuSku, computeTier, constraintBucket[]); per your #197 ack, this typed contract must be ratified before Phase 2 PR #241 can earn `codereview:approved`
- Both DPs establish new patterns: first schema files in new `config/schemas/` directory; first explicit CI gate of its kind; first cross-pack contract prior to dependent PRs

**Blocking chain:** #244 codereview:approved gates #241 (Phase 2 main); #243 codereview:approved gates #210 (parent)

Ceremony context: phase-2.0-prep-243-244-242


---

## 2026-04-28 — DR #243 + #244 DP reviews (ceremony: dr-243-244-codereview)

**Requested by:** Ahmed Sabbour

### #243 — microsoft-skills.json schema + CI lint gate (Bender)
**Verdict:** ⚠️ Approved with conditions
**Comment:** https://github.com/azure-management-and-platforms/kickstart/issues/243#issuecomment-4338042454
**Label applied:** codereview:approved
**Post-flight:** comment=0, label=0

Conditions flagged: (1) LLM-exclusion test must be a NEGATIVE assertion (not.toContain summary/citationUri), not just a positive field-match. (2) `citeNameOnly: false` const-violation test must be a distinct `it(...)` block.

### #244 — Handoff Briefing Schema v1 (Leela)
**Verdict:** ⚠️ Approved with conditions
**Comment:** https://github.com/azure-management-and-platforms/kickstart/issues/244#issuecomment-4338047315
**Label applied:** codereview:approved
**Post-flight:** comment=0, label=0

Conditions flagged: (1) `validateHandoffBriefing` invalid-bucket test must assert `error.issues[0].path` contains `'bucket'`. (2) `constraint: ''` (min(1) violation) must assert path includes `constraintBucket[0].constraint`.

**Learning:** `post-flight-check.mjs --kind label` requires `--label <name>` argument — omitting it returns exit code 3 (invalid args). Always include `--label` for label post-flight calls.

**Blocking chain:** #244 codereview:approved gates #241 (Phase 2 main); #243 codereview:approved gates #210 (parent)

## 2026-04-28: Design Review #243-#244 (Code Review)

- **Role:** Code Review  
- **Ceremony:** design-review-243-244  
- **Verdicts:**  
  - #243 (microsoft-skills.json schema): codereview:approved (2 PR-time conditions)  
    1. LLM-exclusion test must use negative assertions (not.toContain)  
    2. citeNameOnly:false const-violation test in separate it() block  
  - #244 (Handoff Briefing Schema v1): codereview:approved (2 PR-time conditions)  
    1. Invalid-bucket test must assert error.issues[0].path contains 'bucket'  
    2. Empty constraint test must assert error.issues[0].path includes constraintBucket[0].constraint  
- **Blocking Gate:** All conditions are PR-review enforced; no pass without satisfying.


## Phase 2.0 — PR Review Gate (2026-04-28)

Two PRs in codereview queue:
- **PR #246** (#243 implementation): 13/13 tests, Nibbler conditions N1+N2 enforced (negative-assertion LLM exclusion test + distinct const-violation test block)
- **PR #245** (#244 implementation): 16/16 tests, Nibbler conditions 1 & 2 covered (error.issues[0].path validation, typed error field naming)

Both await full codereview:approved label. No blockers identified; post-flight confirmations passed.

---

## 2026-04-28T18:56Z — PR Review Gate #245 + #246 (ceremony: pr-gate-codereview-245-246)

**Requested by:** Ahmed Sabbour

### PR #246 — feat(pack-core): microsoft-skills schema, fail-closed loader, CI gate (closes #243)
**Author:** squad-backend[bot]  
**Verdict:** ✅ Approved  
**Review URL:** https://github.com/azure-management-and-platforms/kickstart/pull/246  
**Review ID:** 4191639684 | post-flight: kind=review exit=0  
**Label:** `codereview:approved` applied — confirmed via `gh api issues/246/labels` (label post-flight exit=3, known Kif #242 gap, label manually verified present)

**DR conditions verified:**
1. ✅ N1 LLM-exclusion: `not.toContain(validEntry.summary)` + `not.toContain(validEntry.citationUri)` in `describe('cite path LLM exclusion (Nibbler N1)')` — exact negative assertions confirmed
2. ✅ N2 const-violation: `citeNameOnly: false` rejection test in fully separate `describe('citeNameOnly const violation (Nibbler N2)')` block — distinct it() confirmed

**Production code spot-check:** `cite()` returns only `"${name} v${version}"` (no summary/citationUri); `ReadonlyMap` return; fail-closed `MicrosoftSkillsLoadError` on I/O + validation; AJV `citeNameOnly: { const: true }` + `additionalProperties: false` at leaf. No test smells.

### PR #245 — feat(triage): Handoff Briefing Schema v1 (closes #244)
**Author:** squad-lead[bot]  
**Verdict:** ✅ Approved  
**Review URL:** https://github.com/azure-management-and-platforms/kickstart/pull/245  
**Review ID:** 4191649857 | post-flight: kind=review exit=0  
**Label:** `codereview:approved` applied — confirmed via `gh api issues/245/labels` (label post-flight exit=3, known Kif #242 gap, label manually verified present)

**DR conditions verified:**
1. ✅ Cond 1: `expect(result.error.issues[0].path.join('.')).toContain('bucket')` in `describe('Nibbler condition 1')` — path join = `constraintBucket.0.bucket` contains `'bucket'`
2. ✅ Cond 2: `expect(path).toContain('constraintBucket')` + `expect(path).toContain('constraint')` in `describe('Nibbler condition 2')` — path join = `constraintBucket.0.constraint` satisfies both checks

**Production code spot-check:** `HandoffBriefingV1.strict()` + `ConstraintEntry.strict()` confirmed; `gpuSku: z.string().nullable()` (D13); validator is fail-closed discriminated union; structured-log fires only on success. No test smells across 16 tests.

**Learning:** `gh pr edit --add-label` fails with GraphQL Projects classic deprecation warning (exit 1); use `gh api repos/.../issues/<N>/labels --method POST` directly for label writes. Also: `post-flight-check.mjs --kind label` returns exit 3 (events fetch 404) — verified labels via REST API instead.

## Ceremony: PR Review Gate #245 + #246 (2026-04-28)

- **Ceremony:** pr-gate-245-246-plus-kif
- **Time:** 2026-04-28T11:56:56Z
- **Role:** Code Review
- **Status:** ✅ APPROVED both PRs
  - PR #245 review 4191649857: verified path conditions
  - PR #246 review 4191639684: verified N1 negative-assertion + N2 distinct describe block
  - `codereview:approved` labels applied + REST-verified
- **Note:** New decision merged: squad-platform[bot] owns all `.github/workflows/**`


### 2026-04-28T12:12:30Z: Halt-and-pivot ceremony — PR #245/#246 merge blocked

**Ceremony:** merge-attempt-halt-and-pivot-245-246

Both PRs halted at merge gate due to unrelated blockers:
- Leela: missing PR-stage architecture labels (now applied)
- Kif: Zod monorepo split CI failure (root cause diagnosed, requires v3→v4 migrations in web + pack-core)

**Your role:** codereview:approved already posted on both issues. No additional Nibbler action required — PRs blocked upstream, not on code-review gate.

**Note:** New decision — squad-platform[bot] owns workflows scope. Future workflow changes route through Kif, not product agents.

## 2026-04-28 — DR #247 Zod v4 migration DP

- **Ceremony:** dr-247-codereview
- **Verdict:** ⚠️ Approved with conditions
- **Comment:** https://github.com/azure-management-and-platforms/kickstart/issues/247#issuecomment-4338584960 (id: 4338584960)
- **Label applied:** `codereview:approved`
- **Post-flight:** comment=OK (squad-codereview[bot]/Bot), label=OK (squad-codereview[bot]/Bot)
- **Key findings:**
  - `z.preprocess` is NOT removed in Zod v4 — exists as `ZodPipe<ZodTransform, U>` in `v4/classic/schemas.d.ts`; SKILL.md rationale needs correction
  - Null-coerce pattern in `basic_functions_api.ts`: DP's proposed `nullable().transform()` changes semantics (null accepted vs rejected); must be clarified
  - 5 harness `z.preprocess` callsites not mentioned in DP (already on v4, likely fine)
  - `zod-to-json-schema@^3.25.1` compat unconfirmed post-migration
  - `TriggerSchema` v4 migration narrows TypeScript input type — breaking API change not documented
  - CI guardrail: `npm ls zod` approach flagged; lockfile check recommended as faster/more reliable
  - Override mechanic correct: repo uses npm, `overrides.zod` is right knob

## DR #247 completion

**SKILL correction flagged:** `.squad/skills/zod-monorepo-split/SKILL.md` needs update — z.preprocess is NOT removed in v4, return type changes (ZodEffects → ZodPipe). Kif to apply.

**Equivalence test requirements documented.** Bender deciding harness scope now.

## Learnings

### 2026-04-18: Onboarding context

- Team runs at 34 PRs/day velocity — reviews must be fast and decisive
- Retro analysis revealed "review time" was mostly Copilot PR reviewer bot latency (sequential passes 30-90 min apart), not human design debates
- Review gate (#427) uses label-based approval: `leela:approved`, `zapp:approved` — adding `nibbler:approved`/`nibbler:rejected`
- Bot identities: `sabbour-squad-lead[bot]`, `sabbour-squad-frontend[bot]`, `sabbour-squad-backend[bot]`, `sabbour-squad-tester[bot]`
- Key files: `.squad/decisions.md` (team decisions), `docs/v2-implementation-brief.md` (architecture brief)
- Pack boundaries are sacred — changes blurring two packs are flagged
- Zero rework target — catch issues in review so PRs merge on first cycle

### 2026-04-21: Batch review — 4 PRs (parity reviewer role)

First run as full structured reviewer (parity with Leela/Zapp). Patterns observed:

- **#989 (A2UI v0.9 clean break):** strong loud-rejection discipline — Zod `unrecognized_keys` error code is the right hook for "non-spec property" messaging. The `strict()` Button + non-strict containers asymmetry was a deliberate, documented trade-off for mid-stream streaming; accept it, don't flatten. Clean-break PRs need at least three test classes: canonical-shape acceptance, per-edge-case survival, and explicit legacy-dialect rejection. This PR had all three. Approved.
- **#986 (Playground polish):** `mergeClasses` tolerates falsy branches, so `fillContainer && styles.rootFill` is fine — but the codebase mixes `mergeClasses` with template-literal concat. Watch for consistency nits. Opt-in boolean props (`fillContainer = false`) keep the blast radius small; that pattern is reusable for any layout override added to a shared viewer component. Visual polish PRs rarely carry new tests — flag as 🟡 concern but don't block when Playwright E2E is green. Approved.
- **#988 (remove Ideas tab, DRAFT):** deletion PRs need a "grep the deleted symbol across the whole package" pass — `GalleryCardErrorBoundary` class name and a `groupByPack` example comment still reference the deleted concept. Flag doc-comment drift explicitly; TypeScript won't catch it. Comment-only on draft.
- **#990 (inspirations variety, DRAFT):** prompt allow-lists are only as good as the actual registered catalog — ALWAYS grep-verify each listed component name against the registry before approving. Duplicated fallback arrays in two packages with a "keep in sync" doc-comment is a latent drift bug; either centralise or pin with a unit test. Comment-only on draft.

**Cross-cutting takeaway:** after the clean-break landing in #989, legacy-dialect regressions are the class of bug most worth watching — any new LLM-facing prompt or fallback content must name components the client actually renders, or we're back to `_ErrorComponent` banners. #990's allow-list is exactly that risk surface.

---

## 2026-04-21T10:15:00Z — Four-way review gate structural shift + parity directive

**Event:** Ceremony enforcement PR #993 shipped. PR Review Gate is now 4-way: Leela (architecture) + Zapp (security) + Nibbler (code-quality) + Docs reviewer (interim: Scribe).

**Impact on nibbler:**
- ✅ Elevated to full structured-reviewer parity with Leela + Zapp
- ✅ Review outcomes (nibbler:approved / nibbler:rejected) are blocking merge gates
- ✅ Reviews posted via `gh pr review` under lead bot identity (protocol: same as Leela/Zapp)
- ✅ Merge criteria: all four approval labels required (leela + zapp + nibbler + docs)
- 💬 First run as structured reviewer completed: approved #989 + #986, comment-only on #988/#990 (drafts)

**Directive:** "Every PR review must be engaged as full structured gate, not ad-hoc."

## 2026-04-21T10:52:00Z — Batch review: PR #993 + DPs #991/#980


## Summary (Full History Archived 2026-04-23T22:53:28Z)

Nibbler participated in the first 4-way review gate cycle (Leela/Zapp/Nibbler/Docs). Key contributions:
- Approved 8 PRs across multiple rounds with consistent code-quality discipline
- Caught test-durability gaps: named constants vs magic numbers, determinism pinning for LLM tests, validator reuse patterns
- Established self-authored PR limitation: GitHub blocks formal review when PR author == authenticated identity (workaround: label-based approval)
- Identified bundle-budget pattern: concrete ceiling + CI gate + PR-description waiver is effective for performance sign-offs
- First run learning: verify CI green before approving (prevents 6h round-trips on red checks)
- Code-quality gate functions as designed — catches test gaps at DP stage before implementation hour is burned
- Cross-cutting pattern: legacy-dialect regressions are the highest-risk class of bug post-#989

[Full archive in session store for history reference]