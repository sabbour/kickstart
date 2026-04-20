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

- (2026-04-20T02:48:20.359-07:00) Lifecycle template parity matters for auth hardening: fixing `.squad/issue-lifecycle.md` is insufficient if `.squad/templates/issue-lifecycle.md` still teaches ambient push, PR-ready, or merge commands. Wave-1 GitHub write guidance must stay fail-closed in both live docs and generators.
- (2026-04-20T02:48:20.359-07:00) GitHub write hardening wave 1: `sabbour/kickstart` agent-authored writes now document a fail-closed path via `resolve-token.mjs --required`, `GH_TOKEN`, and token-authenticated pushes. Coordinator, lifecycle, and workflow docs should not suggest ambient `gh`, PAT, or account-switching fallbacks for bot writes.
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

## Wave 3 — 2026-04-17 #474 Step 1 + A2UI #351 Decisions Filed

- `leela-v2-rewrite-start-gate.md`: Do not start #474 implementation until sprint planning ceremony completes; HOLD gate honored.
- `leela-dp-474-step1.md`: Step 1 seam APPROVE_WITH_CONDITIONS — shim must be shrinking only, no new exports or runtime behavior; Bender owns implementation, Fry handles web-shell fallout. Exit contract: v1 files deleted, v1 flags gone, `packages/harness` canonical.
- `leela-351-component-expansion.md`: A2UI catalog expanded 28→33 components; Alert, Table, Link added; SummaryCard + DecisionCard new React components; `KNOWN_COMPONENT_TYPES` 46→48; ProgressSteps/CodeBlock/SteppedCarousel/Questionnaire deferred.
- **Issue #300**: Architecture diagram at DESIGN step is under-informed — shows only user-selected services as flat nodes, omits AKS infrastructure known from §7/§9 defaults (ACR, Gateway API, Key Vault, Workload Identity, CI/CD).
- **Root cause**: System prompt line 125 says only "ArchitectureDiagram showing the app and connected services". Example 3 (line 282) reinforces the flat pattern. Component catalog gives 2-node example.
- **Decision**: Three-tier model — Tier 1 (always: AKS subgraph, ACR, Key Vault, Gateway), Tier 2 (conditional: DB, cache, queue, AI), Tier 3 (annotations: CI/CD, Workload Identity, replicas). Use `diagram` prop with Mermaid subgraphs, not `nodes/edges`.
- **Key insight**: ArchitectureDiagram.tsx already supports subgraphs via raw Mermaid `diagram` prop — this is purely a prompt-layer fix.
- **Files affected**: `system-prompt.ts` (§2 STEP 2 + Example 3), `component-catalog.ts` (ArchitectureDiagram entry), `demo-scenarios.ts` (ARCHITECTURE scenario)
- **Assigned to**: Bender (implementation), Fry (rendering verification)
- **Decision file**: `.squad/decisions/inbox/leela-architecture-diagram-depth.md`

---

### 2026-04-15T22:27:37Z: Priority Tracking Session
**Outcome:** Priority labels and cross-links added to GitHub issues #333, #328, #327, #326, #331, #332. Decision recorded in decisions.md for future priority tracking workflow.

- **2026-04-16T05:51:43.085Z — Post-v0.7.0 triage and priority lane decision:** Burndown complete, all demo-sprint lanes shipped. Decided: (1) merge PR #341 security bump immediately, (2) run sprint planning ceremony before any feature code, (3) proceed with #330 Agents SDK design spike (P1) in parallel since DPs are process-compatible with a reset, (4) #329 MCP App IDE design follows, (5) #332 stays blocked. Key insight: design spikes produce the DP gates the process requires — blocking them on the ceremony is circular. Updated now.md, session plan, and wrote decision to inbox. Decision file: `.squad/decisions/inbox/leela-post-v070-priority-lane.md`

---

## 2026-04-16 PR #383 Documentation Rewrite — Complete

