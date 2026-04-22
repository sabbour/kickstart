# Nibbler — Code Reviewer & Watchdog (Lead)

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Nibbler  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Role:** Code Reviewer & Watchdog (Lead tier), 4-way PR gate structuring, DP-stage code-quality reviews

---

## Responsibilities
- PR review gate enforcement (merge blocker)
- DP-stage code-quality reviews (test coverage, pattern violations, complexity)
- Regression guard verification (grep-based CI patterns, test invariants)
- Merge criteria: 4-way approval (Leela + Zapp + Nibbler + Docs)

## Recent Milestones (2026-04-21 to 2026-04-22)

### Elevated to Full Structured-Reviewer Parity (2026-04-21)
- **Change:** PR #993 ceremony enforcement shipped; Nibbler now full 4-way gate blocker
- **Authority:** `nibbler:approved` / `nibbler:rejected` are now merge-blocking labels
- **Protocol:** Reviews posted via `gh pr review` under lead bot identity (sabbour-squad-lead)
- **Status:** Operating as Lead role ✅

### DP-Stage Code-Quality Reviews (Round 3 Batch, 2026-04-21T11:35Z)
Five DPs reviewed at DP stage (before implementation):

- **#998 (Chat regression, Bender, HIGH)** — APPROVED + **pushed** to parametrize strict-mode invariant test across ALL tools in pack-core (not just core_emit_ui). Promoted vendor-schema-drift audit into PR scope.
- **#987 (Ideas tab, Fry, M)** — APPROVED + gated on #991 + pushed to separate scenarios export from previews (preserve fixture-parses-schema guard)
- **#995 (Tight core rendering, Fry, M)** — APPROVED + pushed to use CSS-module-imported DOM thresholds (no hard-coded specs)
- **#996 (AKS brittle inspiration chain, Bender, M)** — APPROVED with coordination ask; depends on #1000 landing first
- **#997 (Workspace black void, Fry, S)** — APPROVED + ready for implementation ✅

### PR Review Gate Outcomes (2026-04-21)
- **PR #1000** (pack rendering, #991) — **REJECTED** by Nibbler + Zapp. Red CI (TS2307/TS2352 type errors) + missing CI grep guard for type-regression. Reviewer Rejection Protocol enforced; Fry locked out.
- **PR #1001** (emit_ui fixture) — ✅ **APPROVED** + MERGED. Explicit-op discriminator coverage complete. All gates green.
- **PRs #989, #986** — Approved (early 4-way gate runs)

