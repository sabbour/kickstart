# Leela — Lead Architect

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Leela  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Role:** Lead Architect, ceremony facilitator, architectural gate enforcement

---

## Responsibilities
- DP approval and Design Review facilitation
- Ceremony enforcement (mechanical 4-way gate on all PRs)
- Architecture alignment checks (pack boundaries, surface consistency)
- Post-incident retrospectives and decision capture

## Recent Milestones (2026-04-21 to 2026-04-22)

### Ceremony Gate Enforcement (PR #993 Merged)
- **Change:** Mechanical 4-way approval gate now active on all future PRs
- **Gate:** `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` ∨ `docs:not-applicable`) + green CI
- **Status:** No override path; gate is merge-blocking ✅

### Five DPs Approved in Round 3 (2026-04-21T04:30Z)
- #998 (chat regression, Bender, S, HIGH) — APPROVED + ready for implementation ✅
- #995 (Core component rendering, Fry, M) — APPROVED + ready ✅
- #996 (AKS brittle tests, Bender, M) — APPROVED but depends on #1000
- #997 (workspace black void, Fry, S) — APPROVED + ready ✅
- #987 (Ideas tab, Fry, M) — APPROVED but depends on #991

### PR Review Outcomes (2026-04-21)
- **PR #1000** (pack rendering, #991) — **REJECTED** by Zapp + Nibbler. Red CI (TS2307/TS2352) + missing CI grep guard. Reviewer Rejection Protocol triggered; Fry locked out; bender-1000-revise assigned.
- **PR #1001** (emit_ui fixture) — ✅ **MERGED.** All gates green. Shipped explicit-op discriminator coverage.

### Production 404 Incident Post-Mortem (2026-04-21)
- **Root cause:** PR #1034 reintroduced `@aks-kickstart/harness: "*"` in API dependencies. Azure SWA server-side npm install tries to fetch private workspace pkg, fails, overwrites OTel externals. Worker crashes → no routes → 404.
- **Historical debt:** Same mechanism identified in prior commits (swa-pkg-fix/68e5f875, swa-clean-deps branches) but never merged to main.
- **Forensic chain:** 8-step evidence documented; zip timing disproved `.funcignore` theory, confirmed server-side install overwrite.
- **Fix:** PR #1048 merged — move workspace deps to devDependencies. Production restored ✅

### OTel Reversal Strategy (DP Amendment Approved)
- **Issue:** #1041 — Revert PR #1030's incorrect externalization; restore bundled-inline strategy
- **Scope:** Remove externals (except `@azure/functions-core`), delete `materialize-api-externals.mjs`, lazy-init OTel
- **DP:** Leela + Zapp + Nibbler all approved; implementation dispatched to Bender ✅
- **Status:** PR #1051 ready for merge review

## Key Learnings
1. **Azure SWA platform behavior:** Server-side npm install ALWAYS occurs during post-upload processing (~30s window), regardless of `skip_api_build` client-side flag. Dependency resolution must be runtime-only.
2. **Workspace package governance:** Hardcode `/^@aks-kickstart\/harness$/` into CI allowlist and API package.json audit to prevent accidental runtime dependencies on workspace packages.
3. **Ceremony gate as blocker:** Mechanical 4-way approval eliminates override negotiation; forces thorough review upfront. PR #993 sets new standard.
4. **DP-time security invariants:** Strict-mode schema compliance, ideas-tab threat model, composition retry bounds — all must be enforced at DP approval, not post-hoc.
5. **Historical incident prevention:** PR #1052 grep-based regression guard pattern (verify smoke-gate, verify OTel externals) should be applied retroactively to high-risk previous decisions.

## Active DP Track
- #1050 (emit_ui strict-mode) — DP approved, shipped (Fry, PR #1058) ✅
- #1049 (SWA smoke gate + PR preview) — DP v2 approved, ready for implementation (Fry)
- Five Round-3 DPs under implementation dispatch

## Current Queue
- #1040: AgentSpanError stack-trace fix (P1, pending assignment)
- Production stability: Regression guards + ceremonies now in effect

---

## Triage Harness Bug Investigation (2026-04-22T02:56:41-07:00)

**Requested by:** Ahmed  
**Session type:** Investigation + issue filing only. No implementation dispatched.

### Three bugs filed

