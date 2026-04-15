---

# Decision: E2E Demo Sprint Plan — No Faking, No Mocking

**Date:** 2026-04-15T09:34:03.404Z
**Updated:** 2026-04-15T09:34:03.404Z
**Author:** Leela (Lead)
**Status:** Active (v3 — scope expanded per Ahmed directive)
**Scope:** Sprint plan for making Kickstart end-to-end demo ready with real integrations

---

## Goal

A user walks through Kickstart from "describe your app" through file generation, GitHub repo creation, and Azure deployment — **zero fakes, zero mocks, zero dead ends.** Full pipeline, all real.

## Scope (Revised)

~~**v1 scope trade:** Demo ended at PR creation. Azure bits deferred.~~

**v3 scope (current):** Full E2E including Azure auth and deployment. Ahmed's directive: "include the Azure bits too." The GitHub OAuth App now exists — #274 is unblocked. No more external blockers.

**Demo flow target:**
```
DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF (GitHub) → DEPLOY (Azure)
```

Every phase backed by real infrastructure. Handoff/Deploy re-enabled conditionally (only when auth tokens are present).

---

## What Already Shipped / Ships Now

### PR #297 — Ship Immediately (Option A)

| Closes | What it does |
|--------|-------------|
| **#271** | Makes Review terminal (`nextPhase = null`), adds `client:download-project` action routing, wires ZIP download. No more dead-end screens. |
| **#269** | Prompt guardrail: LLM cannot hallucinate "repo created" cards. Engine prevents reaching Handoff/Deploy. |

**Action:** Merge PR #297 now. It's the safety net — users get a clean flow even before GitHub/Azure integration lands. Handoff/Deploy phases are deprecated but retained in code, ready for conditional re-enablement.

---

## Priority Tiers

### TIER 1 — Foundation (blocks everything else)

| # | Issue | Type | Why it's first |
|---|-------|------|----------------|
| 1 | **PR #297** | Fix (critical) | Merge now. Stops the dead-end flow. Closes #271, #269. Foundation for everything below. |
| 2 | **#298** — Chat surface ownership + phase bar regression | Bug (critical) | Surfaces mutate earlier turns, phase bar doesn't render. Every other issue touches chat rendering. |

### TIER 2 — Demo Spine (the real flow)

| # | Issue | Type | Depends on | Why this order |
|---|-------|------|------------|----------------|
| 3 | **#275** — Progressive conversation flow | Feature (critical) | #298 | The wizard skeleton. One-step-at-a-time pacing, phase state tracking. Must work for both current 4-phase flow AND future 6-phase flow when Handoff/Deploy re-activate. |
| 4 | **#274** — GitHub OAuth + real repo flow | Feature (high) | #298 | **UNBLOCKED — OAuth App exists.** Real sign-in, org selection, repo creation, file commit, PR. Re-enables Handoff phase conditionally. Needs Zapp security review. |
| 5 | **NEW** — Azure MSAL auth + AKS deployment flow | Feature (high) | #274 | Azure device-code/browser auth via MSAL. ARM API calls for AKS Automatic provisioning. Re-enables Deploy phase conditionally. **Needs issue creation.** Needs Zapp security review. |

**The #269/#271/#274 cluster is now resolved:** #269 and #271 closed by PR #297. #274 stands alone as real GitHub integration (unblocked).

### TIER 3 — Demo Polish (parallel track)

| # | Issue | Type | Depends on | Notes |
|---|-------|------|------------|-------|
| 6 | **#265** — File manager experience | Feature | #298 | Wire generated files into FileManagerSidebar, compact file list in chat. |
| 7 | **#300** — Architecture diagram prompt-layer depth | Feature | none | Prompt-only fix: AKS subgraphs, ACR, Key Vault, Gateway. Quick win, ships before #273. |
| 8 | **#273** — Architecture diagram (ELK + icons) | Feature | none | ELK layout engine, Azure icons, zoom. Benefits from #300 landing first. |
| 9 | **#299** — Debug action-event placement | Bug | none | Move debug output to separate panel. Quick fix. |
| 10 | **#296** — Subtitle 1 title sweep | Bug | none | Typography normalization across 11 components. Quick fix. |

