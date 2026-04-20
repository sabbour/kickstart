# Docs Review Checklist

Use this checklist for documentation-only PRs and mixed PRs with meaningful docs updates. If every required item passes, reviewers can add the `docs:ready` label and fast-track the PR for an expedited merge target of 5–10 minutes.

## Required checks

- [ ] **Links validated** — internal links resolve, external links are intentional, and anchors point at real headings.
- [ ] **Examples are runnable** — code fences include language tags and the commands or snippets match the current repo layout.
- [ ] **Cross-references updated** — related pages, README links, and extension/contributing references still point at the canonical docs surface.
- [ ] **No stale paths** — file paths, package names, and doc targets match the current repository structure (especially redirect-sensitive paths called out in #393).

## Reviewer notes

- Use `docs-site/docs/` as the canonical source for product and contributor docs unless the change is explicitly for a root-level reference file.
- Treat `docs/` as redirect or compatibility surface unless the PR is intentionally updating a root-level stub.
- If any item fails, leave the PR unlabeled until the author updates the docs.

## `docs:ready` label rule

Add `docs:ready` when all required checks pass and the PR does not need deeper architecture, security, or runtime review.