**#1060 — P1: Duplicate header (Bug A)**  
Root: `ChatMessage.tsx:43–58` renders `message.text` AND `message.surfaceIds` unconditionally. `AgentOutput.message` is required (`z.string()`), so the agent always emits prose. `a2ui-output-discipline` skill doesn't mandate empty `message` when emit_ui is called. `core_emit_ui` also called twice = double surface render.  
Fix direction: guard in `ChatMessage.tsx` to skip prose when surfaceIds present; `message` optional in `AgentOutput`; skill rule update.

**#1061 — P2: Raw event name in user bubble (Bug B)**  
Root: A2UI spec uses `action.event.payload` for button data, but `data-context.ts:resolveAction()` only reads `action.event.context`. The payload keys (`value`, `action`, `confirmed`) never flow into `A2uiClientAction.context`. `actionToMessage()` sees empty context and falls back to `cleanName = "choose_build"`.  
Fix direction: `data-context.ts` should merge `payload` into `resolvedContext`; catalog Button components should inject child Text's value as `label` in context at click time.

**#1062 — P0: Triage loops (Bug C)**  
Root: Three compounding causes — (1) Bug B sends useless text to agent, (2) `triage.agent.md` has no post-selection routing logic, (3) no build-intake handoff agent exists. Even if Bug B is fixed, triage has no instruction to stop re-presenting the menu after a confirmed selection.  
Fix direction: Fix Bug B first; add explicit branch-on-confirmed-intent section to triage prompt; add `core.build-intake` handoff.

### Priority ordering recommendation to Ahmed

1. **#1062 (Bug C) first** — it's the P0 product blocker. The loop prevents any real user journey from completing.
2. **#1061 (Bug B) second** — prerequisite for #1062's fix; also important UX trust issue (raw event names visible).
3. **#1060 (Bug A) third** — quick visual win (2-line ChatMessage.tsx guard), improves perceived quality immediately and can be done in parallel.

---

## Observability DP Triage (2026-04-22T02:56:41-07:00)

**Requested by:** Ahmed (pivot from harness investigation)  
**Session type:** Triage + DP authoring. No implementation dispatched.

### Batching decision

Grouped 6 issues into 4 DPs:

**DP-A: #1035 + #1036 — RedactingSpanExporter hardening (P1)**  
Double-export security gap + extend Proxy to redact span.links[].attributes and resource.attributes. Primary issue: #1035. Comment: https://github.com/sabbour/kickstart/issues/1035#issuecomment-4295318972

**DP-B: #1040 — AgentSpanError stack trace (P1)**  
Pass real Error to `recordException()` in agents-otel-bridge.ts:182. Comment: https://github.com/sabbour/kickstart/issues/1040#issuecomment-4295322566

**DP-C: #1037 + #1038 — OTel cleanup (S)**  
Remove dead `applicationinsights` dep + upgrade T9 test fixture to real BasicTracerProvider. Primary issue: #1037. Comment: https://github.com/sabbour/kickstart/issues/1037#issuecomment-4295325726

**DP-D: #1042 — Browser-side App Insights (L, deferred)**  
Stub DP with 5 open design questions. Blocked until DP-A and DP-B merge. Zapp security gate required before any code ships. Comment: https://github.com/sabbour/kickstart/issues/1042#issuecomment-4295329972

### Label changes applied

All 6 issues: removed `squad` + `go:needs-research`, added `go:needs-dp-review`. Squad member labels preserved.

### MUST SHIP FIRST

**#1035** (DP-A). Security: spans currently export unredacted to App Insights via the distro's internal exporter. PII leaks on every request. Blocks everything else from a security posture standpoint.

### Sequencing recommendation

