# Decision: JSON Envelope Replaces Regex-Based A2UI Extraction

**Author:** Bender  
**Date:** 2026-04-09  
**Status:** Implemented  

## Context

The LLM response pipeline used regex to extract A2UI blocks from fenced `~~~a2ui` sections inside free-text responses. This was fragile — escaping issues, partial matches, and no structured validation of the A2UI payload.

## Decision

Replace regex extraction with a structured JSON envelope. The LLM now outputs valid JSON:

```json
{"message": "...", "a2ui": [...], "actions": []}
```

Key changes:
- `response_format: { type: "json_object" }` enforced in Azure OpenAI API calls
- New `processResponse()` in `packages/core/src/services/response-processor.ts` parses and validates the envelope
- System prompt teaches the full JSON format with examples
- A2UI messages use v0.9 flat adjacency list: components have `id` + `component`, children are string[] id references
- SSE streaming accumulates chunks, then emits typed events (chunk → message + a2ui + done)

## Consequences

- **Eliminates regex fragility** — JSON parsing is deterministic
- **Graceful fallback** — invalid JSON treated as plain text (no crash)
- **Streaming tradeoff** — can't progressively render `message` field since it's inside JSON; frontend gets loading indicator via `event: chunk` during generation
- **Catalog breaking change** — components use `component` field (not `type`), children are id arrays (not nested objects). 23 components total (18 basic + 5 custom Kickstart)
