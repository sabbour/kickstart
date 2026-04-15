---

# Decision: E2E Demo Sprint Plan — No Faking, No Mocking

**Date:** 2026-04-15T09:34:03.404Z
**Author:** Leela (Lead)
**Status:** Proposed
**Scope:** Sprint plan for making Kickstart end-to-end demo ready with real integrations

---

## Goal

A user walks through Kickstart from "describe your app" to "PR created on a real GitHub repo with a working GitHub Actions workflow" — zero fakes, zero mocks, zero dead ends.

## Scope Trade (Critical Decision)

**The E2E demo ends at PR creation, not AKS deployment.** Here's why:

- Real GitHub OAuth + repo creation + file commit + PR is achievable this sprint
- Real Azure auth + AKS provisioning is a separate epic (needs Azure OAuth, ARM APIs, provisioning wait states)
- The PR includes a GitHub Actions workflow that deploys to AKS — so deployment is real, just triggered by merge, not by the app
- This is honest, not faked: "merge this PR and GitHub Actions deploys to AKS Automatic"
- #271 (deployment flow blocked) gets resolved by: (a) #274 provides real GitHub flow, (b) #275's prompt guardrails prevent the LLM from entering unimplemented phases

**What we defer:** Azure auth, in-app AKS provisioning, live deployment status tracking. These become the next sprint.

---

## Priority Tiers

### TIER 1 — Foundation (blocks everything else)

| # | Issue | Type | Why it's first |
|---|-------|------|----------------|
| 1 | **#298** — Chat surface ownership + phase bar regression | Bug (critical) | Surfaces mutate earlier turns, phase bar doesn't render. If the chat can't correctly own and render A2UI components per-turn, nothing downstream works. Every other issue touches chat rendering. |

**Duration:** 1–2 sessions. Small surface area (useA2UI, useStreaming, MessageList, ChatMessage).

### TIER 2 — Demo Spine (the real flow, in order)

| # | Issue | Type | Depends on | Why this order |
|---|-------|------|------------|----------------|
| 2 | **#275** — Progressive conversation flow | Feature (critical) | #298 | The wizard skeleton. One-step-at-a-time pacing, phase state tracking, prompt guardrails. This is the connective tissue that makes the entire demo feel guided vs dumped. Also adds guardrails that prevent LLM from entering unimplemented phases (solving #271). |
| 3 | **#274** — GitHub OAuth + real repo flow | Feature (high) | #298 | Core differentiator. Real sign-in, real org selection, real repo creation, real file commit, real PR. Automatically closes #269 (fake repo card). Needs Zapp security review (OAuth is security-critical). |
| 4 | **#271** — Deployment flow unblocked | Bug (high) | #274, #275 | Resolved by combination: #274 replaces fake repo card, #275's prompt guardrails scope the demo to end at PR creation. Residual work: register AuthCard component shell (renders "coming soon" or redirects to GitHub Actions). |

### TIER 3 — Demo Polish (parallel track, no ordering dependencies)

| # | Issue | Type | Depends on | Notes |
|---|-------|------|------------|-------|
| 5 | **#265** — File manager experience | Feature | #298 | Wire generated files into FileManagerSidebar, compact file list in chat. Independent of auth flow. |
| 6 | **#273** — Architecture diagram (ELK + icons) | Feature | none | Self-contained component. ELK layout engine, Azure icons, zoom. Can start immediately. |
| 7 | **#299** — Debug action-event placement | Bug | none | Move debug output to separate panel. Quick fix, 1 session. |
| 8 | **#296** — Subtitle 1 title sweep | Bug | none | Typography normalization across 11 components. Quick fix, 1 session. |

### TIER 4 — Deferred (next sprint, after E2E works)

| # | Issue | Type | Why defer |
|---|-------|------|-----------|
| 9 | **#272** — Live Azure pricing | Feature | Issue itself says "not a demo blocker." Fallback to estimated pricing is acceptable for demo. |
| 10 | **#277** — Session token/cost tracker | Feature | Issue itself says "not a blocker." Nice-to-have for cost awareness demos. |

---

## Dependency Graph

```
#298 (surface ownership)
  ├── #275 (progressive flow) ──┐
  ├── #274 (GitHub OAuth) ──────┤── #271 (deployment unblocked)
  ├── #265 (file manager)       │
  │                             │
  #273 (arch diagram) ─────────(independent)
  #299 (debug placement) ──────(independent)
  #296 (subtitle sweep) ───────(independent)
```