**Engineering Docs Rewrite (7 files)**
- **Status:** Ready for merge; all review comments addressed
- **Files updated:**
  1. docs/ARCHITECTURE.md — Comprehensive system architecture with VSCode type hints
  2. docs/PHASES.md — Phase definitions (updated post-FSM removal)
  3. docs/CONVERSATION-ENGINE.md — Engine internals with advancePhase() pattern
  4. docs/AUTHENTICATION.md — Auth security model (no localStorage secrets)
  5. docs/PERSISTENCE.md — virtual-fs.ts (client-side IndexedDB) + server backup
  6. docs/INTEGRATION.md — Kit pattern + lifecycle management
  7. docs/TESTING.md — Snapshot + E2E test patterns

**Code Health Documentation**
- **virtual-fs.ts:** Client-side VirtualFileSystem (IndexedDB). NO server-side TTL. Affects data durability understanding.
- **Splice vs push:** Clarified immutable array operations using splice(0,1) for safe mutation-free operations in reducer examples.
- **Resolver ordering:** System walks scoped → base → global. Made dependency resolution chain explicit.
- **IntegrationKit:** Interface defined in @kickstart/core, published via catalog plugin system.

**Accuracy Fixes (2026-04-16T17:44:57Z)**
- Corrected factual errors from Copilot PR review (12 comments total)
- All review feedback incorporated; PR ready for merge

**Quality Gates**
- npm run build ✅
- All internal doc links validated ✅
- Code examples executable ✅
- Copilot review completed ✅

---

## 2026-04-16 Sprint Retro — Security + Generation Sprint

**PRs merged this sprint (Leela-owned or cross-cutting):**
- #341 DOMPurify 3.4.0 (XSS/prototype pollution fix)
- #354 Enable STEPWISE_GENERATION_V1 flag — now default in prod via infra/main.bicep
- #356 DeploymentProgress → GenerationProgress rename (18 files)
- #358 LLM combined catalog guidance in system-prompt.ts
- #368 CI permissions (explicit permissions blocks in all workflows)
- #372 next-card phantom cleanup + DeploymentProgress orphan text removal

**Issues created / triaged:**
- Overnight backlog audit: 11 items triaged. New: #349 (FileEditor A2UI coupling), #350 (DeploymentProgress wording), #351 (custom components audit) — all Leela spikes.
- Confirmed #329 (MCP App IDE) and #330 (Agents SDK) spikes adequate — no follow-up issues needed.

