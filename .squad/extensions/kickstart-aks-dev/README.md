# Kickstart AKS Development Extension

Codifies development workflows for **Kickstart** — an AI-guided AKS onboarding app built on the `@openai/agents` SDK. Two-layer architecture: `@kickstart/harness` (runtime glue) plus packs (`pack-core`, `pack-azure`, `pack-aks-automatic`, `pack-github`). Design north star: [`docs-site/docs/architecture/v2-implementation-brief.md`](../../../docs-site/docs/architecture/v2-implementation-brief.md).

## Install

```
squad plugin install github/azure-management-and-platforms/kickstart-aks-dev-extension
```

## What's Inside

### Skills

| Skill | Description |
|-------|-------------|
| **pr-workflow** | Issue → DP → branch → draft PR → review → merge lifecycle, with project board updates and review gates |
| **pack-authoring** | Rules for adding/modifying Pack, Agent, Skill, Tool, UserAction, Component, Guardrail |
| **a2ui-components** | A2UI streaming contract (`core.emit_ui`), component manifests, progressive rendering, Fluent v9 compliance |
| **testing-strategy** | Four-layer testing: unit, pack conformance, contract, Playwright E2E |
| **release-process** | Automated daily cadence via `.github/workflows/squad-release-cadence.yml`, changesets, release-notes curation |
| **swa-deployment** | Pre-prod SWA from `main`, CSP, OIDC, Vite `define` build metadata |
| **debug-mode** | Debug metadata convention for SSE endpoints, opt-in, backward-compatible |
| **docs-changelog** | Pre-merge docs + changeset contract, updates the brief and the docs-site in the same PR |
| **continuous-improvement** | Data loop: per-PR metrics → daily pulse → weekly pulse → `process` issues |

### Ceremonies (all automated, see `.squad/ceremonies.md`)

| Ceremony | Trigger | Workflow |
|----------|---------|----------|
| **design-review** | DP comment on issue | in-session, facilitated by Leela |
| **retrospective** | per PR (auto), on failure (ad-hoc), weekly (auto) | `squad-pr-retro.yml`, `squad-weekly-pulse.yml` |
| Daily Pulse | 17:00 Pacific daily | `squad-daily-pulse.yml` |
| Weekly Pulse | Monday 17:00 Pacific | `squad-weekly-pulse.yml` |
| Release Cadence | 17:00 Pacific daily | `squad-release-cadence.yml` |

### Directives

| Directive | Description |
|-----------|-------------|
| **project-conventions** | Branching, deployment, docs, changelogs, releases, testing, security, UI standards |

## Conventions Summary

- **Architecture:** harness + packs; no domain logic in the harness; A2UI streams through `core.emit_ui`
- **Branch naming:** `squad/{issue-number}-{kebab-case-slug}`
- **Releases:** `main` deploys the pre-prod SWA; tags (`v*`) mark versioned releases
- **Model:** Claude for code-writing, GPT-5 class for Zapp and stuck architecture calls
- **PRs:** Always draft first, squash-merge, delete branch
- **Design:** DP comment on issue before code; Leela (architecture) + Zapp (security) approve
- **Testing:** four layers (unit, pack conformance, contract, Playwright E2E); all required
- **Work tracking:** GitHub Issues is the source of truth; post major findings as comments
- **Docs:** every user-facing PR updates `docs-site/docs/` and adds a changeset
