# Zapp — Security Architect History

## Core Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, Azure Static Web Apps, Azure OpenAI
- **Owner:** Ahmed Sabbour
- **Joined:** 2026-04-10

## Learnings

- 2026-04-10: Pre-v0.3.0 security audit completed. Highest-risk patterns were frontend HTML injection paths (`dangerouslySetInnerHTML`) and public AI endpoints lacking auth/throttling.
- 2026-04-10: `/api/converse` currently exposes full system prompts to clients on new sessions; treat system prompts as sensitive control-plane data.
- 2026-04-10: Security hardening backlog now tracked in Security milestone issues #81-#88 with severity and OWASP mapping.
- 2026-04-10: DP #30 (IntegrationKit lifecycle/dependency/auth extension) approved with conditions requiring transactional lifecycle rollback, cycle detection on re-registration, explicit auth schema validation, and documented trusted-kit boundary.

## Round 5: Multi-Round Security Reviews

**2026-04-14**
- Security review of DP #188 (demo scenarios) — approved
- Re-review of DP #186 (round 2) — identified 3 concerns
- Final review and sign-off on DP #186 (round 3) — approved for implementation
## 2026-04-14 Round 2: DP Security Review

- **Reviewed DPs #186 & #187**: #187 approved (low risk), #186 flagged with High/Medium concerns.
- **#186 blockers**: Immutable source pinning, prompt-safety validation, fail-closed + provenance.
- **Coordination**: Communicated security requirements to Leela; provided detailed guidance for Phase 1 hardening.

- 2026-04-15: Revision 4 on issue #326 approved from security side; prior blockers remained resolved with no regression, clearing security gate for #327/#328.

---

**2026-04-15T22:40:15Z — Scribe**: Issue #326 Revision 4 approved. Security gate post on #326#issuecomment-4256162191 logged. Ready for closure.

## 2026-04-17 DP #330 Security Review

**Review Date:** 2026-04-17T01:57:58Z  
**Issue:** #330 — spike: design OpenAI Agents SDK migration for less-rigid chat flow  
**DP:** Hybrid route planner + manager agent architecture

**Decision:** ✅ APPROVED WITH CONDITIONS

**Security Conditions (implementation acceptance criteria):**
1. Allowlist response adapter only — never expose raw SDK run items/traces/unfiltered tool outputs to browser
2. Principal-bound resume/session ownership — enforce `(sessionId, runId, principalId)` with fail-closed behavior + audit logging
3. Preserve session semantics — keep current TTL/expiry/ownership behavior; expired sessions/runs cannot be resumed
4. Guardrails additive only — server-side controls remain authoritative (rate limiting, content safety, auth/ownership, sanitization, workspace validation)
5. Dependency governance — pin SDK version, maintain lockfile integrity, run dependency/security scans, define upgrade/rollback procedure

**Consequence:** Security gate clear when conditions added as implementation acceptance criteria and verified by tests.

## 2026-04-17 DP #329 Security Review (Round 6 – MCP App IDE Surface)

**Review Date:** 2026-04-17T03:30:17Z  
**Issue:** #329 — DP: MCP App IDE surface (A2UI + ext-apps)
**DP:** Single-file React bundle deployed as MCP App resource, zero-trust postMessage sandbox

**Decision:** APPROVE WITH CONDITIONS

**Findings by Severity:**
- 🔴 **High:** MCP tool exposure from iframe runtime — without server-side allowlisting for app-originated calls, compromised iframe can attempt broader tool access
- 🟠 **Major (3):**
  1. postMessage trust model under host variance — `"*"` targetOrigin acceptable in null-origin sandbox only; `allow-same-origin` hosts must use explicit `event.origin` allowlist
  2. CSP missing in PoC — must be required in production as defense-in-depth
  3. A2UI payload parsing lacks strict bounds — unbounded component processing enables UI tampering / render-path DoS
- 🟡 **Minor:** Session ownership/replay protections not explicit — should be requirement
- 🟢 **Low:** Credential handling generally sound — API keys server-side, no token-in-iframe invariant enforced

**Required Security Conditions (implementation acceptance criteria):**
1. Server-enforced allowlist of app-callable MCP tools with default-deny behavior
2. Mode-aware message verification:
   - null-origin sandbox: strict source + schema + nonce/session binding
   - same-origin sandbox: strict origin allowlist + source validation
