---
"@aks-kickstart/harness": minor
---

Adapt session store to persist Responses API thread IDs (#126)

When `KICKSTART_USE_RESPONSES=1`, the `Session` now stores the `responseId`
returned by the SDK after each turn. On subsequent turns the runner passes
`previousResponseId` to the SDK instead of re-sending the full conversation
history, letting the OpenAI Responses API maintain the thread server-side.
First turn (no responseId yet) and flag-off callers continue to use the
existing `toAgentInputItems()` full-history path with no change in behaviour.
