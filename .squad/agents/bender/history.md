# Bender — Backend Dev

## About Me
Backend engineer owning MCP server, API layer, and database design. Expertise in Node.js, Azure Functions, streaming protocols, and LLM integration patterns.

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
- v2 #474 DP drafted and posted; APPROVE_WITH_CONDITIONS from Leela + Zapp
- Agents SDK adapter (#445, PR #447): SDK behind `KICKSTART_AGENTS_SDK=true`, all Zapp conditions met, 1511 tests, merged
- FSM removal (#385): replaced with linear `advancePhase()` pattern
- Security sprint v0.5.6: API hardening, rate limiting, CodeQL fixes, crypto.randomUUID

## Active Sprint: v2

Sprint 1 role: implement #474 (Nuke v1) after DP gate cleared. DP APPROVE_WITH_CONDITIONS — seam-cutting pass required. `@kickstart/core` imports and `packages/web/src/types.ts` must be managed incrementally.

## Learnings

- (2026-04-17T12:06:45Z) #474 implementation must follow seam-cutting pass: remove mock/demo sources first, introduce temporary replacement exports for `@kickstart/core` and `types.ts` contracts, then hard-delete legacy files.
- (2026-04-17) `advancePhase()` must use `PHASE_DEFINITIONS.find()` + safe fallback, not `getPhaseDefinition()` which throws. Any function called on every LLM turn must be hardened against stale/hydrated strings. Use `isPhase()` type guard at API boundaries.
- (2026-04-17) `Phase` enum values are lowercase strings (`"discover"`, `"design"`, etc.) — not PascalCase. Type guards and tests must use actual runtime values.
- (2026-04-17) **8KB cap pattern for debug metadata strings:** Apply hard cap (8,192 bytes) at the point of assignment with trailing `…` indicator. Keeps debug payload bounded regardless of downstream consumption.
- (2026-04-17) **Prod startup warning pattern:** When feature is debug-only (gated by `DEBUG_MODE`), emit `console.warn` on startup if flag detected in `NODE_ENV === 'production'`. Name the flag, describe exposure, instruct to unset.
- (2026-04-17) **Threading optional fields through call stacks:** When adding optional field to deeply-nested type, trace every call site and add `field: undefined` explicitly — object spread patterns silently drop fields not present in the spread source.
- (2026-04-17) For prompt-injection defense, transforming third-party content into a constrained structured JSON (extracted facts only) is stronger than delimiter sandboxing — the LLM never sees free-form prose it could interpret as instructions.
- (2026-04-16) `BaseConnector.isAuthenticated()` returns `true` for `auth: { kind: 'none' }` (SWA cookie auth). Components guarding live API calls must also check `isMockMode() || isPlaygroundMode()`.
- (2026-04-16) All `useA2UI()` calls must supply an `actionHandler` (even a no-op) if the component may host surfaces that fire `continue:` or other actions.
- (2026-04-15T16:06:15Z) Azure Functions v4 loads every file matched by `package.json` `main` glob during startup. `bicep-node` must stay external in managed Functions ESM bundle — inlining causes `Dynamic require of "os" is not supported` on import.
- (2026-04-15T15:20:19Z) Backend model routing stays phase-based, server-side: only trusted `Phase.Generate` turns route to codex. `messages[].phase` must never escalate backend model choice — track trust separately in `session-store.ts`.

## 2026-04-17 Agents SDK Backend Adapter (#445, PR #447)

New files: `agents-azure-provider.ts`, `agents-session-adapter.ts`, `agents-route-planner.ts`, `agents-sse-adapter.ts`, `agents-runner.ts` (+ 4 test files). SDK behind `KICKSTART_AGENTS_SDK=true`. Tracing disabled globally. All 6 security conditions met. 1511 tests passing. Approved by Leela + Zapp. Merged.

Key learnings:
- `@openai/agents` `run()` does NOT accept `modelProvider` — belongs in `Runner` constructor.
- `AzureOpenAI` has `#private` field preventing structural assignment to `OpenAI` — use `azureClient as any`.
- `vi.stubEnv` sets env vars to strings including empty strings — use `||` (falsy) not `??` (nullish) for deployment name fallbacks.
- `AgentInputItem` role not directly on union — access via `(item as { role?: string }).role`.
- `AssistantMessageItem` requires `status` field (`"completed" | "in_progress" | "incomplete"`) — omitting fails Zod validation at `addItems()`.

## 2026-04-17T12:06:45Z — #474 DP Draft + Conditions

DP posted on issue #474. Leela APPROVE_WITH_CONDITIONS + Zapp APPROVE_WITH_CONDITIONS. Implementation proceeds as seam-cutting pass per Fry's analysis.

## #476 DP — Registry + loaders

Posted the Step 3 DP for issue #476: sealed `PackRegistry`, `.agent.md` and `SKILL.md` loaders, frontmatter parser port, catalog skeleton, sigil-based tool vs user-action resolution, and fail-fast collision/dependency checks for Hermes to validate before pack-core starts.

## Wave 3 — 2026-04-17 #474 Step 1 Decisions Filed

- Filed `bender-474-step1-compat-seam.md`: temporary `@kickstart/core` seam is compile-preservation only; no new behavior; burned down in Step 2+.
- Filed `bender-474-step1-backend-cutover.md`: backend package graph moves straight to `@kickstart/harness`; `@kickstart/core` stub kept only for web-shell fallout during Fry's cleanup.
- Filed `bender-mcp-app-schema-isolation.md`: MCP app response schema kept local to `packages/mcp-server/src/a2ui.ts` until HTML app renderer migrates to shared `@kickstart/core` catalog shape.
