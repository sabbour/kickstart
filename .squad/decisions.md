# Squad Decisions

Chronological record of architectural, process, and product decisions. Entries merged from `.squad/decisions/inbox/` on each session close.

---

# Fry decision inbox — shared surface namespace for chat updates

**Date:** 2026-04-24T00:01:12-07:00
**Context:** Issue #5 DP amendment responding to Nibbler rejection

## Decision

For chat A2UI replay/update flows, reserve a stable surface-id namespace (`shared:<logical-id>`) for surfaces that must update in place across assistant turns.

## Why

- Current `assistant-turn-N::surfaceId` scoping prevents turn-2 `updateComponents()` from targeting turn-1 surfaces.
- Blanket prefix stripping would break intentionally isolated per-turn surfaces such as repeated file/progress cards.
- An explicit namespace keeps cross-turn behavior opt-in and replay-safe.

## Consequences

- `chat-a2ui` needs a logical→rendered surface registry for `shared:*` IDs.
- `App`/chat rendering must preserve original surface ownership instead of attaching updated shared surfaces to later turn bubbles.
- Acceptance/E2E tests should assert stable `data-surface-id` across turns.
