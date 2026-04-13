# A2UI Component Patterns

**When to use:** You need to build, register, or render A2UI custom components in Kickstart.

## Context

Kickstart uses A2UI (Adaptive UI) for dynamic component rendering driven by LLM output. Components follow the "fat component" pattern — self-contained React components that handle their own data fetching, state, and error display.

## Steps

### 1. Fat Component Pattern

Each custom A2UI component is self-contained:
1. Receives config props from LLM (API path, bind key, labels)
2. Uses `useServiceConnector()` to get auth + make API calls
3. Manages its own loading/error/empty states (Fluent UI v9 `Spinner`, `MessageBar`)
4. Reports selection back via A2UI `action.event` → orchestrator updates data model

Register via `createReactComponent()` in the component catalog.

### 2. Fluent 2 Compliance

All components must follow the Fluent 2 audit checklist:
- Use `makeStyles()` + design tokens — no inline styles, no raw CSS classes
- Use Fluent UI React v9 components (`Button`, `Card`, `Spinner`, etc.)
- No emoji in UI — use Fluent UI icons or Material Symbols
- Theme via `resolvedTheme` pattern (standard for all themed components)

### 3. Progressive Rendering

Components use a three-layer progressive rendering pipeline:

1. **`useProgressiveQueue` hook** — stagger incoming components with 150ms delay
2. **Mock streaming stagger** — `sendMock()` emits surface messages with 200ms delays
3. **CSS animation** — `a2ui-component--entering` class with `--enter-index` custom property:
   ```css
   animation-delay: calc(var(--enter-index) * 60ms);
   ```

Any future A2UI component rendering path should use `--enter-index` for consistent animated entry.

### 4. Accessibility

- All interactive components must have proper ARIA labels
- Keyboard navigation support required
- Focus management for dynamic component insertion
- Color contrast via Fluent design tokens (automatic with theme compliance)

### 5. Schema Props

A2UI schema props require type narrowing for native HTML attributes. Don't pass A2UI props directly to HTML elements — narrow first.

### 6. Past-Turn Isolation

Past-turn components become read-only:
- Check `isActive` prop before running effects
- Prevent `useEffect` in past turns
- Components deactivate gracefully (no stale API calls)

## Key Files

- `packages/web/src/components/` — all A2UI component implementations
- `packages/core/src/` — component registration and catalog
- Component catalog defines available components for LLM to use
