---
"@aks-kickstart/harness": minor
"@aks-kickstart/pack-core": patch
---

Wire agent frontmatter `handoffs:` into the `@openai/agents` SDK so declared
handoffs are actually executable (closes #1073, audit defects D2 / D7 / D14).

### What changed

- `Runner.run()` now builds the per-turn `Agent` via a new private helper
  `buildAgentInstance(agentName, cache, ctx)` that recursively resolves
  each `handoffs[].agent` into an SDK `handoff(target, { toolDescriptionOverride })`
  call. The frontmatter `label` (+ optional `prompt`) becomes the model-
  visible description.
- The helper uses a per-turn `Map<agentId, Agent>` cache. The Agent is
  inserted into the cache BEFORE recursing into its targets, so mutual
  handoff references (A↔B / self-handoff A→A) terminate instead of
  blowing the stack. A fresh Map is used per turn so tool closures
  (`session`, `sseWrite`, `abortCtrl`) never leak across turns.
- `PackRegistry.seal()` now validates every active agent's
  `handoffs[].agent` target: unknown targets or cross-pack targets throw
  with an error message that contains the pack, agent, and target tokens
  so debugging is a single grep (Nibbler N6, Zapp Z1). Cross-pack
  handoffs are deferred until the trust model is reviewed — out of scope
  for this PR.
- `Runner.run()` now passes an explicit `maxTurns` to
  `sdkRunner.run()` so mutual handoffs cannot ping-pong to token
  exhaustion (Zapp Z2). Default is `10`, overridable via
  `KICKSTART_RUNNER_MAX_TURNS`.

### User-visible

- Triage → Codesmith and Triage → Reviewer handoffs declared in
  `packages/pack-core/src/agents/triage.agent.md` now actually fire at
  runtime. The previously-unreachable `handoff_occurred` /
  `agent_updated_stream_event` handlers in the runner emit `phase`
  SSE events and update `session.activeAgent`.
- Starting the server with a pack that declares a broken handoff target
  now fails loudly at `seal()` instead of silently swallowing it.

### Deferred

- **Cross-pack handoffs** — rejected at seal() for now. Will ship behind
  a Zapp-gated issue once the trust model (depth caps, post-handoff
  output-guardrail re-run, per-pack tier policies) is designed.
- **Real end-to-end Playwright regression** — repo's Playwright suite is
  UI-only with no LLM driver. The multi-turn triage→codesmith flow is
  covered by harness unit tests (per-turn isolation, cycle-break,
  tool-name shape) instead. A stubbed `sdkRunner.run` integration test
  is tracked as a follow-up.

### Env flags added

- `KICKSTART_RUNNER_MAX_TURNS` — integer cap on the SDK agent loop per
  turn. Defaults to 10; invalid / non-positive values fall back to the
  default.
