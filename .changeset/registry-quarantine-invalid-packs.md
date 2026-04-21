---
"@aks-kickstart/api": minor
---

Registry now quarantines invalid pack skill manifests instead of failing global init. A single bad SKILL.md no longer takes the entire API offline.

- `/api/packs` response gains `loadErrors: Array<{packId: string, reason: 'schema_validation' | 'parse_error' | 'unknown'}>` (empty array when all packs healthy). Error content is sanitized — no raw Zod messages, no file paths in the response body.
- `/api/health` status type now includes `"degraded"` (HTTP 200) when some non-core packs failed to load but the registry is sealed and core is healthy. `"error"` (HTTP 503) is reserved for when core itself fails or the registry cannot seal.
- Pre-existing raw `err.message` exposure in the anonymous `/api/packs` error path is closed — 500 body is now opaque.
- Fix `packages/pack-core/src/skills/a2ui-media-discipline/SKILL.md` frontmatter (was using `.squad/skills/` template format; now uses correct `version` + `x-kickstart` block). Closes #1027.
