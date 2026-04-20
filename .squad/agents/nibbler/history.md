# Nibbler — History

## Project Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, OpenAI Agents SDK
- **Architecture:** Harness + Packs model (v2). See `docs/v2-implementation-brief.md`
- **User:** sabbour
- **Joined:** 2026-04-18

## Learnings

### 2026-04-18: Onboarding context

- Team runs at 34 PRs/day velocity — reviews must be fast and decisive
- Retro analysis revealed "review time" was mostly Copilot PR reviewer bot latency (sequential passes 30-90 min apart), not human design debates
- Review gate (#427) uses label-based approval: `leela:approved`, `zapp:approved` — adding `nibbler:approved`/`nibbler:rejected`
- Bot identities: `sabbour-squad-lead[bot]`, `sabbour-squad-frontend[bot]`, `sabbour-squad-backend[bot]`, `sabbour-squad-tester[bot]`
- Key files: `.squad/decisions.md` (team decisions), `docs/v2-implementation-brief.md` (architecture brief)
- Pack boundaries are sacred — changes blurring two packs are flagged
- Zero rework target — catch issues in review so PRs merge on first cycle
