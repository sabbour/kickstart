---
'@aks-kickstart/harness': minor
'@aks-kickstart/pack-core': minor
---

scaffold_app and write_file now emit files to the browser via emitFile() — enabling in-browser artifact store (Phase 3 of #165).

`write_file` always emits a `FileMessage` A2UI event so the frontend can store the file in its in-memory map; it also writes to disk when a server-side workspace is available (dual-mode). `scaffold_app` no longer requires a workspace root and works in pure in-browser deployments. Path safety checks (no traversal, no absolute paths) are preserved in both modes.