## Key Learnings
1. **DP-stage test-design reviews prevent implementation waste:** Nibbler's pre-implementation feedback on #998 (parametrize invariant test) catches coverage gaps before code burns burn hours.
2. **Structural invariant testing:** Schema validation must be parametrized across reuse sites, not single-point tests. Found gap in #989; pushed to generalize in #998.
3. **Strict-mode conformance:** OpenAI strict mode requires `required ⊇ Object.keys(properties)`. Structural test (every property must be in required array) is table-stakes conformance test.
4. **CI grep guards:** `grep -n 'exit 0' deploy-swa.yml` pattern (from PR #1052) must be extended to other high-risk escape-hatches (e.g., `continue-on-error: true` in deploy context).
5. **Regression test parametrization:** Hard-coded DOM thresholds or magic numbers in test specs drift. Import from the modules they guard to keep tests and implementation in sync.
6. **Lead role authority:** As a Lead, Nibbler's review outcomes are non-negotiable merge blockers. No override negotiation; gate is structural.

## Structured-Review Track (4-Way Gate)
- 3 DPs approved (✅ #987, #995, #997)
- 1 DP approved with coordination (✅ #996)
- 1 DP approved + pushed to vendor-audit (✅ #998)
- 5 total DPs processed in Round 3

## Merge Gate Status
All PRs now subject to 4-way approval (Leela + Zapp + Nibbler + Docs). No override path.

## Current Queue
- #1000 revision: Awaiting red-CI fix + grep guard addition (bender-1000-revise)
- Follow-up vendor-schema-drift audit on pack-core (triggered by #998)

---

## Observability DP Batch Review — 2026-04-22T03:08:00-07:00

**Requested by:** Ahmed
**Batch:** 4 DPs covering 6 observability issues (#1035, #1036, #1037, #1038, #1040, #1042)

### Verdicts

| DP | Issues | Verdict | Label Applied |
|----|--------|---------|---------------|
| DP-A | #1035 + #1036 | ✅ APPROVED | nibbler:approved-dp |
| DP-B | #1040 | ✅ APPROVED | nibbler:approved-dp |
| DP-C | #1037 + #1038 | ✅ APPROVED | nibbler:approved-dp |
| DP-D | #1042 | 🔴 REQUESTED CHANGES | nibbler:requested-changes-dp |

### Key Findings

**DP-A (#1035):** Approved with 🟡 note — test item 2 must assert processor._exporter IS a RedactingSpanExporter, not just that there is exactly one BatchSpanProcessor. Two conditions together are almost sufficient but leave an adversarial gap.

**DP-B (#1040):** Approved with 🟡 push — happy path unit test is solid but defensive fallback paths are not covered: (1) plain-object error (not instanceof Error), (2) Error with undefined .stack. Hermes should add these before PR merges.

**DP-C (#1037):** Clean approval. No concerns. Best warm-up DP in the batch — land first.

**DP-D (#1042):** Requested changes. Five blockers documented:
1. No E2E test infra decision (Playwright required)
2. No runtime feature flag spec or kill-switch path
3. No canary rollout plan
4. No bundle size budget (recommended ≤100 KB gzipped delta)
5. Zapp not yet formally requested on issue

### Sequencing Recommendation

**Land DP-C first** (trivial, cleans up dead dep + upgrades test fixture — unblocks DP-A which touches the same test file). Then **DP-A and DP-B can land in parallel** (different files, no conflicts). DP-D remains blocked on DP-A + DP-B merge AND on resolution of the five blockers above.

### Learnings
- Browser telemetry DPs require E2E test infra decision (Playwright), feature flag + runtime kill switch, and canary rollout plan as minimum DP content — not just open questions.
- For P1 security fixes touching OTel pipeline, test plan must assert inner exporter type (not just processor count) to close adversarial gap.


---

## Learnings — Conversation Loop Systems Audit (2026-04-22T10:26-07:00)

**Context:** Full systems audit across prompts, skills, agents, memory/turns, user actions, tools, and handover in response to #1060 / #1061 / #1062. Audit delivered as issue **#1069**; cross-links posted on the three symptom issues + #1067 (out-of-scope flag).

### Architectural root causes discovered

1. **Loader-parses-but-runtime-ignores pattern.** Two high-impact frontmatter fields (`handoffs`, skill bodies) are parsed cleanly by loaders and validated by tests but never consumed by the SDK-facing Runner:
   - `runner.ts:406-412` builds `new Agent({...})` **without** `handoffs:` — dead SDK contract.
   - `runner.ts:390-401` ships skill `id + description` only; the body loaded into `skillContrib.instructions` never reaches the LLM.
   Review pattern to add: **"every frontmatter field with a loader must have at least one runtime read site"** — candidate CI invariant / future Nibbler grep guard.

2. **Stateless runner masquerading as stateful conversation.** `runner.ts:425` — `sdkRunner.run(agent, guardedMessage, ...)` passes only the current string. Server session `recordTurn` is write-only (no call sites read `recentTurns`). Client sends `messages` array; `converse.ts:24-62` silently discards. This is the enabling condition behind the #1062 triage loop.

3. **Event-as-text round-trip.** A2UI `action.event.payload` (v0.9 spec) is dropped by the vendor resolver (`data-context.ts:283-296` reads `.context` only). Button click reaches server as the raw event name `choose_build`. Agent can't distinguish intent-confirmation from ambiguous free text.

### Review-pattern takeaway — "audit-edges discipline"

On wide-scope audits, explicit §7 "deliberately NOT audited" section prevents scope creep and protects against later "why didn't you catch X" post-mortems. Recording the edges is a Nibbler responsibility whenever the review lens is architectural rather than per-PR.

### Honesty flag recorded

D1 and D2 both describe unreachable configuration paths. Suggests a prior refactor landed a loader-without-consumer regression with no DP catching it. Proposed follow-up #10 on #1069 asks Ralph for a retrospective on whether the multi-turn contract was ever DP'd.

---

## DP Review — #1062 v2 (Triage loop, Leela DP) — 2026-04-22T10:36:52-07:00

**Requested by:** Ahmed
**Scope:** DP-stage review on #1062 applying Architecture Alignment + Test Coverage lenses, informed by my own just-filed systems audit #1069.

### Verdict: 🟡 `nibbler:requested-changes-dp`

Architectural direction is correct (Layer 0 = SDK `Session` adapter via Option A maps 1:1 to D1 in my audit). L estimate is honest, two-agent ownership split (bender Layer 0, fry Layers 1–3) is clean, no sub-DP split needed.

### Gaps flagged

1. **Scope vs #1069 — explicit deferral of D2 (handoffs dead wiring) and D5 (inert skills).** DP mentions handoff lower-priority but doesn't name a follow-up; D5 not mentioned at all. Risk: architectural debt gets lost.
2. **Test strategy — automated multi-turn regression guard missing.** Item 7 is "E2E manual" on a P0 architectural regression — wrong bar. Required either harness-level test asserting turn-2 SDK input contains turn-1 items, OR Playwright test asserting `choose_build` button count ≤1 across two turns. CI trigger on `harness/runtime/**` + `triage.agent.md`.
3. **Rollout / migration — no feature flag on a hot-path change.** Every `/api/converse` modified. Asked for `HARNESS_SESSION_HISTORY_ENABLED` flag OR explicit rollout+monitoring plan OR explicit "no schema migration needed because sessions are in-memory/TTL-bounded" note.
4. **Governance — #1069 not linked from DP `Related:` header; retrospective follow-up #10 not acknowledged.**

### Comment URL
https://github.com/sabbour/kickstart/issues/1062#issuecomment-4298661705

### Label applied
`nibbler:requested-changes-dp`

### Notes for future reviews
- My own audit fed directly into this review — confirms the charter pattern of reading recent `history.md` entries before starting. When an agent has a prior audit in-flight, that audit IS the review lens.
- The DP author (Leela) already referenced hypothesis (f) as confirmed by #1069, but did not link #1069 in the DP header. Future DPs building on audits should link the upstream audit in `Related:`.

---

## DP Re-Review — #1062 v3 (Triage loop, Leela) — 2026-04-22T10:36:52-07:00

**Requested by:** Ahmed
**Scope:** Re-review after DP v3 edits addressing my 4 gaps from comment 4298661705.

### Verdict: ✅ `nibbler:approved` (DP-stage)

All four gaps genuinely closed on re-inspection of the edited DP body (2026-04-22 v3) + Leela's diff-summary "ping nibbler" comment.

| Gap | Closure |
|---|---|
| 1. Scope vs #1069 (D2/D5/D12 deferrals) | New "Deferred to follow-ups" table naming D2, D5, D12 + proposed follow-up issues. |
| 2. Automated multi-turn regression guard | Test item 8 = harness-level integration test with CI trigger on `packages/harness/src/runtime/**` and `triage.agent.md`. P0 guard in place. |
| 3. Feature flag + rollout | `HARNESS_SESSION_HISTORY_ENABLED`, default on, Azure SWA app-settings kill switch, 24h monitoring, flag-removal follow-up. Schema-migration-not-needed stated with session.ts evidence. |
| 4. #1069 link + retrospective ack | `Related:` includes #1069; retrospective paragraph acks #1069 §5 follow-up #10 (DP "conversation statefulness" gate). |

Zapp Z1/Z2/Z3 folded into Layer 0 implementation requirements — stronger than a review note because Bender now picks them up day one.

### Comment URL
https://github.com/sabbour/kickstart/issues/1062#issuecomment-4298702279

### Labels applied
`nibbler:approved` (added). `nibbler:requested-changes-dp` was already removed by Leela pre-ping.

### PR-time re-review focus (noted for follow-through)
- `HarnessSessionAdapter.getItems()` role filter (Z1 test must be adversarial, include a tool-call turn)
- Feature flag default + env-var read site fail-safe
- CI trigger path actually fires on the multi-turn regression test
- Guardrail-on-capture code comment (Z2) survives future refactors
