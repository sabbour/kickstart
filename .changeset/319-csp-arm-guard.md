---
"@aks-kickstart/web": patch
---

Add CSP regression guard for browser-direct ARM (#319, parent #237)

- Add a regression guard to prevent removal of `https://management.azure.com` from the existing `connect-src` directive in `staticwebapp.config.json`.
- Add `packages/web/scripts/check-csp.mjs` which parses the SWA config, extracts the `connect-src` directive, and exits non-zero if any required origin is missing.
- Add `.github/workflows/csp-check.yml` — a hard-fail CI job (no `continue-on-error`) that runs the script on every PR touching CSP-owning files, blocking merges on regression.
- Add `packages/web/src/__tests__/csp-check.test.ts` covering pass + four regression scenarios.

Internal infra change with no user-visible behavior. Unblocks Wave 2 caller migration (sibling issue B2) by guaranteeing browser ARM calls remain CSP-permitted in production.