### TIER 4 — Deferred (after E2E works)

| # | Issue | Type | Why defer |
|---|-------|------|-----------|
| 11 | **#272** — Live Azure pricing | Feature | "Not a demo blocker" per issue. Estimated pricing acceptable for demo. |
| 12 | **#277** — Session token/cost tracker | Feature | "Not a blocker" per issue. Nice-to-have for cost demos. |

---

## Dependency Graph

```
PR #297 (merge now) ─── closes #271, #269
  │
#298 (surface ownership)
  ├── #275 (progressive flow) ──────────────────┐
  ├── #274 (GitHub OAuth — UNBLOCKED) ──────────┤── re-enable Handoff
  ├── #265 (file manager)                       │
  │                                             ├── NEW: Azure MSAL + AKS deploy
  │                                             │        ── re-enable Deploy
  #300 (arch diagram prompt) ── lands before ── #273 (arch diagram ELK)
  #299 (debug placement) ──────(independent)
  #296 (subtitle sweep) ───────(independent)
```

## Parallel Tracks

After #297 merges and #298 lands:

- **Track A (Wizard Flow):** #275 — Bender (prompt/backend) + Fry (frontend). Must design phase state to support conditional 4-phase or 6-phase flow.
- **Track B (GitHub):** #274 — Bender (OAuth service, device flow, pushTree, GitHubConnector) + Fry (A2UI components: GitHubLoginCard, AccountSelector, RepoForm, CommitCard, PRCard) + Zapp (security review). Re-enables Handoff phase.
- **Track C (Azure):** NEW — Bender (MSAL auth, ARM provisioning API, AKS Automatic resource creation) + Fry (AuthCard for Azure, DeploymentProgress with real status) + Zapp (security review). Re-enables Deploy phase.
- **Track D (Polish):** #300, #265, #273, #296, #299 — interleaved with Tracks A–C.

Tracks B and C can run in parallel once #298 and #275 are stable. Track C depends on Track B patterns (auth flow established by GitHub OAuth informs Azure auth structure).

---

## Execution Plan — Squad Assignment

### Phase 0: Ship Now

| Item | Assignee | Work |
|------|----------|------|
| **Merge PR #297** | **Leela** (approve) | Merge Option A. Review terminal, download action, prompt guardrails. Closes #271, #269. |

### Phase 1: Foundation (Day 1)

| Issue | Assignee | Work |
|-------|----------|------|
| **#298** | **Fry** | Fix surface ownership in useA2UI/useStreaming, restore phase bar rendering, turn-scoped surface IDs |
| **#300** | **Bender** | Prompt-layer depth fix: system-prompt.ts, component-catalog.ts, demo-scenarios.ts. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui` |
| **#296** | **@copilot** (Fry reviews) | Subtitle 1 sweep — 11 files, mechanical. |
| **#299** | **@copilot** (Fry reviews) | Debug panel extraction — small, well-scoped. |

### Phase 2: Core Flow (Day 1–2, starts when #298 merges)

| Issue | Assignee | Work |
|-------|----------|------|
| **#275** | **Bender** (prompt + backend phase state) + **Fry** (frontend phase UI) | Progressive flow with phase state machine that supports conditional 4→6 phase expansion. Design phase transitions so Handoff/Deploy activate when auth tokens are present. |
| **#274** | **Bender** (OAuth device flow, GitHub API service, GitHubConnector.pushTree) + **Fry** (GitHubLoginCard, AccountSelector, RepoForm, CommitCard, PRCard) | Full GitHub OAuth integration. Wire real device codes. Create repos, commit files, open PRs. Re-enable Handoff phase conditionally. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui`. **Zapp must review before merge.** |
| **#265** | **Fry** | Wire VirtualFS → FileManagerSidebar, compact file cards in chat, progress card rename |

### Phase 3: Azure Integration (Day 2–3, starts when #274 patterns are established)

| Issue | Assignee | Work |
|-------|----------|------|
| **NEW: Azure auth + deploy** | **Bender** (MSAL device-code auth, ARM REST API for AKS Automatic, deployment status polling) + **Fry** (AuthCard Azure rendering, DeploymentProgress real status) | Azure MSAL auth flow. AKS Automatic cluster + ACR provisioning via ARM. Re-enable Deploy phase conditionally. Follow auth patterns from #274. **Zapp must review before merge.** |
| **#273** | **Fry** (continued) | Finish ELK diagram. #300 should be merged by now. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui` |

