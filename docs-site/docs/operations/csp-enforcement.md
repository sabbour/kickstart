---
sidebar_label: CSP Enforcement
sidebar_position: 4
---

# Content Security Policy (CSP) Enforcement

## Canonical Enforcement Location

CSP is enforced at **runtime** by **Azure Static Web Apps** via the `globalHeaders` section of `packages/web/public/staticwebapp.config.json`.

This is the single source of truth for the deployed CSP header. Every change to the CSP policy must be made in that file.

```json
// packages/web/public/staticwebapp.config.json
{
  "globalHeaders": {
    "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://management.azure.com ..."
  }
}
```

## Repo-Side Guard

A compile-time companion guard runs on every PR that touches CSP-owning files:

- **Script:** `packages/web/scripts/check-csp.mjs`
- **Workflow:** `.github/workflows/csp-check.yml`

The guard reads `staticwebapp.config.json`, extracts the `Content-Security-Policy` value, and validates that required directives (e.g. `connect-src https://management.azure.com`) are present. It exits non-zero on any violation, blocking the PR.

> The repo-side guard catches _regressions before deployment_. It does not substitute for a post-deploy runtime check (see Wave 2 / issue #347).

## Escalation: CSP Drift Response

### What counts as a drift event

A CSP drift event is any of:

1. **Smoke check failure** — post-deploy CI fetches the live URL and finds the CSP header is missing or missing required directives (issue #347).
2. **Manual header inspection** — `curl -I https://<app>.azurestaticapps.net` shows a CSP that differs from `staticwebapp.config.json`.
3. **User report** — a browser console error referencing a CSP block that was not present in pre-deploy testing.

### Owner

| Role | Responsibility |
|------|---------------|
| **Kif (Platform)** | Primary owner — runtime and deploy config. First responder for any drift event. |
| **Leela (Architecture)** | Escalation — if drift requires a policy change that affects security architecture. |

### SLA

| Phase | Target |
|-------|--------|
| **Detection → Revert** | ≤ 24 hours from first alert |
| **Revert → Permanent fix** | ≤ 1 sprint (2 weeks) |

### Response channel

1. File a GitHub issue with labels `priority:p1`, `area:web`, `bug`.
2. Ping `@kif` (or the on-call platform owner) in the issue.
3. If the smoke check (issue #347) fires, the CI failure notification serves as the alert.

## Future Scope (non-`globalHeaders` CSP locations)

The current guard only scans `globalHeaders` in `staticwebapp.config.json`. If the project adopts additional CSP enforcement points, the guard must be extended. Potential future locations:

| Location | What to scan | Required directive |
|----------|--------------|--------------------|
| `<meta http-equiv="Content-Security-Policy">` in `packages/web/public/index.html` or built HTML | Parse all `<meta>` tags; extract CSP value | `connect-src https://management.azure.com` |
| Server-set CSP headers (if a proxy or custom origin fronts the SWA) | Fetch response headers from the proxy endpoint | `connect-src https://management.azure.com` |

> **Do not implement these scanners until the corresponding CSP location is actually adopted.** See issue #348 for the decision gate.

## Related

- Parent tracking issue: #324
- Runtime smoke check: #347
- Scope guard extension: #348
- CSP guard script: `packages/web/scripts/check-csp.mjs`
- Static Web App config: `packages/web/public/staticwebapp.config.json`
