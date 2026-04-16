# Decision: Playground Tab Grouping + Offline Mode Banner Removal

**Date:** 2026-04-16  
**Author:** Fry (Frontend Dev)

---

## 1. GitHub Components and Azure Components belong in the Components tab

**Decision:** `'GitHub Components'` and `'Azure Components'` are moved from `GALLERY_GROUPS` to `COMPONENT_GROUPS` in `packages/web/src/pages/Playground.tsx`.

**Rationale:** The **Ideas** tab is for mashups and demo scenarios (multi-phase flows, file operations, cost estimates, etc.). The **Components** tab is for built-in and catalog-supplied UI components. GitHub and Azure components are catalog components — they belong alongside Layout, Content, Inputs, and Custom Controls, not alongside scenario demos.

---

## 2. Offline mode banners removed from all catalog components

**Decision:** The "Running in offline mode — …" `Caption1` banners are removed from:
- `AzureLoginCard.tsx`
- `GitHubAction.tsx`
- `AzureAction.tsx`
- `AzureResourceForm.tsx`
- `GitHubLoginCard.tsx`
- `AuthCard.tsx`

**Rationale:** In playground mode, stub behavior is automatic and silent by design — there is no need to surface it to users. In production, a real connector is always injected, so the `!connector` condition would never be true. There is no meaningful scenario where showing "offline mode" provides value to end users. Silent stub operation is the established pattern for playground components.
