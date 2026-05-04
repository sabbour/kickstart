---
"@aks-kickstart/web": patch
---

fix: wire DebugTraceExport into main workspace chat and fix DebugPanel missing a2uiMessages in Playground

- `ChatShell` now accepts `sessionId?: string` and renders `<DebugTraceExport>` when `debugEnabled && !isStreaming && messages.length > 0`
- `App.tsx` passes `sessions.activeSessionId` as `sessionId` to `ChatShell`, making the export button visible in the workspace chat
- Fixes `Playground.tsx` Create tab where `<DebugPanel>` was missing the `a2uiMessages` prop, which caused A2UI action log to be excluded from the debug panel
