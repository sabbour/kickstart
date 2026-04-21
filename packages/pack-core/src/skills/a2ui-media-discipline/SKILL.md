---
name: a2ui-media-discipline
description: Rules for referencing media assets (video, audio, images) in A2UI component examples. Enforces local-only media URLs to maintain strict CSP compliance.
domain: a2ui, assets, csp
confidence: high
source: earned
---

## Context

Kickstart's Content Security Policy enforces `default-src 'self'` with no explicit `media-src` directive. Any A2UI component example that references an external media URL will produce a browser CSP violation and a broken preview. This skill applies whenever authoring example envelopes, sample prompts, component previews, or any `core.emit_ui` payload that includes a `Video`, `AudioPlayer`, `Image`, or `Media` component with a `url` prop.

## Patterns

### Use locally-hosted sample media only

All media URLs in A2UI example envelopes **must** reference local assets served from the same origin:

| Asset type | Local path |
|---|---|
| Video | `/assets/samples/sample.mp4` |
| Audio | `/assets/samples/sample.mp3` |
| Image / Icon | `/assets/icons/fluent/<name>.svg` (Fluent catalog) |

These files are committed to `packages/web/public/assets/` and are bundled into the deployment artifact — they are always available at the above paths with no external dependency.

### Icon assets use the Fluent SVG catalog

Icons referenced via the `Icon` or `Image` component must use paths under `/assets/icons/fluent/`. The SVGs are vendored from `@fluentui/react-icons` and committed to `packages/web/public/assets/icons/fluent/`. To add a new icon:

1. Extract the SVG path data from `node_modules/@fluentui/react-icons/lib-cjs/atoms/svg/<icon-name>.js`
2. Commit the `.svg` file to `packages/web/public/assets/icons/fluent/`
3. Register the name in `packages/web/src/pages/playground-icons.ts`

## Examples

**✅ Correct — local Video example:**

```jsonc
[
  { "id": "root", "component": "Video", "url": "/assets/samples/sample.mp4" }
]
```

**✅ Correct — local AudioPlayer example:**

```jsonc
[
  { "id": "root", "component": "AudioPlayer", "url": "/assets/samples/sample.mp3", "description": "Audio preview" }
]
```

**✅ Correct — local Icon example:**

```jsonc
[
  { "id": "root", "component": "Icon", "name": { "path": "/assets/icons/fluent/sparkle.svg" } }
]
```

## Anti-Patterns

**❌ External media URLs — always violate CSP:**

```jsonc
// NEVER — violates default-src 'self', broken in all environments
{ "id": "root", "component": "Video", "url": "https://www.w3schools.com/html/mov_bbb.mp4" }
{ "id": "root", "component": "AudioPlayer", "url": "https://www.w3schools.com/html/horse.mp3" }
{ "id": "root", "component": "Image", "url": "https://example.com/image.png" }
```

**❌ Do NOT broaden CSP to allow external media:**

Adding `media-src https://www.w3schools.com` or any external host to the CSP header is explicitly rejected per Ahmed's "align to spec" directive. The fix is always to use local assets, never to loosen the CSP.

**❌ Do NOT use data: URIs for large media:**

`data:` URIs for binary media bypass asset caching, bloat payloads, and are harder to audit. Use committed asset files instead.
