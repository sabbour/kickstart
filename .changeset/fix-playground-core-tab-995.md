---
'@aks-kickstart/web': patch
---

fix(web/playground): Core components tab density + preview coverage (#995)

#986 tightened the component grid but left two regressions on the Core tab:

- The grid still produced 6+ cards/row at 1920px viewports (target was 4–5).
- Several core basic components (Video, AudioPlayer, Tabs, Modal, Accordion)
  had no entries in `COMPONENT_PREVIEWS`, so the Core tab showed "No preview"
  placeholders alongside real preview cards.

This patch:

- Adds preview entries for Video, AudioPlayer, Tabs, Modal, Accordion so
  every shipped core basic component renders a live preview.
- Lifts the minimum column width (`260px` → `300px`), relaxes the per-card
  cap (`320px` → `380px`), and promotes the grid gap to `spacingVerticalL`
  so the grid hits 4–5 cards/row at 1280/1440/1920px.
- Adds a minimum preview-card height so live previews render with legible
  vertical room.
- Extracts geometry into `playground-layout-constants.ts` so the CSS and
  the Playwright / unit assertions share a single source of truth.
- Adds a unit-test regression guard for Core preview coverage + grid
  density, plus Playwright assertions on card dimensions and preview
  visibility using the same named constants.

Layout-only change. No schema, guardrail, or sandbox surface touched.
