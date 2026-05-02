# Project Context

- **Owner:** {user name}
- **Project:** {project description}
- **Stack:** {languages, frameworks, tools}
- **Created:** {timestamp}

## Learnings

### Playground Component Re-render Churn Pattern (2026-04-16)

**Problem:** Playground components exhibit surfaceId churn when JSON preview pane is toggled.

**Root Cause:** Two-factor pattern:
1. `playground-scenarios` module's `uid()` function generates new IDs on each call (not memoized)
2. JSON preview re-renders cascade parent updates, triggering uid() calls multiple times per render

**Investigation:** Fry (2026-04-16T06:12:17Z) — identified via React Profiler analysis

**Implications for Future Work:**
- When troubleshooting Playground churn: check for memoization gaps + preview re-render boundaries
- Consider stable key generation for scenario objects early in feature development
- Test with React DevTools Profiler to catch churn patterns during development

**Related Issues:** #328 (chat progress surface recovery depends on stable workspace)

---

## Cross-Agent Updates: PR #349 Review Gate + Merge (2026-05-02)

### Bender (Backend)

**PR #349 feedback implementation completed** (2026-05-02T00:15:00Z):
- Addressed two Copilot review threads in commit 3c77cec
- Posted batch summary + reply to each thread (followed two-step closure protocol)
- Resolved threads after replies posted (per squad protocol)

**API route retirement decision captured**:
- When retiring Azure Functions routes: keep file, replace with `410 Gone` tombstone
- Never delete; always follow garbage-collection pattern (same as `github-proxy.ts`, `github-oauth.ts`)
- Pattern + rules documented in `.squad/decisions.md`
- Applies to Bender's future API work + Amy's changeset review process

---

### Leela (Architecture)

**PR #349 architecture review** (2026-05-02T00:45:00Z):
- Approved architectural safety
- Applied `architecture` + `lead` labels
- No design concerns; merged downstream into gate

---

### Zapp (Security)

**PR #349 security review** (2026-05-02T00:45:00Z):
- Approved security posture
- No injection, auth, or trust-boundary concerns
- Label applied; merged into gate

---

### Nibbler (Code Quality)

**PR #349 code review** (2026-05-02T00:45:00Z):
- Approved code quality
- Correctness, readability, patterns validated
- Label applied; merged into gate

---

### Amy (Docs)

**PR #349 docs review** (2026-05-02T00:45:00Z):
- Docs assessment: not applicable (test-only scope)
- Applied `docs:not-applicable` label
- Merged into gate

**API route retirement documentation impact**:
- Will review changesets that retire routes (tombstone + docs updates must be bundled)
- Pattern enforces docs changes in same PR as code; Amy ensures compliance

---

### Hermes (QA)

**PR #349 test readiness** (2026-04-30T22:00:00Z):
- Approved test-only scope
- No production surface coverage issues
- Flagged Review Gate + branch blockers (real blockers, not test-related)

---

### Coordinator

**PR #349 merge orchestration** (2026-05-02T01:10:00Z):
- Branch updated (dev merged onto PR branch for base sync)
- CI verified green
- Squash merged as `squad-lead` bot
- All gates passed: nibbler:approved + zapp:approved + leela:approved + docs:not-applicable + CI green

---

### Ralph (Feature Agent) — Directive

**Prioritization captured** (2026-05-02T01:09:17Z):
- Ralph should focus on feature work first (per Amy)
- When routing or assigning tasks: prioritize features over chores

