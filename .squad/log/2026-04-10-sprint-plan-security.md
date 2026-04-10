# Security Sprint Plan
**Date:** 2026-04-10  
**Facilitator:** Leela (Lead)  
**Milestone:** Security  
**Target Release:** v0.2.1 hotfix / v0.3.0 prep  

---

## Sprint Goal
Eliminate critical and high-severity security vulnerabilities identified in Zapp's codebase audit. All 8 issues will be resolved before v0.3.0 release, with a focus on XSS prevention, API authentication/rate limiting, and infrastructure secrets management. **Hard requirement:** All security PRs require architecture review from Zapp before merge.

---

## Completed Work (v0.2.0)
- **14 issues resolved**, **12 PRs merged**
- Sprint retro completed and action items closed
- Team velocity established: ~35 story points/sprint (baseline)

---

## Issues by Priority & Execution Order

### 🔴 CRITICAL PRIORITY (P0)
Execute in parallel, unblocked.

| # | Title | Assigned | Est. Points | Type | Notes |
|---|-------|----------|-------------|------|-------|
| #81 | XSS in assistant chat message rendering | Fry | 5 | Bug | DOM rendering, user input sanitization |
| #82 | XSS in CodeBlock/FileEditor highlight fallback | Fry | 5 | Bug | Component-level XSS, same mitigation pattern as #81 |
| #83 | Public AI endpoints lack auth and rate limiting | Bender | 8 | Feature | Implement middleware, depends on understanding current API surface |

**Parallelization:** #81 and #82 are independent (same engineer, same pattern). #83 is independent.  
**Blockers:** None.  
**Review Gate:** Zapp architecture review required before merge.

### 🟠 IMPORTANT PRIORITY (P1)
Execute after P0 critical issues are in flight.

| # | Title | Assigned | Est. Points | Type | Notes |
|---|-------|----------|-------------|------|-------|
| #84 | /api/converse exposes full system prompt | Bender | 3 | Bug | Depends on understanding API behavior from #83 audit |
| #85 | API handlers leak internal error details | Bender | 5 | Bug | Error handling across all endpoints, consistency work |
| #86 | Missing Content-Security-Policy header | Fry | 3 | Feature | Middleware configuration, works alongside #81/#82 |
| #87 | Infra secrets not integrated with Key Vault | Bender | 8 | Feature | Infrastructure config, CI/CD integration |

**Parallelization:** #84 and #85 can start once Bender completes API audit from #83. #86 can start immediately with Fry. #87 is independent.  
**Blockers:** #84/#85 weakly depend on #83 understanding.  
**Review Gate:** Zapp architecture review required before merge.

### 🟡 NICE-TO-HAVE PRIORITY (P2)
Execute if capacity remains after P0 + P1.

| # | Title | Assigned | Est. Points | Type | Notes |
|---|-------|----------|-------------|------|-------|
| #88 | Vulnerable transitive dev dependencies | Hermes | 2 | Maintenance | npm audit fix, regression testing required |

**Parallelization:** Independent, can be done anytime.  
**Blockers:** None.  
**Review Gate:** Standard code review (no security architecture required).

---

## Story Point Estimates

**Fibonacci Scale Used:** 1, 2, 3, 5, 8, 13

| Issue | Points | Rationale |
|-------|--------|-----------|
| #81 | 5 | Identify all XSS vectors in chat renderer, implement sanitization, test |
| #82 | 5 | Similar scope to #81, component-specific, reuse patterns |
| #83 | 8 | Full API audit, implement auth middleware, add rate limiting, test across all endpoints |
| #84 | 3 | Straightforward: redact system prompt from API response |
| #85 | 5 | Error handling across all handlers, audit for info leaks, standardize responses |
| #86 | 3 | CSP header configuration, browser testing, nonce generation if needed |
| #87 | 8 | Azure Key Vault integration, CI/CD secret injection, local dev setup |
| #88 | 2 | Run npm audit fix, verify no breaking changes, run full test suite |

**Total Sprint Estimate:** 39 story points

---

## Agent Capacity Allocation

| Agent | Capacity | Assigned Issues | Points | Notes |
|-------|----------|-----------------|--------|-------|
| **Fry** | 3 issues | #81, #82, #86 | 13 | Critical XSS work (#81/#82, 10 pts) + CSP (#86, 3 pts). Can be done in parallel. |
| **Bender** | 4 issues | #83, #84, #85, #87 | 24 | Largest scope: API audit + auth (#83, 8 pts), error handling (#85, 5 pts), secret mgmt (#87, 8 pts), prompt redaction (#84, 3 pts). Can parallelize #87 while doing API work. |
| **Hermes** | 1 issue | #88 | 2 | Dependency updates and regression testing. Light workload, can support ad-hoc testing. |

**Team Capacity Check:**
- Total capacity: ~35 pts (v0.2.0 baseline)
- Sprint estimate: 39 pts
- **Note:** Slight over-capacity due to critical security nature. Prioritize P0 → P1 → P2. If P0 critical issues finish early, staff can help Bender on #87 (infrastructure).

---

## Dependencies & Blockers

