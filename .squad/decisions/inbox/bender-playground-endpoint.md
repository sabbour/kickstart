# Decision: Dedicated /api/playground Endpoint for A2UI Playground

**Author:** Bender (Backend Dev)
**Date:** 2025-07-27
**Status:** Accepted
**Related:** Content Safety, A2UI Component Model

## Context

The Playground Create tab was calling `/api/converse`, which uses the full Kickstart onboarding engine (phases, kit skills, phase indicators). This was wrong context — the playground needs free-form A2UI component generation, not an AKS deployment guide.

## Decision

Created a dedicated `POST /api/playground` endpoint with:
- Its own system prompt focused on A2UI component design
- Its own lightweight in-memory session store (separate from the onboarding sessions)
- JSON mode (`response_format: json_object`) for reliable structured output
- Simpler response shape: `{ sessionId, message, a2ui }` — no phases, no streaming
- Content safety via the existing shared `checkContentSafety` module

Frontend `Playground.tsx` updated to call `/api/playground` with direct fetch instead of the SSE-based `useStreaming` hook.

## Rationale

- **Separation of concerns:** Playground and onboarding are fundamentally different use cases. Sharing an endpoint meant the LLM received AKS deployment prompts when the user wanted to design UI components.
- **Simpler contract:** The playground doesn't need phases, tool calling, or SSE streaming — a single JSON round-trip is cleaner and easier to debug.
- **Independent session state:** Playground sessions don't pollute onboarding session storage and vice versa.
