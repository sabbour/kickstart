---
"@aks-kickstart/harness": patch
"@aks-kickstart/web": patch
---

fix(mcp): include github pack skills in MCP bundle and handle missing skillsDir gracefully

- esbuild.config.mjs: fix source path for github skills (`src/skills` → `skills`)
- registry.ts: `directoryURLToPath` now accepts `allowMissing` option; `loadSkills` skips gracefully when skillsDir directory is absent (prevents crash when npm strips empty directories from tarballs)
