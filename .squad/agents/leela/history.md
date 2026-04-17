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

## 2026-05-28 — DP Review #478 v2 Step 4a: Playground on registry

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/478#issuecomment-4268203830  
**Decision record:** `.squad/decisions/inbox/leela-478-dp-review.md`

Key findings:
- GALLERY_GROUPS removal via `registry.playgroundScenarios` is architecturally clean. ✅
- Widgets tab full deletion (not gating) is correct — v1 coupling, no v2 pack provides it. ✅
- Step 5 boundary is respected; Create tab excluded; `usePlaygroundDispatch` stays at hook layer. ✅
- corePack MVP (4 components + 2 scenarios + empty stubs) is sufficient for registry shape validation. ✅
- C1 (BLOCKER): Three of four registry APIs used by this DP (`getComponent`, `playgroundScenarios`, `playgroundStubs`) are not in the #476-approved surface. Bender must extend the Step 3 spec before #478 starts.
- C2 (Fix before coding): `usePlaygroundDispatch` pseudocode has missing `if (!stub)` guard — throw executes unconditionally. Must be fixed in DP text.
- M1 (Minor): "Fail loudly" scope must be explicit — unregistered component references → error badge; empty scenario list → empty state. Two different failure modes.

## 2026-05-28 — DP Review #477 v2 Step 4: pack-core

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/477#issuecomment-4268164127  
**Decision record:** `.squad/decisions/inbox/leela-477-dp-review.md`

Key findings:
- pack-core scope (3 agents + 5 skills + 6 tools + 39 components + 3 guardrails) and domain-neutral boundary are correct. ✅
- Delivery order (A → B‖C → D → E → F → G → H) is coherent; no circular dependencies. Phases A+B unblocked immediately once #476 green. ✅
- `emit_ui` Zod union usage correct; `session.a2uiEmissions` decoupling model is architecturally sound. ✅
- 27/12 component split correct; audit table domain classification is accurate. ✅
- C1 (BLOCKER for Phase C): `Pack` type shape ambiguity — brief says `register()` walks `agentsDir`/`skillsDir`, DP shows inline arrays. Must resolve against #476 before Phase C starts.
- C2 (BLOCKER for Phase C): `SessionCtx.a2uiEmissions: A2UIMessage[]` must be confirmed in #475; raise targeted PR against #475 if missing.
- C3 (Required for merge): Brief §9 Step 5 sketch reads `event.arguments` (raw) — contradicts DP's `session.a2uiEmissions` contract (post-validation). Step 5 DP must commit explicitly to `session.a2uiEmissions` forwarding before Step 5 is authored.
- C4 (Required for merge): §6c registration test must exercise real loader-from-disk path once C1 resolved; add second test if Pack uses inline arrays.
- C5 (Required for Phase E): `AuthCard` schema must be stripped of all Azure-specific props before Phase E porting.

## Wave 4 — 2026-05-28 DP Review #477 v2 Step 4: pack-core

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/477#issuecomment-4268164127

- Pack-core scope approved: 3 agents, 5 skills, 6 tools, 39 components, 3 guardrails, 2 playground scenarios. Domain-neutral boundary correct.
- `emit_ui` Zod union + `session.a2uiEmissions.push()` decoupling model approved.
- Phase A+B unblocked once #476 is green.
- C1 (BLOCKER Phase C): Pack type shape — dir-pointers vs inline arrays must be resolved against #476 before Phase C.
- C2 (BLOCKER Phase C): `SessionCtx.a2uiEmissions: A2UIMessage[]` must exist in merged #475; if not, targeted PR against #475 required.
- C3 (Required for merge): Step 5 DP (#479) must commit to forwarding from `session.a2uiEmissions`, NOT `event.arguments` (raw, pre-validation).
- C4 (Required for merge): §6c test must exercise loader-from-disk path, not just manifest shape.
- C5 (Required Phase E): `pack-core/AuthCard` must be domain-neutral — no MSAL props. MSAL wiring lives in `pack-azure`'s `azure:login` UserAction.
- #478 unblocked once pack-core has real components. #479 hard-depends on C3.

## 2026-06-10 — PR #544 Code Review (v2 Step 1)

**PR:** #544 — feat(v2): Step 1 — Nuke v1, cut to harness, web-shell cleanup (Closes #474)
**Verdict:** APPROVED + `leela:approved` label applied

All 8 DP approval conditions verified:
- Core shim compile-only ✅ (package.json redirect only, no src/index.ts)
- Feature flags gone ✅ (KICKSTART_AGENTS_SDK + KICKSTART_V2 purged from production)
- Fail closed ✅ (converse.ts → 503, mock/demo files deleted)
- 16 web files on harness ✅
- 34 harness smoke tests ✅ (407 total green)
- No new exports ✅ (stubs only)
- Build green ✅ (vite build passes)
- Deferred items correct ✅ (types.ts as empty module, connector infra intact)

**Known debt — Step 2 prerequisite:** `types.ts` emptied to `export {};` but ~15 web shell files still import named types from it. `tsc --noEmit` would fail (TS2305). Vite build passes (strips types). Step 2 must resolve tsc errors before any tsc CI gate lands. Bender + Fry co-own.

Decision filed: `.squad/decisions/inbox/leela-pr544-review.md`
