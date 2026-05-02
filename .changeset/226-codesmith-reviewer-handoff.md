---
'@aks-kickstart/pack-core': patch
---

Add formal `core.codesmith` → `core.reviewer` handoff so Codesmith can hand the conversation to the Reviewer for sign-off after generation, complementing the existing in-band asTools consultation. Docs (`docs-site/docs/extending/runner-chain.md`) reconciled to clarify that explicit `handoffs:` intent and `runWithGate` enforcement are complementary — the gate guarantees review regardless of whether the handoff is taken (#226).
