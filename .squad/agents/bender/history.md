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

- (2026-05-15) Agents SDK adapter: Implemented `@openai/agents` SDK backend runtime adapter for Issue #445 — 5 new modules (agents-azure-provider, agents-session-adapter, agents-route-planner, agents-sse-adapter, agents-runner), feature-flagged via `KICKSTART_AGENTS_SDK=true`. PR #447 opened as draft.
- (2026-04-15 16:26) Heartbeat workflow fix: traced failing Ralph checks on merged PRs to the project-board step requiring `COPILOT_ASSIGN_TOKEN`; patched `.github/workflows/squad-heartbeat.yml` to fall back to `GITHUB_TOKEN`, then audited sibling workflows and added explicit `github-token` inputs/fallbacks in `squad-triage.yml`, `squad-issue-assign.yml`, `squad-label-enforce.yml`, and `sync-squad-labels.yml`.
- (2026-04-14 13:04) Triage pipeline fix: added project board assignment to squad-triage.yml, squad-heartbeat.yml, squad-issue-assign.yml. Added triage checklist to routing.md.
- (2026-04-14 11:02) Wave 1: SWA continuous deploy + version footer → PR #177 opened. Auto-deploy from main, version shows SHA.
- (2026-04-15 16:06) SWA outage triage: latest deploy was packaging 18 API entrypoints, including `converse.test.ts`, and bundling `bicep-node` into the function ESM output. Both crashed module import before handlers registered, which explains the live `/api/*` 404s. Fixed `packages/web/api/esbuild.config.mjs` to exclude `*.test.ts`/`*.spec.ts` and keep `bicep-node` external.

## Learnings
- Heartbeat board-assignment steps that use `actions/github-script` must always fall back from `COPILOT_ASSIGN_TOKEN` to `GITHUB_TOKEN`. If the PAT secret is unset, the action fails before the script can early-return or downgrade GraphQL/project errors to warnings.
- SWA deploy workflow (`deploy-swa.yml`) needs explicit `push → branches: [main]` trigger — tag-only triggers mean no continuous deployment from main.
- `__BUILD_VERSION__` in `vite.config.ts` can embed git SHA via `execSync('git rev-parse --short HEAD')` — works both locally and in CI without relying on `GITHUB_SHA` env var.
- Footer version display should use a single unified string (`version-sha`) rather than showing version and SHA separately — reduces redundancy and makes each build uniquely identifiable at a glance.
- GitHub Projects V2 API requires GraphQL (`addProjectV2ItemById` mutation) -- REST API does not support user-level projects. Must discover project node ID first via `user(login).projectV2(number)` query.
- For user-owned projects (not repo projects), `COPILOT_ASSIGN_TOKEN` PAT with `project` scope is required -- `repository-projects: write` permission alone is insufficient.
- WSL on Windows (`/mnt/c/`) has line ending issues -- files may be CRLF or LF depending on git config. Always detect EOL before doing byte-level edits.
- Concurrent git operations from multiple agents cause `index.lock` contention -- use retry loops with lock removal for shared repos.
- (2026-04-14 17:44) System prompt's ABSOLUTE RULES section had a passive question→component hint that the LLM ignored for binary/either-or questions. Fixed by adding explicit NON-NEGOTIABLE rules, an "Either/or" row in the component selection table, and two new examples (Buttons-in-Row + RadioGroup) for 2-option questions. PR #213.
- LLM examples are the strongest prompt steering mechanism — the model follows demonstrated patterns over stated rules. If a pattern has no example, the LLM will default to plain text. Always add an example for every major component pattern.
- (2026-04-14 17:44) Updated DP on #186 (Public Copilot Skills) to address Zapp's security review: added SHA-only immutable pinning (no branches/tags), prompt-injection defense-in-depth (delimiter sandboxing + automated policy scanning + content hashing), full provenance metadata on every public skill, and fail-closed sync pipeline with size/timeout/policy controls. Tagged Zapp for re-review.
- When ingesting third-party content into LLM system prompts, defense-in-depth requires structural isolation (delimiters + preamble), automated policy scanning (directive detection), and content hashing — HTML stripping alone is insufficient against prompt injection.
- (2026-04-14 17:44) Final DP hardening on #186: addressed Zapp's 3 remaining concerns — (1) commit signature verification + trusted org allowlist + optional Sigstore attestation for supply chain authenticity, (2) executable code-fence patterns escalated from warn→reject + structured JSON representation instead of raw markdown in prompts, (3) explicit no-runtime-fetch invariant with zero network imports in skill loader + ESLint guard. Tagged Zapp for final sign-off.
- Supply chain security for third-party content requires authenticity verification beyond SHA integrity — verified commit signatures (git verify-commit / GitHub API verification) plus trusted org allowlists are the minimum; Sigstore attestations add CI provenance.
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

---

## 2026-04-16 FSM Removal Completion

**PR #385 — Remove FSM from core engine**
- **Commit:** cb3fe0a (squad/384-fsm-removal-cleanup)
- **Deleted:** machine.ts, phases.ts, FSM test suite
- **Replaced:** ConversationState.currentPhase + linear advancePhase() pattern using PHASE_DEFINITIONS.nextPhase
- **Impact:** ~40% state boilerplate reduction, simpler phase extension model
- **Pattern:** Position-based phase status (calculate from order index, not status maps)
- **Status:** PR open, awaiting squad review
- **Integration:** Ready for Fry's system-prompt.ts restructuring (commit 8d3ed53) + Leela's docs update (PR #383)

**Learnings:**
- FSM was over-engineered for strictly linear phase flow — simpler state machine (single currentPhase variable) is more maintainable
- Phase status should be derived from position in PHASE_DEFINITIONS, not stored separately
- Keeping PHASE_DEFINITIONS + Phase enum preserves all phase-management patterns (getPhaseDefinition, getPhaseOrder)

---

## 2026-04-16 Sprint Retro — Security + Generation Sprint

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
