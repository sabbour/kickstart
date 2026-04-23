# Leela — PR #551 Recheck Notes

**Date:** 2026-04-17  
**PR:** #551 — Step 6: Skill Resolver (issue #480)  
**Commits reviewed:** 5976894 (Fry), 938bef9 (Bender), 409c1a7 (Bender)

## Verdict: ✅ APPROVED

All conditions from original Leela review and Zapp security review are fully resolved.

## Condition Status

### BLOCK-1 — `fitSkillsInBudget` break→continue ✅
- `token-budget.ts`: `continue` confirmed, not `break`
- `[small, huge, small]` test returns both smalls: `['pack/small1', 'pack/small2']`

### BLOCK-2 — `resolveSkills()` 4-stage pipeline ✅
- `skill-resolver.ts` exists (41 lines)
- 4 stages correct: appliesTo filter → keyword score → priority sort → fitSkillsInBudget
- Re-exported from `packages/harness/src/index.ts` (stub replaced)
- `ResolveSkillsOptions` type also exported
- `harness-exports.test.ts` updated to new signature
- `resolve-skills.test.ts`: all 6 tests present (keyword ranking, priority tiebreak, budget truncation, agent filter, empty message, empty skills)

### C1 — `buildSkillPrompt` XML format ✅
- Renders `<skill name="${s.id}">\n${s.instructions}\n</skill>` — no markdown `##` headers
- All tests updated with recalibrated token budget values

### Zapp Crit1 + Crit2 + B1 ✅
- Crit1: `Object.freeze()` on file-backed and inline skills (including sub-arrays)
- Crit2: `fitSkillsInBudget` uses `continue` (same as BLOCK-1)
- B1: `validateGlobPattern` 256-char cap enforced and tested

## DP §7 Done Criteria
- Unit tests: ✅ All covered
- Token budget enforced: ✅
- `appliesTo: ["*"]` injects for all agents: ✅
- Skills not in user messages: ⚪ Runner-level concern, deferred to Steps 7+
- Integration test (dynamic instructions): ⚪ Deferred to downstream runner integration

The two deferred criteria are correctly out of scope for the resolver primitive.

## Action Taken
- Comment posted on PR #551
- `leela:approved` label applied
