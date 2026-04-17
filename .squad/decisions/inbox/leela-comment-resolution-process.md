### 2026-04-17: PR feedback must be explicitly acknowledged and threads resolved
**By:** Ahmed Sabbour (process fix after #405 audit)
**What:** When any agent addresses PR review feedback (from Copilot, Leela, Zapp, or any reviewer), they MUST:
  1. Reply to the specific comment explaining what was done
  2. Resolve the review thread via the GitHub GraphQL resolveReviewThread mutation
  3. Verify 0 unresolved threads before attempting merge
Silently fixing code without acknowledging the comment is a process violation. Unresolved threads will block the branch protection gate (require_conversation_resolution: true).
**Why:** #407–#426 were merged without addressing Copilot review comments. The branch protection's require_conversation_resolution was not enforced at the time but is now. This prevents that class of merge-blocking from recurring.
