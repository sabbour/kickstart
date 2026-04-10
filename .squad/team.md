# Squad Team

> Kickstart — AI-guided onboarding experience for deploying apps to AKS

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
| Hermes | Tester | `.squad/agents/hermes/charter.md` | ✅ Active |
| Zapp | Security Architect | `.squad/agents/zapp/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
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
- **Stack:** HTML/CSS/JS (Portal Prototyper), TypeScript, Azure/AKS, AI/LLM
- **Description:** A web-based experience that guides developers from app idea to production deployment on AKS Automatic, without requiring Kubernetes expertise
- **Created:** 2026-04-08
