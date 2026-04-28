---
"@aks-kickstart/harness": minor
---

Add `emitFile()` helper that emits a `file` A2UI event — enables in-browser file storage without requiring a server-side workspace root. Tools can now call `emitFile(session, name, content, mimeType?)` to stream file payloads to the browser, where the frontend stores them in a `Map<filename, content>`.
