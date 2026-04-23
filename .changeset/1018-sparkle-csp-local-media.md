---
"@aks-kickstart/web": patch
---

Fix sparkle.svg 404 + replace external w3schools media URLs with CSP-compliant local samples (#1018)

- Add `sparkle.svg` to `public/assets/icons/fluent/` (sourced from `@fluentui/react-icons` Sparkle24Regular path data); resolves 404 in Playground Icon and Image component previews.
- Add `sample.mp4` and `sample.mp3` to `public/assets/samples/`; these are minimal valid media stubs served from the same origin.
- Update `core-previews.ts` Video and AudioPlayer example envelopes to reference `/assets/samples/sample.mp4` and `/assets/samples/sample.mp3`; eliminates CSP `default-src 'self'` violations caused by the w3schools external URLs.
- CSP header unchanged — `default-src 'self'` remains strict; no `media-src` directive added.
- Add `packages/pack-core/src/skills/a2ui-media-discipline/SKILL.md` documenting the local-assets-only pattern for all future A2UI media component examples.
