# Kickstart AKS Development Extension

Codifies development workflows for **Kickstart** — an AI-guided AKS onboarding app built as a monorepo with npm workspaces (`@kickstart/core`, `@kickstart/web`, `@kickstart/mcp-server`).

Extracted from 200+ team decisions, 13 inbox proposals, 4 ceremonies, and 1 existing skill accumulated over the project's development lifecycle.

## Install

```
squad plugin install github/sabbour/kickstart-aks-dev-extension
```

## What's Inside

### Skills

| Skill | Description |
|-------|-------------|
| **pr-workflow** | Full issue → branch → PR → review → merge lifecycle, including project board updates, Design Proposal process, and review gates |
| **release-process** | Changesets-based monorepo versioning, changelog generation, tag-triggered SWA deploys |
| **swa-deployment** | Azure Static Web Apps deployment patterns — CSP, build metadata stamping via Vite `define`, slot strategy |
| **debug-mode** | Debug metadata convention for SSE endpoints — activation, payload shape, frontend/backend contract |
| **a2ui-components** | A2UI custom component patterns — fat components, progressive rendering, Fluent 2 compliance, accessibility |
| **testing-strategy** | Playwright E2E + Vitest unit testing, validation engine patterns, rules registry |

### Ceremonies

| Ceremony | Description |
|----------|-------------|
| **design-review** | Pre-implementation architecture + security review of Design Proposals on issues |
| **retrospective** | Post-failure and post-sprint retrospectives with root cause analysis and velocity tracking |
| **sprint-planning** | MMM-aligned sprint planning with milestone roadmaps and capacity estimates |

### Directives

| Directive | Description |
|-----------|-------------|
| **project-conventions** | Consolidated user preferences: branching, deployment, process, tooling, and team rules |

## Conventions Summary

- **Branch naming:** `squad/{issue-number}-{kebab-case-slug}`
- **Releases:** Tagged releases (`v*`) deploy to SWA production; main = pre-prod
- **Model:** Claude Opus 4.6 for all code-writing work
- **PRs:** Always draft first, squash-merge, delete branch
- **Design:** DP comment on issue before code; Leela (architecture) + Zapp (security) approve
- **Testing:** Playwright E2E required for all feature work
- **Work tracking:** GitHub Issues is the source of truth; post major findings as comments