3. Mandatory restrictive CSP in bundled app, verified in CI
4. Strict A2UI validation: schema checks, payload size limits, component count/depth limits, fail-closed fallback
5. Per-session principal/channel ownership checks and replay/audit protections on every app tool call
6. Security compatibility matrix across VS Code, Claude Code, ChatGPT hosts

**Gate Status:** Conditionally clear for design proposal. Final implementation PRs must demonstrate all conditions with tests/evidence before Zapp sign-off.
- 2026-04-17: DP #329 (MCP App IDE surface) approved with conditions; key risks were app-tool overexposure, host-variant postMessage trust, missing mandatory CSP, and unbounded A2UI payload validation.

## 2026-04-17 Round 3: PR #447 Security Approval

**Sponsor Issue:** #445 — Backend SDK adapter for OpenAI Agents SDK migration  
**PR:** #447 — squad/445-backend-adapter

**Security Review Scope:**
All 4 critical security conditions from issue #445 acceptance criteria:
1. Server-enforced allowlist of app-callable MCP tools (default-deny)
2. Workspace gate bypass protection 
3. TTL expiry enforcement 
4. Test coverage for hijack scenarios + lockfile pinning

**Verification:**
- ✅ **MCP tool allowlist:** Backend route validates `toolName` against allowlist before forwarding to MCP server. Disabled tools return 403 Forbidden. Tests cover both positive (allowed) and negative (blocklisted) cases.
- ✅ **Workspace gate bypass:** Session ownership binding enforced at API boundary. Principal/channel checks block cross-workspace access. Audit logging captures attempted bypasses.
- ✅ **TTL expiry:** Session TTL strictly enforced; expired sessions return 401 Unauthorized. Resume semantics fail-closed when token invalid. No guest fallbacks.
- ✅ **Hijack tests:** Invalid/cross-principal sessionId rejected. Token tampering detected. Lockfile integrity enforced.

**Security Verdict:** ✅ **APPROVED WITH CONDITIONS** (applied `zapp:approved` label)
- All 4 blocking conditions satisfied with test evidence
- Dependencies pinned in package-lock.json (no floating semver)
- Dependency scans passed
- Integration with DP #329 + #330 security review validated

**Consequence:** Unblocks merge when Leela approval also present (verified as received).

## 2026-04-17T12:06:45Z — #474 DP Review + v2 Security Architecture Review

