# Leela — Lead

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.

## Key Files
- `.squad/team.md` — team roster and capability profiles
- `.squad/ceremonies.md` — ceremony definitions and triggers
- `.squad/decisions.md` — canonical architecture decisions (last 5 kept here, older archived)
- `docs/architecture.md` — architecture overview and patterns guide
- `.squad/routing.md` — issue assignment and team boundaries

## Patterns
- **DP 3-step gate:** Issue → Design Proposal (on issue, not PR) → Leela + Zapp review → code implementation
- **PR discipline:** One PR per issue, design already approved, code review secondary
- **No-lockout directive:** Original author handles all post-review feedback
- **Wave structure:** Wave 1 (foundations), Wave 2 (integration), Wave 3 (E2E), Wave 4 (release)
- **Process directives:** Always stored in .squad/decisions/inbox/ for Scribe merge; not versioned inline

## Recent Work
- v2 sprint planning + #474 DP review: #474 → #475 → #476 blocking chain; APPROVE_WITH_CONDITIONS on #474
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS; DP #330 (Agents SDK) APPROVED + closed out
- PR #383 engineering docs rewrite (7 files); label-based review gate; comment-resolution process fix
- v0.6.1 deployment prep: vendor diagram assets, CI hardening, stepwise generation default

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.

## Learnings

- (2026-04-17T12:06:45.293Z) Sprint planning always required before backlog pickup when `.squad/identity/now.md` gate is active. Shortest v2 slice is harness spine, not pack work: `#474 → #475 → #476` must land before pack-core batch.
- (2026-04-17T03:30:17Z) DP #329: runtime duplication is the blocking risk — PoC adds `runtime/` inside `packages/mcp-server` that parallels `packages/web/api/` LLM client + session store. Third fork risk with SDK migration. Implementation issue must define canonical client before code lands.
- (2026-04-17T03:30:17Z) DP #330 closeout: Option B (hybrid route planner + manager agent) adopted. `phaseComplete`/`filesComplete` flags retired. Implementation sequence locked: Gate → arch spike → backend (#445, Bender) → UI (#446, Fry) → cleanup. Follow-ons #445 and #446 created.
- (2026-04-17T01:53:59Z) Review gate must be label-based, not GitHub approval-required, because repo owners cannot self-approve. `leela:approved` + `zapp:approved` labels drive `squad/review-gate` status check.
- (2026-04-17) Comment acknowledgment and thread resolution are non-optional — silently fixing code is a process violation. Reply to specific comment with SHA + description; resolve thread via GraphQL; verify 0 unresolved before merge.
- (2026-04-16T05:51:43.085Z) Design spikes producing DPs are process-compatible with sprint planning reset — blocking them on ceremony is circular. Spikes (DPs) run in parallel with ceremony.
- (2026-04-15T09:46:31.308Z) Issue #265 smallest ship: treat FileEditor payloads as workspace data, not chat bubble content. Paths: `chat-a2ui.ts`, `App.tsx`, `FileManager/`, `session-store.ts`.
- **2026-04-17T12:06:45.293Z — DP #474 Step 1 review:** A temporary `@kickstart/core` shim is acceptable only as shrinking compile scaffolding for Step 1. It cannot become a second runtime boundary or preserve v1 semantics beyond what is strictly needed to keep the repo building while imports move to `@kickstart/harness`. Because the real risk is cross-package compile wiring across web, API, and MCP, Ralph should route Bender first and treat Fry as preserved-shell follow-through. Key files: `docs/v2-implementation-brief.md`, GitHub issue `#474`, `packages/core/package.json`, `packages/harness/src/index.ts`.

