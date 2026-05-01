---
sidebar_position: 2
---

# Prompt Pipeline

Every conversation turn dynamically assembles agent instructions before calling the LLM. The pipeline lives in `packages/harness/src/runtime/runner.ts` (`Runner.run`) and `packages/harness/src/runtime/skill-resolver.ts`.

---

## Inputs

`Runner.run(session, userMessage, sseWrite, signal?, runConfig?)` consumes:

- `Session` (`runtime/session.ts`) — `activeAgent`, `recentTurns`, `a2uiEmissions`, `artifacts`, `pendingUserAction`, `responseId`, per-turn skill counters.
- `userMessage` (string).
- `SSEWriter` (`(event, data) => void`).
- Optional `AbortSignal` (forwarded into the runner's internal `AbortController`).
- Optional `RunConfig` (`runtime/run-config.ts`) — `onHandoff`, `handoffInputFilter`, etc.

---

## Steps

1. **`start` SSE frame** with `{ sessionId }`.
2. **Plan-artifact gate**: agents in `PLAN_REQUIRED_AGENTS` (currently `core.codesmith` and the architects) throw a fixed-copy `PlanArtifactMissing` Card if `session.artifacts.has('plan') === false`. The raw error is logged to telemetry only, never to SSE.
3. **Agent lookup**: `registry.getAgent(activeAgent)` returns the `AgentContribution` (`packages/harness/src/types/agent.ts`).
4. **Skill resolution**: `resolveSkills()` (`runtime/skill-resolver.ts`) selects skills whose `appliesTo` globs match the active agent (`runtime/skill-matcher.ts`), then greedily fits them within a token budget using `fitSkillsInBudget()` and `estimateTokens()` (`runtime/token-budget.ts`, ~4 chars/token approximation). Oversized skills are skipped, never truncated.
5. **Instruction assembly**: the agent's `instructionsBase` (loaded from the body of `<pack>/agents/<agent>.agent.md`) is concatenated with the rendered skill blocks (each wrapped as `<skill name="…">…</skill>`).
6. **Tool surface**: `registry.getToolsForAgent(name)` returns only tools listed in the agent's `tools:` frontmatter (`toolAllowlist`). Tools never leak across allowlists.
7. **Guardrail wiring**: input and output `GuardrailContribution` instances whose `appliesTo` matches the agent are wrapped via `toSdkInputGuardrail` / `toSdkOutputGuardrail` and attached to the SDK agent. Tool-stage guardrails stay on the sequential `runGuardrails()` path because the SDK has no tool-arg hook (see `runtime/guardrails.ts` header).
8. **History threading**: `session.recentTurns` is fed into `runInput`. The current user turn is recorded *before* the SDK run so the model sees it; if input guardrails tripwire, the turn is popped in the catch handler (the "guardrail-on-capture" rule, #1062 Z2 in `runner.ts`).
9. **SDK invocation**: the OpenAI Agents SDK runs with the assembled instructions, allowed tools, parallel guardrails, and a `responseId` for thread continuity (#114 Phase 3 in `runner.ts`).
10. **Per-turn drains**: each LLM tool_call drains `session.a2uiEmissions` *after* the tool finishes (the post-tool A2UI drain rule), then emits queued frames as `a2ui` SSE events. This is what guarantees A2UI never overtakes the tool that produced it.
11. **Termination**: `end` is emitted with skill counters (`skillsExecuted`, `skillsPulledBytes`, `skillsPulledTokens`) and `toolsExecuted`. Per-turn counters are reset in a `try/finally` so they never leak across turns on abort or thrown errors.

---

## Skill resolution rules

- Skills live at `packages/<pack>/src/skills/<slug>/SKILL.md`.
- Frontmatter: `name`, `description`, `version`, `x-kickstart.appliesTo[]` (agent-name globs), `x-kickstart.keywords[]`, `x-kickstart.priority` (higher first).
- `appliesTo` patterns are validated at registration: shell metacharacters (`;|&$\``) are rejected (`runtime/skill-matcher.ts`).
- Empty or absent `appliesTo` matches all agents. `*` is a short-circuit C1 fast-path.

---

## Token budget

`fitSkillsInBudget(skills, budgetTokens)` is greedy: it iterates by priority order, costs each skill as its rendered block (header + body), and **skips** skills that would overshoot rather than breaking. This means a small high-value skill ranked after a large one still gets included.

Default per-turn skill-pull byte cap is configured via `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN` and enforced inside `core.read_skill`.

---

## What the model sees

A typical turn payload:

```
<system>
{instructionsBase}
<skill name="teach-then-ask">…</skill>
<skill name="a2ui-output-discipline">…</skill>
…
</system>
<user>{guardrail-sanitized userMessage}</user>
{recent prior turns from session.recentTurns}
```

There is no fixed "phase prompt" injected at the top. Phase is owned by the agent's instructions and the `phase` SSE event is emitted by the runner only on handoff transitions.
