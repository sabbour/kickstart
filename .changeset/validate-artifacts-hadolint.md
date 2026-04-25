---
"@aks-kickstart/pack-core": minor
---

Replace validate_artifacts stub with real dispatcher + hadolint Dockerfile linting

- Input schema changed from file paths to `{path, content}[]` for in-memory validation
- Added `.max()` bound (10MB) on content field per security advisory
- Hadolint integration via stdin pipe (no temp files): PATH lookup → download-on-first-use → graceful skip
- Codesmith prompt uplift: auto-validate Dockerfiles after write, retry up to 2x on violations
- 28 new/updated unit tests covering dispatcher routing, hadolint parsing, and schema conformance
