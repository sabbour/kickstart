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
- **Scope trade decision:** Demo ends at PR creation, not AKS deployment. Azure auth/provisioning deferred to next sprint. Honest, not faked.
- **Critical path:** #298 (surface ownership) → #275 (progressive flow) + #274 (GitHub OAuth) → #271 (deployment unblocked)
- **Dependency cluster confirmed:** #269 closed by #274, #271 closed by #274 + #275 combination
- **Deferred:** #272 (live pricing) and #277 (token tracker) — both self-described as non-blockers
- **Coding agent candidates:** #296 (subtitle sweep) and #299 (debug placement) — mechanical, well-scoped
- **Zapp mandatory** on #274 — OAuth is security-critical per routing rules
- **3 parallel tracks** after #298: Flow (#275→#271), GitHub (#274), Polish (#265/#273/#296/#299)
- **Key files:** Sprint plan at `.squad/decisions/inbox/leela-e2e-sprint-plan.md`

## 2026-04-15 Architecture Diagram Depth Decision

- **Issue #300**: Architecture diagram at DESIGN step is under-informed — shows only user-selected services as flat nodes, omits AKS infrastructure known from §7/§9 defaults (ACR, Gateway API, Key Vault, Workload Identity, CI/CD).
- **Root cause**: System prompt line 125 says only "ArchitectureDiagram showing the app and connected services". Example 3 (line 282) reinforces the flat pattern. Component catalog gives 2-node example.
- **Decision**: Three-tier model — Tier 1 (always: AKS subgraph, ACR, Key Vault, Gateway), Tier 2 (conditional: DB, cache, queue, AI), Tier 3 (annotations: CI/CD, Workload Identity, replicas). Use `diagram` prop with Mermaid subgraphs, not `nodes/edges`.
- **Key insight**: ArchitectureDiagram.tsx already supports subgraphs via raw Mermaid `diagram` prop — this is purely a prompt-layer fix.
- **Files affected**: `system-prompt.ts` (§2 STEP 2 + Example 3), `component-catalog.ts` (ArchitectureDiagram entry), `demo-scenarios.ts` (ARCHITECTURE scenario)
- **Assigned to**: Bender (implementation), Fry (rendering verification)
- **Decision file**: `.squad/decisions/inbox/leela-architecture-diagram-depth.md`
