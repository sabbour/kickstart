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
- v0.5.6 retro: sprint timing analysis, DP compliance audit, cross-branch contamination fix
- v0.5.0 multi-surface: security review intensive, postMessage origin validation, session auth spec
- v0.4.0 planning: wave structure refinement, velocity tracking, dependency mapping
- v0.3.0 retrospective: DP gate success, no-lockout directive validation, review cycle improvement

## Learnings

- **2026-04-15T22:27:37.636Z — Priority lane tracking on GitHub:** Encode sprint priority directly on GitHub issues using existing labels (`priority:p1`, `priority:p2`) plus cross-link comments. Each issue gets a pinned comment listing its related issues in the same lane. This makes priority visible on the issue page without requiring users to check local squad notes. Decision file: `.squad/decisions/inbox/leela-priority-tracking-github.md`
- **2026-04-15T09:46:31.308Z — Issue #265 smallest ship:** Treat `FileEditor` payloads as workspace data, not chat bubble content. The no-mock v1 is frontend-first: transform incoming `FileEditor` A2UI into compact file cards, mirror those files into `VirtualFileSystem`, auto-open the sidebar/viewer, and override generate-phase progress title client-side. Key paths: `packages/web/src/utils/chat-a2ui.ts`, `packages/web/src/App.tsx`, `packages/web/src/components/FileManager/`, `packages/web/api/src/lib/session-store.ts`.
- **2026-04-15T09:46:31.308Z — Issue #265 sequencing stays tight:** GitHub OAuth now being available and Azure deployment staying in scope does not widen #265. The file-manager slice remains a parallel generate/review UX track that should land before or alongside handoff/deploy work, not after it.

## Round 5: Design Review Cycle

**2026-04-14**
- Reviewed and approved DP #188 (expanded demo scenarios)
- Approved Fry's implementation readiness for issue #188

## 2026-04-15 PR Review & Merge Sprint

**Round 1 — File Manager Sidebar Merge**
- Reviewed and merged PR #252 (feat: file manager sidebar with tree view and file viewer, closes #201)
- Architecture: FileManagerSidebar + FileViewer components in `packages/web/src/components/FileManager/`
- Follows existing patterns: Griffel, Fluent UI, barrel exports, VirtualFS context consumption
- Noted non-blocking issue: highlight.js language registrations duplicated between ChatMarkdown and FileViewer — candidate for shared `hljs-setup.ts` module
- Layout.tsx extended with additive optional props (`fileManagerSidebar`, `fileViewer`, `showFileSidebar`, `showFileViewer`)
- Key files: `FileManagerSidebar.tsx`, `FileViewer.tsx`, `index.ts` barrel, Layout.tsx, App.tsx
- Outcome: Squash-merged, CI green

**Round 2 — Bug Fix Reviews & Merges**
- Reviewed and merged PR #247 (3 TypeScript fixes: missing module, null type, wrong variable)
  - Outcome: Merged, CI green
- Reviewed and merged PR #248 (E2E test fix: added exact:true to getByRole)
  - Outcome: Merged (already merged by CI automation), CI green

