# Debug Mode

**When to use:** You need to add debug metadata to API responses, wire up the debug UI, or extend the debug payload.

## Context

Kickstart has a full-stack debug mode that surfaces LLM model info, raw output, and rendering decisions during development. It's opt-in and backward-compatible — production responses are byte-identical when debug is off.

## Steps

### 1. Activation (Backend)

Debug mode activates when either condition is met:
- `x-kickstart-debug: true` request header
- `?debug=true` query parameter

Detection is centralized in `packages/web/api/src/lib/debug-mode.ts`.

### 2. Payload Shape

All debug metadata lives under a single `debug` key:
```json
{
  "debug": {
    "model": "gpt-4o",
    "rawContent": "...",
    "renderDecisions": [
      { "type": "component-selected", "reason": "..." }
    ]
  }
}
```

### 3. SSE Placement

Debug metadata is included only in the **terminal event** (`done` for converse, final `data` for generate) — never in every chunk. This avoids bloating the stream.

### 4. Frontend Integration

- **DebugContext** — separate React context (not merged into ThemeContext)
- **Three activation methods:** URL param `?debug=true` (shareable), keyboard shortcut `Ctrl+Shift+D` (quick toggle), localStorage (sticky across sessions)
- **Debug header injection** — handled at the `apiFetch()` layer, not per-component
- **DebugPanel** — uses Fluent `makeStyles` + tokens only, no custom CSS

### 5. Graceful Degradation

Every field in `DebugMetadata` is optional. The UI renders "Not available" for absent data. Frontend can ship before backend fields are fully wired.

## Extending Debug

When adding new debug fields (token counts, latency breakdowns):
1. Add to the `debug` object in `debug-mode.ts`
2. Update `DebugMetadata` type
3. The `renderDecisions` array is extensible — add new decision types without breaking consumers
