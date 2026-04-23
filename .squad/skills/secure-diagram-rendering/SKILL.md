---
name: "secure-diagram-rendering"
description: "Render LLM-authored Mermaid architecture diagrams with ELK layout, shared icons, and a strict security posture"
domain: "frontend, security"
confidence: "high"
source: "earned"
---

## Context
Use this when a frontend needs richer architecture diagrams from untrusted LLM output without falling back to fake CSS overlays or weakening Mermaid security. It applies especially to AKS/Azure visuals where nested subgraphs, multiline subtitles, and shared icon registries matter.

## Patterns
- **Diagram-first contract:** Prefer a raw Mermaid `diagram` string for grouped architectures; keep `nodes`/`edges` only as a legacy fallback.
- **ELK over default layout:** Register `@mermaid-js/layout-elk` and set `defaultRenderer: 'elk'` for cleaner clustered layouts.
- **Sanitize before render:** Normalize literal `\\n` to `<br/>`, then run `sanitizeDiagramInput()` before Mermaid render. Preserve `securityLevel: 'antiscript'`.
- **Strict icon placeholders:** Expand `%%icon:name%%` only after render, only for allowlisted keys, and only from a shared registry. Unknown keys should collapse to plain text.
- **Vendor fixed icon sets locally when install auth is the problem:** If the renderer only needs a stable allowlist of SVGs, copy those exact assets into the app (for example `public/assets/architecture-diagram/`) and resolve them through a local registry module instead of keeping a private package in the web dependency path.
- **Keep styling centralized:** Put Mermaid preprocessing, placeholder expansion, and SVG styling in one helper module so prompts, tests, and UI stay aligned.
- **Use TS shims when source-published packages are noisy:** If a package publishes source TypeScript that drags extra surface area into `tsc`, add narrow web-only shims for the exact runtime APIs you use.

## Examples
- Renderer helpers: `packages/web/src/catalog/components/architectureDiagramUtils.ts`
- Secure UI wrapper: `packages/web/src/catalog/components/ArchitectureDiagram.tsx`
- Contract + prompt alignment: `packages/core/src/services/a2ui-schema.ts`, `packages/core/src/prompts/system-prompt.ts`, `packages/core/src/prompts/component-catalog.ts`
- Tests: `packages/web/src/catalog/components/architectureDiagramUtils.test.ts`

## Anti-Patterns
- Switching Mermaid to `securityLevel: 'loose'` for convenience.
- Guessing icons from label keywords or local fallback SVGs.
- Faking boundaries with external CSS boxes instead of real Mermaid subgraphs.
- Spreading diagram sanitization, icon expansion, and styling across multiple files with duplicated logic.
