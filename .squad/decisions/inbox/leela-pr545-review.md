# Leela Decision — PR #545 Code Review (v2 Step 2 Harness Primitives)

**Date:** 2026-06-10  
**PR:** #545 — feat(v2): Step 2 — Harness primitives, all types + Zod schemas  
**Closes:** #475  
**Verdict:** REQUEST CHANGES — 2 blockers  

## Review outcome

### Passed conditions (C1, C3, C4, C5)
- **C1:** `z.discriminatedUnion('op', […])` on A2UI envelope, `version: z.literal('v0.9')` in every shape, `.strict()` throughout. ✅
- **C3:** `ComponentContribution.renderer: unknown`, no React/JSX imports in any harness file. ✅
- **C4:** `zod` and `@openai/agents` in `dependencies` (not devDeps) in `packages/harness/package.json`. ✅
- **C5:** `chat-a2ui.ts` has function-level keep/drop block at top; v1 step-model code absent. ✅

### Blocking issues

**Blocker 1 — C2+: `SessionCtx.a2uiEmissions: A2UIMessageV09[]` missing**  
`session.ts` exposes `recordA2UIEmission(msg: A2UIMessageV09): void` (write-only) but no readable `a2uiEmissions` array property. This was a late C2 addition flagged in #477 F3/C2 as "This is not optional — `execute` won't compile without it." Step 5's SSE forwarding reads `session.a2uiEmissions` as its post-validation buffer. Without the property, the Step 5 forward-from-accumulator contract has no type anchor.  
**Required fix:** Add `a2uiEmissions: A2UIMessageV09[]` to `SessionCtx`.

**Blocker 2 — #477-C1: `Pack` interface has incompatible dual-registration models**  
`pack.ts` exposes both `agentsDir?: URL` and `agents?: AgentContribution[]` (same for skills). #477 F1 called these "incompatible models." The brief (§11) resolves this: `register()` walks `agentsDir`/`skillsDir` — dir-based only. Keeping the inline arrays creates an indeterminate loading contract for Step 3's registry.  
**Required fix:** Remove `agents?: AgentContribution[]` and `skills?: Skill[]` from `Pack`. Dir-based is canonical. `tools`, `userActions`, `components`, `guardrails`, `playgroundScenarios` (no dir alternatives) stay as inline arrays.

### Non-blocking observations
- `tsconfig.json` includes `"DOM"` lib — unnecessary for a server-side package; trim in follow-on.
- `index.ts` still has `// TODO(Step 2)` header — stale since this IS Step 2; clean up.

## Consequence for Step 3
Step 3 (`#476` registry + loaders) remains gated on this PR merging. Both blockers are small diffs; no scope expansion needed. Bender should be able to resolve in the same branch.

— Leela
