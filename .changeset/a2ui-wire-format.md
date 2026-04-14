---
"@kickstart/core": minor
"@kickstart/web": patch
"@kickstart/mcp-server": patch
---

Adopt official A2UI v0.9 nested wire format end-to-end. The `A2UIMessage` type shape changed from flat `{type, surfaceId, ...}` to nested `{version: "v0.9", createSurface: {...}}`.
