# Leela decision inbox — role clarity audit and boundary alignment

**Date:** 2026-04-24T13:20:49-07:00
**Context:** Team expanded to 10 members (8 active + Scribe + Ralph). Ahmed requested crystal-clear role boundaries with no overlap.

## Decisions

### 1. Amy (Docs) vs Scribe boundary

Amy owns all user-facing documentation: README, ADRs, guides, Docusaurus site, changesets, release notes prose. Scribe owns mechanical `.squad/` state: `decisions.md`, `history.md`, `retro-log.md`, `velocity.md`, pulse issues, session logs, CHANGELOG curation from aggregated changesets. No overlap.

### 2. Kif (DevOps) vs Bender (Backend) boundary

Bender writes product code including application-level Azure infrastructure (Bicep, OIDC, managed identity, AKS defaults). Kif manages CI/CD pipelines, GitHub Actions workflows, release automation, branch protection, rulesets, project board, GitHub App management. Bender does NOT write workflows; Kif does NOT write product features or app infrastructure.

### 3. Kif (DevOps) vs Leela (Lead) boundary

Leela makes architectural decisions and reviews. Kif implements operational infrastructure. Leela decides "we need X capability"; Kif builds it. Leela reviews Kif's DPs for alignment.

### 4. Amy (Docs) vs Leela (Lead) boundary

Leela makes architecture decisions. Amy documents them as ADRs. Leela doesn't write docs; Amy doesn't make decisions.

### 5. Zapp (Security) vs Nibbler (Code Review) boundary

Both review PRs but through different lenses. Nibbler reviews for code quality (correctness, readability, patterns, error handling). Zapp reviews for security (injection, auth bypass, trust boundaries, secret handling). Both approvals required for merge. Neither substitutes for the other.

### 6. PR Review Gate expanded to four-way

PR Review Gate now explicitly requires four review dimensions: Nibbler (code quality) + Zapp (security) + Leela (architecture) + Amy (docs). Merge requires `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` or `docs:not-applicable`) + CI green.

### 7. Routing keywords non-overlapping

Removed "public docs, CHANGELOG, README" from Scribe routing. Amy gets all documentation routing. Kif gets all DevOps/CI/CD routing. Scribe is spawned by coordinator for internal `.squad/` state, not by user request.

### 8. Ceremonies updated for new roles

- Design Proposal: Amy added as participant (docs impact assessment)
- Design Review: Amy added (docs impact)
- PR Review Gate: Amy added (docs review dimension)
- Retrospective: Kif added when CI/workflow failure
- Release: Kif owns process, Amy writes release notes

## Consequences

- All 8 active agent charters now have explicit `## Boundaries` sections with hand-off descriptions
- `routing.md` has non-overlapping routing keywords
- `ceremonies.md` has updated participant lists and an end-to-end process flow comment
- Scribe no longer routes for user-facing docs; Amy does
- Bender no longer claims CI/CD; Kif does
