---
updated_at: 2026-06-10T00:00:00.000Z
mode: sprint-active
focus_area: v2 harness foundation — Steps 2-4a merged; #477 pack-core in PR #548 review; #479 next
active_issues: [477, 479, 480, 482]
blocked_issues: [481, 483, 484, 485, 486, 487, 488]
merged_issues: [474, 475, 476, 478]
---

# What We're Focused On

**Steps 2–4a MERGED.** Harness types, PackRegistry, and Playground on registry are all in v2-rewrite.

## Current State

| Issue | Status | Branch | Gate |
|-------|--------|--------|------|
| #474 Step 1 | ✅ MERGED (PR #544) | v2-rewrite | — |
| #475 Step 2 | ✅ MERGED (PR #545) | v2-rewrite | — |
| #476 Step 3 | ✅ MERGED (PR #546) | v2-rewrite | — |
| #478 Step 4a | ✅ MERGED (PR #547) | v2-rewrite | — |
| #477 Step 4 | 🔄 PR #548 in review | squad/477-pack-core | Leela + Zapp reviews in progress |
| #479 Step 5 | 📋 DP approved (conditions) | — | Waiting on #477 merge |
| #480 Step 6 | 📋 DP approved (conditions) | — | Waiting on #479 merge |
| #482 Step 7 | 📋 DP authoring in progress | — | Fry writing DP |

## Immediate Priority Order

1. **Merge PR #548** (#477 pack-core) — Leela + Zapp review in flight
2. **#479 implementation** — start immediately after #477 merges (Runner + SSE + /api/packs)
3. **#480 implementation** — after #479 merges (Skill resolver)
4. **#482 DP review** — Leela + Zapp review after Fry posts DP

## What's NOT Happening

- **No Step 8-12 domain work before Step 5/6.** AKS, GitHub, web-client, guardrails, and MCP all sit behind the harness spine.
- **No reopening of old demo-sprint scope.** v2 is the lane; #332 remains externally blocked.

## What's NOT Happening

- **No Step 7-12 domain work before Step 5/6.** Azure, AKS, GitHub, web-client, guardrails, and MCP all sit behind the harness spine.
- **No reopening of old demo-sprint scope.** v2 is the lane; #332 remains externally blocked.

## Reference Projects

- [adaptive-ui-try-aks](https://github.com/sabbour/adaptive-ui-try-aks) — Existing "Ship It" prototype (TypeScript/Vite, conversational AI guide for AKS deployment)
- [portal-prototyper](https://github.com/azure-management-and-platforms/portal-prototyper) — Azure Portal UX framework (zero-dependency static HTML/CSS/JS)