- **#474 DP review:** APPROVE_WITH_CONDITIONS. Standard seam-cutting conditions; playground stubs must be gated behind `KICKSTART_PLAYGROUND`.
- **v2 security architecture review (#473):** APPROVED WITH CONDITIONS. 10 conditions total.
  - 5 Critical (before Step 5): SSRF/fetch_webpage URL denylist, path traversal/write_file workspace prefix, resume handler OID ownership, resume resultSchema validation, playground stub fail-closed gate.
  - 3 High (before Step 7/12): ARM path injection Zod regex, MCP auth documented, MCP UserAction architectural separation confirmed.
  - 6 Medium: secrets detection, PII detection, A2UI guardrail scope, token budget ceiling, CSP audit, CSRF.
- **MCP UserAction resolution:** UserActions are NOT MCP tools. MCP client detects `user_action_required` and POSTs directly to `/api/converse/resume`. Residual conditions #3 and #4 (OID ownership + resultSchema) cover MCP-originated resume calls equally.
- **Decision filed:** `zapp-v2-security-review.md` merged to decisions.md.

## Wave 3 — 2026-04-17 Security Reviews Filed

### #474 Step 1 Shim Security (APPROVE_WITH_CONDITIONS)
- Seam is compile-only and time-bounded; no new exports/fallback logic.
- Delete v1 helpers fail-closed — no silent fallback to demo, mock, or legacy paths.
- All v1 feature flags removed entirely.
- Secret/auth trust boundaries must not move client-side during preservation work.
- Step 1 merge requires proof: deleted imports gone, preserved packages did not gain broader runtime access.

### Kickstart App Hotspot Hardening
- Resolve parent target origin before messaging; reject messages unless `event.source === window.parent` and `event.origin` matches trusted parent.
- Replace schema-driven `innerHTML` rendering with explicit DOM construction + URL allowlisting.
- Dynamic renderer dispatch validated with allowlisted own-property check before invocation.
- Decision filed as `zapp-kickstart-app-hotspot-hardening.md`.

### #475 Harness Types (APPROVE_WITH_CONDITIONS)
- `AgentOutput` must reject unknown fields; `intent` is closed enum.
- A2UI union enforces one-and-only-one operation key; hybrid messages fail outright.
- `SessionCtx` narrowed/redacted; credential access capability-scoped.
- CI/static checks enforce compile-only boundary; dynamic code-loading primitives rejected.
- Catalog validation remains a mandatory second gate at runtime.

### #476 Registry + Loaders (APPROVE_WITH_CONDITIONS)
- Pack-owned names only; namespace squatting prevented by name validation at index time.
- Dependency-scoped reference resolution; only canonical `:` names valid in frontmatter.
- Frontmatter parser: safe YAML only, no custom tags/functions, bounded aliases/size.
- Loader path confinement: `realpath` canonicalization, symlink escape rejected.
- Registry sealed after `seal()` — exported views frozen; concurrent lifecycle misuse fails closed.
- Cycle detection: bounded iterative DFS or Kahn algorithm.

## Wave 6 — 2026-04-17 Security Reviews Filed

### #477 pack-core (APPROVE_WITH_CONDITIONS)
- `core.fetch_webpage`: public-web-only, redirect blocking, DNS/IP private-range rejection, strict size/time bounds.
- File tools bound to session-scoped workspace/VFS; absolute paths, traversal, symlink escapes rejected.
- `core.validate_artifacts` pure + bounded: no shell-outs, no eval, safe parsers only.
- Registered-component validation required before forwarding `emit_ui` payloads.
- Pack manifests deep-frozen/cloned at registration time.
- Found `dangerouslySetInnerHTML` in `CodeBlock.tsx`, `Markdown.tsx`, `FileEditor.tsx`.

### #478 playground-on-registry (APPROVE_WITH_CONDITIONS)
- `playgroundStubs` validated against registered canonical UserAction names.
- Registry exposes frozen read-only snapshot after `seal()`.
- Packs in-tree/trusted only for v2. Fail-loud UI errors redacted to fixed user-safe text.

### PR #544 — REQUEST CHANGES → APPROVED
- Initial review blocked: `STEPWISE_GENERATION_V1` still in `infra/main.bicep:52-53,132-140`. Also noted `npm run build` fails on missing DOM globals in harness.
- Recheck (commit `1a62989`): flag fully removed from infra. No runtime occurrences. Applied `zapp:approved`.

### PR #545 — REQUEST CHANGES
- Blocking finding: `packages/harness/src/a2ui/chat-a2ui.ts` still preserves legacy `handoff` phase logic while the harness phase contract is now `discover/assess/design/generate/review/deploy`.
- Security impact: exported phase normalizer accepts deprecated state and rejects current `assess`, creating a control-plane mismatch that could become unsafe once runtime/UI wiring consumes the harness helper.
- Other checks passed: strict/discriminated schemas, closed `AgentOutput.intent`, opaque credential typing in `SessionCtx`, no dynamic code-loading primitives, harness build + targeted schema tests green.
- Decision filed: `.squad/decisions/inbox/zapp-pr545-review.md`.

## Wave 5 — 2026-04-17 PR #545 Security Review (v2 Step 2)

**PR #545 (Closes #475) — REQUEST CHANGES**
- **Blocking finding:** `packages/harness/src/a2ui/chat-a2ui.ts` still normalizes legacy `handoff` phase. Current harness contract has no `handoff` phase (`discover → assess → design → generate → review → deploy`). Helper rejects current `assess` phase — trust-boundary mismatch on persisted state. Fails DP check #5.
- **Required fix:** Align `chat-a2ui.ts` with current phase contract; add tests for accept/reject.
- **All other checks passed:** `AgentOutput` strict + closed enum, A2UI discriminated union fail-closed, `SessionCtx` credentials opaque (`unknown`), no `eval`/dynamic `import`, harness build + tsc + vitest green.
- **Process note:** GitHub blocked `REQUEST_CHANGES` (author = reviewer = repo owner). Finding posted as PR comment instead.
- Filed `zapp-pr545-review.md` → decisions.md.
