---
name: bundled-pack-assets
description: Ship file-backed pack agents and skills with the API bundle
---

# Bundled Pack Assets

Use this when an API/serverless bundle inlines pack manifests that still load `.agent.md` or `SKILL.md` from disk at runtime.

## Rules

1. Inspect the bundled output, not just the source manifest. `import.meta.url` is rebound to the emitted bundle location.
2. Resolve every `agentsDir` / `skillsDir` exactly as the bundled file will at runtime.
3. Copy the markdown asset trees into those resolved `dist/` paths during the build. Do not depend on source-tree-relative paths existing in production.
4. Keep the runtime contract unchanged unless you are intentionally redesigning pack loading. Build-time asset shipping is the safe fix.
5. Validate with the built artifact: the resolved bundle URLs must contain readable `.agent.md` / `SKILL.md` files.

## Kickstart reference

- Build hook: `packages/web/api/esbuild.config.mjs`
- Registry loader: `packages/harness/src/runtime/registry.ts`
- Pack manifests: `packages/pack-*/src/server-manifest.ts`, `packages/pack-github/src/server-manifest.ts`

## Failure signature

- `/api/health` can still return `200`
- `/api/converse` or `/api/packs` 500 on first registry access
- first prompt can surface `Unknown agent: core.triage` if the bundle has partial/empty agent directories instead of the real markdown files
- bundle inspection shows `new URL("./agents/", import.meta.url)` or similar
- the matching directories are missing under `packages/web/api/dist/`