- **2026-04-17T12:06:45.293Z — v2 rewrite start gate (#474):** Even when the v2 implementation brief is design-locked and Step 1 is technically dependency-free, `.squad/identity/now.md` is the active execution gate. If it says "no feature code until sprint planning completes," Ralph should route the planning ceremony instead of pushing the first implementation issue. Key files: `.squad/identity/now.md`, `docs/v2-implementation-brief.md`, `.squad/ceremonies.md`, GitHub issue `#474`.

- **2026-04-17T03:30:17Z — MCP App IDE DP (#329) architecture review:** Approved with conditions. Key finding: PoC adds \`runtime/\` modules inside \`packages/mcp-server\` that parallel the existing \`packages/web/api/\` LLM client + session store. If both the MCP App runtime and the Agents SDK migration (#330) proceed, we risk a third forked LLM runtime. Implementation issue must define which client is canonical before code lands. Bundle size validation of vite-plugin-singlefile output with full React + Fluent 2 + A2UI is required before Slice 1 ships. Decision file: \`.squad/decisions/inbox/leela-dp-reviews-apr17.md\`

## 2026-04-17 DP Reviews

**DP #329 (MCP App IDE Surface) — APPROVED WITH CONDITIONS**
- Resource registration via `registerAppResource` + `registerAppTool` canonical
- Single-file bundle with `vite-plugin-singlefile` required; CSP headers mandatory
- `event.source === window.parent` guard required
- Bundle size validation (vite-plugin-singlefile with full React + Fluent 2 + A2UI) before Slice 1 ships

**DP #330 (Agents SDK Migration) — APPROVED + CLOSED**
- Option B (hybrid route planner + manager agent) adopted
- Server-authored route state replaces model-emitted booleans
- Implementation: #445 (Bender backend), #446 (Fry UI)

## 2026-04-17 PR #447 Code Review + Approval

- Found duplicate-message bug in SDK streaming loop (blocking). Bender fixed in commit a3899e5.
- Applied `leela:approved`. 1511 tests passing, 0 unresolved threads.

## 2026-04-17 v2 Sprint Planning + #474 DP Review

- HOLD_FOR_PLANNING gate honored; sprint planning run first.
- Sprint plan: #474 → #475 → #476 blocking chain. Step 4+ frozen until #476.
- #474 DP: APPROVE_WITH_CONDITIONS. Seam-cutting pass approach confirmed.
- v2 architecture DP (#473): APPROVED. Guardrail enforcement semantics must be pinned before Step 11 (`error` SSE with `guardrail_block`). UserAction resume authz must be a done criterion in Step 5.

## 2026-05-28 — DP Review #476 v2 Step 3: Registry + loaders

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/476#issuecomment-4268074355  
**Decision record:** `.squad/decisions/inbox/leela-476-dp-review.md`

Key findings:
- Registry lifecycle (`register → enable → seal`) and sigil resolution (`.`/`:`) are sound. ✅
- Circular dependency detection and collision rules correctly specified. ✅
- Catalog skeleton scope (typed data assembly only, no UI runtime) is correct. ✅
- C1 (BLOCKER): Custom frontmatter mini-parser can't handle arrays; must use `yaml` npm package. All agent/skill frontmatter uses arrays.
- C2 (BLOCKER): Registry read accessor surface underspecified; only `getAgent` + `components` listed. Step 5+6 need `getSkillsForAgent`, `getToolsForAgent`, `getUserAction`, `getGuardrailsByStage` — must be locked in Step 3.
- C3 (REQUIRED): UserAction wire transliteration (`azure:login` → `azure__login`) unspecified. `UserActionContribution` must carry both `.name` and `.wireName`.
- M1/M2 (minor): `enable()` dep enforcement and `enable()` after `seal()` behavior unspecified in DP text.

## 2026-05-28 — DP Review #475 v2 Step 2: Harness types

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/475#issuecomment-4268063788  
**Decision record:** `.squad/decisions/inbox/leela-475-dp-review.md`

Key findings:
- Primitive coverage complete (all 12 type files match brief). ✅
- AgentOutput Zod contract correct. ✅
- A2UI schemas must be discriminated unions with `version: 'v0.9'` literal — not v1 all-optional transcription. (C1)
- `SessionCtx` forward refs (`AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, `AzureCredential`) must be resolved. (C2)
- `ComponentContribution.renderer` typed as `unknown` in harness — React-aware narrowing deferred to pack-core. (C3)
- `package.json` missing `zod` and `@openai/agents` as runtime dependencies. (C4)
- `chat-a2ui.ts` port must drop all v1 phase-model code; PR needs explicit keep/drop inventory. (C5)

## 2026-05-28 — DP Reviews #475 + #476

**#475 (Harness Types) — APPROVE_WITH_CONDITIONS:**
1. A2UI Zod schemas must be discriminated unions with `version: z.literal("v0.9")` — not all-optional.
2. `ComponentContribution.renderer` typed as `unknown` in harness; React-aware type deferred to pack-core.
3. `SessionCtx` forward refs (`AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, `AzureCredential`) must be stubbed with `// TODO(Step 3)` before merge.
4. `zod` + `@openai/agents` must be `dependencies`, not `devDependencies`, in `@kickstart/harness`.
5. `chat-a2ui.ts` port must drop all v1 phase-model code — explicit keep/drop inventory required in PR.
All five conditions are blocking. Step 3 gated on standalone compile.

**#476 (Registry + Loaders) — APPROVE_WITH_CONDITIONS:**
- C1 (BLOCKER): Drop custom mini-parser; use `yaml` npm package — mini-parser doesn't support arrays needed for `tools:`, `handoffs:`, `appliesTo:`, `keywords:`.
- C2 (BLOCKER): Full registry read accessor surface required in Step 3 (6 methods/properties defined — see decisions.md).
- C3 (BLOCKER): `UserActionContribution` must carry both `.name` (canonical, `:` sigil) and `.wireName` (transliterated, `__`); loader-agent.ts produces both.
C1–C3 block Step 4 (pack-core), Step 5 (Runner), and Step 6 (skill resolver).
