# SWA Deployment

**When to use:** you are deploying to Azure Static Web Apps, adjusting CSP, stamping build metadata, or debugging a production deploy.

## Context

Kickstart is an Azure Static Web App with a Vite-built web client and SWA Functions API. The SWA is the **pre-production** environment and deploys from `main`. CSP is strict: `script-src 'self'`.

## Steps

### 1. Build metadata via Vite `define`

All build-time constants are injected through Vite's `define` block. Never inline scripts, never use `sed` hacks in CI.

```ts
// packages/web/vite.config.ts
define: {
  __BUILD_VERSION__: JSON.stringify(process.env.npm_package_version),
  __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'local'),
}
```

Declare types in `packages/web/src/vite-env.d.ts`.

Rules:
- No inline `<script>` tags in `index.html`.
- No `sed` replacements in CI for build values.
- No CDN script tags. All JS goes through the bundler.
- New build-time constants add to the `define` block plus `vite-env.d.ts`.

### 2. Content Security Policy

- `script-src 'self'`. No inline. No CDN.
- Configured in `packages/web/staticwebapp.config.json`.
- Any PR that loosens CSP requires a Zapp review and a brief note explaining why.

### 3. Deployment triggers

| Trigger | Target | Workflow |
|---------|--------|----------|
| Push to `main` | Pre-prod SWA | `.github/workflows/deploy-swa.yml` |
| Manual dispatch | Pre-prod SWA (re-deploy) | `.github/workflows/deploy-swa.yml` |
| Push to `main` under `infra/` | Azure infra | `.github/workflows/deploy-infra.yml` |
| Push to `main` under `docs-site/` | Docs site | `.github/workflows/deploy-docs.yml` |

Tag pushes (`v*`) mark versioned releases and cut GitHub Release notes. They do not trigger a separate production SWA deploy. The pre-prod SWA is the current runtime surface.

### 4. SWA Functions API

- API lives under `packages/web/api/`.
- Exposes the v2 runtime: `/api/converse`, `/api/health`, pack-registered proxy endpoints.
- Streams SSE events: `chunk`, `a2ui`, `tool`, `user_action_required`, `handoff`, `intent`, `done`, `error`.
- CORS-proxied endpoints (`arm-proxy`, `github-oauth`, `pricing-proxy`) forward Bearer tokens or use managed identity.

### 5. OIDC credentials

- Use `secrets.*` for OIDC credentials in GitHub Actions. Never `vars.*`.
- The `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` triad lives in repo secrets.
- Never print secrets to logs.

### 6. Smoke check

`deploy-swa.yml` runs `scripts/check-swa-health.mjs` against `/api/health` after deploy. A failed smoke check halts the deploy. Fix forward on `main`. Do not force-update an existing tag.

## Debugging a failed deploy

1. Read the workflow logs for the failing step.
2. If the Static Web Apps deploy step fails, check the artifact size and the deploy token.
3. If the smoke check fails, hit `/api/health` manually with the production hostname and inspect the response.
4. If the UI loads but the stream stalls, check the browser console for CSP violations and the network tab for the SSE connection.
