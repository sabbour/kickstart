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

## Wave 36 — 2026-04-17

### DP #484 pack-github — Re-check APPROVE_WITH_CONDITIONS ✅
B1 ✅ `decodeURIComponent()` before allowlist + `..`/`%`/backslash rejection. B2 ✅ `SessionCtx.tokens` excluded from /api/packs, SSE, LLM context. B3 ✅ HTTPS-only OAuth routes, Secure+HttpOnly cookies, no log echoing. B4 ✅ All 6 GitHub playground stubs gated `KICKSTART_PLAYGROUND=true`. Security gate cleared for Step 9 implementation.

### DP #485 web-client A2UI renderer — Re-check APPROVE_WITH_CONDITIONS ✅
Crit1 ✅ `schema.parse()` pre-render validated. B1 ✅ missing confirmComponent → MessageBar + no resume POST. B2 ✅ resume POST body exactly `{sessionId,actionId,result}`. B3 ✅ `ReadonlyMap` + frozen contributions post-seal. B4 ✅ schema-projected merge, `__proto__` strip, 64KB/5-level limits. Implementation sign-off contingent on Step 10 PR demonstrating controls in code+tests.

### DP #486 Guardrails Engine — BLOCKED
Crit1: SSE block events expose guardrail name+reason = client oracle → must emit only opaque `{code,message}`. Crit2: secrets only blocked at tool stage; output stage still leaks → add `no-credential-leak` guardrail (input+output+tool, always-block). B1: blocked tool call continues turn execution → abort all remaining tool calls. B2: pack-ordering means packs can redact before core guardrails → core must run first on original payload, non-overridable. B3: redact chaining evaluates downstream on replacement text → use non-controllable sentinel or evaluate against both original+redacted. B4: `validate_artifacts` always-valid stub creates false assurance → fail-closed or @internal. B5: no duplicate-name rejection at registration → reject + reserve `core/` namespace. B6: fail-closed guarantee incomplete → add tests for all stage hooks including mutation paths.

### PR #550 (Step 5 Runner+SSE) — BLOCKED
3 high: (1) `POST /api/converse/resume` returns HTTP 200 for auth failures instead of 403/400. (2) Session fixation — `/api/converse` accepts caller-provided `sessionId` without OID ownership check. (3) Pending action schema stored by tool name only, not by `(sessionId,actionId)` pair. 2 medium: runner not aborted on client disconnect; no per-session lock on resume (duplicate continuation race). Positive: manifest fails closed (no stubs), playground gated, no token exposure in SSE/api/packs.

## Wave 37 — 2025-07-15

### DP #486 Guardrails Engine — Re-check REMAINS BLOCKED
B6 still outstanding: fail-closed acceptance tests omit payload-coercion failure case. Crit1+Crit2 and B1–B5 all resolved. One more revision required — add explicit payload-coercion test, then re-check.

### DP #487 MCP Adapter — BLOCKED (6 blockers)
High-severity: (1) UserActions must not be MCP tools; (2) bind execution+resume to `(sessionId, runId/actionId, principalId/connectionId)`; (3) `mcpExposed` must default `false`; (4) MCP args must be validated by same schemas as web path; (5) single-use interrupt semantics (atomic, TTL-bound, replay-safe); (6) guardrails must gate buffered MCP responses before return. Q3/Q4 answers provided (no raw bearer tokens; bind session to connectionId+principalId).
