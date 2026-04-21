# Decision: /health deep-check endpoint design

**Date:** 2026-04-20  
**Author:** Bender (backend)  
**Issue:** #941  
**Status:** PROPOSED

---

## Context

`/health` previously only checked the pack registry. If Azure OpenAI returned a 4xx error (as happened for ~2 days in #933), the endpoint still reported green — a false-positive that masked the real outage.

## Decision

Add opt-in deep-check mode via `?deep=1` query parameter on the existing `/health` endpoint rather than a separate `/health/llm` endpoint.

**Rationale for query param over new endpoint:**
- One fewer route to document, version, and secure
- Existing load-balancer/uptime probes using `/health` with no params are unaffected
- Synthetic monitors / alert rules that want real LLM validation add `?deep=1` explicitly

**LLM probe spec:**
- Chat Completions API, chat deployment only (`KICKSTART_CHAT_MODEL`)
- Single `"hi"` user message, `max_completion_tokens: 1` — minimal cost/latency
- 8-second `AbortController` timeout
- Response: `{ llm: { ok, latencyMs, model, errorCode? } }`
- Error redaction: only HTTP `response.status` surfaced as `errorCode` (never raw body)

**Cache:**
- 30-second module-level TTL, success-only
- Cache misses (failures) always execute a live probe so monitoring gets real signal
- Cache hits return `{ cached: true }` in the response

## Consequences

- Operators should update synthetic monitors to use `/health?deep=1` to get real LLM signal
- `/health` (no param) remains a fast, cheap registry probe suitable for load-balancer health checks
- If AOAI is down, `GET /health?deep=1` returns HTTP 503, giving alert rules a concrete signal
