# Sprint Plan: v0.3.0
**Date:** 2026-04-10  
**Release Target:** 2026-04-24 (2 weeks)  
**Team:** Fry (Frontend), Bender (Backend), Hermes (Test)  
**Lead:** Leela (Architecture)

---

## Executive Summary

v0.3.0 focuses on **foundational service architecture + component authoring**. After closing #79 (already fixed), we have **8 issues** organized in 3 execution waves:

- **Wave 1** (Week 1): Independent items + foundational patterns  
  - ServiceConnector (auth + API), CORS proxy, auto-continue middleware, VSCode buttons
- **Wave 2** (Mid-sprint): Architecture layer  
  - ServicePack abstraction, LLM tool system
- **Wave 3** (Week 2): Component packs  
  - A2UI packs (Azure + GitHub) built on ServicePack

**Total Story Points:** 34 (Fibonacci estimate)  
**Velocity:** 17 pts/week (conservative 2-week sprint)  
**Risk:** ServicePack design critical path; unblocks both A2UI packs

---

## Issues (8 total, 1 closed)

### CLOSED
- **#79** ✅ Remove Theater/Tutorial from Playground sidebar menu  
  - Fixed in PR #76. Closed.

### OPEN (v0.3.0 Sprint)

#### Wave 1: Foundational & Independent (4 issues)

| # | Title | Assignee | Area | Story Points | Wall Clock | Status |
|---|-------|----------|------|--------------|-----------|--------|
| **#25** | Build ServiceConnector pattern (auth + API) | Bender | Backend | **8** | 2–3 days | Pending |
| **#34** | Build CORS proxy backend | Bender | Backend | **5** | 1.5 days | Pending |
| **#37** | Implement auto-continue middleware | Bender | Backend | **3** | 0.5 day | Pending |
| **#44** | Bring back VSCode launch & MCP install buttons | Fry | Frontend | **3** | 0.5 day | Pending |

**Wave 1 Total:** 19 story points | ~4.5 days work

**Dependencies:** None (all independent or self-contained)

**Wall Clock (parallel):** ~2 days (Bender on #25/#34/#37, Fry on #44 in parallel)

---

#### Wave 2: Architecture Layer (2 issues)

| # | Title | Assignee | Area | Story Points | Wall Clock | Status |
|---|-------|----------|------|--------------|-----------|--------|
| **#30** | Create ServicePack abstraction | Leela (design) + Bender (impl) | Architecture | **8** | 1.5 days | Pending |
| **#26** | Implement LLM tool system (function calling) | Bender | Backend | **5** | 1.5 days | Pending |

**Wave 2 Total:** 13 story points | ~3 days work

**Dependencies:**  
- #30 depends on #25 (ServiceConnector pattern)  
- #26 depends on #25 (ServiceConnector) + #30 (ServicePack)

**Wall Clock:** ~3 days (after Wave 1: design #30 in parallel with #25 completion, then implement)

---

#### Wave 3: Component Packs (2 issues)

| # | Title | Assignee | Area | Story Points | Wall Clock | Status |
|---|-------|----------|------|--------------|-----------|--------|
| **#31** | Build fat A2UI components — Azure pack | Fry | Frontend | **5** | 1.5 days | Pending |
| **#32** | Build fat A2UI components — GitHub pack | Fry | Frontend | **5** | 1.5 days | Pending |

**Wave 3 Total:** 10 story points | ~3 days work

**Dependencies:**  
- Both #31 & #32 depend on #30 (ServicePack abstraction)  
- Can run in parallel

**Wall Clock:** ~2 days (parallel, after ServicePack design phase)

---

## Execution Timeline

```
Week 1 (Days 1–5):
  Mon–Tue   [Wave 1] Bender #25, #34, #37 | Fry #44 (parallel)
  Wed–Thu   [Overlapping] Finalize Wave 1 | Leela designs #30 | Begin #30 impl
  Fri       [Wave 2 kickoff] Bender #26 (blocks on #30 design completion)

Week 2 (Days 6–10):
  Mon–Tue   [Wave 3] Fry #31, #32 (parallel) | Bender cleanup/tests
  Wed–Thu   [Polish] Tests, docs, PR reviews
  Fri       [Release] v0.3.0 shipped
```

**Critical Path:** #25 → #30 (design) → #26, #31/#32  

---

## Story Point Breakdown

**Fibonacci scale:** 1, 2, 3, 5, 8, 13

- **#25 (ServiceConnector):** 8 pts
  - Requires interface design, 2 OAuth implementations (MSAL + GitHub), token mgmt, React Context
  
- **#34 (CORS proxy):** 5 pts
  - Backend endpoint, proxy logic, middleware setup
  
- **#37 (auto-continue middleware):** 3 pts
  - Middleware pattern, state transitions, simple logic
  
- **#44 (VSCode buttons):** 3 pts
  - UI components, event handlers, launch logic
  
- **#30 (ServicePack abstraction):** 8 pts
  - Design phase (Leela) + implementation (Bender)
  - Must handle component registration, provider setup, validation
  
- **#26 (LLM tool system):** 5 pts
  - Tool registration, function calling protocol, Azure OpenAI integration
  
- **#31 (A2UI Azure pack):** 5 pts
  - 3–4 fat components, authentication required, ServicePack consumer
  
- **#32 (A2UI GitHub pack):** 5 pts
  - 3–4 fat components, authentication required, ServicePack consumer

**Total:** 34 story points

---

## Team Capacity & Velocity

- **Bender (Backend):** 5 issues (#25, #34, #37, #26, +#30 impl)
  - ~21 story points
  - Capacity: ~17 pts/week (2-week sprint)
  - ✅ Fits (slight overload, but sequential waves)

- **Fry (Frontend):** 3 issues (#44, #31, #32)
  - ~13 story points
  - Capacity: ~17 pts/week
  - ✅ Fits comfortably

- **Leela (Lead):** Design #30, code review, architecture
  - Unblocked until mid-sprint
  - ✅ Available for design + technical reviews

- **Hermes (Tester):** Tests throughout, accessibility audits
  - Lighthouse, WCAG, E2E coverage
  - ✅ Available for parallel testing

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| #25 (ServiceConnector) complexity | Medium | Start early; spike if OAuth flows more complex than estimated |
| #30 (ServicePack) design delays Wave 2/3 | Medium | Leela begins design as #25 approaches completion; pre-align patterns |
| Bender overload | Medium | Prioritize #25 > #34 > #37; defer polish if needed |
| Test coverage gaps | Low | Hermes parallel testing; E2E for all auth/API flows |

---

## Success Criteria

- [ ] All 8 issues moved to Done
- [ ] Story points > 30 pts completed (>90%)
- [ ] All PRs reviewed, merged, no blockers
- [ ] Test coverage > 80%
- [ ] WCAG A compliance for new components
- [ ] v0.3.0 release tagged and deployed

---

## Notes

1. **#79 Status:** Closed (fixed in PR #76 — Theater/Tutorial removed)
2. **#30 (ServicePack) Assignment:** Currently labeled `squad:leela`. Per directive, Leela designs architecture; implementation assigned to Bender. Will adjust label to `squad:bender` for implementation PR.
3. **Velocity:** Using 17 pts/week as conservative estimate; team can scale if iterations fast.
4. **Release Date:** Target 2026-04-24 (2 weeks from sprint start)
