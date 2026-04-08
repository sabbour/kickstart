# Decision: Lightweight inline markdown renderer for chat bubbles

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-27
**Status:** Accepted

## Context

Assistant text messages from the API can contain markdown (bold, code blocks, lists, links). Previously these were rendered as escaped plain text via `escapeHtml()`, making responses hard to read.

## Decision

Added `renderMarkdown()` to `components.js` — a zero-dependency, regex-based converter that handles the subset of markdown LLMs typically produce: bold, italic, inline code, fenced code blocks, unordered lists, links, paragraphs, and line breaks.

User messages remain escaped plain text. Only assistant messages with `msg.text` (no `msg.html`) go through the markdown renderer.

## Why not a library?

The project uses zero build deps (vanilla ES modules). Pulling in `marked` or `markdown-it` would add a CDN dependency and ~30KB of code for features we don't need. The subset above covers >95% of LLM output patterns.

## Consequences

- If we need tables, headings, or nested lists in the future, extend `renderMarkdown()` or swap to a CDN-loaded library.
- Streaming bubbles also render partial markdown via `innerHTML` — this is safe because the text is HTML-escaped before markdown transforms are applied.
