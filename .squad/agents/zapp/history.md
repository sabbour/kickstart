# Zapp — Security Architect History

## Core Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, Azure Static Web Apps, Azure OpenAI
- **Owner:** Ahmed Sabbour
- **Joined:** 2026-04-10

## Learnings

- 2026-04-10: Highest-risk patterns: frontend HTML injection (`dangerouslySetInnerHTML`) and unauthenticated AI endpoints. Security backlog #81–#88 OWASP-mapped.
- 2026-04-17: Resume semantics must bind `(sessionId, runId, principalId)` — validation of result shape alone is insufficient. Any DP/PR that introduces a resume handler must enforce ownership before resultSchema.
- 2026-04-17: `/api/packs` (or any registry-serving endpoint) must project a safe DTO. Registry contains agent instructions, skill bodies, prompt examples, and pack-private structure — never return raw registry objects to the browser.
- 2026-04-17: Skill SKILL.md bodies are privileged prompt-control data, not benign content. SSRF, prompt injection, and model-steering risks apply to selection logic.
- 2026-04-17: Path confinement with `resolve()`/`relative()` is lexical only — `statSync()` follows symlinks. Always canonicalize with `realpath` before comparing base to candidate path.

## Recent Review History (archived detail → history-archive.md)

- DP #330 (#445 backend) APPROVED WITH CONDITIONS; all 4 conditions verified in PR #447 → applied `zapp:approved`.
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS — 6 conditions: tool allowlist, mode-aware origin, CSP, A2UI bounds, session ownership, host compat matrix.
- v2 architecture #473 APPROVED (10 conditions). MCP UserActions = NOT MCP tools; POSTs to `/api/converse/resume`.
- #474/#475/#476/#477/#478 DPs all APPROVE_WITH_CONDITIONS (see decisions.md and history-archive.md for details).
- PR #544 APPROVED (after `STEPWISE_GENERATION_V1` removed from infra).
- PR #545 REQUEST CHANGES (fixed → approved by Leela; Zapp was waiting on re-check).
- PR #546 REQUEST CHANGES — symlink path-confinement bypass in `frontmatter.ts`; pending fix + regression test.

## 2026-04-17 — DP #479 Runner + SSE Security Review

**Verdict:** APPROVE WITH CONDITIONS

6 required conditions before implementation PR merges:
1. **Resume ownership bind** — `loadSession()` must enforce principal ownership. Server-issued opaque `actionId`/`runId` pair stored in `session.pendingUserAction`; reject mismatch exactly. Anonymous sessions: unguessable per-session nonce/cookie.
2. **`/api/packs` safe DTO** — return only component names + client-facing schemas + UserAction names/descriptions/confirm metadata. Never return agent instructions, skill bodies, prompt notes, tool executors, or registry internals.
3. **SSE server-side validation** — `a2ui`: discriminated schema + payload bounds + negotiated-catalog membership. `user_action_required`: dedicated schema, server-authored fields only. `done`/`handoff`/`intent`/`tool`: fresh allowlisted objects, never raw SDK event objects.
4. **Skill content + prompt material off wire** — no raw SDK traces, tool args/results, system prompts, skill bodies, or debug state. `chunk` = text-delta only.
5. **UserAction resume data-only** — client sends `{ sessionId, actionId, result }` only; server validates with stored `resultSchema`; client cannot specify tool name, scopes, or target run.
6. **Restart / TTL documented** — `pendingUserAction` expires with in-memory session; resume post-expiry fails closed with fresh-turn requirement.

## 2026-04-17 — DP #480 Skill Resolver Security Review

**Verdict:** APPROVE WITH CONDITIONS

Step 6 implementation must add:
- Registration-time skill text validators (SKILL.md bodies treated as privileged prompt-control data).
- Rendered-string token accounting (not just char/4 approximation for budget cap).
- Immutable registry returns (no mutation of resolved Skill objects after `seal()`).
- Tests covering: mutation attempts on resolved skills, glob pattern rejection on invalid syntax, no-content logging (skill bodies must not appear in observability output).

## 2026-04-17 — PR #545 Security Recheck

**Verdict:** APPROVED

