# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-01-21: Azure Static Web Apps Deployment Setup

- **Deployment approach:** Azure Static Web Apps via GitHub Actions (`Azure/static-web-apps-deploy@v1`)
- **App structure:** Static HTML/CSS/JS served from repo root (`app_location: "/"`)
- **No build step:** Portal Prototyper framework is zero-dependency, so `skip_app_build: true`
- **PR previews:** SWA automatically creates staging environments for every PR
- **Secret management:** `AZURE_STATIC_WEB_APPS_API_TOKEN` required in GitHub secrets
- **Config file:** `staticwebapp.config.json` at repo root handles routing, headers, MIME types
- **Custom domains:** Configured via Azure Portal after initial deployment (temp: imagine.prototypes.aks.azure.sabbour.me, future: imagine.aks.azure.com)
- **Security headers:** Enforced at CDN edge via `globalHeaders` in SWA config (nosniff, frame deny, XSS protection)
- **Workflow structure:** Two jobs — `deploy` (on push/PR open) and `close_staging` (on PR close)

### 2025-07-24: Auth Registration Setup

- **Entra App Registration:** "Imagine - AKS Onboarding", App ID `7a630e18-8f49-404e-8454-228b13089c57`, Object ID `1652d168-11ad-4f5c-84c9-4689cceb1284`
- **Tenant:** `72f988bf-86f1-41af-91ab-2d7cd011db47` (Microsoft internal, single-tenant only)
- **Auth flow:** SPA Auth Code Flow with PKCE via MSAL.js — no client secret for the SPA
- **SPA redirect URIs:** localhost:8080, localhost:4280, staging domain, production domain
- **API permissions:** Microsoft Graph `User.Read` + Azure Service Management `user_impersonation` (both delegated)
- **MSFT internal tenant quirk:** `--service-management-reference` is REQUIRED for `az ad app create`. Used `940efe13-531b-418e-bf86-62248ccec86c` (Ahmed's existing service tree reference).
- **Subscription note:** Target subscription `4498459e-01d5-4a3f-b07e-8f1f36598c16` wasn't in the available list, but app registrations are tenant-level, so used `90ab3701-83f0-4ba1-a90a-f2e68683adab` which is in the same tenant.
- **Config file:** `js/config.js` — environment-aware (auto-detects hostname), IIFE pattern, frozen config object
- **GitHub OAuth:** Requires manual creation via GitHub UI. Setup docs at `docs/github-oauth-setup.md`
- **Secret management:** Client IDs in source code (not secrets), client secrets in GitHub Secrets / SWA app settings only
- **Key files:** `js/config.js`, `docs/github-oauth-setup.md`, `.squad/decisions/inbox/bender-auth-setup.md`
