# Wave 9: Track Addendums + E2E Test Rewrite

**Date:** 2026-04-08  
**Agents:** Bender (Backend), Hermes (Tester)

## Summary

Bender added per-track system prompt addendums (web-app and agentic-app guidance) and created `/api/inspirations` endpoint. Hermes deleted legacy test files and rewrote E2E suite for chat-first UX. All 118 tests passing.

## Outcomes

### Bender: Track Addendums + API Endpoint
- System prompt builder now accepts optional `track` parameter
- `WEB_APP_ADDENDUM` (~280 words): containerization, CI/CD, database patterns, AKS Automatic
- `AGENTIC_APP_ADDENDUM` (~300 words): KAITO, RAGEngine, LangChain, Semantic Kernel, Azure OpenAI
- `/api/inspirations` endpoint (Azure Function): returns 12 carousel items as JSON
- All code paths (demo, hybrid, API) wire track to prompt builder
- Build clean, all tests passing
- Commits: 6d2013c + e1b5ff7

### Hermes: E2E Test Rewrite
- Deleted 5 legacy test files (old phase flow, auth, knowledge, routing, markdown)
- Created 4 new spec files (21 tests total):
  - `landing-page.spec.ts` (5 tests) — track/framework selection
  - `chat-transition.spec.ts` (4 tests) — landing→chat flow
  - `chat-experience.spec.ts` (8 tests) — multi-turn, markdown, error handling
  - `sessions-sidebar.spec.ts` (4 tests) — session create/switch/delete
- All tests pass (21/21) with demo engine (API mocked with 503)
- Committed as 4da9eee + 1a5c850

## Files Changed

**Bender:**
- `packages/core/src/prompts.js` (addendums added)
- `packages/core/src/engine.js` (track param wired)
- `packages/web/api/src/functions/inspirations.ts` (new endpoint)

**Hermes:**
- Deleted: 5 old spec files
- Created: 4 new spec files (21 tests)

## Testing Status

✅ All 118 Playwright E2E tests passing  
✅ No regressions in landing page, chat flow, or session management  
✅ Demo engine stable for test assertions

## Next Steps

- Monitor how track addendums improve LLM guidance in production
- Consider track forwarding in API session model (future)
- Extend E2E coverage for accessibility (ARIA labels, keyboard nav)
