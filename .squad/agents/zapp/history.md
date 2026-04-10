# Zapp — Security Architect History

## Core Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, Azure Static Web Apps, Azure OpenAI
- **Owner:** Ahmed Sabbour
- **Joined:** 2026-04-10

## Learnings

- 2026-04-10: Pre-v0.3.0 security audit completed. Highest-risk patterns were frontend HTML injection paths (`dangerouslySetInnerHTML`) and public AI endpoints lacking auth/throttling.
- 2026-04-10: `/api/converse` currently exposes full system prompts to clients on new sessions; treat system prompts as sensitive control-plane data.
- 2026-04-10: Security hardening backlog now tracked in Security milestone issues #81-#88 with severity and OWASP mapping.
