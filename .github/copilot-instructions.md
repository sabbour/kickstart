# Copilot Instructions

## Project Overview

This project uses **Squad** — an AI team framework where a coordinator agent routes work to specialized agents. The team roster, routing rules, and decision history live in `.squad/`.

**Kickstart** is an AI-guided onboarding experience for deploying apps to Azure Kubernetes Service (AKS). It guides developers from app idea to production deployment on AKS Automatic, without requiring Kubernetes expertise. Built as a monorepo with npm workspaces (packages/core, packages/web, packages/mcp-server).

## Team (Futurama universe)

| Name | Role | Focus |
|------|------|-------|
| Leela | Lead | Architecture, scope, code review, issue triage |
| Fry | Frontend Dev | Portal Prototyper UX, HTML/CSS/JS, guided flows |
| Bender | Backend Dev | AI/LLM integration, Azure/AKS, APIs, infrastructure |
| Hermes | Tester | Tests, quality, edge cases, accessibility |
| Scribe | Session Logger | Memory, decisions, session logs (silent) |
| Ralph | Work Monitor | Work queue, backlog, keep-alive |

## Squad Framework Structure

- `.squad/team.md` — Team roster and project context. The `## Members` header is required by GitHub workflow automation (label sync, triage, issue assignment).
- `.squad/routing.md` — Determines which agent handles each type of work.
- `.squad/decisions.md` — Canonical decision ledger. Append-only shared state.
- `.squad/ceremonies.md` — Auto-triggered design reviews and retrospectives.
- `.squad/agents/{name}/charter.md` — Per-agent identity and boundaries (read-only for agents).
- `.squad/agents/{name}/history.md` — Per-agent learnings (append-only, owned by that agent).
- `.squad/decisions/inbox/` — Drop-box for new decisions. Scribe merges into `decisions.md`.
- `.squad/casting/` — Persistent name registry mapping agent names to fictional universes.

## Key Conventions

### Decision Drop-Box Pattern

Agents never write directly to `decisions.md`. Instead, write decisions to individual files in `.squad/decisions/inbox/{agent-name}-{brief-slug}.md`. Scribe merges them.

### Append-Only Files

Files marked with `merge=union` in `.gitattributes` are append-only: `decisions.md`, `agents/*/history.md`, `log/**`, `orchestration-log/**`. Never retroactively edit these to change meaning.

### Branch Naming

Use `squad/{issue-number}-{kebab-case-slug}` for issue-based branches (e.g., `squad/42-fix-login-validation`).

### Agent Spawn Hygiene

- Agents read only: their own files + `decisions.md` + explicitly listed input artifacts.
- Agent charters are inlined into spawn prompts — agents don't discover their own charter.
- History and decisions are read by the agent at spawn time for context.

## GitHub Workflows

Four Squad workflows in `.github/workflows/`:

| Workflow | Purpose |
|----------|---------|
| `squad-heartbeat.yml` | Ralph's periodic check — triage, assignment, cleanup |
| `squad-issue-assign.yml` | Routes `squad:{member}` labeled issues to agents |
| `squad-triage.yml` | Lead triages issues with the `squad` label |
| `sync-squad-labels.yml` | Syncs team roster to GitHub labels |

These workflows parse `## Members` from `team.md` — do not rename that section header.
