---
'@aks-kickstart/harness': minor
---

feat(harness): thread conversation history across turns (#1062 Layer 0)

The harness `Runner` now replays `session.recentTurns` (user/assistant roles
only, bounded to the existing 50-turn window) into the `@openai/agents` SDK on
every `/api/converse` invocation, behind the `HARNESS_SESSION_HISTORY_ENABLED`
env flag. When the flag is on (`"1"` or `"true"`), the model sees the full
conversation instead of just the latest message — fixing the core cause of
the triage-loop bug (#1062) where each turn was treated as a fresh
conversation.

Default: OFF in this release. A follow-up change will flip it to ON after
preview-environment validation.

Other changes in this PR:

- User turns are now recorded in `session.recentTurns` **after** the input
  guardrails run, so sanitized text is persisted (guardrail-on-capture). Raw
  pre-guardrail PII or credentials no longer land in the session history.
- New exported helpers `toAgentInputItems()` and `isHistoryEnabled()` for use
  by tests and by Fry's upcoming Layer 1–3 client-side work.
- A harness-level multi-turn regression test
  (`packages/harness/src/runtime/__tests__/history-threading.test.ts`) that
  fails if history threading ever regresses.

No public API or SSE event-shape changes.
