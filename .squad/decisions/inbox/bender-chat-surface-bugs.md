# Decision: Chat Surface Bugs — #937 & #943

**Date:** 2026-04-20  
**Author:** Bender (Backend Dev)

## Context

Two related bugs observed in the same debug screenshot affected the main chat surface.

## Decision 1 — Double-encoded JSON (#937)

When `AgentOutput` is used as the SDK's `outputType`, the model emits structured JSON tokens (`{"message":"...","intent":"continue"}`) as the raw text stream. The runner was forwarding those JSON tokens as `chunk` deltas, so `useStreaming.ts` accumulated the JSON string into `accumulated` → `fullEnvelope.message` showed double-encoded JSON.

**Resolution:** After `result.finalOutput` resolves, overwrite `outputText` with `finalOutput.message` (the already-parsed prose string). The existing `outputText !== fullText` flush path sends the clean prose as a single chunk, preserving the guardrail redaction path.

**Implication for future pack authoring:** The `message` field in `AgentOutput` is the display text. Do not stream raw JSON schema fields to the client — the runner handles message extraction.

## Decision 2 — Model name in SSE stream (#943)

The runner resolved `modelName` but never included it in any SSE event. The frontend `useStreaming` read `parsed.model` only in the `default:` fallback case, never in the typed `case 'end':`.

**Resolution:** 
1. `runner.ts`: add `model: modelName` to `sseWrite('end', ...)`.
2. `useStreaming.ts`: add `if (parsed.model) lastModel = parsed.model as string;` inside `case 'end':`.

**Contract:** The `end` SSE event now carries `{ sessionId, intent?, model }`. Any new consumer of the stream should read model from `end` — not rely on the `default:` fallback.
