---
"@aks-kickstart/web": patch
---

feat: export full conversation trace to file or clipboard from debug panel (#440)

When debug mode is active (Ctrl+Shift+D), a new **DebugTraceExport** bar appears below the conversation after at least one message is sent. It offers two export actions:

- **Download trace** — saves a `trace-<sessionId>-<date>.json` file via `URL.createObjectURL`.
- **Copy trace** — copies the same JSON to the clipboard via the Clipboard API.

The exported JSON includes:
- `exportedAt` — ISO 8601 timestamp
- `sessionId` — server-side session ID (if established)
- `turns` — all `ChatMessage` objects (text, role, model, phase, timestamp, usage, debugInfo, a2uiMessages)
- `actionLog` — all A2UI action dispatches captured by `DebugContext`

Uses Fluent UI v9 `Button` + `Tooltip` for interactive controls, and `makeStyles` with Fluent UI design tokens for layout and typography. No hand-rolled CSS class systems or inline styles on rendered UI elements.
