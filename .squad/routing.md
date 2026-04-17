# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Frontend UX | Fry | Web client routes, A2UI rendering, component authoring, SSE client, playground |
| Backend & runtime | Bender | Harness, non-UI packs, SDK tools, user actions, guardrails, SWA Functions API, Azure infra |
| Code review | Leela | Review PRs, check architecture alignment, suggest improvements |
| Testing | Hermes | Four test layers: unit, pack conformance, contract, Playwright E2E |
| Performance & observability | Hermes | Perf budgets on DPs, p95 latency, first-chunk time, token ceilings, cold-start, resource sizing, tracing spans, structured logging |
| Scope & priorities | Leela | What to build next, trade-offs, decisions |
| Architecture | Leela | Pack boundaries, primitive surface, harness contract |
| Security | Zapp | DP security review, tool schema review, guardrail design |
| Release notes, docs | Scribe | Release PR curation, pulse issues, decision merging, public docs, CHANGELOG, README |
| Product & DX review | Scribe | Advisory review on DPs and PRs for naming, defaults, newcomer experience |
| Queue monitoring | Ralph | Stuck PRs, expired gates, missed cron runs |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.


### Triage Checklist (Lead)

When triaging an issue in-session, the Lead must:
1. ✅ Assign `squad:{member}` label
2. ✅ Set a milestone (or explicitly mark as "Backlog" if unplanned)
3. ✅ Verify issue is on the project board
4. ✅ Post triage comment with rationale

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.

## Zapp — Security Architect

| Signal | Route to Zapp |
|--------|---------------|
| Design Proposal (DP) posted on issue | Primary — review for security concerns |
| PR marked ready for review | Primary — security-focused code review |
| Security review request | Primary |
| Vulnerability analysis | Primary |
| Auth/CORS/secrets concerns | Primary |

> **Scope boundary:** Zapp reviews for **security only**. Architecture quality review is Leela's responsibility. Both review DPs on issues and code on PRs, but in their respective domains.
