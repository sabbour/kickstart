# Bender decision inbox — prefer callback-based app creation

**Date:** 2026-04-24T10:40:12.502-07:00
**Context:** GitHub App setup in `.squad/scripts/` needs a reliable manifest flow that actually saves credentials.

## Decision

Prefer `.squad/scripts/create-app.mjs` over `generate-app-manifests.mjs` for GitHub App creation. The new script completes the manifest flow by capturing GitHub's callback code, exchanging it, and saving the resulting credentials.

## Why

- GitHub redirects manifest creation back with `?code=...`, and that code must be exchanged immediately.
- Static HTML can submit a manifest, but it cannot complete the conversion step or persist the PEM and app registration.
- Centralizing the manifest gotchas in one script reduces repeated operator mistakes.

## Consequences

- `generate-app-manifests.mjs` remains a reference generator, not the primary setup path.
- Future setup docs and operator instructions should point to `create-app.mjs` first.
