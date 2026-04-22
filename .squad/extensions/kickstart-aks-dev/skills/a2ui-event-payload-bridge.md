# Skill — A2UI event payload bridge

**Owner:** Fry (Frontend Dev)
**Status:** Active (introduced by #1062)
**Applies to:** any client-to-server hop where a user triggers an A2UI
component action (button click, select, etc.) that re-prompts the LLM.

---

## Problem

Left alone, the client serialises `action.event.name` (e.g. `choose_build`)
into the user bubble **and** POSTs it as the raw user message. The LLM sees
a naked token it must guess the meaning of, the user sees a cryptic bubble,
and there's no way for the agent to distinguish a "confirmed selection"
from an ambiguous free-form question. #1062 was the extreme manifestation
of this — the triage agent looped because every click looked like a brand
new ambiguous request.

## Pattern

Split the single "send" into two signals on the same POST:

```jsonc
{
  "sessionId": "srv-…",         // server-issued; server rehydrates history
  "message":   "Build new",     // human label — exactly what the bubble shows
  "event": {                    // structured, optional, for branching
    "name":    "choose_build",  // verbatim from action.event.name
    "payload": { "value": "build" }   // sanitized action.event.context
  }
}
```

### Client

1. `actionToMessage(action)` → the human bubble text (prefers
   `context.selectedLabel` → `context.label` → `context.value` →
   `cleanName`).
2. `buildActionEventMetadata(action)` → the structured `{ name, payload }`,
   stripping any routing prefix (`navigate:`, `api:`, etc.) and running
   `sanitizeActionContext` over the payload.
3. Pass both through to `onSendMessage(message, event)` → `handleSendMessage`
   → `streaming.send(…, event)`.
4. `_composeConverseRequestBody` is the pure composer. It omits `event`
   entirely when the name is empty, keeping the contract additive for
   callers that have no event signal (typed messages).

### Server

`composeAgentInput(message, event)` produces a single-line marker the
agent can pattern-match on:

```
Build new

[A2UI event] name=choose_build payload={"value":"build"}
```

Keep the marker **compact and fixed-shape** — the triage/handoff agent
prompts match on the exact prefix `[A2UI event] name=`.

### Agent prompt

Every agent that branches on events must carry an explicit
branch-on-event block that:

- names the exact marker shape,
- lists the event names it recognises with their target phases,
- tells the agent to **inspect prior turns + payload** rather than
  hardcoding a switch table (per Ahmed's steering input on #1062),
- forbids re-emitting the same intent menu in response to a confirmed
  selection.

## Invariants / tests to keep

- `buildActionEventMetadata` must not include `event` when name is empty.
- Sanitisation must run on capture — never allow raw `context` to land on
  the wire without the allowlist filter. Prompt-injection hardening
  depends on this.
- A prompt-text regression test (see `triage-branch-on-event.test.ts`)
  keeps the branch-on-event rule from disappearing in a future edit.
- A duplicate-`createSurface` guard upstream of the renderer prevents the
  "duplicate header" failure mode when an agent re-emits the same surface.

## Related

- #1062 — Triage loop (this pattern's origin).
- #1061 — Raw event name in user bubble (closed by Layer 1).
- #1060 — Duplicate header (closed by Layer 3 guard).
- Bender's #1062 Layer 0 — harness session-history threading; required for
  end-to-end branch-on-event behaviour.
