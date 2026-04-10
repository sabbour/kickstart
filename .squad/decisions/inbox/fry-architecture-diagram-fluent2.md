# Decision: ArchitectureDiagram Fluent 2 Theme & Auto-sizing

**Author:** Fry  
**Date:** 2026-07-18  
**Status:** Implemented

## Context

ArchitectureDiagram used Mermaid's `neutral` theme with a fixed 400px viewport, producing tiny diagrams that didn't match Fluent 2 visuals.

## Decision

1. **Mermaid `base` theme with Fluent 2 `themeVariables`** — hardcoded hex values (not runtime tokens) since Mermaid config is static.
2. **SVG post-processing** — icon injection via keyword matching on node labels, rounded corners, thin strokes, flat styling.
3. **Auto-sizing viewport** — 300–800px range based on SVG natural dimensions.
4. **Fit-and-center** — diagram scales to fit container width and centers on render; reset button re-fits instead of going to 1:1.

## Rationale

- `theme: 'base'` gives full color control; `neutral` ignores `themeVariables`.
- Post-processing is necessary because Mermaid has no native icon support.
- Auto-sizing prevents the "tiny diagram in a big box" problem and avoids scroll for small diagrams.
