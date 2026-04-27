---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/web": minor
---

feat: triage one-question-at-a-time and lazy component catalog loading (#110, #113)

**#110 — Triage one-Q-at-a-time:** Replace form-dump triage with a single-question-per-turn policy. The triage agent now asks one question at a time, re-evaluates routing after each answer, and hard-caps at 3 questions before forced routing. Multi-field Questionnaire emission is replaced by sequential prose questions starting with the highest-discriminating-value gap.

**#113 — Lazy component catalog:** Rich catalog components (AuthCard, TrackPicker, CodeBlock, FileEditor, etc.) are now registered via `createLazyRegistration()`. Each component's module is code-split by Vite into its own chunk and only downloaded when first rendered. A Fluent UI v9 Skeleton fallback is shown while the chunk resolves.
