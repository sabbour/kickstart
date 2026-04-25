# Bender decision inbox — externalize app private keys

**Date:** 2026-04-24T10:48:43.003-07:00
**Context:** GitHub App setup scripts need to stop storing PEM material inside the repo without leaving repo-local mirrors behind.

## Decision

Store GitHub App PEM files outside the repo by default under `~/.config/squad/{owner}/keys/`. Do not create `.squad/identity/keys/{role}.pem` symlinks or any other repo-local mirror.

## Why

- The repo should not be the storage boundary for long-lived private keys.
- The token resolver already supports explicit external key paths, so duplicating or mirroring keys inside the repo adds risk without value.
- A `--keys-dir` override keeps local automation flexible for nonstandard environments.

## Consequences

- App creation now depends on the operator's user config directory by default.
- Backup and rotation procedures must treat the external config directory as the only source of truth for PEM material.
- Follow-up configuration must point resolvers at the external key path instead of expecting an in-repo file.
