# Zapp — Security Architect History

## Core Context

- **Project:** Kickstart — AI-guided onboarding for deploying apps to AKS
- **Stack:** TypeScript, React (Fluent UI), Azure Functions, Azure Static Web Apps, Azure OpenAI
- **Owner:** Ahmed Sabbour
- **Joined:** 2026-04-10

## Learnings

- 2026-04-10: Pre-v0.3.0 security audit completed. Highest-risk patterns were frontend HTML injection paths (`dangerouslySetInnerHTML`) and public AI endpoints lacking auth/throttling.
- 2026-04-10: `/api/converse` currently exposes full system prompts to clients on new sessions; treat system prompts as sensitive control-plane data.
- 2026-04-10: Security hardening backlog now tracked in Security milestone issues #81-#88 with severity and OWASP mapping.
- 2026-04-10: DP #30 (IntegrationKit lifecycle/dependency/auth extension) approved with conditions requiring transactional lifecycle rollback, cycle detection on re-registration, explicit auth schema validation, and documented trusted-kit boundary.

## Round 5: Multi-Round Security Reviews

**2026-04-14**
- Security review of DP #188 (demo scenarios) — approved
- Re-review of DP #186 (round 2) — identified 3 concerns
- Final review and sign-off on DP #186 (round 3) — approved for implementation
## 2026-04-14 Round 2: DP Security Review

- **Reviewed DPs #186 & #187**: #187 approved (low risk), #186 flagged with High/Medium concerns.
- **#186 blockers**: Immutable source pinning, prompt-safety validation, fail-closed + provenance.
- **Coordination**: Communicated security requirements to Leela; provided detailed guidance for Phase 1 hardening.

- 2026-04-15: Revision 4 on issue #326 approved from security side; prior blockers remained resolved with no regression, clearing security gate for #327/#328.

---

**2026-04-15T22:40:15Z — Scribe**: Issue #326 Revision 4 approved. Security gate post on #326#issuecomment-4256162191 logged. Ready for closure.

## 2026-04-17 DP #330 Security Review

**Review Date:** 2026-04-17T01:57:58Z  
**Issue:** #330 — spike: design OpenAI Agents SDK migration for less-rigid chat flow  
**DP:** Hybrid route planner + manager agent architecture

**Decision:** ✅ APPROVED WITH CONDITIONS

**Security Conditions (implementation acceptance criteria):**
1. Allowlist response adapter only — never expose raw SDK run items/traces/unfiltered tool outputs to browser
2. Principal-bound resume/session ownership — enforce `(sessionId, runId, principalId)` with fail-closed behavior + audit logging
3. Preserve session semantics — keep current TTL/expiry/ownership behavior; expired sessions/runs cannot be resumed
4. Guardrails additive only — server-side controls remain authoritative (rate limiting, content safety, auth/ownership, sanitization, workspace validation)
5. Dependency governance — pin SDK version, maintain lockfile integrity, run dependency/security scans, define upgrade/rollback procedure

**Consequence:** Security gate clear when conditions added as implementation acceptance criteria and verified by tests.
