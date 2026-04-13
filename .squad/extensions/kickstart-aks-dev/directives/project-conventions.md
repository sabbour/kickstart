# Project Conventions

Consolidated user directives and team rules for Kickstart development.

---

## Branching & PRs

- **Branch naming:** `squad/{issue-number}-{kebab-case-slug}` (e.g., `squad/42-fix-login-validation`)
- **No direct pushes to main** — all work goes through PRs
- **Always open as draft** — never open a ready PR directly
- **Always rebase** when behind main — never merge commits
- **Squash-merge and delete branch** on merge

## Deployment

- **Deploy from tagged releases only** — no auto-deploy on main merge to production
- **Main branch = pre-prod** — staging environment for validation
- **Tagged releases (`v*`) = production** — triggers SWA deploy workflow
- **Investigate SWA slots** for pre-prod/prod separation when available
- **Infra/docs deploys** trigger on push to main (path-scoped, lower risk)

## Work Tracking

- **GitHub Issues is the source of truth** — don't rely on in-memory state or decisions.md alone
- **Post major findings as comments** on issues as work progresses
- **Use GitHub milestones** tied to releases to group work by version
- **Use project board stages:** Backlog → Ready → In progress → In review → Done
- **Assign issues to @sabbour** — agents can't be assigned issues directly
- **Track ALL work on GitHub Issues** to avoid losing context

## Process

- **Lead does not write code** — Leela reviews and triages; implementation routes to Fry (frontend) or Bender (backend)
- **Design Proposal (DP) before code** — post a structured DP comment on the issue; get Lead + Security approval before implementation
- **Full ceremony lifecycle per sprint:** Planning → Design Review → Retro
- **MMM process** — every sprint delivers a shippable, testable, usable milestone

## Testing

- **Playwright E2E required** for all feature work — don't rely only on unit tests
- **All CI checks must pass** before merge (lint, typecheck, build, unit tests, E2E)
- **Do NOT merge PRs** with failing required checks

## Tooling & Models

- **Claude Opus 4.6** for all code-writing work (implementation, refactoring, bug fixes, test code)
- **gpt-5.4 "consultant"** for complex/stuck work or major architecture decisions — hire as a temporary team member
- **Changesets** for monorepo versioning — run `npm run changeset` for changes that warrant a version bump

## UI Standards

- **Fluent UI React v9 only** — no custom CSS classes, no inline styles
- **No emoji in UI** — use Fluent UI icons or Material Symbols
- **Fluent `makeStyles()` + design tokens** for all styling
- **`resolvedTheme` pattern** as standard for themed components

## Security

- **OIDC credentials use `secrets.*`** not `vars.*` in GitHub Actions
- **No inline scripts** in `index.html` — CSP `script-src 'self'` must remain clean
- **No CDN script tags** — all dependencies through npm/bundler
- **Zapp reviews all security-sensitive changes** as a pre-merge gate

## Sprint Retros

- **Must include wall-clock time vs estimates** per issue and per wave
- **Must capture review process inefficiencies** and propose improvements
- **Velocity metrics** for calibrating future estimates
