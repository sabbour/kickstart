# Design Review

**Trigger:** auto, in-session, before implementation begins.
**Condition:** Design Proposal (DP) comment posted on an issue, OR a task involves 2+ agents modifying shared systems (pack boundaries, harness, SSE contract, A2UI catalog).
**Facilitator:** Lead (Leela)
**Participants:** all relevant agents + Security Architect (Zapp)

## Why this ceremony exists

Kickstart v2 has small, stable primitives (Pack, Agent, Skill, Tool, UserAction, Component, Guardrail). Most bugs come from agreeing on the wrong surface before writing code. A DP catches that cheaply.

## Agenda

1. Read the DP comment on the issue.
2. **Leela** evaluates architecture alignment with `docs/v2-implementation-brief.md`: pack boundaries, primitive surface, handoff plan.
3. **Zapp** evaluates the security surface: tool schemas, guardrails, trust boundaries, secret handling.
4. Agree on the pack's public contract (new tools, new user actions, new components) before any code.
5. Identify risks and edge cases (backward compat, SSE event shapes, registry conflicts).
6. Both approve → implementation proceeds.
7. Decisions captured as comments on the issue. If cross-cutting, Scribe mirrors them into `.squad/decisions.md`.

## DP structure

The implementing agent posts a DP comment with:

- Problem statement (cite the issue body)
- Proposed approach with a reference to the relevant brief section
- Pack boundaries affected
- Primitive surface changes: tools, user actions, components, guardrails
- Security considerations: schema changes, trust boundaries, secrets
- Docs and changeset plan
- Alternatives considered

## Rules

- **Authorship:** the issue body (problem + acceptance criteria) is written by the product owner or Lead. The DP (approach) is written by the implementing agent. Agents do not write problem statements.
- **Pre-code gate:** no code before both Leela and Zapp approve.
- **Scope:** each PR maps to one issue. Split bundles.
- **Leela does not write code.** Review and triage are her job. Implementation routes to Fry, Bender, Hermes, or @copilot as appropriate.
