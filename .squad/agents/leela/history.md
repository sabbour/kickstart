# Leela — Lead

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.

## Key Files
- `.squad/team.md` — team roster and capability profiles
- `.squad/ceremonies.md` — ceremony definitions and triggers
- `.squad/decisions.md` — canonical architecture decisions (last 5 kept here, older archived)
- `docs/architecture.md` — architecture overview and patterns guide
- `.squad/routing.md` — issue assignment and team boundaries

## Patterns
- **DP 3-step gate:** Issue → Design Proposal (on issue, not PR) → Leela + Zapp review → code implementation
- **PR discipline:** One PR per issue, design already approved, code review secondary
- **No-lockout directive:** Original author handles all post-review feedback
- **Wave structure:** Wave 1 (foundations), Wave 2 (integration), Wave 3 (E2E), Wave 4 (release)
- **Process directives:** Always stored in .squad/decisions/inbox/ for Scribe merge; not versioned inline

## Recent Work
- v2 sprint planning + #474 DP review: #474 → #475 → #476 blocking chain; APPROVE_WITH_CONDITIONS on #474
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS; DP #330 (Agents SDK) APPROVED + closed out
- PR #383 engineering docs rewrite (7 files); label-based review gate; comment-resolution process fix
- v0.6.1 deployment prep: vendor diagram assets, CI hardening, stepwise generation default

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.

## Learnings

- (2026-04-17T12:06:45.293Z) Sprint planning always required before backlog pickup when `.squad/identity/now.md` gate is active. Shortest v2 slice is harness spine, not pack work: `#474 → #475 → #476` must land before pack-core batch.
- (2026-04-17T03:30:17Z) DP #329: runtime duplication is the blocking risk — PoC adds `runtime/` inside `packages/mcp-server` that parallels `packages/web/api/` LLM client + session store. Third fork risk with SDK migration. Implementation issue must define canonical client before code lands.
- (2026-04-17T03:30:17Z) DP #330 closeout: Option B (hybrid route planner + manager agent) adopted. `phaseComplete`/`filesComplete` flags retired. Implementation sequence locked: Gate → arch spike → backend (#445, Bender) → UI (#446, Fry) → cleanup. Follow-ons #445 and #446 created.
- (2026-04-17T01:53:59Z) Review gate must be label-based, not GitHub approval-required, because repo owners cannot self-approve. `leela:approved` + `zapp:approved` labels drive `squad/review-gate` status check.
- (2026-04-17) Comment acknowledgment and thread resolution are non-optional — silently fixing code is a process violation. Reply to specific comment with SHA + description; resolve thread via GraphQL; verify 0 unresolved before merge.
- (2026-04-16T05:51:43.085Z) Design spikes producing DPs are process-compatible with sprint planning reset — blocking them on ceremony is circular. Spikes (DPs) run in parallel with ceremony.
- (2026-04-15T09:46:31.308Z) Issue #265 smallest ship: treat FileEditor payloads as workspace data, not chat bubble content. Paths: `chat-a2ui.ts`, `App.tsx`, `FileManager/`, `session-store.ts`.

## 2026-04-17 DP Reviews

**DP #329 (MCP App IDE Surface) — APPROVED WITH CONDITIONS**
- Resource registration via `registerAppResource` + `registerAppTool` canonical
- Single-file bundle with `vite-plugin-singlefile` required; CSP headers mandatory
- `event.source === window.parent` guard required
- Bundle size validation (vite-plugin-singlefile with full React + Fluent 2 + A2UI) before Slice 1 ships

**DP #330 (Agents SDK Migration) — APPROVED + CLOSED**
- Option B (hybrid route planner + manager agent) adopted
- Server-authored route state replaces model-emitted booleans
- Implementation: #445 (Bender backend), #446 (Fry UI)

## 2026-04-17 PR #447 Code Review + Approval

- Found duplicate-message bug in SDK streaming loop (blocking). Bender fixed in commit a3899e5.
- Applied `leela:approved`. 1511 tests passing, 0 unresolved threads.

## 2026-04-17 v2 Sprint Planning + #474 DP Review

- HOLD_FOR_PLANNING gate honored; sprint planning run first.
- Sprint plan: #474 → #475 → #476 blocking chain. Step 4+ frozen until #476.
- #474 DP: APPROVE_WITH_CONDITIONS. Seam-cutting pass approach confirmed.
- v2 architecture DP (#473): APPROVED. Guardrail enforcement semantics must be pinned before Step 11 (`error` SSE with `guardrail_block`). UserAction resume authz must be a done criterion in Step 5.
