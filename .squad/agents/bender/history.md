# Bender — Backend Dev

## About Me
Backend engineer owning MCP server, API layer, and database design. Expertise in Node.js, Azure Functions, streaming protocols, LLM integration.

## Key Files
- `packages/core/src/` — conversation engine, FSM, tool registry, validation
- `packages/web/api/src/` — Azure Functions, converse/action/generate endpoints
- `packages/mcp-server/src/` — MCP server, tool handlers, A2UI formatting
- `packages/core/src/kits/` — IntegrationKit framework

## Recent Work
- v2 #474 DP: seam-cutting pass required, APPROVE_WITH_CONDITIONS
- Agents SDK adapter (#445): behind KICKSTART_AGENTS_SDK flag, 1511 tests
- Security sprint: API hardening, rate limiting, CodeQL fixes
- 2026-04-21: **Bug intake — 2 issues assigned** (#998: Chat broken, schema validation regression from #989, priority:high; #996: AKS _ErrorComponent, inspiration prompts unreliable). Both unassigned, go:needs-research. **Action:** Verify #998 schema conformance; audit test suite for A2UI 0.9 spec coverage.
- v2 #474 DP drafted and posted; APPROVE_WITH_CONDITIONS from Leela + Zapp
- Agents SDK adapter (#445, PR #447): SDK behind `KICKSTART_AGENTS_SDK=true`, all Zapp conditions met, 1511 tests, merged
- FSM removal (#385): replaced with linear `advancePhase()` pattern
- Security sprint v0.5.6: API hardening, rate limiting, CodeQL fixes, crypto.randomUUID

## Active Sprint: v2
Sprint 1: implement #474 after DP gate cleared. Manage @kickstart/core imports incrementally via seam-cutting.

## 2026-04-21 Status
Participating in four-way review gate. Ceremony enforcement tightened with pre-dispatch blocking checkpoint.
Sprint 1 role: implement #474 (Nuke v1) after DP gate cleared. DP APPROVE_WITH_CONDITIONS — seam-cutting pass required. `@kickstart/core` imports and `packages/web/src/types.ts` must be managed incrementally.

## Work Summary (Apr 2026)

Recent major accomplishments: v0.5.6 security sprint (API hardening, rate limiting), v0.5.0 multi-surface (MCP App iframe, postMessage validation, session signing), Agents SDK adapter implementation (#445 draft PR #447), SWA deployment pipeline fix (package/bundle exclusions), GitHub Projects V2 integration, heartbeat workflow PAT fallback hardening.

Key learnings: TypeScript `readonly RegExp[]` patterns, API surface minimization via internal barrels, GitHub Actions PAT fallback required, SWA needs explicit main branch trigger, build version embedding via git SHA, user-owned projects require specific PAT scopes, WSL line-ending awareness, concurrent git lock contention mitigation.
- For prompt-injection defense, transforming third-party content into a constrained structured representation (JSON with extracted facts only) is stronger than delimiter sandboxing around raw markdown — the LLM never sees free-form prose it could interpret as instructions.
- (2026-04-14 17:44) Implemented #186 (Public Copilot Skills): 10 new files in packages/core/src/skills/ with full build-time sync pipeline, zero-network runtime loader, policy scanner, frontmatter parser, phase mapper, knowledge extractor. 60 tests. PR #227.
- Core package (packages/core) is browser-compatible — uses "lib": ["ES2022", "DOM"] with no @types/node. Use Web Crypto API (crypto.subtle) and atob() instead of Node.js crypto and Buffer. Accept data as parameters rather than reading filesystem directly.

## Round 5: Multi-Round DP Cycle (#186) + Implementation (Pending)

**2026-04-14**
- Updated DP #186 addressing Zapp security concerns (round 2)
- Received round 3 feedback from Zapp (3 remaining concerns)
- Final DP update (#186 round 3) addressing all security issues
- DP #186 approved by Zapp for implementation
- Implemented public Copilot skills (10 files, 60 tests) in PR #227
- Implementation PR awaiting code review

## 2026-04-14 Round 2: Infrastructure + Bug Fixes

## Archived History Note

For detailed work history prior to 2026-04-20, see git log and .squad/orchestration-log/.

**PR:** squad/941-health-llm  
**Status:** In progress

**Scope:** Added `?deep=1` opt-in mode to `/health` that fires a minimal 1-token AOAI probe and reports `{ llm: { ok, latencyMs, model, errorCode? } }`. 30-second success cache prevents AOAI spam on repeated probes. Default shallow path unchanged.

**Key Learnings:**
- (2026-04-20) In Vitest, `vi.mock` factory closures are hoisted before variable declarations; any variable referenced inside a factory must be declared via `vi.hoisted()` — plain `const` in module scope hits the temporal dead zone.
- (2026-04-20) When mocking a class constructor in Vitest, use `class { ... }` syntax in the factory instead of `vi.fn().mockReturnValue(...)` or `vi.fn().mockImplementation(() => ...)` with an arrow function — arrow functions cannot be constructors and `mockReturnValue` is rejected when called with `new`.
- (2026-04-20) For timeout tests against `AbortController`-based fetch calls, simulate the abort by rejecting immediately with `err.name = "AbortError"` rather than wiring a real abort listener — wiring a listener requires the actual timeout to fire (8 s), which exceeds the default Vitest test timeout (5 s).

## 2026-04-21 — Round 3: DP Reviews + Dual Assignment

**Dual Assignment (in-flight):**
1. **DP #998** (chat broken, emit_ui schema strict-mode regression, priority:HIGH, estimate:S) — `leela:approved` + `zapp:approved` + `nibbler:approved`. **READY FOR IMPLEMENTATION.** Bender is the assigned implementer. Condition: verify schema against A2UI 0.9 vendor; audit all emit_ui branches for `.optional()` violations; add structural invariant test across all pack-core tools (not just emit_ui).

2. **PR #1000 revision** (pack rendering engine, #991) — Originally assigned to Fry, but **Fry LOCKED OUT per Reviewer Rejection Protocol**. Zapp rejected PR #1000 for missing CI grep rule on `dangerouslySetInnerHTML`/`eval`/`new Function` in pack client code. DP #991 set this as a "same-PR hard-fail" condition — not a follow-up. Bender (as bender-1000-revise) will add the missing CI grep step + allow-list comment on pre-existing `insertSvgSafely` in `ArchitectureDiagram`. Fry remains locked out until bender-1000-revise completes the fix.

**Non-blocking:** DP #996 (AKS _ErrorComponent, estimate:M) assigned to Bender but depends on #1000 merging first. Nibbler notes: reuse `validateAndSanitizeComponents` from #1000 (don't author a parallel validator); pin LLM reliability tests or move off CI. Start implementation after #1000 merges.

**Summary:** Bender has two concurrent tracks: (a) DP #998 (chat fix, HIGH priority) and (b) bender-1000-revise (fix PR #1000). Track (a) is unblocked. Track (b) is in-flight. DP #996 waits for #1000 merge.

## 2026-04-21 Issue #998 — `core_emit_ui` strict-mode 400 regression

**PR:** #1005 — squad/998-chat-emit-ui-required
**Status:** ✅ PR open

**Scope:** Chat completely broken (400 on every turn) because `core.emit_ui`'s `createSurface` branch declared `sendDataModel` with `.nullable().optional()`. OpenAI strict-mode required every property in `properties` to appear in `required`; zod's `.optional()` maps to "not in required", and the @openai/agents strict-mode transform does not recurse into `z.discriminatedUnion` branches. Regression landed via #989's A2UI v0.9 realignment.

**Fix:**
- `emit_ui.ts` — every union-branch field (`sendDataModel`, `updateDataModel.path`/`value`, component `child`/`children`/`text`/`action`/`action.event.payload`) changed from `.nullable().optional()` to `.nullable()` (required-but-nullable). emit_ui strips nulls recursively before delegating to the harness `A2UIMessageSchema`.
- `list_files.ts` — same sweep, per Zapp's DP ask.
- Parametrised conformance test `tool-strict-required-conformance.test.ts` walks every pack-core tool's JSON schema and asserts `required ⊇ keys(properties)` on every object node; includes an explicit #998 regression assertion. Verified to fail when the bug is re-introduced.

**Tests:** 940 passed | 159 todo | 3 skipped (85 files). Lint clean. API build succeeds.

**Key learnings:**
- (2026-04-21) `@openai/agents` zod-to-JSON-Schema strict-mode transform **does not recurse into `z.discriminatedUnion` branches**. Any `.optional()` nested inside a union branch will land in the generated schema as "not in required" and fail OpenAI's strict-mode validator. Use `.nullable()` (required-but-nullable) instead, and strip nulls at the runtime boundary before delegating to canonical validators.
- (2026-04-21) For tool-schema invariants (strict-mode `required` completeness, presence of `type` keys, `additionalProperties: false` discipline), **walk the generated JSON schema in a parametrised conformance test** — don't rely on case-specific invocation tests. Invocation tests exercise one path; a schema walk catches every branch.
- (2026-04-21) When the tool input schema becomes stricter than the runtime harness schema (tool requires null, harness rejects null), a single-file `stripNulls(value)` adapter in `execute()` is the cleanest bridge — keeps the harness wire format untouched and avoids cascading schema changes across packages.
