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
