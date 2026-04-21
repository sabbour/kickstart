# Bender — Backend Dev

## About Me
Backend engineer owning MCP server, API layer, and database design. Expertise in Node.js, Azure Functions, streaming protocols, LLM integration.

## Key Files
- `packages/core/src/` — conversation engine, FSM, tool registry, validation
- `packages/web/api/src/` — Azure Functions, converse/action/generate endpoints
- `packages/mcp-server/src/` — MCP server, tool handlers, A2UI formatting
- `packages/core/src/kits/` — IntegrationKit framework

## Recent Work
- v2 #474 DP: seam-cutting pass required, APPROVE_WITH_CONDITIONS
- Agents SDK adapter (#445): behind KICKSTART_AGENTS_SDK flag, 1511 tests
- Security sprint: API hardening, rate limiting, CodeQL fixes
- 2026-04-21: **Bug intake — 2 issues assigned** (#998: Chat broken, schema validation regression from #989, priority:high; #996: AKS _ErrorComponent, inspiration prompts unreliable). Both unassigned, go:needs-research. **Action:** Verify #998 schema conformance; audit test suite for A2UI 0.9 spec coverage.
- v2 #474 DP drafted and posted; APPROVE_WITH_CONDITIONS from Leela + Zapp
- Agents SDK adapter (#445, PR #447): SDK behind `KICKSTART_AGENTS_SDK=true`, all Zapp conditions met, 1511 tests, merged
- FSM removal (#385): replaced with linear `advancePhase()` pattern
- Security sprint v0.5.6: API hardening, rate limiting, CodeQL fixes, crypto.randomUUID

## Active Sprint: v2
Sprint 1: implement #474 after DP gate cleared. Manage @kickstart/core imports incrementally via seam-cutting.

## 2026-04-21 Status
Participating in four-way review gate. Ceremony enforcement tightened with pre-dispatch blocking checkpoint.
