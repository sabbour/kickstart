# Decision: Content Safety Guardrails for LLM-Generated Content

**Author:** Bender (Backend Dev)
**Date:** 2025-07-27
**Status:** Implemented

## Context

Public-facing LLM endpoints (inspirations, converse) could generate or respond to inappropriate content. Added two layers of defense:

## Decision

1. **System prompt hardening** — All 4 inspiration generation prompts now include a safety clause forbidding weapons, violence, illegal activities, adult content, gambling, and harmful/offensive ideas.
2. **User input pre-flight check** — New `content-safety.ts` module performs a lightweight LLM classification (`safe`/`unsafe`) on user messages before they reach the main converse flow. Uses `maxTokens: 10`, `temperature: 0` for speed/cost. Gracefully skips if OpenAI is unavailable or the check fails.

## Implications

- All agents/team members adding new LLM prompts should include the safety clause.
- The content safety check uses the chat deployment (not inspire), keeping it on the faster model path.
- This is a first layer — not a comprehensive content moderator. Future work may add Azure Content Safety service integration.
