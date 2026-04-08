# Decision: Simplify Landing Page to Hero + Track Cards

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-28
**Status:** Accepted (user-directed)

## Context

Ahmed reviewed the landing page and said "Too much going on here" — 5 stacked sections were competing for attention. The custom search input and typography didn't match Fluent 2.

## Decision

1. **Landing page shows only two sections**: Hero (title + Fluent 2 search + suggestion pills) and track cards (Web App or API, AI Agent). All other sections removed.
2. **Fluent 2 search component**: `<fluent-search>` web component replaces custom `<input>`. Styled by Fluent, not custom CSS.
3. **Fluent 2 typography**: Hero title uses 40px/semibold/-0.02em (Fluent 2 Hero ramp). Track cards use explicit Fluent 2 line-height tokens.
4. **Removed permanently**: Inspiration carousel, framework pills (9 buttons), IDE launch links. These were secondary CTAs that diluted the primary flow.

## Consequences

- Carousel API fetch (`/api/inspirations`) is no longer called — backend endpoint can be deprecated.
- Framework pre-selection removed — users now always go through the conversational discover phase.
- IDE links need a new home if we want them back (e.g., post-deploy handoff or settings).
- Landing page is now ~170 lines of CSS (was ~410).