Prior blocker (`handoff` phase id) resolved. `chat-a2ui.ts` now normalizes `handoff` → `assess`. Phase contract exports only valid v2 ids: `discover`, `assess`, `design`, `generate`, `review`, `deploy`. Targeted harness build + 4 test suites passed on PR head. No new regressions.

## 2026-04-17 — PR #546 Symlink Confinement Recheck

**Verdict:** APPROVED (`zapp:approved`)

`confinePath()` in `frontmatter.ts` at `5c325db` now applies `realpathSync()` to both pack root and candidate path before the `startsWith` confinement check. Symlink-escape blocker cleared. PR #546 is security-approved from confinement perspective.

## 2026-04-17 — PRs #545 and #546 merged

- **PR #545 (Step 2):** Blocked on `handoff` legacy phase in `chat-a2ui.ts`. Resolved with remap to `assess`. `zapp:approved` applied after recheck.
- **PR #546 (Step 3):** Blocked on symlink escape via lexical-only path confinement. Resolved with `realpathSync()` canonicalisation in `confinePath()`. `zapp:approved` applied after recheck.
Both PRs merged into v2-rewrite. Harness foundation (Steps 1–3) complete.

## 2026-04-17 — PR #547 Security Review

**Verdict:** BLOCKED

PR #547 fails four Step 4a security conditions: duplicate playground stub keys are silently overwritten, `seal()` does not freeze/snapshot `playgroundStubs`, stub aggregation/lookup uses a plain object instead of a prototype-safe map, and `usePlaygroundDispatch` leaks registered stub names plus raw error messages in dev MessageBars. `zapp:approved` was not applied.

## 2026-04-17 — PR #547 Security Review (v2 Step 4a: Playground on registry)

**Initial verdict:** BLOCKED — 4 security findings

1. **Duplicate stub keys silent overwrite** — `Object.assign` merge enables last-writer-wins hijacking.
2. **`seal()` does not freeze stubs** — only flips boolean; pack can mutate `pack.playgroundStubs` post-seal.
3. **Prototype-pollution risk** — plain object + `stubs[actionName]` lookup not hardened.
4. **Dev error text leaks internals** — stub key list and raw `err.message` exposed in MessageBar.

## 2026-04-17 — PR #547 Security Recheck (commit `4eaa9ee`)

**Verdict:** APPROVED — `zapp:approved` applied

All 4 blockers resolved:
1. Duplicate stub keys throw at registration time. ✅
2. `seal()` computes `_sealedPlaygroundStubs` once; `ReadonlyMap` snapshot immutable post-seal. ✅
3. `playgroundStubs` returns `ReadonlyMap<string, PlaygroundStub>`; dispatch uses `stubs.get()`. ✅
4. Production errors redacted to `Action not found` / `Action failed`. ✅

Validation: harness build ✅, web build ✅. Test failures in `mcp-server` action tests (pre-existing — expect old `discover → design` phase order, not `discover → assess → design`).
Decision filed: `.squad/decisions/inbox/zapp-pr547-recheck.md`

## 2026-04-17 — PR #548 Security Review (v2 Step 4: pack-core)

**Verdict:** BLOCKED (`zapp:approved` not applied)

Three high-severity findings:
1. **Workspace symlink confinement bypass** — `core.read_file`, `core.write_file`, `core.list_files` use `path.resolve()` prefix checks without `fs.realpath()`. Symlink inside workspace can escape. Fix: `realpath()` before confinement check + regression test.
2. **SSRF incomplete on `core.fetch_webpage`** — HTTPS + timeout enforced, but only literal hostname validated. Public hostnames resolving to private IPs and redirect chains to private hosts not blocked. Fix: post-DNS resolution validation or block-list; log + reject private-range hits.
3. **Registered guardrails not visibly enforced** — `token-budget`, `no-pii-in-logs`, `no-secrets-in-artifacts` registered in corePack but no runtime path calls `getGuardrailsByStage()`. Controls appear non-operative. Fix: runner must call `getGuardrailsByStage(stage)` and execute each guardrail before/after agent turn.

Additional: `validate_artifacts` returns `valid: true` unconditionally — stub that JSON consumers may trust too easily.

Clear: `emit_ui` validates via `A2UIMessageSchema`. No hardcoded credentials.

## 2026-04-17 — DP #482 pack-azure Security Review

**Verdict:** BLOCKED

