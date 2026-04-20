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

## Work Summary (Apr 2026)

Recent major accomplishments: v0.5.6 security sprint (API hardening, rate limiting), v0.5.0 multi-surface (MCP App iframe, postMessage validation, session signing), Agents SDK adapter implementation (#445 draft PR #447), SWA deployment pipeline fix (package/bundle exclusions), GitHub Projects V2 integration, heartbeat workflow PAT fallback hardening.

Key learnings: TypeScript `readonly RegExp[]` patterns, API surface minimization via internal barrels, GitHub Actions PAT fallback required, SWA needs explicit main branch trigger, build version embedding via git SHA, user-owned projects require specific PAT scopes, WSL line-ending awareness, concurrent git lock contention mitigation.
- For prompt-injection defense, transforming third-party content into a constrained structured representation (JSON with extracted facts only) is stronger than delimiter sandboxing around raw markdown — the LLM never sees free-form prose it could interpret as instructions.
- (2026-04-14 17:44) Implemented #186 (Public Copilot Skills): 10 new files in packages/core/src/skills/ with full build-time sync pipeline, zero-network runtime loader, policy scanner, frontmatter parser, phase mapper, knowledge extractor. 60 tests. PR #227.
- Core package (packages/core) is browser-compatible — uses "lib": ["ES2022", "DOM"] with no @types/node. Use Web Crypto API (crypto.subtle) and atob() instead of Node.js crypto and Buffer. Accept data as parameters rather than reading filesystem directly.

## Round 5: Multi-Round DP Cycle (#186) + Implementation (Pending)

**2026-04-14**
- Updated DP #186 addressing Zapp security concerns (round 2)
- Received round 3 feedback from Zapp (3 remaining concerns)
- Final DP update (#186 round 3) addressing all security issues
- DP #186 approved by Zapp for implementation
- Implemented public Copilot skills (10 files, 60 tests) in PR #227
- Implementation PR awaiting code review

## 2026-04-14 Round 2: Infrastructure + Bug Fixes

- **PR #213**: Fixed missing choice components in system prompt. Root cause identified and fixed purely additively.
- **Approved by Leela**: Set to auto-merge.
- **SWA automation**: Implemented continuous deployment on main + version-SHA footer (PR #177).
- **Project board triage**: Implemented auto-assignment workflow for issues.
- **Team notes**: Coordinated with Fry on footer components; ensured Leela's approval before merge.
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
- (2026-04-17T12:06:45.293Z) For v2 Step 1-style delete-first migrations, keep a temporary compatibility seam at the package boundary until web/API/MCP imports are rewired. In this repo that seam is `packages/core` → `packages/harness/src/index.ts`; deleting it early turns a cleanup slice into a package-graph outage.
- (2026-04-15) Unified narrative prompts produce more natural conversations than layered phase-template architectures. Embedding step markers (STEP 1—DISCOVER, STEP 2—DESIGN, etc.) in one prompt lets the LLM flow naturally between topics instead of feeling gated by explicit phase switches.
- (2026-04-15) Auto-continue via filesComplete flag eliminates friction during multi-turn file generation. The LLM sets filesComplete: false, the client auto-sends "Generate next set of files" — no manual button clicks needed.
- (2026-04-15) Artifact summary injection (appending generated file list + resource declarations to the system prompt each turn) gives the LLM running context and prevents hallucinated file references or duplicate generation. Modeled after Try-AKS's buildArtifactSummary pattern.
- (2026-04-15) WSL on Windows can silently lose file edits when switching git branches — the working tree may revert to the branch commit state. Always verify file content after branch switches.
- (2026-04-15T16:06:15Z) Azure Functions v4 loads every file matched by the `package.json` `main` glob during startup. If `src/functions` contains a Vitest file and the build bundles it, deployment can still succeed while every live `/api/*` route 404s because handler registration never finishes.
- (2026-04-15T16:06:15Z) `bicep-node` must stay external in the managed Functions ESM bundle. When esbuild inlines it, the generated function entrypoint throws `Dynamic require of "os" is not supported` on import, which blocks the whole API app from starting.
- (2026-04-15T15:20:19+00:00) Backend model routing in `packages/web/api/src/functions/converse.ts` should stay phase-based and server-side: only trusted `Phase.Generate` turns route to codex; all other, unknown, or untrusted phases stay on the default chat deployment.
- (2026-04-15T15:20:19+00:00) Client rehydration can restore UI phase context, but `messages[].phase` must never escalate backend model choice. Track trust separately in `packages/web/api/src/lib/session-store.ts` so hydrated sessions fail closed.
- (2026-04-15T15:20:19+00:00) `packages/web/api/esbuild.config.mjs` must exclude `*.test.ts` entries under `src/functions`; otherwise API builds emit bundled test files into `dist/functions/` and `cd packages/web/api && npx vitest run` can execute build artifacts.
- (2026-04-15T19:24:36.732Z) Phase-aware converse routing lives in `packages/web/api/src/lib/converse-model-router.ts`: only trusted server-owned `Generate` turns use `AZURE_OPENAI_CODEX_DEPLOYMENT` / `gpt-5.4`; all other or client-rehydrated phases stay on `AZURE_OPENAI_CHAT_DEPLOYMENT` / `gpt-5.4-mini`.
- (2026-04-15T19:24:36.732Z) Usage pricing in `packages/web/api/src/lib/usage-tracking.ts` must follow the router's pricing group, not model-name heuristics. Bare deployment names like `gpt-5.4` do not contain `codex`, so string-matching silently bills generate turns against chat pricing.
- (2026-04-15T19:24:36.732Z) Local/runtime config docs must show both `AZURE_OPENAI_CHAT_DEPLOYMENT` and `AZURE_OPENAI_CODEX_DEPLOYMENT`; leaving only `AZURE_OPENAI_DEPLOYMENT` or a `gpt-4o` fallback hides the real converse router contract.
- (2026-04-15T19:24:36.732Z) For routed model regressions, test the helper layer where the inner loops actually live: `chatCompletionWithTools()` owns tool-call rounds and `chatCompletionWithAutoContinue()` owns continuation retries. A top-level endpoint test alone cannot prove the deployment survives those internal hops.
- (2026-04-16) `BaseConnector.isAuthenticated()` returns `true` for `auth: { kind: 'none' }` connectors (SWA cookie auth). Components guarding live API calls with `isAuthenticated()` must also check `isMockMode() || isPlaygroundMode()` — the connector doesn't distinguish offline/playground from production for this auth kind.
- (2026-04-16) All `useA2UI()` calls must supply an `actionHandler` (even a no-op) if the component may host surfaces that fire `continue:` or other actions. Omitting the handler silently swallows actions and can stall wizard flows.
- (2026-04-17) `advancePhase()` must use `PHASE_DEFINITIONS.find()` + a safe fallback rather than `getPhaseDefinition()` which throws. Any function called on every LLM turn must be hardened against stale/hydrated strings from client rehydration. Use `isPhase()` type guard at API boundaries before trusting a string as a `Phase`.
- (2026-04-17) `Phase` enum values are lowercase strings (`"discover"`, `"design"`, etc.) — not PascalCase. Type guards and tests must use the actual runtime values, not the enum key names.
- (2026-04-20) Squad bot auth must resolve through `.squad/scripts/resolve-token.mjs`, not a compiled `packages/squad-sdk/dist/...` path. Worktrees may not contain built SDK artifacts, so prompts and lifecycle docs should call the checked-in script, which maps persona aliases (`Bender`/`Fry`/`Hermes`/`Leela`) to explicit per-role apps and now fails closed for write actions unless `SQUAD_ALLOW_WRITE_FALLBACK=1` is set deliberately.
- (2026-04-20T01:56:21.267-07:00) Ceremony workflow auth should source the intended app's numeric ID from repo-tracked identity records when the repo only provisions private-key secrets. For `squad-pr-retro.yml`, the user-selected Scribe identity is recorded in `.squad/identity/config.json` with app id `3414032`; wiring the workflow to `SQUAD_SCRIBE_APP_PRIVATE_KEY` keeps retro-log commit/PR attribution aligned with `sabbour-squad-scribe[bot]` without depending on a missing app-id secret.

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
**PRs merged this sprint:**
- #369 serialize-javascript 7.0.5 (CVSS 8.1 RCE, npm overrides pattern)
- #373 Sanitization + ReDoS fixes (26 CodeQL alerts, 5 files)
- #375 hono 4.12.14 + follow-redirects 1.16.0 upgrades
- #371 crypto.randomUUID session IDs (Math.random → Web Crypto)
- Auth handler fix: Playground useA2UI() no-op actionHandler + AzureResourceForm SKIP_LIVE_ARM_CALLS guard

**Security decisions shipped:**
- Sanitization: regex/he for Node.js packages; DOMPurify for browser-only packages
- ReDoS: polynomial regexes rewritten to linear-time in data-binding.ts, skill-policy.ts, in-memory.ts
- Transitive dep pinning: npm overrides pattern for when direct upgrade is unavailable
- CI permissions: explicit permissions blocks required in all workflow files
- Insecure randomness: crypto.randomUUID() mandatory for all security-sensitive IDs

**K8s icon catalog work:**
- Updated system-prompt.ts allowlist + examples for all 7 new DRA/Inference icon keys
- Updated component-catalog.ts ArchitectureDiagram notes with new keys
- Bender-side surfaces done before Fry completed SVG assets

**Learnings:**
- `BaseConnector.isAuthenticated()` returns true for `auth: { kind: 'none' }` (SWA cookie auth) — ARM guards must check `isMockMode()||isPlaygroundMode()` independently
- All useA2UI() calls must supply an actionHandler; omitting it silently swallows actions

**Next:** Monitor #359–#363 (remaining CodeQL alerts not yet addressed in this sprint).

---

## 2026-05-15 Agents SDK Backend Adapter

**PR #447 — feat(api): OpenAI Agents SDK backend runtime adapter**
- **Commit:** 58a6d50 (squad/445-agents-sdk-backend-adapter)
- **Issue:** #445 (implements DP approved in #330)
- **New files:** agents-azure-provider.ts, agents-session-adapter.ts, agents-route-planner.ts, agents-sse-adapter.ts, agents-runner.ts (+ 4 test files)
- **Modified:** converse.ts (feature flag gate), package.json (@openai/agents ^0.8.3 + openai ^6.34.0)
- **Pattern:** SDK is behind `KICKSTART_AGENTS_SDK=true`; existing path unchanged when unset
- **Security:** tracing disabled globally, SSE adapter uses explicit allowlist, TTL/principal ownership preserved

**Learnings:**
- `@openai/agents` `run()` top-level function does NOT accept `modelProvider` in options — it belongs in the `Runner` constructor: `new Runner({ modelProvider })`. The `run()` options type is `NonStreamRunOptions`.
- `AzureOpenAI` from `openai` pkg has a `#private` field preventing direct structural assignment to `OpenAI`. The cross-package ESM/CJS resolution mode mismatch also triggers TypeScript errors. Use `azureClient as any` for the `openAIClient` field of `OpenAIProvider`.
- `vi.stubEnv` sets env vars to strings, including empty strings. Use `||` (falsy coalescing) instead of `??` (nullish coalescing) when falling back on deployment names — `"" ?? fallback` returns `""`, not `fallback`.
- SDK `tool()` parameters field requires `ZodObjectLike | JsonObjectSchemaStrict | JsonObjectSchemaNonStrict | undefined`. Raw JSON Schema objects from the tool registry must be cast via `as any` to satisfy the union.
- `AgentInputItem` is a Zod-validated union type — the `role` property is not on the union itself. Access it via `(item as { role?: string }).role` in tests and type guards.
- `AssistantMessageItem` in the SDK requires a `status` field (`"completed" | "in_progress" | "incomplete"`). Omitting it fails Zod validation at `addItems()` call time.
## 2026-04-17 Issue #445 Spawn — OpenAI Agents SDK Backend Adapter

**Context:** Leela's DP #330 closeout approved the hybrid route planner + manager agent architecture. Locked implementation sequence: Gate approval (received 2026-04-17T01:53Z) → arch spike + Azure compat → **[CURRENT: Bender #445]** backend runtime adapter → UI adaptation (#446, Fry) → cleanup.

**Issue #445:** Backend SDK adapter (v1.0.0 implementation)

**Acceptance Criteria include all Zapp security conditions:**
1. Server-enforced allowlist of app-callable MCP tools (default-deny behavior)
2. Mode-aware message verification (null-origin + same-origin sandbox variants)
3. Mandatory restrictive CSP in bundled app, verified in CI
4. Strict A2UI validation: schema checks, payload size limits, component count/depth limits, fail-closed fallback
5. Per-session principal/channel ownership checks and replay/audit protections on every app tool call
6. Security compatibility matrix across VS Code, Claude Code, ChatGPT hosts

**Plus DP #330 architecture requirements:**
- SDK handles run/tool/session/streaming/tracing
- Route state authoritative (server-authored, no model-emitted `phaseComplete`/`filesComplete`)
- Generate orchestration custom (workspace-first constraint enforced)
- Result adapter allowlist-only (no raw SDK traces/unfiltered outputs to browser)
- Principal-bound resume: `(sessionId, runId, principalId)` with fail-closed + audit logging

**Status:** Spawned 2026-04-17T03:30:17Z, still running.

## 2026-04-17 Round 3: Issue #445 Implementation Complete

**Sponsor Issue:** #445 — Backend SDK adapter for OpenAI Agents SDK migration  
**PR:** #447 — squad/445-backend-adapter  
**Status:** ✅ Implementation complete, both reviews approved, ready for merge

**Implementation Scope:**
All 6 security conditions from DP #329 + DP #330 security reviews integrated as issue #445 acceptance criteria.

**Push Cycle History:**

1. **Initial Implementation:** Server-enforced MCP tool allowlist (default-deny), workspace/session ownership enforcement, TTL expiry with fail-closed behavior, A2UI validation and bounds checking.

2. **Cycle 2 (commit a3899e5):** Resolved Leela's blocking duplicate-message finding. Applied de-duplication filter to streaming loop for consecutive identical assistant messages. Added unit tests for deduplication.

3. **Cycle 3 (commit 634cadf + additional):** Resolved remaining Zapp security conditions. Added hijack/token-tampering tests. Verified lockfile integrity. All acceptance criteria verified.

**Test Coverage:**
- 1511 tests passing (zero regression)
- All security conditions have explicit test cases
- De-duplication verified with unit tests
- Hijack scenario tests: invalid sessionId, cross-principal access, token tampering

**Review Outcomes:**
- ✅ **Leela (Code Review):** APPROVED — duplicate-message bug fixed, no scope creep, demonstrates no-lockout directive
- ✅ **Zapp (Security):** APPROVED — all 4 blocking conditions satisfied with test evidence

**Next Step:** Merge by Ralph (coordinator) per implementation sequence lock from DP #330.

## Round 5 Learnings (2026-04-17 — Issue #453 backend, PR #458)

- (2026-04-17) **8KB cap pattern for debug metadata strings:** When threading large strings (e.g., system prompts, raw LLM payloads) through `DebugMetadata`, apply a hard cap (8 192 bytes / 8 KB) at the point of assignment — not at serialization time. Use `value.slice(0, 8192)` with a trailing `…` indicator if truncated. This keeps the debug payload bounded regardless of how the metadata object is consumed downstream.
- (2026-04-17) **Prod startup warning pattern:** When a feature is debug-only (gated by `DEBUG_MODE` or equivalent), emit a `console.warn` on process startup if the flag is detected in a production environment (`NODE_ENV === 'production'`). The warning message should name the flag, describe what it exposes, and instruct the operator to unset it. This was a Zapp condition and is now a standing pattern for all debug-flag-guarded features.
- (2026-04-17) **Threading optional fields through call stacks:** When adding an optional field to a deeply-nested type (`DebugMetadata`), trace every call site that constructs or passes the type and add the field with `undefined` as the default — do not rely on TypeScript's implicit `undefined` for optional properties, as some call sites use object spread patterns that will silently drop the field if it is not explicitly present in the spread source.

## Learnings

- (2026-04-17T12:06:45.293Z) For Step-1 rewrite seams, burn backend consumers off the compatibility package first and leave the shim only for the preserved shell. Swapping API/MCP imports, tsconfig paths, and bundle aliases to the canonical package shrinks the seam without adding runtime behavior to it.
- (2026-04-17T12:06:45.293Z) For raw A2UI v0.9 payloads, the safest Step-2 schema pattern is: preprocess the single top-level op key into an internal discriminator, validate through `z.discriminatedUnion`, then drop the synthetic discriminator from the parsed output. That keeps the wire shape unchanged while still rejecting multi-op or extra-key payloads.
- (2026-04-17T12:06:45.293Z) Implemented v2 Step 3 PackRegistry/loaders in `packages/harness`: YAML frontmatter parsing, dependency-scoped registry reads, pack-owned namespace enforcement, wire-name support for user actions, path confinement, and iterative cycle detection. Kept the Node-backed runtime on package subpath exports instead of the root harness barrel so browser bundles do not pull in `node:fs`/`node:path` code.
- (2026-04-17T06:09:00Z) For Step-3/4 handoff surfaces, `SessionCtx` must retain an append-only `a2uiEmissions` array and `PackRegistry` should expose direct `getComponent()` plus aggregated `playgroundStubs`/`playgroundScenarios` reads so downstream pack-core/playground work can stay on harness contracts instead of rewalking pack manifests.
- (2026-04-17) `chat-a2ui` must normalize legacy `'handoff'` inputs onto `Phase.Assess` and expose only the current harness phase set (`discover`, `assess`, `design`, `generate`, `review`, `deploy`). This keeps Step 2 helpers compatible with persisted legacy turns without reintroducing v1-only control-plane states.
- (2026-04-17T12:06:45.293Z) Step-2 `Pack` should stay dir-based for agents/skills (`agentsDir`/`skillsDir`) while inline arrays remain only for contributions without a file-authoring model. Mixing both surfaces creates ambiguous registry contracts for later steps.
