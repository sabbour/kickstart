# Decision: Local-only media assets for A2UI component examples

**Date:** 2026-04-21  
**Author:** Fry (Frontend Dev)  
**Issue:** #1018  
**PR:** #1022  

## Decision

All A2UI component example envelopes that include a media `url` prop (Video, AudioPlayer, Image, Icon, Media) **must** reference locally-hosted assets served from the same origin. External URLs are prohibited.

## Context

Kickstart enforces `default-src 'self'` as its base CSP with no explicit `media-src` directive. Any external media URL in an A2UI component example will produce a CSP violation and a broken Playground preview in production. The w3schools demo URLs (`mov_bbb.mp4`, `horse.mp3`) that shipped in `core-previews.ts` triggered this in #1018.

## Constraints

- CSP must remain strict: `default-src 'self'`, no `media-src` whitelist additions. Per Ahmed's "align to spec" directive.
- Sample media must be committed to the repo and bundled (not fetched at runtime from external sources).

## Rationale

Broader CSP (`media-src https://...`) was explicitly rejected: it widens the attack surface and contradicts the spec alignment directive. Local assets are auditable, cacheable, and always available regardless of external service availability.

## Canonical sample paths

| Asset | Path |
|---|---|
| Video | `/assets/samples/sample.mp4` |
| Audio | `/assets/samples/sample.mp3` |
| Icons | `/assets/icons/fluent/<name>.svg` |

Source files: `packages/web/public/assets/samples/`, `packages/web/public/assets/icons/fluent/`

## Scope

Applies to: all A2UI example envelopes, component previews in `core-previews.ts`, sample prompts, SKILL.md examples, and any new A2UI component documentation that includes a media `url` prop.

## Documentation

`packages/pack-core/src/skills/a2ui-media-discipline/SKILL.md` — full pattern, examples, anti-patterns.
