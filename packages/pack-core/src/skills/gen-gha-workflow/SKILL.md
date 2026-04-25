---
name: gen-gha-workflow
description: Generate GitHub Actions CI/CD workflows with OIDC + Azure Managed Identity authentication. Emits deterministic, production-ready .github/workflows/*.yml files with zero embedded secrets.
version: 0.1.0
x-kickstart:
  appliesTo:
    - "*"
  keywords:
    - github-actions
    - ci-cd
    - oidc
    - managed-identity
    - azure
    - security
    - automation
  priority: 90
---

# GitHub Actions Workflow Generation

Emit production-grade GitHub Actions CI/CD workflows configured for OIDC federated credential authentication with Azure Managed Identity. No secrets stored in repository — authentication happens via OpenID Connect.

## Purpose

This skill generates `.github/workflows/{name}.yml` files that:

1. **Use OIDC instead of secrets** — Azure login via federated credentials, not stored tokens
2. **Enforce determinism** — same input always produces identical YAML
3. **Apply security guardrails** — reject suspicious step content, validate names, prevent secret leakage
4. **Follow best practices** — canonical field ordering, clear permissions, concurrency control

## Inputs

- **Workflow name** — e.g., "ci", "deploy". Maps to `.github/workflows/{name}.yml`
- **Trigger** — `push`, `pull_request`, `workflow_dispatch`, `schedule` (or combinations)
- **Jobs spec** — List of job definitions:
  - Job name (validated: alphanumeric + hyphens)
  - Steps (each: `name`, `uses` **or** `run`, `env`, `with`)
  - Outputs (job-level only — steps do not support `outputs` in GitHub Actions)
  - Job-level `env` (validated against blocklist)
- **Azure credentials** — Tenant ID, Subscription ID, Client ID (for OIDC)

## Outputs

- **Valid YAML** — Round-trips through `js-yaml` without error (YAML syntax only — not validated against the GitHub Actions JSON schema)
- **OIDC step** — `azure/login` (pinned to SHA, v2.3.0) with tenant ID, subscription ID, and client ID from inputs (non-sensitive configuration values, not GitHub Secrets)
- **Canonical format** — Deterministic field order: name, on, permissions, jobs, etc.

## Determinism

The same input always produces identical YAML. This is enforced by:

- Sorted keys in all objects (YAML maps)
- Consistent indentation (2 spaces)
- Canonical field order (name → on → permissions → concurrency → jobs)
- No UUID or timestamp injection
- 10-run test verifies identical hash over 10 sequential calls

## Security

1. **No embedded secrets** — OIDC login uses the Azure client ID, tenant ID, and subscription ID from the skill input directly (these are non-sensitive public configuration values). Authentication happens at runtime via the `id-token: write` permission, with no stored secrets in the repository.
2. **Step content validation** — Rejects steps containing:
   - `eval()`, `exec()`, dynamic imports
   - Exfiltration patterns (e.g., `env | curl`, `secrets | base64`)
   - Hard-coded credentials (regex pattern match for `ghs_`, `ghp_`, etc.)
3. **Environment variable key validation** — Rejects keys starting with `AWS_`, `GITHUB_TOKEN`, `STRIPE_KEY`, etc.
4. **Job name validation** — Alphanumeric + hyphens, max 100 chars
5. **YAML syntax validation** — Verifies generated output round-trips through `js-yaml` without error. Does not validate against the GitHub Actions JSON schema.
6. **Path traversal prevention** — Workflow `name` is validated with `^[a-zA-Z0-9_-]+$` before being interpolated into the output filename.

## When to use

Apply this skill when you need to generate CI/CD workflows for repositories that:

- Deploy to Azure (AKS, App Service, Functions, etc.)
- Want zero secrets management overhead
- Require OIDC federated credentials (GitHub → Azure)
- Need deterministic, auditable workflow definitions

## Example (high-level)

```typescript
const workflow = await genGhaWorkflow({
  name: "deploy",
  trigger: ["push"],
  azureTenantId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  azureSubscriptionId: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  // Client ID is the Azure App Registration ID — non-sensitive, varies per environment.
  azureClientId: "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
  jobs: [
    {
      name: "deploy",
      runsOn: "ubuntu-latest",
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        // azure/login OIDC step is automatically prepended using the azureClientId above.
        { name: "Deploy", run: "az deployment group create ..." }
      ]
    }
  ]
});
```

Output: Valid `.github/workflows/deploy.yml` with OIDC configuration, ready to commit.

## Implementation Notes

- Uses `js-yaml` for deterministic YAML serialization
- Field ordering enforced via object key sorting and explicit serialization
- Security checks run before YAML generation
- Comprehensive test suite: 20+ tests covering determinism, OIDC, security, YAML validity
