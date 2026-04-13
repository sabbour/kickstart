### Decision: Progressive Component Rendering Pattern
**Author:** Fry (Frontend Dev)
**Date:** 2026-07-27
**Status:** Implemented
**PR:** #126
**Issue:** #40

**Context:** Components were rendered all at once after the LLM response completed, creating a jarring UX.

**Decision:**
1. **Timer-based progressive queue** — `useProgressiveQueue` hook sits between `onA2UI` and render state. Incoming surface IDs are queued and revealed one-at-a-time with a 150ms stagger delay. This pattern is independent of the streaming source (works for both mock and real SSE).

2. **Mock streaming stagger** — `sendMock()` emits each surface's A2UI message pair individually with 200ms delays, rather than dumping all at end. Groups by `createSurface` boundaries.

3. **CSS stagger via `--enter-index`** — Each component receives a `--enter-index` CSS custom property. Animation delay is `calc(var(--enter-index) * 60ms)`. This is the standard approach for any future animated component entry.

**Impact:** Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` for consistent progressive appearance.
