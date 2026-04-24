# Nibbler — History

## Project Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, OpenAI Agents SDK
- **Architecture:** Harness + Packs model (v2). See `docs/v2-implementation-brief.md`
- **User:** sabbour
- **Joined:** 2026-04-18

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