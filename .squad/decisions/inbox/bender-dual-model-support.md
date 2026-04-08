# Decision: Dual-Model Backend (Chat + Codex)

**Author:** Bender (Backend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

Ahmed configured two Azure OpenAI deployments — `gpt-5.3-chat` for conversation and `gpt-5.3-codex` for code generation. The codex model uses the newer Responses API (not Chat Completions).

## Decisions

### 1. Separate deployment env vars with fallback

`AZURE_OPENAI_CHAT_DEPLOYMENT` and `AZURE_OPENAI_CODEX_DEPLOYMENT` added alongside the existing `AZURE_OPENAI_DEPLOYMENT` (which acts as fallback for both). This is backward-compatible — existing single-model setups keep working.

### 2. Responses API for Codex

The codex model uses `POST /openai/deployments/{deployment}/responses?api-version=2025-03-01-preview` — a different API shape from Chat Completions. System prompt goes in `instructions`, user messages in `input`. Streaming uses `response.output_text.delta` SSE events.

### 3. New `/api/generate` endpoint

Dedicated code generation endpoint with type-specific system instructions (dockerfile, kubernetes, pipeline, bicep, generic). Keeps conversation and code generation concerns cleanly separated.
