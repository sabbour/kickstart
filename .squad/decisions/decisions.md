# Team Decisions & Plans

## Indexed Decisions

---

### Sprint Plan: v0.5.7 Bug-Fix Sprint

**Date:** 2026-04-14T10:49:56Z  
**Facilitator:** Leela (Lead)  
**Sprint Goal:** Fix critical A2UI rendering blocker and resolve P1 UI/UX bugs to stabilize the app before next feature wave.

---

## Issue Prioritization & Complexity

| Issue | Type | Title | Complexity | Fast-Track | Route |
|-------|------|-------|-----------|-----------|-------|
| #166 | P0 Bug | A2UI components parsed but not rendered | M | — | Fry |
| #167 | P1 Bug | CodeBlock no syntax highlighting in prod | S | ✅ | Fry |
| #168 | P1 Bug | SteppedCarousel no panel transition animation | S | ✅ | Fry |
| #169 | P1 Bug | Sign-in button shows "Sign in with Microsoft" after login | M | — | Fry |
| #170 | P1 Bug | Integration Kit scenarios not visible in sidebar | S | ✅ | Fry |
| #171 | P1 Bug | Files/Folder icon in header does nothing | S | ✅ | Fry |
| #172 | P1 Bug | "Clear All" needs confirmation dialog | M | — | Fry |
| #173 | P2 Enh | Add Home button for landing page navigation | S | ✅ | Fry |
| #174 | P2 Enh | File operations scenarios in Playground | M | — | Fry |

**Complexity Key:**
- **S (Small):** CSS-only, config/array update, single-line fixes. ~1–2 hours, single file.
- **M (Medium):** Single-file logic, state management, component wiring. ~4–6 hours.
- **L (Large):** Multi-file refactoring, cross-system integration. ~1–2 days.

---

## Dependencies & Blocking Relationships

```
#166 (P0 blocker)
  ↓
#169, #170, #171, #172, #173 (all P1+ depend on #166 completing)
  ↓
#174 (lowest priority, can start in parallel with Wave 3)

#167, #168 (independent CSS fixes — can ship anytime)
```

**Key insight:** #166 is a **critical blocker** preventing the entire app from rendering rich components. All other work is lower priority but independent.

---

## Sprint Waves

### **Wave 1: Critical Blocker (Day 1)**
Unblock the app. All further work depends on this.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #166 | Fry | 4–6 hours | Fix SSE parser in `useStreaming.ts` to accumulate JSON envelope for `a2ui` array. Backend confirmed working — frontend-only fix. This unblocks all component rendering. |

---

### **Wave 2: P1 Quick Fixes (Day 1–2, parallel with Wave 1 start)**
Low-risk CSS and config updates. Ship these ASAP after #166 lands.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #167 | Fry | 1–2 hours | **Fast-track:** Verify `highlight.js` CSS bundle inclusion in prod build (likely vite/rollup config). May need CSS import or plugin adjustment. |
| #168 | Fry | 1–2 hours | **Fast-track:** Add CSS transitions to `SteppedCarousel` panel container. Simple animation rule, no JS. |
| #170 | Fry | 30 min | **Fast-track:** Add `'Integration Kits'` entry to `GALLERY_GROUPS` array in Playground sidebar. Config-only. |
| #171 | Fry | 1 hour | **Fast-track:** Wire up Files/Folder button click to toggle FileTreePanel visibility. Single handler, existing component. |

---

### **Wave 3: P1 Logic Fixes (Day 2–3, start after Wave 1)**
Medium complexity state/component work.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #169 | Fry | 4–6 hours | Auth state not propagating to sign-in button after login. Likely context or hook issue in AuthContext or useAuth. Check token refresh flow. |
| #172 | Fry | 3–4 hours | Add Fluent Dialog component for "Clear All" confirmation. Wire to existing clear action. Needs state + UX testing. |

---

### **Wave 4: P2 Enhancements (Day 3–4, lower priority)**
Nice-to-have features, can slip if time constrained.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #173 | Fry | 1–2 hours | **Fast-track:** Add Home button to header. Wire to landing page route. Small UX addition. |
| #174 | Fry | 4–6 hours | Add file operations scenario mockups to Playground. New scenario data + gallery entry. Depends on Fry's familiarity with Playground data structures. |

---

## Fast-Track Approval (Skip Full DP Gate)

Per v0.5.6 retro: CSS-only fixes and config updates fast-track directly to code review.

