# SWA Deployment

**When to use:** You need to deploy to Azure Static Web Apps, configure CSP headers, stamp build metadata, or manage deployment slots.

## Context

Kickstart is deployed as an Azure Static Web App with a Vite-built frontend and SWA Functions API backend. Production deploys are gated on tagged releases. The app uses strict CSP headers.

## Steps

### 1. Build Metadata via Vite `define`

All build-time constants are injected through Vite's `define` configuration — never inline scripts:

```ts
// vite.config.ts
define: {
  __BUILD_VERSION__: JSON.stringify(process.env.npm_package_version),
  __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'local'),
}
```

Declare types in `src/vite-env.d.ts`:
```ts
declare const __BUILD_VERSION__: string;
declare const __BUILD_SHA__: string;
```

**Rules:**
- Never use inline `<script>` tags in `index.html`
- Never use `sed` hacks in CI to replace values
- No CDN scripts — all dependencies through npm/bundler
- New build-time constants go in the `define` block + `vite-env.d.ts`

### 2. Content Security Policy (CSP)

Maintain strict `script-src 'self'` CSP:
- No inline scripts (blocked by CSP)
- No CDN script tags
- All JS through the bundler
- CSP header configured via SWA `staticwebapp.config.json`

### 3. Deployment Strategy

| Trigger | Target |
|---------|--------|
| Tag push (`v*`) | Production SWA |
| `workflow_dispatch` | Emergency production deploy |
| Push to `main` | Pre-prod / staging |
| Push to `main` (path: `infra/`) | Infrastructure deploy |
| Push to `main` (path: `docs-site/`) | Documentation site deploy |

### 4. SWA Functions (API Backend)

- CORS proxy endpoints: `/api/arm-proxy/*`, `/api/github-oauth/*`, `/api/pricing-proxy/*`
- Token forwarding via Bearer token or managed identity
- Custom domain: configured via SWA domain binding + TLS cert

### 5. OIDC Credentials

Use `secrets.*` (not `vars.*`) for OIDC credentials in GitHub Actions workflows. This is a hard requirement — `vars.*` doesn't work for OIDC.
