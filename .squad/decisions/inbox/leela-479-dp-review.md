# Decision: DP #479 — v2 Step 5: Runner + SSE

**Date:** 2026-06-10
**Author:** Leela (Lead)
**Issue:** #479
**Comment:** https://github.com/sabbour/kickstart/issues/479#issuecomment-4268302933
**Status:** APPROVE_WITH_CONDITIONS

---

## Architecture decisions recorded

1. **Runner/registry coupling model is correct.** Registry calls per turn (`getAgent`, `getToolsForAgent`, `listComponents`, `getSkillsForAgent`) are read-only. The sealed registry cannot be mutated at runtime. `Agent` is constructed per-turn from `AgentContribution` — the contribution is never mutated. This pattern is canonical for all future runner implementations.

2. **9 SSE event taxonomy is locked.** `chunk | a2ui | tool | artifact | user_action_required | handoff | intent | done | error` is the complete typed event surface for v2. The `a2ui`/`chunk` separation is canonical per brief §3. No envelope. One `core.emit_ui` call = one `event: a2ui` line. No `resume_ack` event — new SSE stream IS the acknowledgement.

3. **`a2uiEmissions` drain must be immediate, not end-of-turn.** The runner must emit SSE `a2ui` events immediately on each SDK `tool_call_item` for `core.emit_ui`. The `session.a2uiEmissions` array is a record/log, not the streaming path. Buffering until end of turn is incorrect and would prevent real-time A2UI rendering.

4. **`resultSchema` is not stored on `SessionCtx.pendingUserAction`.** Zod schemas cannot be serialized to JSON and cannot survive a persistence adapter. The resume endpoint uses `registry.getUserAction(toolName).resultSchema` for validation. The `pendingUserAction` shape carries only `runId`, `toolName`, and `args`. This is the canonical `pendingUserAction` shape.

5. **`useNavigation.ts` must be explicitly wired to `onIntent`** in Step 5 or deferred with an explicit TODO. It must not be listed as "untouched" while its prior feed (`onPhase`) has been removed.

6. **`/api/packs` response shape does not include `playgroundScenarios`** as of this DP. The Playground.tsx `TODO(Step 5)` scope is narrowed to catalog+userActions replacement only; scenario listing is resolved separately (Option A/B/C per C5 condition). Any choice is acceptable — it must be documented before Phase C.

7. **`getToolsForAgent(agentName)` is required on #476 PackRegistry.** Open question §8.1 asks only about skills. The runner's per-turn Agent construction also needs `getToolsForAgent`. If missing from #476, file as an addendum before Phase A+B starts.

## Conditions on implementation

- C1: Confirm `getToolsForAgent(agentName)` on #476 PackRegistry (Phase A+B gate)
- C2: Spec `runner.ts` to forward `a2uiEmissions` immediately (Phase B gate)
- C3: Drop `resultSchema` from `SessionCtx.pendingUserAction` (Phase C gate)
- C4: Address `useNavigation.ts` + `onIntent` wiring (merge gate)
- C5: Clarify playground scenario listing in `/api/packs` (Phase C gate)
- Zapp Critical 1-3: session ownership check, resultSchema validation, playground env gate (merge gate, Zapp-owned)
