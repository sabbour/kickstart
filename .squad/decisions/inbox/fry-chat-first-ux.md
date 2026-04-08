# Decision: Chat-first UX redesign

**Date**: 2025-07-25  
**Author**: Fry (frontend)  
**Status**: Accepted  

## Context

The Kickstart web app used a Portal Prototyper pattern (sidebar nav, breadcrumbs, command bar, wizard forms, content area with a toggleable Copilot panel). The AI chat was a secondary sidebar. The goal was to make the AI conversation THE primary experience — following the pattern from `sabbour/adaptive-ui-try-aks`.

## Decision

1. **Remove the portal shell entirely** — no nav-pane, breadcrumbs, command-bar, SPA router, or wizard forms.
2. **Chat UI as the main content area** — centered at 760px max-width, always visible, no toggle.
3. **File viewer as a right sidebar** — appears only when files are generated in GENERATE phase. Tabbed, with copy-per-file.
4. **Sessions sidebar on the left** — toggleable from header. Placeholder for future multi-session support.
5. **Conversational demo flow** — Discover phase asks ONE question per turn (3 turns) instead of presenting multi-field forms.
6. **Dark mode** — via `prefers-color-scheme` media query, no user toggle.
7. **Prompt inspector** — moved from copilot panel header to a topbar toggle button.

## Consequences

- `core.js` still exports Router/Navigation/Breadcrumbs but they're unused — can be removed in a future cleanup.
- All `.copilot-*` CSS classes renamed to `.chat-*` — any external references will break.
- A2UI renderer still renders inside chat messages — no changes needed there.
- The demo flow is now truly conversational: one concept per turn, no multi-field wizards.
