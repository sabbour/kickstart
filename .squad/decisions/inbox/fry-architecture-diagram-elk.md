---
# Decision: Secure ELK ArchitectureDiagram contract

**Date:** 2026-04-15T15:20:24Z
**Author:** Fry (Frontend Dev)
**Status:** Implemented

## Context

Issue #273 needed the real try-aks architecture diagram path: ELK layout, Azure/Kubernetes icons, nested group boundaries, and multiline subtitles. The existing renderer already had safe Mermaid handling, so the key trade-off was how to add the richer visuals without weakening the security posture or shipping fake icon heuristics.

## Decision

1. **`diagram` is the v1 contract.** `ArchitectureDiagram` should prefer raw Mermaid text with nested subgraphs, while `nodes`/`edges` remain a legacy fallback for simple graphs.
2. **Renderer posture stays strict.** Keep `securityLevel: 'antiscript'`, preserve `sanitizeDiagramInput()`, and expand `%%icon:name%%` placeholders only after render with a strict allowlist.
3. **Registry-backed icons or plain text — never fake guesses.** Use the shared adaptive-ui icon registry for supported keys; if a shared icon is missing, render the label without an icon instead of mapping to a local keyword-based placeholder.

## Consequences

- Prompt, schema, catalog, and demo updates should emit `diagram`, `title`, and `description` so the model and demos use the grouped architecture path consistently.
- Reusable renderer helpers live in `packages/web/src/catalog/components/architectureDiagramUtils.ts`.
- Web-only type shims in `packages/web/src/types/` are acceptable when source-published packages expose more TypeScript surface area than the renderer actually needs.