**Fast-track candidates:**
- ✅ #167 (highlight.js CSS bundling)
- ✅ #168 (CSS transitions)
- ✅ #170 (array entry)
- ✅ #171 (button wiring)
- ✅ #173 (Home button)

**Standard DP gate required:**
- ❌ #166 (M complexity, needs spec confirmation on parser fix)
- ❌ #169 (M complexity, auth logic, needs review)
- ❌ #172 (M complexity, dialog component + state)
- ❌ #174 (M complexity, new scenario data structure)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| #166 fix incomplete (SSE parser still not accumulating) | CRITICAL — blocks entire sprint | Fry to validate with backend (already confirmed working); add test case for A2UI envelope parsing. |
| #169 requires deeper auth refactor than expected | HIGH — slips to next sprint | Root-cause analysis first (30 min). If >2 hours, defer to v0.5.8. |
| #172 UX scope creeps (animated dialog, etc.) | MEDIUM — scope creep | Define UX spec before code. Simple Fluent Dialog, no animations. |
| CSS bundling issue (#167) is vite/rollup config | MEDIUM — may need build tooling changes | Test prod build locally first. If vite config needed, pair with Bender. |

---

## Success Criteria

**Sprint completion = all P0 + P1 issues resolved. P2 is best-effort.**

- [ ] #166 ships and A2UI components render in UI
- [ ] #167–#172 all closed with passing tests
- [ ] v0.5.6 history compaction applied (baseline established)
- [ ] All code follows DP gate discipline
- [ ] Zero regressions in smoke tests

---

## Retrospective Hooks

- **v0.5.6 learning applied:** Pre-sprint history compaction already done ✅. CSS fast-track policy in place ✅.
- **Track:** SSE parser complexity (did fix require extra debugging?). Auth state propagation (recurring issue?).
- **Next sprint:** Consider pre-built test cases for streaming A2UI to prevent similar regressions.

---

## Author Notes (Leela)

This is a focused bug-fix sprint with a single critical blocker (#166). Wave 1 must complete before teams can fully validate the rest. The P1 bugs are independent — parallelization here is high. P2 features are defensive against scope creep; ship if time permits, defer if needed. All work routes to Fry; no backend changes expected (backend SSE confirmed working). Fast-track policy reduces DP ceremony on 5 low-risk items, keeping the team agile.

---

### SWA Continuous Deploy & Version Footer

**Date:** 2026-04-14T10:54:58Z  
**By:** Ahmed Sabbour (via Copilot)  
**Decision:** SWA should always run the latest version on "main" — no more waiting for release tags to see changes. The version shown in the footer should be something meaningful (e.g., git SHA, build date, or "dev-{sha}") rather than requiring a semver bump.  
**Rationale:** User request — the current release-then-deploy cycle is too slow for iterating and testing. Continuous deployment from main is needed for demo readiness.

**Implementation details:**
1. **Push-to-main trigger** — `deploy-swa.yml` now triggers on `push → branches: [main]` with path filters (`packages/**`, `package.json`, `package-lock.json`, `tsconfig.json`). Tag-based releases still trigger deployment as before.
2. **Unified version string** — `__BUILD_VERSION__` is now `{semver}-{shortSHA}` (e.g. `0.5.6-abc1234`). Git SHA is resolved via `git rev-parse --short HEAD` at build time, falling back to `GITHUB_SHA` env var, then `dev`.
3. **Footer simplification** — Landing and Playground footers show the unified version string instead of version + SHA separately. Every build is uniquely identifiable.

**Impact:** Every push to `main` that touches package code auto-deploys to SWA. Release workflow unchanged — tag pushes still work. Fry: footer components (`Landing.tsx`, `Playground.tsx`) now use `__BUILD_VERSION__` only (SHA embedded).

---

### Agent time tracking per issue

**Date:** 2026-04-14T12:56:33Z  
**By:** Ahmed Sabbour (via Copilot)  
**Directive:** Agents must track how much time they spent working on each issue — total time, and time spent addressing feedback separately. This data should surface in Sprint Retro ceremonies and feed into Sprint Planning for estimation calibration. The goal is to correlate feature size with implementation time.

**Rationale:** User request — captured for team memory and process improvement.

---

### Issue comment + board state on work start

**Date:** 2026-04-14T12:58:00Z  
**By:** Ahmed Sabbour (via Copilot)  
**Directive:** When an agent starts working on an issue, it must immediately post a comment on the issue and move it to "In Progress" on the project board. Use the GitHub App identity (bot token) for these API calls so the comment appears as the agent's bot identity, not the human user.

**Rationale:** User request — captured for team memory.

---
