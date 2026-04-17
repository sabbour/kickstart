# Zapp — History Archive

## 2026-04-10: Initial security audit
- Pre-v0.3.0 audit: highest-risk = `dangerouslySetInnerHTML` frontend injection + unauthenticated AI endpoints.
- `/api/converse` exposed full system prompts; treat as sensitive control-plane data.
- Security backlog #81–#88 with severity + OWASP mapping.
- DP #30 approved: transactional lifecycle rollback, cycle detection, auth schema validation, trusted-kit boundary.

## 2026-04-14/15: Multi-round DP security reviews
- DP #186/#187: #187 approved; #186 required immutable source pinning, prompt-safety validation, fail-closed + provenance.
- Issue #326 Revision 4 approved; security gate cleared for #327/#328.

## 2026-04-17: DP #330 Security Review — APPROVED WITH CONDITIONS
Hybrid route planner + manager agent. Conditions: allowlist-only response adapter, principal-bound `(sessionId, runId, principalId)` resume, session TTL/expiry preserved, server-side guardrails additive-only, SDK dependency pinned + scanned.

## 2026-04-17: DP #329 Security Review (MCP App IDE Surface) — APPROVE WITH CONDITIONS
🔴 MCP tool overexposure from iframe. 🟠 postMessage host-variance, missing CSP, unbounded A2UI parsing. 🟡 No session replay protections. Conditions: server-enforced tool allowlist, mode-aware origin verification, mandatory CSP, strict A2UI bounds, per-session ownership + replay protection, compatibility matrix across VS Code/Claude Code/ChatGPT.

## 2026-04-17: PR #447 Security Approval — APPROVED WITH CONDITIONS
MCP tool allowlist ✅, workspace gate bypass ✅, TTL expiry ✅, hijack tests ✅. Applied `zapp:approved`. Unblocks merge.

## 2026-04-17T12:06:45Z: #474 DP + v2 Architecture Review
- #474 APPROVE_WITH_CONDITIONS: seam compile-only + time-bounded; stubs gated behind `KICKSTART_PLAYGROUND`.
- v2 architecture (#473) APPROVED WITH CONDITIONS (10 total): 5 Critical (SSRF denylist, path traversal prefix, resume OID ownership, resultSchema validation, playground fail-closed); 3 High (ARM path injection Zod regex, MCP auth documented, MCP UserAction separation); 6 Medium.
- MCP UserAction: NOT MCP tools — MCP client POSTs directly to `/api/converse/resume`.

## Wave 3: Step 1 shim + #475/#476 security reviews
- #474 shim: compile-only, time-bounded, no new exports, v1 flags deleted, no auth trust migration, proof required.
- Kickstart app hotspot: `event.source` + `event.origin` validation, DOM construction replaces `innerHTML`, allowlisted renderer dispatch.
- #475 harness types: `AgentOutput` strict + closed enum, A2UI one-op-only, `SessionCtx` least-privilege, CI enforces compile-only, catalog validation second gate.
- #476 registry: pack-owned names, dep-scoped resolution, safe YAML only, `realpath` confinement, `seal()` immutable, iterative cycle detection.

## Wave 6: #477 + #478 security reviews
- #477 pack-core: `core.fetch_webpage` public-web-only + redirect/DNS bounds; file tools workspace-scoped; `validate_artifacts` pure + safe parsers; `emit_ui` pre-forwarding validation; pack manifests deep-frozen. Found `dangerouslySetInnerHTML` in CodeBlock.tsx/Markdown.tsx/FileEditor.tsx.
- #478 playground: `playgroundStubs` validated against registered canonical names; registry frozen after `seal()`; fail-loud errors redacted to user-safe text.

## PR #544: REQUEST CHANGES → APPROVED
Initial block: `STEPWISE_GENERATION_V1` still in `infra/main.bicep:52-53,132-140`. Recheck after commit `1a62989`: flag fully removed from infra. Applied `zapp:approved`.

## Wave 5: PR #545 — REQUEST CHANGES
`chat-a2ui.ts` still normalizes legacy `handoff` phase; harness contract now has no `handoff`; rejects current `assess`. Control-plane mismatch. Other checks passed. Required: remap `handoff` → `assess`, tests for accept/reject. Filed `zapp-pr545-review.md`.

## Wave 6: PR #546 — REQUEST CHANGES
`frontmatter.ts` lexical-only path confinement (`resolve()`/`relative()` + `statSync()` follows symlinks). Symlink inside pack root pointing outside passes check. Required: `realpath` canonicalization before comparison + `lstat` guard + regression test. Filed `zapp-pr546-review.md`.

---
## Archived from history.md — 2026-04-17 wave 34 summarization

### DP #479 Runner+SSE — APPROVE_WITH_CONDITIONS
6 conditions: resume ownership `(sessionId,runId,principalId)`, `/api/packs` safe DTO, SSE discriminated-schema validation, skill content off wire, UserAction resume data-only, pendingUserAction TTL.

### DP #480 Skill Resolver — APPROVE_WITH_CONDITIONS
Add registration-time skill text validators, rendered-string token accounting, immutable registry, tests for mutation/glob/no-content-logging.

### PR #545 — APPROVED (recheck)
`handoff`→`assess` normalization in `chat-a2ui.ts`. Phase ids: discover/assess/design/generate/review/deploy.

### PR #546 — APPROVED (recheck)
`confinePath()` in `frontmatter.ts` at `5c325db` uses `realpathSync()` before `startsWith` check.

### PRs #545+#546 merged — Steps 2+3 complete

### PR #547 — BLOCKED then APPROVED
4 blockers (duplicate stubs, seal() no-freeze, prototype-pollution, dev error leaks). Fixed at `4eaa9ee`: throw on duplicate, `ReadonlyMap` snapshot, redacted production errors.

### PR #548 — BLOCKED then APPROVED
3 blockers (symlink confinement, SSRF DNS rebinding, guardrails unenforced). C2 (DNS rebinding) fixed at `cef36b3` with `resolveAndCheckHostname()`. `zapp:approved` applied.

### DP #482 pack-azure — BLOCKED then APPROVED
5 conditions (arm_get allowlist, deploy_bicep server-only, token storage, /api/packs redaction, playground gate). B3 re-check cycle: allowlist-first order (`!ARM_PATH_RE` → throw, then `ARM_PATH_DENY` → throw). Fully approved after B3 final.

### DP #483 pack-aks-automatic — BLOCKED then APPROVED
3 high blockers (aks:deploy credential boundary, block>rewrite precedence, playground gate). All cleared: `DefaultAzureCredential()` server-only, block short-circuit, `aksPlaygroundStubs` gated on `KICKSTART_PLAYGROUND=true`.

### DP #484 pack-github — BLOCKED then APPROVED
4 high blockers (api_get encoding bypass, token boundary, OAuth transport, playground gate) + 2 major (branch regex, PR body sanitizer). All cleared: `decodeURIComponent()` + forbidden-seq before allowlist, `SessionCtx.tokens` opaque, HTTPS-only + Secure+HttpOnly cookies, all 6 stubs fail-closed.

### DP #485 Web Client A2UI Renderer — BLOCKED
Crit1: component props not schema-validated before render (raw props reach GenericBinder without `schema.parse()`). B1: missing confirmComponent fails open. B2: resume/credential boundary under-specified. B3: registry sealing not evidenced. B4: Phase D event.args + props merge unsanitized. Non-blocking: CSP-compatible if pure React lookup, sanitizeHtml() already in use for HTML sinks, URL-bearing components need https: allowlist.
