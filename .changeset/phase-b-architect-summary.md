---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/pack-azure": minor
"@aks-kickstart/pack-aks-automatic": minor
"@aks-kickstart/web": patch
---

Unlock SummaryCard + ArchitectureDiagram in `core.emit_ui` schema and wire
architect agents to present a plan summary with approve/revise loop
(#1113 Phase B of #6).

### Changes

1. **emit_ui schema unlock** — The discriminated union now includes 2 new
   registry-derived variants (SummaryCard, ArchitectureDiagram) with strict
   schemas from `rich-component-schemas.ts`. Both use `.strict()` — no
   `.unknown()` fallbacks.

2. **Catalog injection — prop-aware llmHint** — Full exemplar hints added
   for SummaryCard, ArchitectureDiagram, and Card. Each hint includes
   complete props documentation and a rendered JSON exemplar so the LLM
   knows exactly how to compose them.

3. **SummaryCard children slot** — Both pack-core and web SummaryCard
   components now accept an optional `children` prop (array of component
   IDs) rendered below the items grid, enabling composition with
   ArchitectureDiagram and action buttons.

4. **Architect agent prompts** — `azure-architect.agent.md` and
   `aks-architect.agent.md` rewritten with plan summary exemplars, action
   routing table for `approve_plan` / `revise_plan`, and handoff to
   `core.codesmith` on approval.

5. **UserAction routing** — `approve_plan` and `revise_plan` are handled
   via the existing `[A2UI event]` marker mechanism; action names are
   constrained to a known set per Zapp's enum/literal union guidance.

### Token cost of enriched catalog

Baseline catalog block: ~250 tokens (3 Phase A components with llmHint).
Enriched catalog block: ~550 tokens (6 components with llmHint).
Delta: +300 tokens per agent system prompt. Well under the 5KB limit.

### Test coverage

- 7 new unit tests in `emit_ui.test.ts` (valid + strict-rejection for
  SummaryCard and ArchitectureDiagram, plus composition test)
- Playwright E2E: `phase-b-architect-summary.spec.ts` (render + revise
  in-place)

Closes #6.
