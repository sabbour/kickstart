# Architecture Decision Records (Repo-Internal Ledger)

This directory holds Kickstart's **repo-internal** ADR ledger.

ADRs are deliberately **not published** to the docs site (`docs-site/`). They
are an engineering artifact: a written record of *why* a decision was taken at
a moment in time, by whom, and what alternatives were rejected. They are
addressed at contributors, not at users.

If you are looking for *user-facing* architecture documentation — what the
system does today and how to extend it — start at
[`docs-site/docs/architecture/overview.md`](../../docs-site/docs/architecture/overview.md).

## When to write an ADR

Open an ADR when a change meets **any** of the following:

- It locks in a public surface (HTTP endpoint shape, SSE event taxonomy, MCP
  manifest contract, pack interface, A2UI component shape) such that future
  changes would be breaking.
- It chooses one cross-cutting library or runtime over a credible
  alternative (e.g. an OpenTelemetry exporter, a guardrail engine, an MCP
  transport).
- It is a security or privacy posture decision (redaction policy, token
  scope, default-deny lists, content recording flags).
- It introduces a constraint that is hard to walk back — for example, "all
  tool inputs must use Zod strict mode," "the harness owns retry, packs do
  not," or "guardrails run server-side only."

You do **not** need an ADR for routine bug fixes, refactors that preserve
public behaviour, dependency bumps, or copy edits.

## Authoring workflow

1. Copy [`template.md`](./template.md) to a new file in this directory.
   Name it `ADR-NNNN-<kebab-case-title>.md` where `NNNN` is the next free
   sequential number (4 digits, zero-padded).
2. Fill in every required section. If a section does not apply, write
   `Not applicable — <one-line reason>` rather than deleting it.
3. Open a PR. The ADR file is the change. Reviewers approve the *decision*,
   not just the prose.
4. Once merged, the ADR is immutable except for the **Status** field
   (e.g. `Accepted` → `Superseded by ADR-NNNN`). Subsequent revisions to a
   decision live in a new ADR that supersedes the old one.

## Status values

| Status        | Meaning                                                        |
|---------------|----------------------------------------------------------------|
| `Proposed`    | Open for discussion in the PR. No implementation work allowed. |
| `Accepted`    | Decision is binding. Code may rely on it.                      |
| `Superseded`  | Replaced by a newer ADR. Link the successor in the header.     |
| `Withdrawn`   | Decision was reverted before adoption. Kept for historical context. |

## Why ADRs are not published

Earlier versions of Kickstart shipped ADRs to the public docs site. They
were removed because:

- ADRs describe *historical reasoning*, not current behaviour. Users who
  follow links from architecture pages to ADRs frequently end up with an
  outdated mental model of the system.
- A merged ADR's prose ages quickly: the system evolves, but the ADR text
  is intentionally frozen. Architecture pages on the published site are
  the place to describe how the system works *now*.
- Removing them from the published site does not delete them — they live
  here, in-repo, where contributors can read them in context with the
  source.

The matching architecture pages on the published site link back to the
relevant ADRs in this directory using GitHub links so contributors can
trace decisions without polluting end-user navigation.

## Index

This README is the canonical index for the ledger. Add a row for every
accepted ADR. Withdrawn or proposed ADRs may be listed below the table or
inferred from the file listing.

| ID  | Title | Status |
|-----|-------|--------|

_(No accepted ADRs in the ledger yet — the four ADRs that previously
existed in `docs-site/docs/architecture/decisions/` were removed when the
public docs site stopped publishing ADRs. If you need to recover the
historical text for any of those decisions, retrieve it from the git
history of `docs-site/docs/architecture/decisions/` prior to the docs
restructure.)_
