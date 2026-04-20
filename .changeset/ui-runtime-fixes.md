---
"@kickstart/web": patch
---

fix: dark mode landing icon, session expiry redirect, Monaco/Vite 8 compat

- Replace go.svg with ArrowRight24Regular Fluent icon (invisible in dark mode)
- Fix session expiry: apiFetch throws SessionExpiredError, useStreaming redirects to AAD login
- Fix Monaco worker URL resolution for Vite 8 / rolldown bundler
- Fix FileEditor lazy-loading and ArtifactContext dynamic imports
- Fix squad-pr-retro.yml YAML syntax error (multiline commit message)
- Fix CI changeset status: use fetch-depth 0 so changeset can find diverge point
