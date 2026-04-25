---
"@aks-kickstart/pack-core": minor
---

feat(pack-core): add gen-dockerfile skill — language-aware multi-stage Dockerfile generation

Implements issue #48: deterministic `gen-dockerfile` skill for Generation Phase C.

- Hardcoded base image allowlist: Python (3.11-slim), Node (20-alpine), Go (1.21-alpine)
- Multi-stage builds for all languages (builder + runtime stages)
- Layer caching: package manifests (requirements.txt / package.json / go.mod) copied before source
- Security defaults: non-root user (addgroup/adduser + USER appuser) in all generated Dockerfiles
- Framework-specific entrypoints: FastAPI (uvicorn), Flask (python app.py), Express (node server.js), Go (./server)
- Output path is always the literal "Dockerfile" — never derived from user input
- Full unit test suite: all languages + frameworks, unsupported language error, non-root check, path safety invariants
