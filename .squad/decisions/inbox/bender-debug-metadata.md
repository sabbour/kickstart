# Decision: Debug Metadata Convention for SSE Endpoints

**Author:** Bender (Backend Dev)
**Date:** 2025-07-25
**Status:** Implemented
**PR:** #135

## Context

Frontend needs to show debug info (model name, raw LLM output, rendering decisions) when debug mode is enabled. We needed a convention for how debug metadata flows through SSE and JSON responses.

## Decision

1. **Activation:** `x-kickstart-debug: true` header OR `?debug=true` query param. Both are checked; either activates debug mode.
2. **Payload shape:** All debug metadata lives under a single `debug` key containing `{ model, rawContent, renderDecisions[] }`.
3. **SSE placement:** Debug metadata is included in the terminal event (`done` for converse, final `data` for generate) — not in every chunk. This avoids bloating the stream.
4. **Backward compatible:** When debug is off, responses are byte-identical to pre-debug behavior. No new fields leak into production responses.
5. **Helper location:** `packages/web/api/src/lib/debug-mode.ts` — centralized so both endpoints use the same detection and payload builders.

## Implications

- Frontend should only parse `debug` when it exists (it won't be present in production).
- Future debug fields (token counts, latency breakdowns) should be added to the same `debug` object.
- The `renderDecisions` array is extensible — new decision types can be added without breaking existing consumers.
