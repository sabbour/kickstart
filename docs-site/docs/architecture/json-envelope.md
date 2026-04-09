---
sidebar_position: 3
---

# JSON Envelope Format

The AI engine returns responses in a structured **JSON envelope** format. This allows a single LLM response to contain both conversational text and rich UI instructions.

## Envelope Structure

```json
{
  "message": "Here's your proposed architecture for the Node.js application...",
  "a2ui": [
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "arch-overview",
        "catalogId": "kickstart"
      }
    },
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "arch-overview",
        "components": [
          {
            "id": "title",
            "type": "Text",
            "dataModel": { "text": "## Architecture Overview" }
          },
          {
            "id": "services",
            "type": "Card",
            "dataModel": {
              "title": "Azure Services",
              "variant": "outlined"
            }
          }
        ]
      }
    }
  ],
  "actions": [],
  "phase": "design"
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Natural language response displayed as a chat bubble |
| `a2ui` | `array` | Array of A2UI v0.9 instructions (createSurface, updateComponents, updateDataModel) |
| `actions` | `array` | Suggested follow-up actions (buttons the user can click) |
| `phase` | `string` | Current conversation phase (`discover`, `design`, `generate`, `review`, `handoff`, `deploy`) |

## SSE Event Types

The backend streams the JSON envelope to the frontend using **Server-Sent Events (SSE)**. The stream is broken into typed events:

### `message` event

Contains the natural language text from the `message` field. Streamed incrementally as tokens arrive from the LLM.

```
event: message
data: {"content": "Here's your proposed "}

event: message
data: {"content": "architecture for the "}

event: message
data: {"content": "Node.js application..."}
```

### `a2ui` event

Contains A2UI instructions. Sent as complete JSON objects (not streamed token-by-token) since partial A2UI messages can't be rendered.

```
event: a2ui
data: {"version":"v0.9","createSurface":{"surfaceId":"arch-overview","catalogId":"kickstart"}}

event: a2ui
data: {"version":"v0.9","updateComponents":{"surfaceId":"arch-overview","components":[...]}}
```

### `done` event

Signals the end of the stream. Contains the final phase and any actions.

```
event: done
data: {"phase": "design", "actions": [{"label": "Looks good, generate files", "value": "approve"}]}
```

## Graceful Fallback

The frontend handles malformed or missing JSON gracefully:

- **Invalid JSON** — if the LLM returns unparseable JSON, the raw text is displayed as a plain message
- **Missing `a2ui` field** — the message is rendered as text-only (no surfaces created)
- **Missing `message` field** — only the A2UI surfaces are rendered (no chat bubble)
- **Unknown component types** — silently ignored; existing components continue rendering
- **Partial streams** — if the SSE connection drops mid-stream, whatever was received is displayed

This ensures the conversation never breaks, even when the AI produces unexpected output.
