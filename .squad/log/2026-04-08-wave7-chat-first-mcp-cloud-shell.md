# Wave 7: Chat-First Redesign + MCP App + Cloud Shell Research

**Date:** 2026-04-08  
**Agents:** Fry (Frontend), Bender (Backend), Coordinator (research)

## Summary

Completed dual-surface architecture: Fry rewrote web UI to conversation-first layout (7 files), Bender delivered MCP App HTML surface for IDE with full A2UI renderer (118 tests passing). Coordinator researched Cloud Shell storage; determined programmatic provisioning not available for first-time users.

## Key Outcomes

### Fry: Chat-First Web UI
- Removed Portal Prototyper chrome entirely (nav, breadcrumbs, command bar, router, wizard)
- Chat is now primary full-width experience (760px max-width, centered)
- File viewer sidebar appears on file generation (GENERATE phase)
- Sessions sidebar toggleable from header
- Dark mode via `prefers-color-scheme` media query
- 3-turn conversational Discover phase (one question per turn)
- Commits: d431093 (UI rewrite), 6f7d7e9 (Squad docs)

### Bender: MCP App HTML Surface
- Self-contained HTML with Fluent 2 CSS + dark mode + inline JS
- Full A2UI renderer (18 component types) — feature parity with web
- Typed postMessage protocol (parseAppMessage + handleAppMessage)
- MCP resource serving + app-message tool for iframe ↔ server communication
- Auto-kickstart on load
- 30 new tests (protocol validation + HTML structure), 118 total passing
- Commit: e80b44f

### Coordinator: Cloud Shell Research
- Researched Azure Cloud Shell storage options for session persistence
- Finding: Cloud Shell can't be fully provisioned programmatically for first-time users
- User rejected GitHub Gists approach
- Directive captured in decisions inbox: copilot-directive-20260408-no-gists.md

## Technical Decisions Pending Merge

5 decision files in inbox:
1. `bender-mcp-app.md` — MCP App HTML architecture (self-contained, postMessage, 18 renderers)
2. `fry-chat-first-ux.md` — Chat-first UX redesign (no portal chrome, conversation primary)
3. `copilot-directive-20260408-no-gists.md` — No GitHub Gists for persistence
4. `copilot-directive-20260408-no-dark-mode.md` — Light theme only (conflicts with Fry implementation — Fry added dark mode)
5. `copilot-directive-20260408-chat-first-ux.md` — Chat-first UX directive (confirms Fry's direction)

## Conflicts & Notes

- **Dark mode conflict:** Directive #4 says "no dark mode, light theme only" but Fry added dark mode via `prefers-color-scheme`. This was part of user directive #5 (chat-first UX). Scribe should note the conflict in decision merge.
- **Session persistence:** Deferred. No immediate blocker — demo flows work without it.
- **Next:** Merge decisions, update agent histories to cross-reference work.