### Phase 4: Convergence + Ship (Day 3–4)

| Task | Assignee |
|------|----------|
| E2E test: full 6-phase flow (Discover → Deploy) | **Hermes** |
| Security review: #274 OAuth + Azure MSAL + ARM calls | **Zapp** |
| Conditional flow test: 4-phase (no auth) vs 6-phase (auth present) | **Hermes** |
| Final architecture review | **Leela** |
| Release cut | **Bender** |

---

## Key Decisions

1. **PR #297 ships now** — immediate safety net, closes #271 and #269.
2. **Full E2E through Azure deployment is IN SCOPE** — scope trade reversed per Ahmed directive.
3. **GitHub OAuth App exists** — #274 has no external blockers. Remove registration risk.
4. **Azure auth/deploy needs a new issue** — Leela or Ahmed should create it, scoped to: MSAL auth, ARM provisioning, Deploy phase re-enablement.
5. **Handoff/Deploy re-enabled conditionally** — phases activate only when auth tokens are present. 4-phase flow remains the default for unauthenticated users.
6. **#275 must design for 6 phases** — progressive flow should account for the full pipeline, not just 4 phases.
7. **#274 patterns inform Azure auth** — GitHub OAuth device flow establishes the auth UX pattern; Azure MSAL follows the same structure.
8. **#272 and #277 remain deferred** — not demo blockers.
9. **#296 and #299 are coding agent candidates** — mechanical, well-scoped, Fry reviews.
10. **Zapp mandatory on #274 AND Azure auth** — both are security boundary crossings.
11. **Try-AKS reference:** `/mnt/c/Users/asabbour/Git/adaptive-ui` for #273, #274, #275, #300, and Azure auth reference.

---

## Issue Hygiene — Action Items

| Action | Owner |
|--------|-------|
| Merge PR #297 | Ahmed / Leela |
| Create issue: "Azure MSAL auth + AKS Automatic deployment flow" | Leela (recommend) |
| Update #274 description: remove "blocked by OAuth App registration" note | Leela |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ~~GitHub OAuth App registration missing~~ | ~~N/A~~ | ~~N/A~~ | **RESOLVED — App exists.** |
| SWA auth proxy needs config for GitHub OAuth callback | Medium | High — blocks #274 | Bender investigates SWA auth config in Phase 2 day 1. Fallback: SWA built-in GitHub auth provider. |
| Azure MSAL + ARM provisioning is larger than 1 sprint | Medium | Medium | Scope to AKS Automatic only (no custom clusters). Use ARM REST directly (no Terraform/Bicep in-app). Provisioning can be fire-and-forget with status polling. |
| Progressive flow prompt changes break existing scenarios | Medium | Medium | Hermes runs regression tests after #275. Iterative prompt changes. |
| ELK layout engine (#273) larger than estimated | Low | Low — not on critical path | Ship without ELK; Mermaid is functional. |
| Surface ownership fix (#298) has deeper root cause | Low | High — blocks everything | Fry has context from #182. Escalate to pair debugging if stuck > 1 session. |
| Conditional phase activation adds state complexity | Medium | Medium | Keep it simple: check for auth token presence at phase boundary. No complex feature flags. |

---

## Success Criteria

A human can:
1. Open Kickstart, describe an app
2. See progressive guided conversation (one step at a time)
3. See generated files in file manager sidebar (not dumped as code blocks)
4. See architecture diagram with AKS subgraphs, ACR, Key Vault, Gateway
5. Sign in to GitHub with real OAuth
6. Select a real org, create a real repo, commit files, create a PR
7. Sign in to Azure with real MSAL auth
8. Provision AKS Automatic cluster + ACR via ARM
9. See real deployment status (not fake progress cards)
10. **Without auth:** Flow ends at Review with project download (PR #297 baseline)
11. **With auth:** Full 6-phase flow through deployment
12. Zero fake cards, zero dead ends, zero hallucinated success messages
