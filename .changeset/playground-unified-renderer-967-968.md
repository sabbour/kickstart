---
"@aks-kickstart/web": patch
---

feat(playground): unify A2UI renderer with chat, add component JSON view, fix remaining error components

- Extract `A2UIEnvelopePreview` component — the canonical "render these static A2UI descriptors" primitive. Uses the same `useA2UI` → `A2UISurfaceWrapper` pipeline as the Chat renderer. ComponentCard now delegates to this instead of duplicating the surface-creation lifecycle.
- ComponentCard is now clickable and opens a detail dialog with Preview / JSON tabs (Fluent TabList). JSON tab shows the A2UI descriptor array with 2-space indent and a copy-to-clipboard button.
- 401 error state in Gallery and Components tabs now shows a "Sign in to view components/scenarios" message instead of a generic error bar, with a reference to #955.
- Regression guard added to `component-examples.test.ts`: `validateAndSanitizeComponents` must produce zero `_ErrorComponent` descriptors for every `COMPONENT_PREVIEWS` entry — the same path that fires at render time inside `A2UIEnvelopePreview`.

Closes #967
Closes #968
References #955
