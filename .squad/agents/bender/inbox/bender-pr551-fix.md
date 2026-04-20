# Bender — PR #551 Security Fix Report

**Commit SHA:** `938bef9`
**Branch:** `squad/480-skill-resolver`
**Date:** 2025-04-17

## Files Changed (5)

| File | Change |
|------|--------|
| `packages/harness/src/runtime/skill-matcher.ts` | B1: 256-char glob pattern length cap |
| `packages/harness/src/runtime/loader-skill.ts` | Crit1: `Object.freeze()` on file-backed skills at parse time |
| `packages/harness/src/runtime/registry.ts` | Crit1: `Object.freeze()` on file-backed skills at registration time |
| `packages/harness/src/runtime/token-budget.ts` | Crit2: `fitSkillsInBudget` uses `buildSkillPrompt` + `continue` (skip) |
| `packages/harness/src/__tests__/skill-resolver.test.ts` | Updated stale tests + added freeze-mutation & skip-overflow tests |

## Fixes Applied

### Crit1 — File-backed skills frozen after registration
- `loader-skill.ts`: returns `Object.freeze({ ...skill, appliesTo: Object.freeze([...]), keywords: Object.freeze([...]) })`
- `registry.ts`: `loadSkills()` maps `frozenFileSkills` — applies same freeze pattern as inline skills (PR #549)
- Inline skills were already frozen (PR #549); this patch brings file-backed skills to parity

### Crit2 — `fitSkillsInBudget` skips oversized skills
- Replaced raw `estimateTokens(skill.instructions)` with `estimateTokens(buildSkillPrompt([skill]))` for accurate rendered-block costing
- Changed `break` → `continue` so a single oversized skill no longer stops all subsequent smaller skills

### B1 — Glob pattern length cap
- `validateGlobPattern()` now throws `Glob pattern too long: max 256 chars` before the metacharacter check

## Test Results

```
Test Files  1 failed | 6 passed (7)
      Tests  2 failed | 101 passed (103)
```

The 2 failures are **pre-existing** in `registry.test.ts` (stale skill id namespacing and unresolved tool reference tests) — confirmed by running `git stash` and verifying they fail on the unmodified branch.

### New tests added (skill-resolver.test.ts)
- `validateGlobPattern — rejects pattern longer than 256 chars`
- `validateGlobPattern — accepts pattern of exactly 256 chars`
- `PackRegistry — frozen skills — mutation of appliesTo throws`
- `fitSkillsInBudget — skips oversized skills and includes subsequent skills that fit`
- `fitSkillsInBudget — [small, huge, small] — both smalls included when huge overflows`

### Updated tests
- `fitSkillsInBudget — includes skills that exactly fit the budget` → updated budget (raw 1-token math no longer matches rendered-block costing; budget=8 accommodates 4+4 rendered tokens)
- `fitSkillsInBudget — truncates at first overflow` → renamed + updated expectations to reflect skip-not-break behavior

**Total skill-resolver.test.ts tests: 38 (all passing)**
