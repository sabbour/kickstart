# Design Review

**Trigger:** Auto — before implementation begins.
**Condition:** Design Proposal (DP) comment posted on an issue, OR multi-agent task involving 2+ agents modifying shared systems.
**Facilitator:** Lead (Leela)
**Participants:** All relevant agents + Security Architect (Zapp)

## Agenda

1. **Review the Design Proposal (DP)** comment on the issue
2. **Architecture review** — Lead evaluates quality, alignment with existing patterns, and component boundaries
3. **Security review** — Security Architect evaluates threat surface, auth flows, injection vectors, CORS, and secrets handling
4. **Agree on interfaces and contracts** between components
5. **Identify risks and edge cases** — cross-cutting concerns, backward compatibility, performance
6. **Both approve** → implementation proceeds
7. **Capture decisions** as comments on the issue (or as a GitHub Discussion if cross-issue)

## DP Structure

The implementing agent posts a DP comment with:
- Problem statement (reference to issue body)
- Proposed approach
- Files to modify / create
- Patterns and dependencies
- API contracts (if applicable)
- Security considerations
- Alternatives considered

## Rules

- **Authorship:** The issue body (problem + acceptance criteria) is written by the product owner or Lead. The DP (proposed approach) is written by the implementing agent. Agents do NOT write problem statements.
- **Pre-code gate:** No code may be written before the DP is approved by both Lead (architecture) and Security Architect (security).
- **Scope:** Each PR maps to one issue. If a PR bundles work from multiple issues, split it.
- **Lead does not write code** — Lead reviews and triages; implementation fixes route to the appropriate domain agent.
