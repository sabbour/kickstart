**Zapp — PR #551 Security Recheck**
[findings]
- Crit1 fixed: file-backed skills are frozen in `loader-skill.ts` before return and re-frozen in `registry.ts` when stored; the registry test now verifies mutating a returned skill's `appliesTo` throws.
- Crit2 fixed: `fitSkillsInBudget()` now prices each skill via `buildSkillPrompt([skill])`, uses `continue` on overflow, and tests cover the `[small, huge, small] -> [small, small]` case.
- B1 fixed: `validateGlobPattern()` now rejects patterns longer than 256 characters.
- `resolveSkills()` follows the expected pipeline: `matchesSkill` -> keyword scoring -> priority sort -> `fitSkillsInBudget`.
- No new injection surface found in `resolveSkills()`: `userMessage` is only lowercased and checked with `includes()`, not interpolated into regex.

Verdict: Security recheck clear. Validation passed: `npx vitest run packages/harness/src/__tests__/skill-resolver.test.ts packages/harness/src/__tests__/resolve-skills.test.ts packages/harness/src/__tests__/harness-exports.test.ts` and `npm run build -w @kickstart/harness`.
