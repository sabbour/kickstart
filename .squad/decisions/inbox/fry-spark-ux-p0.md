# Decision: Spark UX P0 patterns

**Date**: 2025-07-24
**Author**: Fry
**Status**: Accepted

## Context
Implemented 4 Spark UX P0 items to align Kickstart with GitHub Spark's feel.

## Decisions
1. **Hero input** lives above the carousel inside `.landing-inner`; reuses `pendingQuickPrompt` → `transitionToChat()` flow.
2. **File chips** use event delegation (not direct listeners) because A2UI renders to `outerHTML` strings which strips DOM events.
3. **Sparkle loader** replaces typing dots; `setTyping(val, phase)` is backward-compatible (phase optional).
4. **Preview panel** reuses `#file-viewer` aside — adds a header overlay and body div; the file-viewer's own header is hidden via CSS. Phase→title mapping in `PREVIEW_TITLES`.
5. Both engine creation paths (API + demo) wire identical `onPhaseChange` + `onResponse` callbacks for preview panel updates.
