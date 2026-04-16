---
updated_at: 2026-04-16T05:51:43.085Z
mode: process-reset-then-design
focus_area: Sprint planning ceremony, then architecture design spikes (#330, #329)
active_issues: [330, 329]
blocked_issues: [332]
---

# What We're Focused On

**v0.7.0 shipped. The burndown is complete. Process reset starts NOW.**

The demo-sprint lanes (297, 298, 299, 274, 301, 265, 300, 331) are all done. #338 confirmed fixed. #332 remains blocked on live credentials (P2, v1.0.0 — no action until external deps clear).

## Immediate Priority Order

1. **Merge PR #341** — DOMPurify 3.4.0 security bump. Fixes mXSS and prototype pollution. Safety-first.
2. **Sprint planning ceremony** — scope post-v0.7.0 milestones, reassess board, calibrate estimates. Leela facilitates. This was committed to and is now overdue.
3. **#330 — Agents SDK migration design** (P1, v1.0.0) — Leela writes the DP. Architecture spike, no code. Can proceed in parallel with ceremony since it doesn't consume implementation capacity.
4. **#329 — MCP App IDE surface design** (important, v0.7.0) — Leela writes the DP after #330, or in parallel if bandwidth allows. Depends on #46 epic direction.

## What's NOT Happening

- **No feature code** until sprint planning completes and the next sprint is scoped.
- **#332** stays blocked — needs live Azure/GitHub credentials and cross-system auth.
- **#46** stays as the parent epic — #329 is the active design slice.

## Rationale

Design spikes are process-compatible with a reset — they're architecture planning, exactly what a healthy process produces. The reset prevents premature code without proper DP gates. Writing DPs IS the gate.

## Reference Projects

- [adaptive-ui-try-aks](https://github.com/sabbour/adaptive-ui-try-aks) — Existing "Ship It" prototype (TypeScript/Vite, conversational AI guide for AKS deployment)
- [portal-prototyper](https://github.com/azure-management-and-platforms/portal-prototyper) — Azure Portal UX framework (zero-dependency static HTML/CSS/JS)
