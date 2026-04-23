---
name: "docs-canonical-surface"
description: "Keep one canonical docs surface and repoint workflows when legacy docs paths are removed"
domain: "documentation"
confidence: "high"
source: "earned"
last_updated: 2026-04-20T11:30:00Z
---

## Context

Use this when a repo has both a public docs site and a legacy top-level docs tree, and a cleanup needs to remove duplication without leaving broken contributor or release workflows behind.

## Patterns

- **Pick one canonical docs tree.** In Kickstart, `docs-site/docs/` is the source of truth for public docs and the v2 implementation brief.
- **Keep `docs/` as a redirect map only.** Use `docs/README.md` to point old paths at their replacements instead of maintaining duplicate pages.
- **Fix entry points in the same change.** When the brief or API docs move, update contributor guidance, release docs, and any automation that links to them before merging.
- **Repoint workflows and skills immediately.** If a legacy path like `docs/api-reference.md` is removed, update docs gates, weekly pulse checks, and squad skills in the same sweep.
- **Validate the docs package directly if it is not a workspace.** Use `cd docs-site && npm run build` instead of assuming a root workspace command exists.