1. DP-A (#1035 + #1036) — P1 security, unblock first
2. DP-B (#1040) — can run in parallel with DP-A (different file)
3. DP-C (#1037 + #1038) — cleanup, lowest risk, parallel with both
4. DP-D (#1042) — deferred; needs DP review ceremony + Zapp sign-off before Fry starts

---

## Design Proposal: #1062 Triage Loop Fix (2026-04-22T08:47:12-07:00)

**Requested by:** Ahmed via Ralph loop  
**Session type:** DP ceremony. No implementation dispatched.

### DP v1 posted, then revised to v2 on #1062

**v1:** Consolidated #1060, #1061, #1062 into 3 layers (payload bridge, prompt fix, prose suppression). Estimate M, Fry only.

**v2 (after Ahmed's hypothesis):** Investigated conversation history threading. **Confirmed complete amnesia** — the runner passes only the latest user message string to the SDK's `run()`, never prior turns. The SDK supports `Session` interface and `AgentInputItem[]` input but our runner uses neither. This is the PRIMARY root cause.

Revised to 4 layers:
- **Layer 0 (NEW, PRIMARY):** Implement SDK `Session` interface adapter in harness, thread `recentTurns` into `sdkRunner.run()` — `squad:bender`
- **Layer 1:** payload→context bridge in `data-context.ts` + Button label injection — `squad:fry`
- **Layer 2:** Phase-advance rules in `triage.agent.md` (defense in depth) — `squad:fry`
- **Layer 3:** ChatMessage.tsx prose suppression — `squad:fry`

Estimate upgraded to **L**. Two-agent PR: Bender (Layer 0, harness), Fry (Layers 1–3, web+pack-core). Added `squad:bender` label.

### DP v3 — addressed Nibbler + Zapp review (2026-04-22)

- **Nibbler gap 1:** Added "Deferred to follow-ups" section — D2, D5, D12 from #1069 explicitly out of scope with follow-up issues proposed.
- **Nibbler gap 2:** Promoted test strategy to automated harness-level multi-turn regression guard (CI-gated on harness + triage.agent.md paths). Manual E2E demoted to supplementary.
- **Nibbler gap 3:** Added rollout plan with feature flag (`HARNESS_SESSION_HISTORY_ENABLED`), preview-env validation, 24h monitoring. Explicit schema-migration note: in-memory, zero risk.
- **Nibbler gap 4:** Added #1069 to Related header. Acknowledged retrospective ask per §5 follow-up #10.
- **Zapp carry-forwards:** Z1 (role-filter test), Z2 (guardrail-on-capture invariant), Z3 (inert-skills follow-up) folded into Layer 0 requirements for Bender.
- Removed `nibbler:requested-changes-dp` label. Posted re-review diff comment for Nibbler.

### Learnings

1. **Runner has complete conversation amnesia.** `runner.ts:425` passes `guardedMessage` (a string) to `sdkRunner.run()`. The `@openai/agents` SDK starts a fresh conversation each turn. `Session.recentTurns` accumulates history but is never fed back. The SDK supports `session?: Session` in run options (`run.d.ts:141`) — we just never use it.
2. **Client sends history but server ignores it.** `useStreaming.ts:382–409` builds `clientMessages` from `chatHistory` and sends it as `messages` in POST body. `ConverseRequest` (`converse.ts:24–28`) doesn't declare `messages`. Dead field.
3. **A2UI payload vs. context gap is a systemic issue.** The spec uses `action.event.payload` but the web-core rendering layer only reads `action.event.context`. Any future component relying on payload keys will hit the same wall.
4. **Agent prompts need explicit state transitions.** A prompt that only describes "emit a menu" without "what happens after they choose" will loop. Phase-advance rules should be a checklist item for any agent that presents interactive surfaces.
5. **When debugging agent behavior, check history threading first.** An agent that loops identically every turn is more likely stateless than prompt-defective. Verify the SDK receives prior turns before blaming the prompt.


---

## Audit #1069 Triage (2026-04-22T11:10-07:00)

**Requested by:** Ahmed
**Session type:** Triage only — filed 6 issues, deferred 1, closed meta.

### Routing outcome

**Filed (6):**
- #1073 — P1 `squad:bender` — D2+D7+D14 (wire handoffs + targets + remove dead branches). Depends on #1071.
- #1074 — P1 `squad:bender` — D3 / F4 (converse.ts hydrate from client `messages`). Depends on #1071. Zapp review flagged.
- #1075 — P1 `squad:bender` — D11 / F5 (emit_ui createSurface idempotence).
- #1076 — P2 `squad:bender` — D9 / F8 (AgentOutput.message optional).
- #1077 — P2 `squad:hermes` — D12 / F9 (skillsExecuted truth). Depends on #1070.
- #1078 — P2 `squad:leela` — F10 (governance retro + CI invariant for parsed-but-unread frontmatter fields).

**Already covered:** D1 (#1062/#1071), D4 (#1071), D5 (#1070), D6 (#1062 L2), D8 (#1061+#1062 L1), D10 (#1060+#1062 L3).

**Deferred:** D13 (catalogBlock without props) — `emit_ui` tool description is authoritative; adding props duplicates context and costs tokens. Re-open if model picks wrong components post-#1070.

### Learnings

1. **"Parsed but unread" is a systemic pattern in this codebase, not a one-off.** D2 (`handoffs`), D5 (skill bodies), D4 (`recentTurns`), D12 (`skillsExecuted`) are four independent instances. That's why #1078 was worth filing as a governance workstream, not just "a nice CI guard."
2. **When triaging audits, group related defects into one issue only if they share a file and fix approach.** D2+D7+D14 all live in `runner.ts:406–473` and are fixed by the same `handoffs:` constructor change, so one issue. D3 + F4 are the same thing (the audit double-counted), so one issue. Don't split further than the implementing agent will open PRs.
3. **Priority the blockers first, polish second, governance in parallel.** All P1 are implementation, all P2 are polish/governance. Keeps the sprint readable.
4. **Cite the defect ID AND the follow-up number in each new issue title.** Future backlink searches work better with both.

---

## 2026-04-22 — MCP Apps DP v2.1 refresh + mermaid diagram (PR #1047)

### Task

Re-sweep MCP-relevant surfaces against DP v2.1 and add a mermaid runtime diagram.

### Sweep findings

- **`packages/mcp-server` already exists** as a v2 thin adapter (McpServer + harness Runner). The DP correctly frames the `SamplingModelProvider` / capability gate as unbuilt future work.
- **Line references in the DP still accurate**: `index.ts:100-109` (oninitialized hook), `runner.ts:316-317` (Runner constructor), `runner.ts:423-425` (getSdkRunner call), `runner.ts:54-72` (buildModelProvider), `runner.ts:95-104` (installOtelBridgeOnce).
- **Old v1 artifacts present but dormant**: `src/tools/` and `src/app/protocol.ts` contain the pre-harness phase-machine implementation. They are referenced only by `protocol.ts` (not the entry point). Not DP scope.
- **nibbler/zapp → lead alias consolidation** (PRs #1048, #1053): DP §2 gates note was stale; updated to reflect that `nibbler:approved` is now applied by Leela as the lead alias.

### Drift classification

- 1 metadata/annotation update (nibbler alias)
- 0 structural drift items (architecture still correct)
- 1 additive (mermaid diagram §2.1)

### Learnings

1. **When a DP lands next to a partially-built package, sweep the entry point first** — `index.ts` tells you what's done vs. still proposed faster than reading tests.
2. **Vestigial v1 code in `src/tools/` won't be caught by the DP's file-touch map** — future cleanup should note these are orphaned and safe to remove independently.
3. **Squad alias consolidations need DP annotation passes** — any DP referencing a named agent as a gate must be updated when that agent is aliased.

## 2026-04-22 — Electron DP rev 8: reconciliation + mermaid diagram

**Task:** Re-survey Kickstart repo against Electron Desktop DP rev 7. Reconcile claims with actual code, add mermaid architecture diagram.

### Scope

Re-read `runner.ts`, `agents-otel-bridge.ts`, `converse.ts`, all 20 function handlers, 3 agent files, `emit_ui.ts`, `appinsights.ts`, `logger.ts`, frontend auth services, `infra/main.bicep`, and `package.json` workspace layout. Compared every claim in the DP against the source.

### Drift findings

- **2 minor fixes:** `agents-otel-bridge.ts` line count 262→277 (Nibbler B3 fix added 15 lines); `Runner.run()` method start line 316→319 (316 is class decl).
- **2 substantive reconciliation notes:** API telemetry has migrated from classic `applicationinsights` SDK to pure OTel via `@azure/monitor-opentelemetry` (classic SDK banned by ESLint). Desktop telemetry guidance in §3.5 updated to match.
- **0 verdict-threatening findings.** The Option 3 shim recommendation stands. All structural claims (20 handlers, 3 agents/2 edges, `buildModelProvider()` at lines 54-72, 597 runner.ts lines, emit_ui pattern, no packages/desktop conflict) verified correct.

### Added

- Mermaid flowchart diagram (§1.1): Option 3 architecture — Web vs Electron deployment fronts, shared KickstartRunner, AgentBackend seam, auth/provider flavors.
- Mermaid sequence diagram (§1.1): Single Electron user turn through CopilotBackend path.
- Cross-reference from §18.10 to §1.1 diagrams.

### Learnings

1. **Telemetry migrations can silently outpace DPs** — `appinsights.ts` underwent a full OTel migration (DP #1030) that invalidated multiple DP table entries. DPs referencing telemetry should pin to the actual import path, not the npm package name.
2. **Line-number references in DPs rot fast** — even mechanical fixes (Nibbler B3) shift counts. Prefer semantic anchors ("the `buildModelProvider()` function") over line numbers where possible.
3. **Mermaid diagrams render natively in GitHub PR review** — reviewers can preview without plugins. Good practice for any DP that proposes multi-package architecture.
