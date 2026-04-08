# Decision: Light-only theme, no dark mode

**By:** Fry  
**Date:** 2026-04-08  
**Status:** accepted

## Context
Dark mode was implemented in the chat-first redesign to match reference app styling. User explicitly requested its removal — "I don't want dark mode colors."

## Decision
Remove all `@media (prefers-color-scheme: dark)` blocks from web CSS and MCP App HTML. The app is light-theme only. Dark mode CSS variables are deleted, not commented out.

## Consequences
- Users on dark system themes will see the light UI.
- Simplifies CSS maintenance (one theme to maintain).
- If dark mode is ever re-requested, it must be re-implemented from scratch.
