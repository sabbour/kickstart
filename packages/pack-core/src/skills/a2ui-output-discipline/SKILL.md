---
name: a2ui-output-discipline
description: Rules for emitting A2UI v0.9 messages via core.emit_ui. Enforces the v0.9 adjacency-list shape, correct hierarchy fields, and spec-compliant action payloads.
version: 0.2.0
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

# A2UI Output Discipline (v0.9)

Use `core.emit_ui` only when a change to the visible UI is required. Do not
emit for internal state transitions that have no user-visible effect.

> **Spec:** https://a2ui.org/specification/v0.9-a2ui/
> **Components:** https://a2ui.org/concepts/components/

## The v0.9 component shape

`updateComponents` takes a **flat adjacency list**. Each entry is:

```jsonc
{
  "id": "<unique-id>",           // required
  "component": "<BareName>",     // required, e.g. "Button", "Row", "Text"
  "child":    "<id>",            // optional — single-slot containers (Card, Button)
  "children": ["<id>", "<id>"],  // optional — multi-slot containers (Row, Column, List)
  "text":     "<literal>",       // optional — only on Text components
  "action":   { "event": { "name": "<event>", "payload": { "confirmed": true, "id": null, "value": null, "action": null, "target": null } } }
}
```

Nothing else belongs at the top level. In particular, **do not emit**:

- ❌ `label` — a Button's visible label is a **Text child** referenced via `child`.
- ❌ `onClick` / `onChange` — use `action: { event: { name } }`.
- ❌ `items` — container hierarchy is `children`, never `items`.
- ❌ `placeholder`, `value`, `disabled` at top level — these belong in
  component-specific props or data-model bindings, not on the adjacency-list entry.

## Canonical spec example

```json
{
  "version": "v0.9",
  "updateComponents": {
    "surfaceId": "main",
    "components": [
      { "id": "root", "component": "Column", "children": ["greeting", "buttons"] },
      { "id": "greeting", "component": "Text", "text": "Hello" },
      { "id": "buttons", "component": "Row", "children": ["cancel-btn", "ok-btn"] },
      { "id": "cancel-btn", "component": "Button", "child": "cancel-text",
        "action": { "event": { "name": "cancel" } } },
      { "id": "cancel-text", "component": "Text", "text": "Cancel" },
      { "id": "ok-btn", "component": "Button", "child": "ok-text",
        "action": { "event": { "name": "ok" } } },
      { "id": "ok-text", "component": "Text", "text": "OK" }
    ]
  }
}
```

## Triage example (plan / review / build)

```json
{
  "version": "v0.9",
  "updateComponents": {
    "surfaceId": "triage-1",
    "components": [
      { "id": "root", "component": "Column", "children": ["title", "row1"] },
      { "id": "title", "component": "Text", "text": "What do you want to do?" },
      { "id": "row1", "component": "Row", "children": ["btn-plan", "btn-review", "btn-build"] },
      { "id": "btn-plan",   "component": "Button", "child": "txt-plan",
        "action": { "event": { "name": "plan" } } },
      { "id": "txt-plan",   "component": "Text", "text": "Plan the app" },
      { "id": "btn-review", "component": "Button", "child": "txt-review",
        "action": { "event": { "name": "review" } } },
      { "id": "txt-review", "component": "Text", "text": "Review an existing design" },
      { "id": "btn-build",  "component": "Button", "child": "txt-build",
        "action": { "event": { "name": "build" } } },
      { "id": "txt-build",  "component": "Text", "text": "Generate implementation files" }
    ]
  }
}
```

### Rules

1. Every non-leaf component must declare `child` OR `children` referring to IDs emitted in the **same** `updateComponents` call.
2. `Card` uses `child` (single ID). To place multiple things inside a Card, wrap them in a `Row` or `Column` and point `child` at that wrapper.
3. `Row` / `Column` / `List` use `children: ["id1", "id2", …]`.
4. Buttons wrap a **Text** (or Icon) child; the Button itself carries the `action`.
5. Never emit `label` / `onClick` / `onChange` / `items` / `placeholder` / `value` / `disabled` at the top level. They are not part of v0.9.

## Surface lifecycle rules

### Creating surfaces
- Call `createSurface` exactly once per logical UI panel.
- Assign a stable, descriptive `surfaceId` (e.g., `plan-review`, `file-list`, `progress-tracker`).
- Do not create a new surface for every response turn — reuse existing surfaces via `updateComponents`.
- **Invariant (harness-enforced, #1075):** one `createSurface` per `surfaceId` per session. A duplicate `createSurface` is rejected with a tool error — to rerender the same surface, use `updateComponents`. `updateComponents` / `updateDataModel` / `deleteSurface` on a `surfaceId` that was never created (or was already deleted) are also rejected.
- `surfaceId` must be 1–128 characters. The harness additionally caps the number of live surfaces per session (default 1000, tunable via `KICKSTART_MAX_LIVE_SURFACES`) — release unused surfaces with `deleteSurface`.

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
