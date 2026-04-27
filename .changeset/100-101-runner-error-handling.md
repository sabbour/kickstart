---
"@aks-kickstart/harness": patch
---

fix: handle MaxTurnsExceededError gracefully and add token-count gate on history (#100, #101)

- #100: Specific catch for `MaxTurnsExceededError` with a user-friendly recovery card instead of a raw error. The card surfaces a "Start New Conversation" action.
- #101: Token-count gate before history injection. Estimates tokens via char/4 heuristic; trims oldest turns when >80% of the 128k context window is consumed. User sees a notification when trimming occurs.
