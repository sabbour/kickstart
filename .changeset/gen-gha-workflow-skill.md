---
"@aks-kickstart/pack-core": minor
---

Add `gen-gha-workflow` skill for generating deterministic, secure GitHub Actions CI/CD workflows with OIDC + Azure Managed Identity authentication. 

**Features:**
- Deterministic YAML generation (identical input → identical output verified by full SHA-256 hash)
- OIDC-only authentication (no embedded secrets — Azure client ID, tenant ID, and subscription ID are non-sensitive and passed as plain config values)
- Comprehensive security validation (dangerous patterns, blocklisted env vars, name validation, path traversal prevention)
- Step validation: each step must have exactly one of `uses` or `run`
- Canonical field ordering and formatting
- 34+ tests covering determinism, OIDC, security, and YAML validity

**Inputs:** `{ name, trigger, jobs, azureTenantId, azureSubscriptionId, azureClientId, concurrency? }`
- `name`: workflow name → interpolated into `.github/workflows/{name}.yml`
- `trigger`: one or more of `push`, `pull_request`, `workflow_dispatch`, `schedule`
- `jobs`: array of job definitions with `name`, `runsOn`, `steps[]` (each step needs `uses` or `run`)

**Outputs:** `.github/workflows/{name}.yml` with OIDC configuration ready to commit
