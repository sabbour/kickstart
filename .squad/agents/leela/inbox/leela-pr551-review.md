# Leela — Architecture Review: PR #551 (Step 6 Skill Resolver, closes #480)

**Date:** 2026-04-18  
**Verdict:** BLOCK

---

## What Works Correctly

- **C1 `*` short-circuit** — `skill-matcher.ts` line 27: `if (pattern === '*') return true;` ✅
- **`listSkills(agentName?)`** — Present on `PackRegistry`, filter logic correct (delegates to `matchesSkill`). Resolves DP C2 via Option A (amend #476 surface). ✅
- **`estimateTokens` re-export (C3)** — Exported from `packages/harness/src/index.ts` alongside `buildSkillPrompt` and `fitSkillsInBudget`. ✅
- **Pattern injection guard** — `validateGlobPattern()` rejects `;|&$\`` at registration time for both inline and file-backed skills. ✅
- **Skill ID format** — Tests use `{packName}/{skillName}` consistently; `normalizeInlineSkill` was already in place from #476. ✅
- **`matchesAnyPattern`/`globMatches` removal** — Clean refactor; `getSkillsForAgent` updated to delegate to `matchesSkill`. Equivalent logic, no regression. ✅
- **`estimateTokens` null/undefined guard** — Fail-safe `if (!text) return 0` present. ✅

---

## BLOCK-1 — `fitSkillsInBudget` uses `break` instead of `continue`

**File:** `packages/harness/src/runtime/token-budget.ts`, line 22

**Current:**
```ts
if (used + tokens > budgetTokens) break;
```

**Required by DP §4:**
```ts
if (used + cost > budget) continue; // skip, don't stop — a later smaller skill may fit
```

The DP is explicit: *"A skill that would bust the budget is **skipped**; iteration continues so that smaller lower-priority skills can still fit. This prevents one large high-priority skill from blocking all remaining skills."*

The PR uses `break`, which stops at the first overflow. The test on line ~245 of `skill-resolver.test.ts` _validates_ the wrong behavior (asserts s3 is "never checked"). This is a correctness bug: once `resolveSkills()` exists, a large high-priority skill would silently suppress every lower-priority skill that follows it, regardless of size.

**Fix:** Change `break` → `continue`. Update the test to assert that s3 (`'xyz'` = 1 token) IS included after s2 overflows.

---

## BLOCK-2 — `resolveSkills()` is absent; PR closes #480 prematurely

The PR delivers helper utilities (`matchesSkill`, token-budget functions, `listSkills`) but the core 4-stage resolver pipeline is entirely missing:

- No `skill-resolver.ts`
- No `resolveSkills(agentName, session, skills, opts): Skill[]`
- No keyword scoring (Stage 2)
- No priority sort — `priority desc → score desc → id asc` (Stage 3)
- No runner integration replacing the `// Step 6 / #480` stub in `runner.ts`

DP §7 done criteria are unmet:
- ❌ Keyword scoring tests (§6b) — none present
- ❌ Priority ordering tests (§6c) — none present
- ❌ Integration test: skill content in agent dynamic instructions (§6f) — none present
- ❌ Skills never appear as session turns (§6g) — untested

The PR description says `Closes #480` — this is premature. The issue cannot close until the 4-stage pipeline ships and its done criteria are verified.

**Options:**
1. **(Recommended)** Rename this PR to "Step 6a: Skill Matching Utilities" (prerequisite), open a follow-up for `resolveSkills()` + runner integration, don't close #480 until both land.
2. Implement `resolveSkills()` in this PR and add the missing tests.

---

## C1 — `buildSkillPrompt` uses markdown headers, not XML skill tags

**File:** `packages/harness/src/runtime/token-budget.ts`, line 10

**Current:**
```ts
return skills.map((s) => `## ${s.id}\n${s.instructions}`).join('\n\n');
```

**Required (Leela DP review, OQ3 answer):**
```ts
return skills.map((s) => `<skill name="${s.id}">\n${s.instructions}\n</skill>`).join('\n\n');
```

My DP review answer on OQ3 was unambiguous: *"Many SKILL.md bodies contain markdown `---` rules as prose structure — using `---` as a separator creates ambiguity. Use XML skill tags."* The `## header` format creates identical ambiguity — `SKILL.md` bodies routinely contain `##` section headers, making LLM boundary detection unreliable.

**Fix:** Change `buildSkillPrompt` to emit `<skill name="...">...</skill>` wrapping. Update `buildSkillPrompt` tests to assert tag presence.

---

## Summary

| ID | Severity | File | Required fix |
|----|----------|------|-------------|
| BLOCK-1 | 🔴 BLOCK | `token-budget.ts:22` | `break` → `continue`; fix corresponding test |
| BLOCK-2 | 🔴 BLOCK | missing `skill-resolver.ts` | Implement 4-stage `resolveSkills()` + runner integration or split PR; don't close #480 |
| C1 | 🟡 Condition | `token-budget.ts:10` | `buildSkillPrompt` → XML tags per Leela DP OQ3 answer |

BLOCK-1 and BLOCK-2 must be resolved before merge. C1 must be resolved before runner integration (Phase C) to avoid re-work.