### Dependency Graph
```
#83 (API audit) ──→ #84 (prompt exposure)
                ├──→ #85 (error details)
                
#81 (XSS chat) ──→ #86 (CSP header) [optional coordination]
#82 (XSS component)

#87 (Key Vault) [independent]
#88 (npm audit) [independent]
```

### Critical Path
1. **#81/#82 (Fry):** Can start immediately, 2–3 days, ~10 pts
2. **#83 (Bender):** API audit, can start immediately, 3–4 days, ~8 pts
3. **#84/#85 (Bender):** Start after #83 API understanding, 2–3 days, ~8 pts
4. **#86 (Fry):** Can start immediately, 1 day, ~3 pts
5. **#87 (Bender):** Can start immediately, 2–3 days, ~8 pts (parallelize with API work)
6. **#88 (Hermes):** Can start immediately, <1 day, ~2 pts

**Recommendation:** Exploit parallelization. Week 1: P0 critical (#81/#82/#83) in parallel. Week 2: P1 important (#84/#85/#86/#87) in parallel. Week 3: P2 nice-to-have (#88) + buffer for retesting.

---

## Review Gates

### Zapp Architecture Review (Hard Requirement)
**All security PRs (#81–#87) require architecture review from Zapp before merge.**

- **What Zapp reviews:** Security design, threat modeling, compliance implications
- **What Zapp does NOT review:** Code style, formatting, nitpicks (standard reviewer does that)
- **Gate enforcement:** Add `@zapp` as required reviewer on all security PRs
- **SLA:** Target 24 hr architecture review turnaround

**Issues triggering architecture review:** #81, #82, #83, #84, #85, #86, #87  
**Issues NOT requiring architecture review:** #88 (dependency management, standard review)

---

## Definition of Done

### For Each Security Issue
- [ ] Code implemented and passes local tests
- [ ] All edge cases covered (test cases added or updated)
- [ ] **Zapp architecture review approved** (hard gate)
- [ ] Standard code review approved (Leela or relevant domain expert)
- [ ] CI/CD pipeline passes (unit tests, integration tests, linting)
- [ ] Security verification: manual test of fix, or automated test if applicable
- [ ] Documentation updated if user-facing (e.g., CSP header behavior)
- [ ] No regressions: full test suite green
- [ ] PR merged to `main`

### For Sprint Completion
- [ ] All 8 issues closed
- [ ] All PRs merged and tagged under v0.2.1 or v0.3.0
- [ ] Sprint retro completed
- [ ] Zapp sign-off: "Security audit findings resolved"
- [ ] Release notes drafted (security fixes section)

---

## Sprint Timeline

| Week | Owner | Focus | Issues |
|------|-------|-------|--------|
| Week 1 | All | Critical path: XSS + API auth | #81, #82, #83 (P0) |
| Week 2 | All | Important: error handling, CSP, secrets | #84, #85, #86, #87 (P1) |
| Week 3 | Hermes | Nice-to-have + retesting | #88 (P2) + smoke tests |

---

## Decisions & Assumptions

1. **Security-first execution:** P0 critical issues have hard deadline; P1 important issues have 7-day target; P2 nice-to-have is stretch goal.
2. **Zapp as gatekeeper:** All security PRs require Zapp's architecture review (non-negotiable). This adds 1 day to PR cycle.
3. **Parallel streams:** Fry (frontend XSS) and Bender (API/infra) can work independently most of sprint.
4. **Test-first for security:** All security fixes must include regression tests and edge case tests.
5. **No scope creep:** Only issues #81–#88 are in this sprint. Feature requests deferred to v0.3.0.

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Zapp unavailable for review | Blocker | Schedule review sessions upfront; async PR comments as fallback |
| XSS findings affect multiple components | Scope creep | Use #81/#82 as proof of concept; apply pattern to other components in v0.3.0 |
| Key Vault integration complexity | Delay | Assign Bender early; pair with infra engineer if available; use docs/samples |
| Transitive dependency conflicts | Regressions | Hermes runs full test suite after #88; quarantine dev-only vs prod deps |

---

## Success Criteria

✅ **Sprint succeeds if:**
1. All P0 critical issues (#81, #82, #83) are merged with Zapp approval by end of Week 1
2. All P1 important issues (#84, #85, #86, #87) are merged with Zapp approval by end of Week 2
3. All issues pass full regression testing
4. Zero security vulnerabilities in post-release audit
5. Zapp sign-off: "Findings addressed"

⚠️ **Sprint at risk if:**
- Any P0 issue unresolved after Week 1
- Zapp review blocked (escalate to lead)
- Regressions detected in testing
- New vulnerabilities discovered

---

## Next Steps

1. ✅ Sprint plan finalized (this document)
2. ⏳ Add story point estimates to GitHub Projects API (Leela, today)
3. ⏳ Comment on each issue with execution order & dependencies (Leela, today)
4. ⏳ Assign sprints/milestones in GitHub (Leela, today)
5. ⏳ Kick off Work: Fry starts #81/#82; Bender starts #83; Hermes preps #88
6. ⏳ Daily standup: 15 min sync on blockers, Zapp review SLA
7. ⏳ End of sprint: retro, velocity check, prep v0.2.1 release notes