Five security conditions must be satisfied before DP #482 can be re-reviewed:
1. Tighten `azure.arm_get`/`azure.what_if` path allowlist (replace `^/subscriptions/` with stricter scoped allowlist, validate after `{sub-id}` expansion, explicitly deny admin paths including `/providers/Microsoft.Authorization/elevateAccess`)
2. Define `azure:deploy_bicep` as server-only credential flow — no browser-provided bearer token passthrough; bound to session subscription/resource-group
3. Define Azure token storage explicitly — prefer `SessionCtx.getAzureCreds()` accessor; no raw token in client-visible state, SSE events, or manifest DTOs
4. Define `/api/packs` redaction boundary — expose only static UX metadata; no ARM endpoint URLs, subscription/tenant/client IDs, or secrets
5. Gate playground stubs on `KICKSTART_PLAYGROUND=true`; fail closed in non-playground environments

Passes: `resultSchema` coverage correct on all 6 user actions.

## 2026-04-17 — PR #548 Final Re-check (C2 DNS Rebinding)

**Verdict:** APPROVED — `zapp:approved` applied

Scope: C2 (SSRF DNS rebinding) only — the final outstanding blocker on PR #548.
Evidence at commit `cef36b3`:
- `resolveAndCheckHostname()` pre-fetches via `dns.resolve4()` + `dns.resolve6()`, checks all returned IPs against private/loopback regex, throws before `fetch()` on match.
- `fetch()` uses `redirect: 'error'` — redirect-based SSRF remains blocked.
- HTTPS-only enforcement still present in `assertSafeUrl()`.
- DNS rebinding tests cover public→private IPv4 (`192.168.1.1`) and public→loopback IPv6 (`::1`); verify `fetch()` not called on rebinding detection.
- `npm test -- --run fetch_webpage.test.ts` passed.

PR #548 is now security-cleared. `zapp:approved` applied.

## Wave 25 — 2026-04-17

### DP #482 pack-azure B3 regex re-check — BLOCKED (B3 still open)
- **Source:** `zapp-482-b3-signoff.md`
- **Issue:** #482 — v2 Step 7: pack-azure
- **Status:** BLOCKED — B3 not yet approved
- **Finding:** `validateArmPath()` still executes allowlist (`ARM_PATH_RE`) test but only runs `ARM_PATH_DENY.test(path)`. B3 requires explicit allowlist-first, denylist-second: (1) reject when `!ARM_PATH_RE.test(path)`, (2) reject when `ARM_PATH_DENY.test(path)`. Denylist alone is not fail-closed.
- **Next:** DP must be amended to show explicit allowlist enforcement before Zapp approval. B1–B2, B4–B5 status unchanged.

## Wave 26 — 2026-04-17

### DP #482 pack-azure B3 Final Sign-off — APPROVED
- **Source:** `zapp-482-b3-final.md`
- **Status:** APPROVE_WITH_CONDITIONS — DP #482 is now fully security-approved
- **B3 cleared:** `validateArmPath()` now enforces allowlist-first (`!ARM_PATH_RE.test(path)` → throw), then denylist (`ARM_PATH_DENY.test(path)` → throw). Fail-closed order confirmed.
- DP #482 implementation may proceed once #479 and #480 merge.

### PR #548 merged into v2-rewrite
- `zapp:approved` applied; PR #548 merged. Step 4 pack-core complete.
- All three security blockers cleared: C1 (symlink realpath), C2 (DNS rebinding), C3 (guardrail enforcement).

## 2026-04-17 — DP #483 pack-aks-automatic Security Review

**Verdict:** BLOCKED (3 high, 1 major, 1 medium)

1. **🔴 High — `aks:deploy` credential boundary unresolved** — must specify server-only credential path, session-bound target validation, least-privilege namespace-scoped RBAC, explicit ban on cluster-admin.
2. **🔴 High — guardrail verdict precedence unspecified** — DP introduces `block`+`rewrite` verdicts without priority rule; must define: all guardrails run, any `block` wins, rewrites cannot downgrade a block.
3. **🔴 High — `aks:deploy` playground stub not gated** — must require `KICKSTART_PLAYGROUND=true` gate; fail-closed; stubs excluded from production runtime.
4. **🟠 Major — `safeguards.json` load path inconsistent** — must be bundled/static import only; no runtime `fs`/path-based load.
5. **🟡 Medium — `aks.validate_safeguards` ReDoS** — linear-time regexes, compiled once at module load, manifest size/count ceilings required.