## Parallel Tracks

Once #298 lands, three tracks can run simultaneously:

- **Track A (Flow):** #275 → #271 — Bender (prompt/backend) + Fry (frontend)
- **Track B (GitHub):** #274 — Bender (OAuth backend) + Fry (A2UI components) + Zapp (security review)
- **Track C (Polish):** #265, #273, #296, #299 — Fry (can be interleaved between Track A/B frontend work)

Track A and Track B converge at #271 (deployment unblocked).

---

## Execution Plan — Squad Assignment

### Phase 1: Foundation (Day 1)

| Issue | Assignee | Work |
|-------|----------|------|
| **#298** | **Fry** | Fix surface ownership in useA2UI/useStreaming, restore phase bar rendering, add turn-scoped surface IDs |
| **#273** | **Fry** (can start in parallel — independent) | Begin ELK layout engine swap, Azure icon integration |
| **#296** | **Fry** or **@copilot** | Subtitle 1 sweep — 11 files, mechanical change. Good candidate for coding agent with Fry review. |
| **#299** | **Fry** or **@copilot** | Debug panel extraction — small, well-scoped. Good candidate for coding agent with Fry review. |

### Phase 2: Core Flow (Day 1–2, starts when #298 merges)

| Issue | Assignee | Work |
|-------|----------|------|
| **#275** | **Bender** (prompt + backend phase state) + **Fry** (frontend phase UI) | System prompt rewrite for one-step-at-a-time pacing, phase state tracking in backend, transition templates, guardrails preventing unimplemented phases |
| **#274** | **Bender** (OAuth service, GitHub API integration) + **Fry** (OAuthCard, AccountSelector, RepoForm, CommitCard, PRCard A2UI components) | GitHub OAuth flow end-to-end. **Zapp must review** before merge (OAuth is security-critical). |
| **#265** | **Fry** | Wire VirtualFS → FileManagerSidebar, compact file cards in chat, progress card rename |

### Phase 3: Convergence (Day 2–3)

| Issue | Assignee | Work |
|-------|----------|------|
| **#271** | **Bender** + **Fry** | Verify #274 + #275 resolve the dead end. Register minimal AuthCard component. Update prompt to end flow at PR creation. |
| **#273** | **Fry** (continued) | Finish ELK diagram if not done in Phase 1 |
| All | **Hermes** | E2E test pass: full flow from app description → file generation → GitHub repo creation → PR |
| All | **Zapp** | Security review of #274 OAuth implementation |

### Phase 4: Ship (Day 3)

| Task | Assignee |
|------|----------|
| Integration test: full E2E walkthrough | **Hermes** |
| Final review of merged state | **Leela** |
| Release cut | **Bender** |

---

## Key Decisions Made

1. **Demo ends at PR creation** — not AKS deployment. Honest scope boundary.
2. **#269 is closed by #274** — no separate fix needed for fake repo card.
3. **#271 is closed by #274 + #275** — combination of real GitHub flow and prompt guardrails.
4. **#272 and #277 are deferred** — not demo blockers per their own descriptions.
5. **#296 and #299 are coding agent candidates** — mechanical, well-scoped, Fry reviews.
6. **Zapp mandatory on #274** — OAuth is a security boundary crossing.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub OAuth requires SWA auth proxy config changes | Medium | High — blocks #274 | Bender investigates SWA auth config early in Phase 2. Fallback: use SWA's built-in GitHub auth provider. |
| Progressive flow prompt changes break existing scenarios | Medium | Medium | Hermes runs regression tests after #275 lands. Prompt changes are iterative, not big-bang. |
| ELK layout engine (#273) is larger than estimated | Low | Low — not on critical path | Can ship demo without ELK; Mermaid diagram is functional, just not pretty. |
| Surface ownership fix (#298) has deeper root cause | Low | High — blocks everything | Fry has the context from original #182 work. If stuck > 1 session, Leela escalates for pair debugging. |

---

## Success Criteria

A human can:
1. Open Kickstart, describe an app
2. See progressive guided conversation (one step at a time)
3. See generated files in file manager sidebar (not dumped as code blocks)
4. See architecture diagram with proper layout
5. Sign in to GitHub with real OAuth
6. Select a real org, create a real repo
7. Commit generated files to the repo
8. Create a PR with a GitHub Actions workflow
9. Zero fake cards, zero dead ends, zero "coming soon" modals in the happy path
