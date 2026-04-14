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

- (2026-04-14 13:04) Triage pipeline fix: added project board assignment to squad-triage.yml, squad-heartbeat.yml, squad-issue-assign.yml. Added triage checklist to routing.md.
- (2026-04-14 11:02) Wave 1: SWA continuous deploy + version footer → PR #177 opened. Auto-deploy from main, version shows SHA.

## Learnings
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
