**Zapp — Security Review**

Verdict: **BLOCK**

**Crit1 — Post-registration mutation bypasses the new registration-time validation for file-backed skills.**  
`validateGlobPattern()` is enforced while registering file skills, but `PackRegistry` stores file-backed `Skill` objects without freezing/cloning them and `listSkills()` / `getSkillsForAgent()` return those live references (`packages/harness/src/runtime/registry.ts:138-146,233-280`; `packages/harness/src/runtime/loader-skill.ts:55-69`). That means a caller can mutate `instructions`, `keywords`, or `appliesTo` after registration and bypass the very checks this PR adds. I verified this on the built PR branch: `registry.listSkills('demo.agent')[0].appliesTo.push('*;rm -rf /')` succeeds and the mutated pattern is then returned by the registry.

**Crit2 — `fitSkillsInBudget()` enforces the wrong security contract for prompt-size control.**  
The approved Zapp condition required budgeting the **final rendered skills block** and continuing past oversized skills; this implementation budgets only raw `skill.instructions` and stops at the first overflow (`packages/harness/src/runtime/token-budget.ts:9-27`). The new test at `packages/harness/src/__tests__/skill-resolver.test.ts:263-273` locks in that incorrect `break` behavior. I verified the current utility returns only `a/one` for `[small, huge, small]` with budget 10, so one oversized early skill can crowd out later smaller skills.

**B1 — Glob/regex handling is improved, but still not fully hardened to the approved DP constraints.**  
`matchesSkill()` escapes regex metacharacters before `* -> .*`, so patterns like `(a+)+b` do **not** become executable regex and I do not see a practical ReDoS here (`packages/harness/src/runtime/skill-matcher.ts:23-28`). Registration-time rejection of ASCII shell metacharacters is also actually enforced for inline and file-backed skills (`packages/harness/src/runtime/registry.ts:242-270`). However, there is still no constrained glob grammar / length cap, so this only partially satisfies the approved condition.

**B2 — Namespace and null-safety checks look good.**  
Inline skills must start with `{packName}/` and file-backed skills synthesize IDs as `{packName}/{skillName}`, so a pack cannot claim another pack's namespace here (`packages/harness/src/runtime/registry.ts:244-248`; `packages/harness/src/runtime/loader-skill.ts:38-57`). `estimateTokens()` is fail-safe on `null` / `undefined` and returns `0` rather than throwing (`packages/harness/src/runtime/token-budget.ts:3-6`).

**B3 — `listSkills()` is not permission-aware, but I do not see a current exploit path in this PR alone.**  
There is no skill visibility model or `requiresSession` field on `Skill` today, so this API is effectively “all active skills, optionally agent-filtered” (`packages/harness/src/runtime/registry.ts:143-146`; `packages/harness/src/types/skill.ts:3-15`). That is acceptable only while it remains in-process/internal; if exposed across an API boundary later, it will leak full skill instructions.

**Other checks**
- No path traversal regression found in skill file loading; `parseFrontmatterFile()` still confines reads to the configured pack root (`packages/harness/src/runtime/frontmatter.ts:11-35`).
- No `eval()` / dynamic code execution added.
- No prototype-pollution issue found; skill storage remains `Map`-backed.
- No `requiresSession: true` exposure found because skills do not currently carry that field.

**Validation run**
- `npx vitest run packages/harness/src/__tests__/skill-resolver.test.ts packages/harness/src/__tests__/registry.test.ts`
  - `skill-resolver.test.ts` passed
  - `registry.test.ts` had 2 failures (one stale raw-ID expectation, one pre-existing dependency-scope expectation)
- `npm run build -w @kickstart/harness` passed

Please fix Crit1 and Crit2 before requesting Zapp sign-off again.
