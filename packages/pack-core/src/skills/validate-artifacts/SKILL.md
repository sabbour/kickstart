---
name: validate-artifacts
description: Guides agents in validating generated infrastructure artifacts (Bicep templates, Kubernetes YAML, GitHub Actions workflows) before they are presented to the user or used in a deployment.
appliesTo:
  - orchestrator
  - implementer
keywords:
  - validate
  - artifacts
  - bicep
  - yaml
priority: 70
---

## Validating Kickstart Artifacts

Run validation after generating any infrastructure file. Use the `validate_artifacts` tool and check each category below.

### Bicep template validation

A Bicep template passes validation when:
- It compiles without errors (`az bicep build` succeeds or the validator reports no syntax errors).
- All `param` declarations have descriptions.
- No hard-coded secrets, passwords, or connection strings appear in resource properties.
- The `location` parameter defaults to `resourceGroup().location`.
- Resource names comply with [Azure naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules): lowercase alphanumeric, hyphens allowed, correct length limits.
- Managed identity is used instead of service principals wherever possible.

### Kubernetes manifest validation

A Kubernetes manifest passes validation when:
- The YAML is syntactically valid (no tabs, correct indentation, no duplicate keys).
- Every `Deployment` has:
  - `resources.requests` and `resources.limits` set for every container.
  - `livenessProbe` and `readinessProbe` configured.
  - `securityContext.runAsNonRoot: true`.
- Every `Service` has a matching `selector` that corresponds to a `Deployment` label.
- `HorizontalPodAutoscaler` targets are referenced by name and match a real `Deployment`.

### GitHub Actions workflow validation

A GitHub Actions workflow passes validation when:
- The YAML is syntactically valid.
- Azure login uses OIDC federation (`azure/login` with `client-id`, `tenant-id`, `subscription-id`) — no stored secrets.
- All `uses:` references pin to a full SHA (not a mutable tag like `@v3`).
- The workflow has at minimum a `push` trigger on the default branch.

### Reporting validation results

For each file checked, report:
- ✅ **Pass** — file is valid; note the check performed.
- ⚠️ **Warning** — file is usable but has non-blocking issues; list them.
- ❌ **Fail** — file has blocking errors; list each error with the line number if available.

Do not mark a generation task complete until all ❌ failures are resolved.