**Architecture decisions made:**
- Component rename discipline formalized (all 8 surfaces must be updated together)
- Sanitization standard: regex approach for Node.js packages, DOMPurify for browser-only
- Stepwise generation is now production default
- Prompt-catalog contract tests (#374) guard phantom references automatically going forward

**Next:** Address architecture spikes #349, #350, #351; review DPs for #329 and #330.

## 2026-04-17 DP #330 Architecture Review

**Review Date:** 2026-04-17T01:53:59Z  
**Issue:** #330 — spike: design OpenAI Agents SDK migration for less-rigid chat flow  
**DP:** Hybrid route planner + manager agent architecture

**Decision:** ✅ APPROVED

**Architecture Alignment Verified:**
1. FSM removal (#400/#412) — merged; DP's route planner fills control plane
2. Workspace-first generation (#326/#327/#328) — treated as constraints
3. Custom/SDK boundary — SDK handles loop/retry/session/streaming/tracing
4. Agents-as-tools — pragmatic starting position (handoffs deferred)
5. Server-authored route state — replaces model-authored flags

**Checkpoints Requested:**
1. Validate `RunResult`/`StreamedRunResult` → typed SSE adaptation without losing A2UI
2. Validate session hydration cold-start round-trip from existing session store

**Consequence:** Implementation unblocked pending Zapp's security review (approved with conditions).

## 2026-04-17 Review Gate Fix — Label-Based Merge Gate

- **Problem:** Branch protection required 1 approving review, but squad agents push PRs as the repo owner. Authors cannot self-approve → every squad PR blocked permanently.
- **Solution:** Replaced required-approval gate with label-based `squad/review-gate` status check.
- **Workflow:** `.github/workflows/squad-review-gate.yml` — triggers on PR label/unlabel/open/sync/reopen events.
- **Labels:** `leela:approved` (blue, #0075ca) and `zapp:approved` (yellow, #e4e669).
- **Gate logic:** Status = `success` when both labels present; `pending` otherwise. Context: `squad/review-gate`.
- **Branch protection:** Removed `required_approving_review_count`, added `squad/review-gate` to required status checks. `required_conversation_resolution` kept enabled.
- **SKILL updated:** `.squad/skills/pr-workflow/SKILL.md` — new Merge Gate section with label verification commands.
- **PR:** #427
- **Status:** ✅ Archived to decisions.md (2026-04-17T01:57:58Z)

## 2026-04-17 Comment Acknowledgment + Thread Resolution — Process Fix

- **Problem:** Agents were fixing code from PR review feedback but never replying to the specific comment or resolving the review thread. This left reviewers blind and blocked merge when `require_conversation_resolution: true` is enforced.
- **Fix:** Updated three files to make the full feedback loop mandatory:
  1. `.squad/skills/pr-workflow/SKILL.md` — replaced "Handling Review Feedback" section with 5-step loop (read → decide → reply → resolve → verify)
  2. `.github/copilot-instructions.md` — added "PR Review Feedback — Required Loop" section
  3. `.squad/decisions/inbox/leela-comment-resolution-process.md` — decision record
- **Learnings:** Comment-acknowledgment and thread-resolution are now documented as non-optional steps in every agent's PR workflow. Silently fixing code is a process violation.

## 2026-04-17 Round 3: PR #447 Code Review + Final Approvals

**Sponsor Issue:** #445 — Backend SDK adapter for OpenAI Agents SDK migration

**PR Review Cycle:**
- **Initial finding:** Duplicate-message bug in conversation streaming. Consecutive identical assistant messages were not deduplicated, causing AI artifact expansion and UX degradation.
- **Blocking status:** High-priority. Required fix before merge.
- **Resolution:** Bender pushed fix to streaming loop (commit a3899e5) with unit tests. Verified in subsequent review cycles.

**Review Verdict:** ✅ **APPROVED** (applied `leela:approved` label)
- All 1 blocking finding resolved
- 1511 tests passing  
- 0 unresolved comment threads
- Security gate also clear (Zapp approved with conditions)

**Implementation Quality:** Clean, focused fix. Demonstrates no-lockout directive — Bender handled all feedback cycles autonomously. No scope creep or pre-existing issues addressed.

## 2026-04-17 v2-Rewrite Merge Strategy Assessment & 1.0.0 Release

**Assessment Date:** 2026-04-17T20:00:55.651Z  
**Status:** GO VERDICT

Completed merge strategy assessment for v2-rewrite → main merge. All 13 v2 implementation steps reviewed. DP approvals finalized:

- ✅ DP #483 (pack-aks-automatic) — APPROVE_WITH_CONDITIONS
- ✅ DP #484 (pack-github) — APPROVE_WITH_CONDITIONS  
- ✅ DP #485 (web A2UI renderer) — APPROVE_WITH_CONDITIONS (Leela); BLOCKED pending Zapp security re-review
- ✅ DP #486 (guardrails engine) — APPROVE_WITH_CONDITIONS
- ✅ DP #487 (MCP adapter) — APPROVE_WITH_CONDITIONS
- ✅ PR #550 (Step 5 Runner + SSE) — APPROVE_WITH_CONDITIONS

**Merge Strategy:** --no-ff merge approved. 6 file conflicts identified with clear resolution paths documented. Bender executing merge with conflict resolution steps.

**Version:** Bumped to 1.0.0. This is the 1.0.0 release milestone.
