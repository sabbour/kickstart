---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/harness": minor
"@aks-kickstart/web": patch
---

Introduce TrackPicker A2UI component for equal-weight choice surfaces;
replace DecisionCard in triage track selection (#22).

### Changes

1. **New TrackPicker component** — A2UI catalog component that presents
   tracks as equal-weight tiles with no recommendation bias. Schema:
   `{ title, tracks: [{ id, label, description, icon? }] }`. Each tile
   fires `pick_track` event with `context.value = track_id`.

2. **emit_ui schema** — TrackPicker variant added to the discriminated
   union (strict, with `.nullable()` icon field for OpenAI strict mode).

3. **Triage prompt rewrite** — Agent emits a single `TrackPicker` instead
   of `DecisionCard` + 4 `Button` components. Simpler exemplar, fewer
   components per surface.

4. **DecisionCard unchanged** — Remains in the catalog for decision-review
   use cases. No longer used in triage track selection.

5. **E2E test updated** — `phase-a-triage-decision-card.spec.ts` asserts
   `TrackPicker` tiles render with `data-testid="a2ui-TrackPicker"`.
