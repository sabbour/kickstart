# Sprint Retro — v0.2.0

**Date:** 2026-04-10  
**Facilitator:** Leela (Lead)  
**Milestone:** [v0.2.0](https://github.com/azure-management-and-platforms/kickstart/milestone/1)
**Milestone:** [v0.2.0](https://github.com/sabbour/kickstart/milestone/1)

---

## 1. What Shipped

12 issues closed, 11 PRs merged to `main` in a single sprint session.

| # | Title | Category |
|---|-------|----------|
| #59 | Restructure Playground to use A2UI Composer sidebar layout | Feature |
| #24 | Fix hybrid action model — unify button action format | Feature |
| #23 | Add /api/action endpoint | Feature |
| #22 | Wire action handler for A2UI components | Feature |
| #2 | Add questionnaire and markdown components to A2UI catalog | Feature |
| #28 | Add OIDC pipeline setup protocol to githubKit | Knowledge |
| #27 | Port KAITO/RAGEngine/Fine-Tuning knowledge to azureKit | Knowledge |
| #3 | Document kit component props in azureKit and githubKit prompts | Knowledge |
| #29 | Fix false 'no secrets to configure' claim in githubKit | Fix |
| #67 | Fix ~50 TypeScript CI errors blocking all PRs | Fix |
| #71 | Playground link on README should use full URL | Fix |
| #53 | Changesets & releases strategy | Chore |

### PRs Merged

| PR | Title |
|----|-------|
| #78 | fix: unify button action format to A2UI ActionSchema |
| #77 | feat: add anonymous route for /api/action endpoint |
| #76 | feat: Restructure Playground to use sidebar layout (#59) |
| #75 | fix(action): wire action handler for A2UI components |
| #74 | chore: PR workflow skill + team.md issue source |
| #73 | fix: update 15 Playwright E2E tests (#69) |
| #72 | fix: use full URL for playground links in README (#71) |
| #70 | chore: configure changesets & release strategy (#53) |
| #68 | fix: resolve ~50 TypeScript errors blocking CI (#67) |
| #66 | feat: add Questionnaire + Markdown components (#2) |
| #65 | feat: batch prompt knowledge updates |

---

## 2. What Slipped

No issues were moved out of v0.2.0 to later milestones. All 12 issues in the milestone were closed.

v0.3.0 was created as a forward-looking milestone with 9 issues (ServicePack, ServiceConnector, tool system, CORS proxy, fat A2UI packs, auto-continue, VSCode buttons, sidebar cleanup).

---

## 3. Velocity Check

- **Issues closed:** 12
- **PRs merged:** 11
- **Estimate:** No story point estimates were tracked on the project board for this milestone. Based on issue complexity, rough estimate is ~30-35 points (mix of features, fixes, knowledge work, and CI stabilization).
- **Duration:** Single sprint session on 2026-04-10 (most PRs merged within a 3-hour window, 07:29–10:43 UTC).
- **Throughput:** Exceptionally high. The squad framework + PR workflow skill enabled rapid parallel work.

---

## 4. What Went Well

1. **CI split and stabilized** — TypeScript errors (#67, 50+ errors) were fixed, Playwright E2E tests updated (#73, 15 tests), and the pipeline now reliably passes.
2. **PR workflow skill created** — Consolidated the full issue→branch→PR→review→merge lifecycle into `.squad/skills/pr-workflow/SKILL.md`. This became the single reference for all agents.
3. **12 PRs merged in one session** — The squad framework enabled sustained, parallel output. Issues moved from open to closed rapidly.
4. **Changesets strategy shipped** — Release tooling (#53) is now in place, making this release possible with proper changelog generation.
5. **Sidebar layout restructure** — Major UX improvement (#59) landed cleanly with Playwright tests updated to match.
6. **Action system end-to-end** — Three linked issues (#22, #23, #24) shipped together, giving the app a complete button→API→handler pipeline.

---

## 5. What Should Change

1. **Charter boundary violation** — Leela (Lead) was incorrectly routed to write code (aria-expanded fix on PR #76). Leads review and architect; they don't write feature code. Routing must respect charter boundaries — Fry or Bender should have handled the implementation.
2. **Copilot reviewer never gives APPROVED** — The `copilot-pull-request-reviewer[bot]` only posts `COMMENTED` reviews, never `APPROVED`. This creates merge friction when branch protection requires an approval. Workaround needed or branch protection rules should be adjusted.
3. **Force pushes from rebase create noise** — The `--force-with-lease` pushes after rebase onto main create noisy GitHub notifications and can confuse review threads. Consider squash-merge earlier or reducing the number of rebase cycles.
4. **No story point tracking** — Velocity check was a rough estimate. Need to use the project board's Estimate field consistently so retros have real data.
5. **Playwright tests lagged behind UI changes** — Test updates (#73) were a separate issue rather than part of the feature PRs. Feature PRs should include test updates or flag test debt explicitly.

---

## 6. Action Items

| # | Action | Owner | Target |
|---|--------|-------|--------|
| A1 | Add routing guard: if task is code implementation, never route to Lead — spawn Fry or Bender instead | Leela | v0.3.0 |
| A2 | Update branch protection to not require Copilot approval, or add a bypass rule for bot-only reviews | Ahmed | v0.3.0 |
| A3 | Document force-push noise mitigation in PR workflow skill (e.g., avoid unnecessary rebases, squash-merge preference) | Leela | v0.3.0 |
| A4 | Require Estimate field on all issues at sprint planning time | Ralph | v0.3.0 |
| A5 | Feature PRs must update or create Playwright tests — add to PR checklist in workflow skill | Hermes | v0.3.0 |
