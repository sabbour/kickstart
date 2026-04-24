---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/harness": minor
"@aks-kickstart/web": patch
---

Unlock DecisionCard, RadioGroup, and Questionnaire in the `core.emit_ui` tool
schema and wire the triage agent to present a 4-track deployment picker on
first turn (#1130 — Phase A of #1113).

### Changes

1. **emit_ui schema unlock** — The hand-coded 26-variant Zod discriminated
   union now includes 3 registry-derived variants (DecisionCard, RadioGroup,
   Questionnaire) with strict schemas from the new
   `packages/pack-core/src/schemas/rich-component-schemas.ts`. All three use
   `.strict()` — no `.unknown()` fallbacks (Zapp advisory).

2. **Catalog injection — prop-aware llmHint** — The system prompt catalog
   block now shows an `llmHint` one-liner for components that provide one
   (DecisionCard, RadioGroup, Questionnaire), so the LLM knows HOW to use
   each component, not just its name.

3. **AgentOutput.message optional** — Triage can now emit surface-only turns
   (just a DecisionCard, no chat bubble). `resolveOutputText()` returns `''`
   when no message field is present.

4. **useA2UI surfaceId fix** — `updateComponents` messages now push their
   `surfaceId` into the returned array so the client knows which surface was
   updated (required for in-place DecisionCard → RadioGroup swap).

5. **Triage prompt rewrite** — 4 tracks (static site, containerized web,
   agentic AI, existing repo uplift), Foundry vs KAITO sub-branch for the
   agentic track, exemplars for DecisionCard emission, UserAction
   closed-loop for `pick_track` and `select_inference`.

6. **UserAction wiring** — `pick_track` and `select_inference` are handled
   via the existing `[A2UI event]` marker mechanism; no new UserAction
   contribution needed.

### Token cost of enriched catalog

Baseline catalog block: ~80 tokens (40 component names, comma-separated).
Enriched catalog block: ~250 tokens (3 components with llmHint, 37 name-only).
Delta: +170 tokens per agent system prompt. Well under the 5KB OpenAI
strict-mode schema limit.

### Test coverage

- 7 new unit tests in `emit_ui.test.ts` (valid + strict-rejection for all 3)
- 3 new tests in `agent-output.test.ts` (optional message)
- 1 updated test in `runner.test.ts` (resolveOutputText surface-only)
- Playwright E2E: `phase-a-triage-decision-card.spec.ts`

Closes #1130.
