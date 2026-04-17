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