Non-blocking: warnings surface as UI output (not silent rewrite); no production debug bypass.
`zapp:approved` not applied. Decision filed: `.squad/decisions/inbox/zapp-483-dp-review.md`

## 2026-04-17 — DP #484 pack-github Security Review

**Verdict:** BLOCKED (4 high, 2 major)

1. **🔴 B1 — `github.api_get` allowlist not encoding-safe** — anchored regexes pass `%2f`/`%2e` traversal variants. Must decode path before matching; reject `.`, `..`, double-encoding; replace broad `.+` tails with per-endpoint segment validators; prefer constructing API URLs from validated owner/repo/ref params.
2. **🔴 B2 — Token boundary not fail-closed** — raw `SessionCtx.githubToken` too easily serialized into logs/SSE/DTOs. Must use opaque server-side handle; define `/api/packs` GitHub DTO (UX metadata only, no token/scopes/auth internals); add acceptance tests that no token appears in SSE or `/api/packs`.
3. **🔴 B3 — Login/secret transport not explicit** — OAuth code-exchange direction is right but must require HTTPS-only auth routes, Secure+HttpOnly cookies, no logging of auth codes/tokens/`set_secret` values.
4. **🔴 B4 — Playground stubs not gated** — Q5 cannot remain open; `github:login`, `github:create_repo`, `github:create_pr`, `github:set_secret` stubs must require `KICKSTART_PLAYGROUND=true`; fail closed in production.
5. **🟠 M1 — Branch name regex too permissive** — anchored and blocks traversal/shell, but still allows leading `.`/`-` and trailing `.lock`; must adopt stricter `git check-ref-format` semantics.
6. **🟠 M2 — PR body uses DOMPurify (HTML), not markdown-safe composition** — strips HTML/XSS but does not prevent markdown abuse (`@mentions`, autolinks, spam). Must template PR body from controlled fields or escape untrusted markdown.

`zapp:approved` not applied.

## 2026-04-17 — DP #483 pack-aks-automatic Security Re-check

**Verdict:** APPROVE_WITH_CONDITIONS ✅ — all 3 blockers cleared

- **B1 cleared:** `aks:deploy` uses `DefaultAzureCredential()` server-side; session `azureToken` restricted to read-only Contributor check only; bound to specific cluster `resourceId`.
- **B2 cleared:** `block` verdicts are final; Runner short-circuits on first block.
- **B3 cleared:** `aksPlaygroundStubs` gated on `process.env.KICKSTART_PLAYGROUND === 'true'`; returns `null` (fail-closed) when absent.

Conditions for Step 8 PR: (1) `DefaultAzureCredential()` only in deploy path, (2) #479 Runner enforces `block > rewrite` short-circuit, (3) `aksPlaygroundStubs` disabled unless flag set.


## 2026-04-17 — DP #485 Web Client A2UI Renderer Security Review

**Verdict:** BLOCKED

1. **🔴 Crit1 — component props are not currently schema-enforced before render** — the vendored renderer stores raw component properties and `GenericBinder` consumes them without a `schema.parse()` step, so LLM-originated `props` would reach registered component sinks unvalidated.
2. **🔴 B1 — missing `confirmComponent` fails open** — auto-resolving `{}` from a missing/unregistered confirm component can bypass explicit consent/credential UX. Missing confirm renderers must fail closed.
3. **🔴 B2 — resume/credential boundary still needs to be explicit** — Step 10 must inherit #479's rule: only `{ sessionId, actionId, result }` crosses the wire; server binds ownership and validates `result` against stored `resultSchema`; no credentials/tool metadata in SSE, `/api/packs`, debug state, or logs.
4. **🔴 B3 — registry immutability is assumed, not guaranteed** — the client catalog used for attacker-controlled `componentName` lookups must be a sealed immutable snapshot (`ReadonlyMap`, frozen contributions, no post-startup mutation).
5. **🟠 M1 — raw `event.args` + `confirmComponent.props` merge needs hardening** — strip dangerous keys, bound depth/size, and pass schema-projected DTOs only.

Decision filed: `.squad/decisions/inbox/zapp-485-dp-review.md`
