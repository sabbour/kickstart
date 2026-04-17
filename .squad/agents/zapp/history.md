# Zapp — Security Architect History

## Core Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, Azure Static Web Apps, Azure OpenAI
- **Owner:** Ahmed Sabbour
- **Joined:** 2026-04-10

## Learnings

- 2026-04-10: Highest-risk patterns: frontend HTML injection (`dangerouslySetInnerHTML`) and unauthenticated AI endpoints. Security backlog #81–#88 OWASP-mapped.
- 2026-04-17: Resume semantics must bind `(sessionId, runId, principalId)` — result-shape validation alone is insufficient.
- 2026-04-17: `/api/packs` must project a safe DTO — never return raw registry objects, agent instructions, skill bodies, or pack-private structure to the browser.
- 2026-04-17: SKILL.md bodies are privileged prompt-control data; SSRF, prompt injection, and model-steering risks apply to skill selection logic.
- 2026-04-17: `resolve()`/`relative()` is lexical only — always canonicalize with `realpath` before confinement checks.
- 2026-04-17: Path allowlists must normalize (decode URI) before matching — anchored regexes are bypassed by `%2f`/`%2e` variants without decoding.
- 2026-04-17: `KICKSTART_PLAYGROUND=true` is the required gate for any pack stub that simulates auth or write operations. Missing confirms must fail closed, never auto-resolve.
- 2026-04-17: Block guardrail verdicts must take precedence over rewrite — short-circuit on first block; rewrites cannot downgrade a deny.

## Review Summary (full detail → history-archive.md)

| Issue / PR | Verdict | Key conditions / notes |
|-----------|---------|----------------------|
| DP #329 MCP App IDE | APPROVE_WITH_CONDITIONS | 6 conditions: tool allowlist, mode-aware origin, CSP, A2UI bounds, session ownership, host compat |
| v2 arch #473 | APPROVE (10 conditions) | MCP UserActions ≠ MCP tools; resume via POST `/api/converse/resume` |
| DPs #474–#478 | APPROVE_WITH_CONDITIONS (each) | See decisions.md + history-archive.md |
| PR #544 Step 1 | APPROVED | After `STEPWISE_GENERATION_V1` removed |
| PR #545 Step 2 | APPROVED (recheck) | `handoff`→`assess` fixed in `chat-a2ui.ts` |
| PR #546 Step 3 | APPROVED (recheck) | `realpathSync()` in `confinePath()` at `5c325db` |
| PR #547 Step 4a | APPROVED (recheck) | 4 playground-stub blockers fixed at `4eaa9ee` |
| PR #548 Step 4 | APPROVED (DNS rebinding `cef36b3`) | C1 symlink, C2 DNS, C3 guardrails all cleared |
| DP #479 Runner+SSE | APPROVE_WITH_CONDITIONS | 6 conditions (see archive) |
| DP #480 Skill Resolver | APPROVE_WITH_CONDITIONS | Registration-time validators, immutable registry |
| DP #482 pack-azure | APPROVED (after B3 re-check cycle) | arm_get allowlist-first order confirmed |
| DP #483 pack-aks | APPROVED (re-check) | DefaultAzureCredential, block>rewrite, aksPlaygroundStubs gate |
| DP #484 pack-github | APPROVED (re-check) | decode+forbidden-seq, SessionCtx.tokens opaque, HTTPS, stubs gated |
| DP #485 web client A2UI | **BLOCKED** | Crit1: props not schema-validated; B1: confirmComponent fails open; B2: resume boundary; B3: registry sealing; B4: props merge unsanitized |
