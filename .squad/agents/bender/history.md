# Bender — Backend Dev

## About Me
Backend engineer owning MCP server, API layer, and database design. Expertise in Node.js, Azure Functions, streaming protocols, and LLM integration patterns. Shipping the conversation engine, session management, tool system, and API service connectors.

## Key Files
- `packages/core/src/` — conversation engine, FSM, tool registry, validation system
- `packages/web/api/src/` — Azure Functions, converse/action/generate endpoints, rate limiting
- `packages/mcp-server/src/` — MCP server, tool handlers, A2UI response formatting
- `packages/core/src/kits/` — IntegrationKit framework and Azure/GitHub connectors
- `packages/core/src/tools/` — LLM tool registry and built-in tools

## Patterns
- **Tool execution loop:** Multi-step LLM function calling with streaming SSE events (tool_call, tool_result)
- **Session store:** In-memory Map shared across /api/converse and /api/action endpoints
- **IntegrationKit lifecycle:** Register → onActivate → authenticate → tools ready; unregister → onDeactivate
- **CORS proxy pattern:** ARM requires auth, GitHub optional, Pricing public; all forward rate-limit headers
- **Error response pattern:** Use safeErrorResponse() utility for generic client messages; log details server-side

## Recent Work
- v0.5.6 security sprint: API hardening (#83), rate limiting, prompt redaction
- v0.5.0 multi-surface: MCP App iframe support, postMessage origin validation, session signing
- v0.4.0 tool system: Function calling protocol, multi-round loops, streaming SSE events
- v0.3.0 service layer: APIConnector auth abstraction, IntegrationKit packs, CORS proxies

## Work Log
- (2026-04-14 11:02) Wave 1: SWA continuous deploy + version footer → PR #177 opened. Auto-deploy from main, version shows SHA.

## Learnings
- SWA deploy workflow (`deploy-swa.yml`) needs explicit `push → branches: [main]` trigger — tag-only triggers mean no continuous deployment from main.
- `__BUILD_VERSION__` in `vite.config.ts` can embed git SHA via `execSync('git rev-parse --short HEAD')` — works both locally and in CI without relying on `GITHUB_SHA` env var.
- Footer version display should use a single unified string (`version-sha`) rather than showing version and SHA separately — reduces redundancy and makes each build uniquely identifiable at a glance.
