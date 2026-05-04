---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/pack-aks-automatic": patch
---

feat: enforce RadioGroup/confirm for binary/limited-choice questions

Add a hard rule to `core.triage` and `aks.architect` charters prohibiting plain-prose
questions when the user must choose from 2–4 known options:

- `core.confirm` for yes/no or confirm/cancel questions
- `core.show_form` with `RadioGroup` for 2–4 option questions
- Plain text only for genuinely open-ended answers

Update `aks.architect` revise-plan handler and quota/ingress prompts to use `core.confirm`
instead of prose confirmations.

Fixes #437.
