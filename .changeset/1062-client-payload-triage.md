---
"@aks-kickstart/web": minor
"@aks-kickstart/pack-core": minor
---

Fix the #1062 triage loop: the web client now POSTs structured A2UI event
metadata alongside a human-readable user message, the triage agent branches
on those events instead of re-emitting the intent menu, and the A2UI
renderer drops duplicate `createSurface` messages for surfaces that already
exist on the canvas.

### User-visible changes

- **Button clicks show the button's label in the chat, not the raw event
  name.** Clicking "Build new" used to produce a user bubble that said
  `choose_build`; it now shows "Build new" (closes #1061).
- **The triage agent no longer re-emits the four-option intent menu after
  you pick one.** A confirmed `choose_build` / `choose_review` /
  `choose_update` / `choose_deploy` event advances the conversation to
  requirements gathering (closes #1062 Layer 2).
- **The Playground canvas no longer stacks duplicate headers** when an
  `emit_ui` tool call re-creates an existing surface — the create is
  treated as a no-op and any `updateComponents` still apply normally
  (closes #1060).

### Under the hood — wire contract

`POST /api/converse` now accepts an optional `event` field:

```jsonc
{
  "sessionId": "…",
  "message": "Build new",
  "event": {
    "name": "choose_build",
    "payload": { "value": "build" }
  }
}
```

The server injects a compact `[A2UI event] name=<name> payload=<json>`
marker into the agent-facing prompt. The triage prompt now has an explicit
branch-on-event rule keyed to that marker. Works end-to-end once Bender's
Layer 0 (`HARNESS_SESSION_HISTORY_ENABLED`) lands.

### Deferred

Per DP v3: Bender's harness session-history threading (Layer 0) is the
other half of this fix and ships in a separate PR. The Playwright
regression guard in this change is skipped with a clear reason until
`HARNESS_SESSION_HISTORY_ENABLED=1`.
