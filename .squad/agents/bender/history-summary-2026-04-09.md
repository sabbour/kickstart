# Bender History Summary (as of 2026-04-09)

**Total Size:** 42KB | **Entries:** ~17 major learnings

## High-Level Index

### Foundational (2025-01 to 2025-07)
- Azure Static Web Apps deployment pipeline
- Entra app registration & auth flow setup
- Monorepo scaffold (npm workspaces, 3 packages)
- 6-phase conversation engine (K8s-delayed terminology)
- Layer 2 system prompt architecture
- MCP server integration (system prompts, catalog negotiation, safeguards)
- SWA API backend + OpenAI client
- Technical documentation (API, MCP, A2UI catalog, prompts, deployment)

### Recent Sprint (2026-04-08 to 2026-04-09)
- **Core API patterns:** A2UI Spec evolution, `handleAppMessage` protocol, response envelopes
- **Frontend wiring:** `useA2UI` hook, action dispatch, form handling, streaming integration
- **Testing:** 35 core tests, 53 MCP tests, 38 Playwright E2E tests, 60+ tool system tests
- **Backend endpoints:** `/api/converse` (chat streaming), `/api/action` (action routing)
- **Tool system:** ToolRegistry, 5 built-in tools, multi-step LLM loops, SSE tool_call/tool_result events
- **Decisions logged:** Changesets versioning, action session store pattern, tool registry extension

## Recent Work (Last Session)

1. **B-24 /api/action endpoint** — POST endpoint for component actions. Routes reply/navigate through LLM re-prompt. API actions stubbed. 194/202 tests pass.
2. **B-13 LLM tool system** — ToolRegistry + 5 tools (Azure list/get, GitHub, K8s manifest, pricing). Multi-step loops. 22 new tests. SSE tool_call/tool_result events.
3. **Decisions:** Changesets (monorepo versioning), action session store (shared with converse), tool registry pattern (extension via IntegrationKits).

## Key Patterns Established

- **Phase-based conversation machine:** 6 phases (Discover→Design→Generate→Review→Handoff→Deploy)
- **Progressive K8s disclosure:** Terminology hidden until Review/Deploy phases
- **Deployment Safeguards (D13):** DS001–DS013 rules, auto-validation, user-friendly framing
- **Tool registry singleton:** Extensible by IntegrationKits, bootstrapped with 5 built-ins
- **Session store pattern:** In-memory Map with TTL cleanup, shared across all API endpoints
- **Changesets workflow:** All packages versioned lockstep; changesets reviewed in PRs

## Known Issues / Blockers

- **B-13 blocker:** `generate_kubernetes_manifest` crashes on non-string appName (Hermes found via testing)
- **8 pre-existing test failures:** MCP server action-handler.test.ts (unrelated to B-24/B-13)

---

**Note:** This summary is an index. See `history.md` for full implementation details, code paths, and design rationale.
