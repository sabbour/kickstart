---
name: a2ui-output-discipline
description: Rules for when and how to emit A2UI messages via core.emit_ui. Prevents runaway surface creation, ensures correct operation ordering, and keeps UI in sync with agent state.
version: 0.1.0
x-kickstart:
  appliesTo:
    - "*"
  keywords:
    - a2ui
    - emit_ui
    - surface
    - ui
    - output
  priority: 85
---

# A2UI Output Discipline

Use `core.emit_ui` only when a change to the visible UI is required. Do not emit for internal state transitions that have no user-visible effect.

## Surface lifecycle rules

### Creating surfaces
- Call `createSurface` exactly once per logical UI panel.
- Assign a stable, descriptive `surfaceId` (e.g., `plan-review`, `file-list`, `progress-tracker`).
- Do not create a new surface for every response turn — reuse existing surfaces via `updateComponents`.

### Updating components
- Use `updateComponents` to modify individual component properties in-place.
- Prefer targeted updates (`path`-scoped) over full surface re-renders when only a few properties changed.
- Batch related updates into a single `updateComponents` call rather than emitting one call per component.

### Deleting surfaces
- Call `deleteSurface` only when the panel is genuinely no longer needed (e.g., a progress tracker after completion).
- Do not delete and recreate surfaces to reset state — use `updateDataModel` instead.

## Component naming conventions

- Use `PascalCase` component types matching the pack's registered names (e.g., `Button`, `ChoicePicker`).
- Component IDs must be unique within a surface. Use descriptive, kebab-case IDs (e.g., `continue-btn`, `step-list`).

## Ordering rules

1. Always `createSurface` before referencing its components in subsequent calls.
2. Always `updateComponents` before `deleteSurface` if you need to show a final state.
3. Never emit `updateComponents` for a surface that has been deleted.

## Data model discipline

- Use `updateDataModel` to push data changes that multiple components share.
- Keep the data model flat where possible — deep nesting makes path-binding hard to follow.
- Do not duplicate data between component `props` and the data model. Pick one source of truth.

## Error handling

- If `core.emit_ui` rejects with a validation error, log the reason and fix the message before retrying.
- Never swallow A2UI validation errors silently.

## Example: progress tracker pattern

```json
{ "op": "createSurface", "surfaceId": "gen-progress", "rootComponents": ["progress"] }
{ "op": "updateComponents", "surfaceId": "gen-progress", "components": { "progress": { "component": "ProgressSteps", "steps": [...] } } }
{ "op": "deleteSurface", "surfaceId": "gen-progress" }
```
