# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns. Shipped full Vite+React stack migration, Playground interface, dark mode, accessibility audit, and 20+ fat A2UI components.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/catalog/fluent-components/` — Fluent UI overrides and custom components
- `packages/web/src/pages/` — Landing, Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system, layout classes
- `packages/web/src/components/` — FileEditor, FileTreePanel, DebugPanel, Widgets

## Patterns
- **Fat A2UI components:** Use createReactComponent factory + useState for auth/API state, useAPIConnector hook, context.dispatchAction for actions
- **Streaming UI:** useProgressiveQueue hook for 150ms stagger reveal, progressive bubble state + ref tracking for stale closures
- **Theme system:** ThemeContext with three-state mode (light/dark/system), resolvedTheme pattern for rendering, useSyncExternalStore for matchMedia
- **Validation safeguards:** DS001-DS020 validators with auto-fix capability, badge/severity display in UI, RegexError handling
- **Accessibility:** WCAG 2.1 AA — aria-label on all A2UI components, roving tabIndex for RadioGroup, live regions on dynamic content

## Recent Work
- v0.5.6 A11y fixes: roving tabIndex, aria-live regions, external link icons
- v0.5.0 component streaming: progressive queue, --enter-index CSS stagger, layout shift prevention
- v0.4.0 theme system: dark mode toggle, system preference detection, CSS variable overrides
- v0.3.0 fat components: Azure/GitHub packs, auth flows, picker patterns, action dispatching

## Current Sprint: v0.5.7

**Sprint Goal:** Fix critical A2UI rendering blocker (#166) + 8 P1/P2 UI/UX bugs.

**Wave 1 (Critical Blocker):**
- #166: Fix SSE parser in `useStreaming.ts` to accumulate JSON envelope for `a2ui` array (4–6 hrs). Backend confirmed working; frontend-only fix.

**Wave 2 (P1 Quick Fixes, parallel):**
- #167: Verify `highlight.js` CSS bundling in prod (1–2 hrs, fast-track).
- #168: Add CSS transitions to `SteppedCarousel` panel (1–2 hrs, fast-track).
- #170: Add `'Integration Kits'` to sidebar config (30 min, fast-track).
- #171: Wire Files/Folder button toggle (1 hr, fast-track).

**Wave 3 (P1 Logic Fixes, after Wave 1):**
- #169: Fix auth state propagation to sign-in button (4–6 hrs).
- #172: Add "Clear All" confirmation dialog (3–4 hrs).

**Wave 4 (P2 Enhancements, lower priority):**
- #173: Add Home button to header (1–2 hrs, fast-track).
- #174: File operations scenarios in Playground (4–6 hrs).

**Key Notes:** #166 is a critical blocker preventing rich component rendering. All other work is independent. Fast-track approved for 5 CSS/config items (skip DP ceremony). Success = all P0 + P1 closed; P2 best-effort.

## Learnings
- (2026-04-14) SSE parsing in `useStreaming.ts` must handle both `event:` type lines and `data:` lines. The backend sends A2UI via typed SSE events (`event: a2ui\ndata: {...}`) AND inside a JSON envelope in the accumulated chunk content. Both paths must route to `callbacks.onA2UI()`.
- (2026-04-14) The accumulated stream content can be either plain text OR a JSON envelope `{message, a2ui, actions}`. After stream completion, always try parsing as JSON to extract structured data before passing to `onComplete`.

## Work Log
- (2026-04-14 11:02) Wave 1: Fixed #166 A2UI rendering blocker → PR #179 opened. SSE parser fixes in useStreaming.ts complete.
