# Project Context

- **Owner:** {user name}
- **Project:** {project description}
- **Stack:** {languages, frameworks, tools}
- **Created:** {timestamp}

## Learnings

### Playground Component Re-render Churn Pattern (2026-04-16)

**Problem:** Playground components exhibit surfaceId churn when JSON preview pane is toggled.

**Root Cause:** Two-factor pattern:
1. `playground-scenarios` module's `uid()` function generates new IDs on each call (not memoized)
2. JSON preview re-renders cascade parent updates, triggering uid() calls multiple times per render

**Investigation:** Fry (2026-04-16T06:12:17Z) — identified via React Profiler analysis

**Implications for Future Work:**
- When troubleshooting Playground churn: check for memoization gaps + preview re-render boundaries
- Consider stable key generation for scenario objects early in feature development
- Test with React DevTools Profiler to catch churn patterns during development

**Related Issues:** #328 (chat progress surface recovery depends on stable workspace)
