---
"@aks-kickstart/web": patch
---

fix: block pointer events on inactive (past-turn) A2UI surfaces (#438)

Past-turn surfaces were visually dimmed with `opacity: 0.5` but still received pointer events, allowing users to click on disabled surfaces (e.g. KAITO model selection) and trigger a re-selection loop.

Added `pointerEvents: 'none'` alongside `opacity: 0.5` on the `A2UISurfaceWrapper` container div when `isActive === false`. Active surfaces are unaffected.
