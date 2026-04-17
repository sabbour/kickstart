---
updated_at: 2026-04-17T14:30:00.000Z
mode: sprint-active
focus_area: v2 foundation — #475 + #476 in PR review; #477 A+B in flight; DPs #479–#480 in review
active_issues: [475, 476, 477, 479, 480]
blocked_issues: [478, 481, 482, 483, 484, 485, 486, 487, 488]
merged_issues: [474]
---

# What We're Focused On

**#474 MERGED into v2-rewrite.** The v1 runtime is gone. Harness is the new spine.

## Current State

| Issue | Status | Branch | Gate |
|-------|--------|--------|------|
| #474 Step 1 | ✅ MERGED (PR #544) | v2-rewrite | — |
| #475 Step 2 | 🔄 PR #545 open | squad/475-harness-types | leela:approved pending + zapp:approved pending (fixes in flight) |
| #476 Step 3 | 🔄 PR #546 open | squad/476-registry-loaders | leela:approved ✅, zapp:approved pending (symlink fix pushed) |
| #477 Step 4 | 🏗️ Phases A+B in impl | squad/477-pack-core | unblocked per Leela; C+D need #476 merged |
| #478 Step 4a | ⏳ Waiting on #476 merge | — | C1 resolved (registry extended); C2 pseudocode fix needed |
| #479 Step 5 | 📋 DP approved (conditions) | — | Leela+Zapp APPROVE_WITH_CONDITIONS |
| #480 Step 6 | 📋 DP in review | — | Leela APPROVE_WITH_CONDITIONS; Zapp in progress |

## Immediate Priority Order

1. **Merge PR #546** (#476) — leela:approved done; zapp recheck in flight
2. **Merge PR #545** (#475) — Pack type + handoff fixes pushed; re-reviews needed
3. **#477 Phases C–H** — tools, components, guardrails, pack manifest (after #476 merges)
4. **#478 implementation** — after #476 merges, pseudocode fix, full approvals
5. **#479 implementation** — after #477+#478 are green
6. **#480 implementation** — after #479

## What's NOT Happening

- **No Step 7-12 domain work before Step 5/6.** Azure, AKS, GitHub, web-client, guardrails, and MCP all sit behind the harness spine.
- **No reopening of old demo-sprint scope.** v2 is the lane; #332 remains externally blocked.

## Reference Projects

- [adaptive-ui-try-aks](https://github.com/sabbour/adaptive-ui-try-aks) — Existing "Ship It" prototype (TypeScript/Vite, conversational AI guide for AKS deployment)
- [portal-prototyper](https://github.com/azure-management-and-platforms/portal-prototyper) — Azure Portal UX framework (zero-dependency static HTML/CSS/JS)
