# Squad Team

> Kickstart — AI-guided onboarding experience for deploying apps to AKS. v2 runs on `@openai/agents` SDK with a harness + packs architecture. See [`docs/v2-implementation-brief.md`](../docs/v2-implementation-brief.md).

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Leela | Lead | `.squad/agents/leela/charter.md` | ✅ Active |
| Fry | Frontend Dev | `.squad/agents/fry/charter.md` | ✅ Active |
| Bender | Backend Dev | `.squad/agents/bender/charter.md` | ✅ Active |
| Hermes | Tester + Observability | `.squad/agents/hermes/charter.md` | ✅ Active |
| Zapp | Security Architect | `.squad/agents/zapp/charter.md` | ✅ Active |
| Scribe | Scribe + Product/DX | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | - | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — (adopts persona from `squad:{member}` label) | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation (new pack skeletons, new skill scaffolds)
- Documentation fixes, `docs-site/docs/` updates, changeset additions
- Release notes curation (as Scribe persona)

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- New SDK tools with narrow schemas (Zapp reviews)
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Changes to pack boundaries or primitive surface
- SSE event taxonomy or A2UI contract changes
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control, guardrail design)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Issue Source

- **Repository:** sabbour/kickstart
- **Project Board:** https://github.com/users/sabbour/projects/3
- **Connected:** 2026-04-08
- **Assign to:** person running the Squad commands

## Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Kickstart — AI-guided onboarding for AKS
- **Stack:** TypeScript, React, Fluent UI v9, `@openai/agents` SDK, Azure/AKS, Bicep, Vite, Playwright, Vitest, Changesets
- **Architecture:** harness + packs (`@kickstart/harness`, `pack-core`, `pack-azure`, `pack-aks-automatic`, `pack-github`)
- **Description:** A web experience that guides developers from app idea to production deployment on AKS Automatic, without requiring Kubernetes expertise
