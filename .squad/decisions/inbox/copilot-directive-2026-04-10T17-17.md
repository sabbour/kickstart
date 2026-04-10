### 2026-04-10T17:17Z: Scope clarification — Leela vs Zapp
**By:** Ahmed Sabbour (via Copilot)
**What:** Clarify the handoff between Leela (Lead) and Zapp (Security Architect):
- **Leela** owns architecture DESIGN: abstractions, interfaces, patterns, dependencies, scope decisions. She decides WHAT to build and HOW it fits together.
- **Zapp** owns SECURITY REVIEW: threat modeling, auth patterns, input validation, secrets, compliance. He reviews for safety AFTER the design is set.
- **Handoff:** Leela designs → Zapp reviews for security concerns → implementation proceeds. Zapp does NOT review general architecture quality (that's Leela's domain). Zapp ONLY flags security/safety risks.
- **Pre-merge gate:** Zapp reviews PRs for security concerns only. Leela reviews PRs for architecture quality only. Both gates apply to foundational patterns (#25, #30, #26). For routine issues, only the relevant gate applies.
**Why:** User directive — role overlap was causing confusion. Leela and Zapp were both doing architecture reviews, duplicating effort and creating unclear ownership.
