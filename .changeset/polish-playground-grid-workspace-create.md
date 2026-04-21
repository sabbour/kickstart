---
"@aks-kickstart/web": patch
---

Playground visual/UX polish:

- **Components tab grid:** Tightened responsive grid to `minmax(260px, 1fr)` with a 320px card cap so wide viewports show 4–5 cards per row instead of 8. Pack sections where every component lacks a registered preview (e.g. `azure`, `aks`, `github`) now render as compact chip-style cards (~88px) with a single explanatory banner, replacing the previous wall of empty "No preview available" placeholders.
- **Workspace tab:** Added a `fillContainer` prop to `FileViewer` so the Playground Workspace editor fills the full width (and height) of its pane instead of being clamped to the 45% chat-side-panel sizing. Eliminates the large black void that previously appeared to the right of the editor.
- **Create tab composer:** Aligned the Create tab's chat input with the main chat composer — `borderRadiusLarge`, matching padding, stroke-1 border, `fontSizeBase300`/`lineHeightBase300` text, and the same `ArrowRight` send icon. The Create page now reads as a sibling chat entry point instead of a bespoke hero input.
