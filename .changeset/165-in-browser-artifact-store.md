---
"@aks-kickstart/harness": minor
"@aks-kickstart/pack-core": patch
---

**fix(harness):** remove `/workspace` server-filesystem default from `Session` — the path does not exist on the Azure Functions host and caused ENOENT crashes on every file-writing tool call.

`workspaceRoot` is now optional on `Session`, `SessionData`, `getOrCreateSession`, and `getOrCreateSessionResult`. Tools (`core.write_file`, `core.read_file`, `core.list_files`, `core.scaffold_app`) return a clear error message instead of crashing when no workspace root is configured. This is Phase 1 of the in-browser artifact store migration (#165); subsequent phases will stream generated files to the frontend via A2UI `emit_file` events and hold them in a browser-side `Map<string, Blob>`.
