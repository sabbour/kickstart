### Decision: A2UI Component Accessibility Patterns
**Author:** Hermes (Tester)
**Date:** 2026-07-27
**Issue:** #43
**PR:** #124
**Status:** Implemented

**Context:** WCAG 2.1 AA audit revealed that the A2UI schema defines `accessibility.label` and `accessibility.description` on all components via CommonProps, but no component consumed these props. Additionally, custom interactive components (RadioGroup, ProgressSteps) lacked keyboard navigation and semantic roles.

**Decisions:**

1. **accessibility.label passthrough** — All components that render standalone elements (Icon, Image, Video, AudioPlayer, List) must read `props.accessibility?.label` and apply it as `aria-label`. Decorative elements default to `aria-hidden="true"`.

2. **Custom interactive components use WAI-ARIA patterns** — RadioGroup uses the roving tabIndex pattern (first item tabIndex=0, rest -1, arrow keys cycle). ProgressSteps uses semantic `<ol>/<li>` with `aria-current="step"`.

3. **Dynamic content needs `aria-live`** — Components that update in real-time (DeploymentProgress, SteppedCarousel content area) must include `aria-live="polite"` regions.

4. **Form label association** — All form components must connect labels to inputs via `htmlFor`/`id`. Required fields use `aria-required` and decorative asterisks are `aria-hidden="true"`.

5. **External link context** — Links opening in new windows must include visually-hidden "(opens in new window)" text and `aria-hidden="true"` on the external icon.

**Impact:** All future A2UI components must follow these patterns. The a11y test suite (`packages/web/src/__tests__/a11y-components.test.ts`) validates these patterns statically.
