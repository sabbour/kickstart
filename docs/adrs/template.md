# ADR-NNNN: <Short title in present-tense imperative>

- **Status:** Proposed | Accepted | Superseded by ADR-NNNN | Withdrawn
- **Date:** YYYY-MM-DD
- **Authors:** @<github-handle> (and any co-authors)
- **Supersedes:** <ADR-NNNN or "None">
- **Related issues / PRs:** #NNNN, #NNNN

## Context

What problem are we solving? What are the forces in play? Cite specific
files, modules, or behaviours that motivated the decision.

Be concrete. "Performance" is not a force. "Tool calls for the same
session can race because the MCP transport is not single-threaded
(packages/mcp-server/src/index.ts)" is a force.

If the decision was triggered by an incident, link the incident.

## Decision

State the decision in one or two sentences. Use **must / will**, not
**should / could**. The decision text is what reviewers approve.

Add a short paragraph (2–6 sentences) explaining the *shape* of the
decision: what it covers, what it does not cover, what it permits.

## Alternatives considered

For each credible alternative, include:

- **Name** — one-line summary.
- **Why rejected** — concrete reason. "Higher operational cost" is not
  a reason; "would require widening CSP with `unsafe-inline`" is.

A decision with no alternatives is suspicious. If the decision really is
forced, write "No credible alternative — the constraint comes from
<external system / dependency / regulatory requirement>" and explain.

## Consequences

What changes when this ADR is accepted? Be honest about both directions.

- **Positive:** what improves (capability unlocked, risk reduced, surface
  simplified).
- **Negative / cost:** what gets harder, what we are now committed to
  maintaining, what reviewers must check on every PR going forward.
- **Follow-ups required:** issues that must be opened to make the
  decision real (CI gates, doc updates, deprecation notices).

## Code anchors

List the files that implement or enforce this decision. These are the
places a future reader should look to verify the ADR is still accurate.

- `packages/<scope>/<file>.ts` — what this file enforces.
- `packages/<scope>/<file>.ts` — what this file enforces.

Keep this list short (≤ 6 entries). The point is to give readers a
starting point, not to enumerate every touched file.

## Notes

Optional. Use sparingly for things that do not fit the sections above —
e.g. links to design docs, transcripts of key discussions, or data that
informed the decision. Anything important enough to be load-bearing
belongs in **Context** or **Decision**, not **Notes**.
