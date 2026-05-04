---
'@aks-kickstart/web': patch
---

Internal: add `data-testid` and `data-step` hooks on A2UI catalog components (`SummaryCard`, `GenerationProgress`, `CodeBlock`) so end-to-end tests can deterministically locate them after the chat surface re-renders. Also scopes Phase B architect-summary spec locators to the rendered surface to prevent strict-mode collisions with assistant chat narration. No user-visible behaviour changes.
