---
"@aks-kickstart/api": patch
---

refactor(widget-inspirations): consolidate system prompt, flatten SSE fallback chain, inline single-use helpers (#1020)

Simplifies `widget-inspirations.ts` from 251 → 200 lines by applying four levers from the approved DP:

1. **Consolidated system prompt** — single `buildSystemPrompt(focus, mode)` function replaces the two inlined 60-line blocks; shared preamble + per-mode format suffix eliminate drift risk.
2. **Flattened fallback logic** — new `streamOrFallback()` async-generator replaces three nested error-handling layers with one try/catch and a clear early-return for the unconfigured path.
3. **Externalized prompt text** — `JSON_FORMAT_SUFFIX`, `STREAM_FORMAT_SUFFIX`, `SSE_HEADERS` are named constants; prompt text is auditable without reading handler logic.
4. **Inlined single-use helpers** — `generateWidgetIdeas()` and `generateWidgetPromptStream()` removed; their logic lives directly in the handler's two branches.

Behavior is unchanged: same focus-domain rotation, same allow-list, same JSON/SSE output shape.
Backed by 11 new characterization tests in `widget-inspirations.test.ts`.
