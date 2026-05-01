---
"@aks-kickstart/web": patch
---

Test-only: fix the phase-c codesmith generation Playwright spec so the
secondary `shared:generation-summary` surface actually renders a real
publish button.

The spec was sending `appearance: 'primary'` on its `Button` envelope.
The catalog's Button schema is strict v0.9 and only accepts `variant`
(see `packages/web/src/catalog/fluent-components/Button.tsx`), so
`validateAndSanitizeComponents` rejected the unknown key and replaced
the descriptor with `_ErrorComponent`. That left no real `<button>` for
`getByRole('button', { name: /publish/i })` to find, and phase-c kept
failing even after #326 added the GenerationProgress test hook.

Switching the spec to the spec-correct `variant: 'primary'` makes the
publish button render and keeps the visible UX unchanged. Closes #329.