**Summary:** 3 PRs merged, 5 issues closed (includes #201 via #252), CI maintained at green
## 2026-04-14 Round 2: DP Review + Team Leadership

- **Reviewed DPs #186 & #187**: Approved both with guidance. #186 requires security hardening (immutable pinning, prompt-injection checks) before Phase 1.
- **Approved PR #213**: Choice components fix. Clean, additive change.
- **Team status**: Zapp flagged #186 security concerns; Fry delivered hash-based nav; Bender merged SWA deployment automation.
- **Next:** Address #186 security gate before starting Phase 1.

## 2026-04-15 E2E Demo Sprint Planning

- **Sprint plan built** for making Kickstart demo-ready with no faking/mocking
- ~~**Scope trade decision:** Demo ends at PR creation~~ → **REVERSED v3:** Full E2E including Azure auth + deployment per Ahmed directive
- **PR #297 ships immediately** (Option A) — closes #271, #269. Makes Review terminal with ZIP download. Safety net while real auth lands.
- **GitHub OAuth App exists** — #274 no longer has external blockers. Registration risk removed.
- **Azure auth/deployment IN SCOPE** — MSAL device-code auth, ARM provisioning for AKS Automatic. Needs new issue creation.
- **Critical path:** PR #297 (merge now) → #298 (surface fix) → #275 (progressive flow, design for 6 phases) + #274 (GitHub OAuth, unblocked) → Azure MSAL + AKS deploy → full 6-phase E2E
- **Conditional phase activation:** Handoff/Deploy re-enable when auth tokens present. 4-phase flow stays default for unauthenticated users.
- **#274 patterns inform Azure auth** — GitHub OAuth device flow establishes the auth UX; Azure MSAL follows same structure.
- **Deferred:** #272 (live pricing) and #277 (token tracker) — both self-described as non-blockers
- **Coding agent candidates:** #296 (subtitle sweep) and #299 (debug placement) — mechanical, well-scoped
- **Zapp mandatory** on #274 AND Azure auth — both are security boundary crossings
- **4 parallel tracks** after #298: Wizard Flow (#275), GitHub (#274), Azure (new), Polish (#300/#265/#273/#296/#299)
- **#300** (arch diagram prompt depth) — prompt-only fix, lands before #273 (ELK engine). Bender owns.
- **Try-AKS reference:** `/mnt/c/Users/asabbour/Git/adaptive-ui`
- **Key files:** Sprint plan at `.squad/decisions/inbox/leela-e2e-sprint-plan.md`

## 2026-04-15 Sprint Planning Ceremony (Overdue)

- **Ceremony run** for v0.6.1 — full open backlog assessment (15 issues, 1 PR)
- **Board drift identified:** 12/15 issues had no milestone, all had stale `go:needs-research`, no priority labels on 11/15, #271/#269 open despite ready fix
- **Fixes applied:** All demo-critical → v0.6.1, created v0.7.0 for deferred, cleared stale labels on in-flight work
- **Burn now (4):** PR #297, #298, #299, #274 — do not interrupt
- **Burn next (5):** #300, #296, #275, #265, #266 — fire as Wave 1 when active lanes land
- **Blocked (2):** #301 (Azure, waits for #274), #273 (ELK, waits for #300)
- **Close (2):** #271, #269 — closed by PR #297
- **Defer (3):** #272, #277 → v0.7.0; #46 stays v0.6.0 (multi-week epic)
- **Fry is the bottleneck** — almost every issue has frontend surface. Mitigation: @copilot handles #296, #299 is quick, #273 is back-loaded.
- **Ralph's next wave:** Monitor BURN NOW completion → fire #300/#296/#275/#265/#266 in parallel
- **Key file:** `.squad/decisions/inbox/leela-sprint-planning-v061.md`

## 2026-04-15 Architecture Diagram Depth Decision

- **Issue #300**: Architecture diagram at DESIGN step is under-informed — shows only user-selected services as flat nodes, omits AKS infrastructure known from §7/§9 defaults (ACR, Gateway API, Key Vault, Workload Identity, CI/CD).
- **Root cause**: System prompt line 125 says only "ArchitectureDiagram showing the app and connected services". Example 3 (line 282) reinforces the flat pattern. Component catalog gives 2-node example.
- **Decision**: Three-tier model — Tier 1 (always: AKS subgraph, ACR, Key Vault, Gateway), Tier 2 (conditional: DB, cache, queue, AI), Tier 3 (annotations: CI/CD, Workload Identity, replicas). Use `diagram` prop with Mermaid subgraphs, not `nodes/edges`.
- **Key insight**: ArchitectureDiagram.tsx already supports subgraphs via raw Mermaid `diagram` prop — this is purely a prompt-layer fix.
- **Files affected**: `system-prompt.ts` (§2 STEP 2 + Example 3), `component-catalog.ts` (ArchitectureDiagram entry), `demo-scenarios.ts` (ARCHITECTURE scenario)
- **Assigned to**: Bender (implementation), Fry (rendering verification)
- **Decision file**: `.squad/decisions/inbox/leela-architecture-diagram-depth.md`

---

### 2026-04-15T22:27:37Z: Priority Tracking Session
**Outcome:** Priority labels and cross-links added to GitHub issues #333, #328, #327, #326, #331, #332. Decision recorded in decisions.md for future priority tracking workflow.
