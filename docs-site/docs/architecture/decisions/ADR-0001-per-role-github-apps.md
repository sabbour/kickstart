---
sidebar_position: 1
---

# ADR-0001: Per-Role GitHub Apps for Bot Identity

**Date:** 2026-04-24  
**Status:** Accepted  
**Deciders:** Ahmed Sabbour (Lead), Squad  
**Affects:** Identity system, CI/CD workflows, bot token management

## Context

The Squad system needs a secure, auditable way to authenticate bots (code agents, scripting tasks, CI/CD workflows) with GitHub. Each squad role (Lead, Frontend, Backend, Tester, CodeReview, Scribe, Security, DevOps, Docs, Data) performs distinct actions — code reviews, deployment, documentation publishing — and each should operate with minimal privilege and independent credential management.

### Problem Statement

- **Auditability:** We need to trace which role performed which action on GitHub.
- **Least Privilege:** Each role should have only the permissions it needs.
- **Independent Rotation:** If one role's credentials are compromised, others remain safe.
- **Secure Ephemeral Tokens:** Short-lived tokens reduce blast radius if exposed.

## Decision

**Use per-role GitHub Apps.** Create 10 independent GitHub Apps (one per squad role), each registered as a GitHub App. Private keys are stored locally and never committed to the repository; app metadata (appId, slug, clientId, installationId) is stored as public JSON files.

### Why Per-Role Apps?

1. **One credential per responsibility:** Lead makes releases, Backend deploys code, Docs publishes site updates — each via its own app.
2. **Audit trail:** GitHub audit logs show which app (and thus which role) performed each action.
3. **Instant rotation:** If a role is compromised, revoke that app's token without affecting others.
4. **Zero shared secrets:** No shared bot token that all roles depend on.

## Alternatives Considered

### 1. Single Shared GitHub App Token

**Pros:** Simpler to manage — one app, one token.  
**Cons:**
- All roles appear as the same identity; audit logs can't distinguish who did what.
- Compromise of one token exposes all roles.
- No way to revoke access for one role without breaking others.

**Rejected:** Loses the auditability and isolation benefits.

### 2. Personal Access Tokens (PATs)

**Pros:** Simple to create and deploy.  
**Cons:**
- PATs are tied to a single human user and their permissions; not suitable for bots.
- Difficult to rotate without manual intervention.
- No GitHub App features (scoped app permissions, installation-level restrictions).

**Rejected:** Not designed for bot-to-bot or bot-to-service communication.

### 3. Single GitHub App with Role Parameter

**Pros:** Fewer apps to register and manage.  
**Cons:**
- All roles still share the same JWT signing key; if compromised, all are exposed.
- GitHub doesn't route actions by internal "role parameter" — the app identity is opaque to GitHub.
- No clearer audit trail than the shared token approach.

**Rejected:** Adds management complexity without solving the security or auditability problems.

## Implementation Details

### App Registration

1. Each role gets a GitHub App registered at `https://github.com/settings/apps`
   - **App name:** `squad-{role}` (e.g., `squad-backend`, `squad-docs`)
   - **Permissions:** Scoped to the minimum required for that role's tasks
   - **Webhooks:** Disabled (not needed for token-based workflows)

2. **Private Key Storage**
   - Generated after app registration and downloaded from GitHub.
   - Stored locally at `~/.config/squad/asabbour_microsoft/keys/{role}.pem`
   - **Never** committed to the repository.

3. **Public Metadata**
   - App registration JSON stored at `.squad/identity/apps/{role}.json`
   - Contains only public info: `appId`, `slug`, `clientId`, `installationId`
   - Safe to commit; enables portable app metadata across machines.

### Token Lifecycle

#### 1. Generate JWT from PEM

```
resolve-token.mjs (with PEM)
  ↓
  Generate JWT signed with the role's private key
  ↓
  JWT is valid for ~10 minutes
```

#### 2. Exchange JWT for Installation Token

```
JWT + installationId
  ↓
  POST /app/installations/{installationId}/access_tokens (GitHub API)
  ↓
  Return ephemeral token (1-hour TTL)
```

#### 3. Use Installation Token Inline

```bash
GH_TOKEN="$TOKEN" gh pr create ...
```

- Token is never logged or echoed.
- Passed inline to `gh` CLI only.
- Only in memory; not persisted.

#### 4. Post-Flight Identity Check

After each critical action (deployment, release, secret rotation), verify the action by checking GitHub's audit log to confirm the correct app performed it.

### Credential Distribution for CI

For GitHub Actions workflows (which run in CI, not locally):

1. **Secret Upload** (`sync-secrets.mjs`): Uploads PEM files + app IDs as repository secrets.
2. **Secret Scanning** (`scrub-secrets.mjs`): Blocks PEM file paths in commits but allows app registration JSONs (content-based scanning catches real secrets).

## Consequences

### Operational Complexity

- **10 apps to manage:** Each role has its own app registration, private key, and metadata.
- **Key rotation:** Revoking a compromised key requires regenerating that app's key.
- **Tooling required:** `resolve-token.mjs`, `sync-secrets.mjs`, `scrub-secrets.mjs` handle key generation, token exchange, and secret scanning.

### Security Benefits

- **Minimal privilege per role:** Backend app has only deployment permissions; Docs app has only site publishing permissions.
- **Audit trail:** Every GitHub action is attributed to the role that performed it.
- **Instant isolation:** Revoke one app without affecting others.
- **Ephemeral tokens:** No long-lived credentials in workflows; each run fetches a fresh token.

### Scalability

If additional roles are added (e.g., `admin`, `infra`), the pattern scales:
1. Create a new GitHub App
2. Store the PEM locally
3. Add the app registration JSON to `.squad/identity/apps/`
4. Update `sync-secrets.mjs` to include the new role
5. Role is immediately available for use

## Validation

- **Local Testing:** `resolve-token.mjs` generates valid JWTs and exchanges them for installation tokens.
- **CI Testing:** `sync-secrets.mjs` correctly uploads PEMs; workflows fetch and use tokens without error.
- **Audit Verification:** GitHub audit log shows the correct app identity for each action.

## Related Decisions

- **ADR-0000 (future):** CI/CD workflow structure and GitHub Actions secret management.

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [JWT Bearer Token Flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-jwt-for-a-github-app)
- [Installation Token Endpoint](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)
- **Squad Implementation:** `.squad/identity/`, `resolve-token.mjs`, `sync-secrets.mjs`, `scrub-secrets.mjs`
