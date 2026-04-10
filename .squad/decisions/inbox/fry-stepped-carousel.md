# Decision: SteppedCarousel component pattern

**Author:** Fry  
**Date:** 2026-07-18  
**Status:** Implemented  

## Context
Needed a wizard-style alternative to FormGroup for multi-step flows where showing all steps at once is overwhelming.

## Decision
Created `SteppedCarousel` as a custom A2UI component using the same `createReactComponent` pattern. Key choices:
- **Client-side state only:** Step navigation is purely `useState` — no server round-trip needed for step changes.
- **Child-based content:** Each step references a `child` ComponentId, same delegation pattern as FormGroup. This means step content is composable from any A2UI components.
- **No animation:** Simple content swap keeps it lightweight and avoids CSS transition complexity.

## Impact
New component available in kickstart catalog. No breaking changes to existing components.
