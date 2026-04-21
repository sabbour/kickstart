---
"@aks-kickstart/web": patch
---

Fix AKS compositions falling back to `_ErrorComponent` when the composition skill-chain emits bare pack names or the legacy `type` alias (issue #996).

`validateAndSanitizeComponents` (shared with PR #1000) now runs a narrow coercion step before validation:

- `type` is accepted as a legacy alias for `component` when `component` is absent.
- A bare component name (e.g. `AksClusterCard`) is rewritten to its pack-qualified form (e.g. `aks/AksClusterCard`) when exactly one pack exposes that suffix — ambiguous suffixes (e.g. shared across `aks/*` and `azure/*`) are left untouched so the validator rejects them.

The coercion is pre-processing only. The Zod-schema trust boundary (the real rail from PR #989/#1000) is unchanged — malformed payloads still fall back to `_ErrorComponent` and the structured log names only the offending component, never the surrounding composition payload.
