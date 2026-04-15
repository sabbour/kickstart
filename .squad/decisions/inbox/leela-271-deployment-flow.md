---

# Decision: Stop the flow before handoff/deploy — Issue #271

**Date:** 2026-04-15T08:39:29.427Z
**Author:** Leela (Lead)
**Issue:** #271 — Deployment flow is blocked
**Status:** Proposed

## Problem

The onboarding flow enters HANDOFF (STEP 5) and DEPLOY (STEP 6) phases
that have **no backend implementation**. Users see fake "repo created" cards,
"Deploy now" buttons, and AuthCard sign-in prompts that lead nowhere.
This is a dead end — the demo cannot proceed past file generation.

The issue text claims AuthCard is unregistered. **That is wrong.** AuthCard
exists in the React catalog, component-catalog, and a2ui-schema. It renders
fine. The problem is the flow reaches phases that pretend real work is
happening when it is not.

## Root Causes

1. **System prompt instructs LLM to enter unimplemented phases.**
   STEP 5 (HANDOFF) and STEP 6 (DEPLOY) describe GitHub repo creation
   and Azure deployment flows backed by no real service.
2. **Demo scenarios include HANDOFF and DEPLOY_PROGRESS responses.**
   Fake repo URLs, fake "7 resources provisioned" progress, and "Deploy now"
   buttons that fire events no handler catches.
3. **Review example ends with "Approve and continue to handoff"**
   leading directly into the dead end.
4. **CONFIGURE_FORM ProgressSteps** includes a "Deploy" step label
   that implies deployment exists.

## Decision: End the flow at REVIEW

### Ship now (3 changes)

| # | File | Change |
|---|------|--------|
| 1 | `packages/core/src/prompts/system-prompt.ts` | Remove STEP 5 (HANDOFF) and STEP 6 (DEPLOY) from the conversation flow. Make REVIEW the terminal step. Replace the "Approve and continue to handoff" button in Example 5 with a "Session complete" summary. Remove Example 6 (handoff). Add an explicit guardrail: the LLM must NOT enter handoff or deploy phases. |
| 2 | `packages/web/src/services/demo-scenarios.ts` | Replace HANDOFF with a "Session Complete" summary (no fake repo/deployment). Remove DEPLOY_PROGRESS. Update `scenarioFlow` to end at REVIEW_EXPANDED. Remove keyword routing for deploy/handoff to fake screens. Remove the "Deploy" step from CONFIGURE_FORM ProgressSteps. |
| 3 | `packages/web/src/services/demo-scenarios.ts` | In CONFIGURE_FORM, change ProgressSteps "Deploy" to "Review" so the step tracker does not promise deployment. |

### Defer (do NOT touch)

- **AuthCard component** — works correctly, keep for future Azure auth.
- **DeploymentProgress component** — works correctly, keep for future use.
- **a2ui-schema.ts / component-catalog.ts** — no changes needed.
- **playground-scenarios.ts** — separate concern; many deploy references,
  but it's a component playground, not the user-facing onboarding flow.

## Acceptance Bar

1. Walk through the demo flow end-to-end. After REVIEW, the user sees a
   "session complete" summary with next steps (not handoff/deploy).
2. No "Deploy now", "Open in Codespaces", or fake repo cards appear.
3. The LLM never enters handoff/deploy phases (verified by prompt guardrail).
4. All existing tests pass (`npm run build && npm test`).

## Consequences

- Users can complete the demo without hitting a dead end.
- Deployment/handoff features can be re-added when backend support exists
  (AuthCard, DeploymentProgress, and schema entries remain intact).
- The system prompt shrinks slightly, reducing token spend per request.

## Needs Sign-Off

- **Ahmed Sabbour** — product scope confirmation (ending at review is acceptable).
