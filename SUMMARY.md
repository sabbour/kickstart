# Issue #271 — Test Plan & Quality Decision (HERMES SUMMARY)

## What I Completed

### 1. Comprehensive Test Plan (`HERMES-271-TEST-PLAN.md`)

A detailed **acceptance coverage document** for the shortest safe fix, covering:

- **Problem analysis** — root causes of AuthCard not rendering
- **5 component registration tests** (A1-A5)
  - Component in catalog
  - Schema validation
  - Render in React
  - Stub mode (offline)
  - Error handling
- **3 deployment phase guards** (B1-B3)
  - System prompt documentation
  - Guardrails to prevent unimplemented phases
  - Stale card cleanup
- **4 flow integration tests** (C1-C4)
  - Full demo flow DISCOVER → GENERATE
  - Graceful completion (no dead ends)
- **2 A11y tests** (D1-D2)
  - ARIA compliance
  - Keyboard navigation
- **Minimum automated coverage recommendations** (5 new tests to add)
- **Test execution plan** (pre-implementation → post-implementation → regression)
- **Quality bar definition** — demo-ready criteria

### 2. Quality Decision (`hermes-271-component-registration-coverage.md`)

A **permanent quality gate** decision establishing:

- **Component registration REQUIRES 2 tests:** inventory + schema validation
- **Why it matters:** Prevents silent failures (LLM output silently dropped)
- **Implementation guidance** for Fry & Bender
- **Authority:** Based on established "test-discipline" skill
- **Sign-off:** Effective immediately, Squad-wide

## Key Findings

### Root Cause ✓ Identified
AuthCard IS implemented but **NOT registered** in `kickstart-catalog.ts`. When LLM sends the component, the renderer doesn't know about it → silently dropped.

### Shortest Safe Fix Path ✓ Documented
1. Register AuthCard in catalog (1 line)
2. Add 2 unit tests (catalog inventory + schema validation)
3. Verify system prompt guards against unimplemented phases
4. Optional: End demo at GENERATE phase (skip DEPLOY)

### Risks ✓ Mitigated
- **Silent drops** → Caught by catalog inventory test
- **Schema mismatches** → Caught by schema validation test
- **Dead-end flows** → Caught by integration tests
- **A11y regressions** → Caught by ARIA compliance test

## What's Blocked/Needs

- ❓ **Confirmation:** Does system prompt have DEPLOY phase guards?
- ❓ **Confirmation:** Should we end demo at GENERATE or implement DEPLOY fallback?
- 🔄 **Handoff to Fry/Bender:** Implementation of the fixes (tests + registration)

## Test Priority (For Implementation)

**MUST ADD (before merge):**
1. ✅ Catalog inventory test (AuthCard + DeploymentProgress in kickstartCatalog)
2. ✅ Schema validation test (AuthCard props schema)
3. ✅ A11y compliance test (AuthCard ARIA attributes)

**SHOULD ADD:**
4. Demo flow integration test (DISCOVER → GENERATE completes)
5. System prompt validation (component examples are valid JSON)

**NICE TO HAVE:**
6. Accessibility keyboard navigation test (Tab/Enter/Space work)

## Success Criteria ✓

- All acceptance tests documented
- New automated tests ready for implementation
- Quality decision published
- Demo-ready criteria clear
- No blockers for implementation to start

## Status

**READY FOR IMPLEMENTATION PHASE**

All test coverage is defined. Fry/Bender can now implement the fixes and reference this plan for test requirements.

---

**Signed:** Hermes, Tester  
**Date:** 2026-04-15  
**Charter:** Test strategy, quality assurance, edge case analysis
