# Debug Mode

**When to use:** you are adding debug metadata to an API response, wiring the debug UI, or extending the debug payload.

## Context

Kickstart has opt-in full-stack debug mode that surfaces model info, raw SDK trace, tool calls, and rendering decisions. When debug is off, production responses are byte-identical to non-debug responses.

## Steps

### 1. Activation (backend)

Debug activates when either is true:

- `x-kickstart-debug: true` request header
- `?debug=true` query parameter

Detection centralizes in `packages/web/api/src/lib/debug-mode.ts`.

### 2. Payload shape

Debug metadata lives under a single `debug` key on the terminal SSE event, never on every chunk:

```json
{
  "debug": {
    "model": "gpt-4o-...",
    "rawContent": "...",
    "sdkTrace": {
      "runId": "...",
      "handoffs": [...],
      "toolCalls": [...]
    },
    "renderDecisions": [
      { "type": "component-selected", "component": "azure/resource-picker", "reason": "..." }
    ]
  }
}
```

Every field is optional. The UI renders "Not available" for absent data.

### 3. SSE placement

Debug metadata attaches to the terminal event only:

- For `/api/converse`: the final `done` event.
- For `/api/generate` (if present): the final `data` event.

Never on every `chunk`. Never on every `a2ui` event. Bloating the stream is a regression.

### 4. Frontend integration

- `DebugContext` is a standalone React context. Do not merge it into `ThemeContext`.
- Three activation methods, all first-class:
  - URL `?debug=true` (shareable)
  - Keyboard `Ctrl+Shift+D` (quick toggle)
  - localStorage (sticky across sessions)
- The `apiFetch()` layer injects the debug header when active. Never per-component.
- `DebugPanel` uses Fluent `makeStyles` + tokens only.

### 5. Extending the debug payload

When adding a new debug field (token counts, latency breakdowns, guardrail trace):

1. Add the field to the `debug` object in `debug-mode.ts`.
2. Update the `DebugMetadata` type.
3. Render it in `DebugPanel` with a "Not available" fallback.
4. Document the field in `docs-site/docs/extending/api-endpoints.md`.

### 6. SDK trace

The `@openai/agents` Runner produces a structured trace per run. Debug mode surfaces a redacted copy:

- Handoff chain (which agent handled which turn).
- Tool calls with sanitized arguments (drop secrets, redact long blobs).
- Guardrail outcomes.
- Interrupt/resume timestamps for user actions.

Do not surface raw tool arguments that may contain secrets. The redaction step is required.

## Key files

- `packages/web/api/src/lib/debug-mode.ts` — backend detection and payload assembly.
- `packages/web/src/contexts/DebugContext.tsx` — frontend context.
- `packages/web/src/components/DebugPanel.tsx` — UI.
- `packages/harness/src/trace/` — SDK trace capture and redaction.
