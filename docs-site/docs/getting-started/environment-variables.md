---
sidebar_position: 2
---

# Environment Variables

Complete reference for all environment variables used in Kickstart — from local development to production.

## LLM Configuration (Required)

These variables are required for the conversation engine to work. They configure Azure OpenAI deployments.

### AZURE_OPENAI_ENDPOINT

**Required:** Yes  
**Default:** None  
**Example:** `https://your-resource.openai.azure.com/`

The Azure OpenAI resource endpoint. Supports both:
- **Azure AI Services** (multi-service): `https://your-resource.cognitiveservices.azure.com/`
- **Azure OpenAI** (single-service): `https://your-resource.openai.azure.com/`

Check your resource in the Azure Portal under **Keys and Endpoint**.

### AZURE_OPENAI_API_KEY

**Required:** Yes  
**Default:** None  
**Example:** `sk-abc123...`

The API key for your Azure OpenAI resource. Found in Azure Portal under **Keys and Endpoint** → **Key 1** or **Key 2**.

### KICKSTART_CHAT_MODEL

**Required:** Yes  
**Default:** None (falls back to `AZURE_OPENAI_CHAT_DEPLOYMENT`)  
**Example:** `gpt-5.4-mini`

The deployment name for chat-tier models. Used for conversation turns, routing decisions, and text generation.

The harness will automatically fall back to `AZURE_OPENAI_CHAT_DEPLOYMENT` if this is not set, with a deprecation warning.

### KICKSTART_CODEX_MODEL

**Required:** No (unless used by agents)  
**Default:** None (falls back to `AZURE_OPENAI_CODEX_DEPLOYMENT`)  
**Example:** `gpt-5.4`

The deployment name for code-generation tier models. Required only if agents request a codex-tier model.

The harness falls back to `AZURE_OPENAI_CODEX_DEPLOYMENT` if unset, but will never cross tiers — a missing `KICKSTART_CODEX_MODEL` will not fall back to `KICKSTART_CHAT_MODEL`.

### KICKSTART_INSPIRE_MODEL (Optional)

**Required:** No  
**Default:** None  
**Example:** `gpt-5.4-nano`

The deployment name for lightweight inspiration/ideation models. Used for suggestion generation where a smaller, faster model is sufficient.

## Legacy Fallbacks

These variables are deprecated but still supported for backward compatibility. New deployments should use the `KICKSTART_*` variables instead.

### AZURE_OPENAI_CHAT_DEPLOYMENT

**Deprecated:** Yes  
**Fallback for:** `KICKSTART_CHAT_MODEL`  
**Triggers warning:** Yes

Used only if `KICKSTART_CHAT_MODEL` is not set. A deprecation warning is logged to encourage migration.

### AZURE_OPENAI_CODEX_DEPLOYMENT

**Deprecated:** Yes  
**Fallback for:** `KICKSTART_CODEX_MODEL`  
**Triggers warning:** Yes

Used only if `KICKSTART_CODEX_MODEL` is not set.

## Pack Configuration

### KICKSTART_PACKS

**Required:** No  
**Default:** All available packs  
**Example:** `core,azure,aks-automatic`

Comma-separated list of packs to enable at runtime. If not set, all discovered packs are loaded.

Useful for:
- Disabling specific packs in certain environments
- Loading only the packs needed for your deployment
- Testing with a minimal pack set

Valid pack names: `core`, `azure`, `github`, `aks-automatic`

## Feature Flags

### KICKSTART_PLAYGROUND

**Required:** No  
**Default:** `false`  
**Allowed values:** `true`, `false`

When `true`, enables playground scenarios for component development and testing. Adds demo data and example workflows to the UI without requiring full API integration.

**Security:** Playground mode adds additional UI endpoints and demo data. Disable in production environments.

### KICKSTART_DEBUG_ALLOWED

**Required:** No  
**Default:** `false`  
**Allowed values:** `true`, `false`

When `true`, enables debugging tools and verbose logging in the runtime. Useful for investigating agent behavior and pack interactions.

## Authentication & Security

### GITHUB_CLIENT_ID

**Required:** No (unless GitHub auth is needed)  
**Default:** None  
**Example:** `Ov23liwXXXXXXXXXXXXX`

OAuth application ID for GitHub authentication. Create an OAuth app in GitHub Settings → Developer settings → OAuth Apps.

### GITHUB_CLIENT_SECRET

**Required:** No (unless GitHub auth is needed)  
**Default:** None  
**Example:** `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

OAuth application secret for GitHub authentication. Keep this secret — do not commit to source control.

### GITHUB_SESSION_SECRET

**Required:** No  
**Default:** Falls back to `GITHUB_CLIENT_SECRET` or `AZURE_CLIENT_SECRET`  
**Example:** `your-secret-string`

Encryption key for GitHub OAuth session cookies. If not set, falls back to other secrets in order of precedence.

### GITHUB_OAUTH_SCOPES

**Required:** No  
**Default:** `repo,user:email`  
**Example:** `repo,user:email,gist`

Comma-separated list of OAuth scopes to request from GitHub. Customize based on what your deployment needs.

### AZURE_CLIENT_ID

**Required:** No  
**Default:** None  
**Example:** `e71a23c6-aeb4-459a-88fc-07ff96fc9b92`

Azure Entra ID (formerly Azure AD) application ID for Azure authentication and resource deployments.

### AZURE_CLIENT_SECRET

**Required:** No  
**Default:** None  
**Example:** `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

Client secret for Azure Entra ID service principal. Used for interactive deployments and resource operations.

### AZURE_TENANT_ID

**Required:** No  
**Default:** None  
**Example:** `d91aa5af-8c1e-442c-b77c-0b92988b387b`

Azure Entra ID tenant ID (directory ID) for your organization.

### DEPLOY_RUN_SECRET

**Required:** No  
**Default:** Falls back to `GITHUB_SESSION_SECRET` or `AZURE_CLIENT_SECRET`  
**Example:** `your-run-secret`

Secret used to authorize deployment run initiations. If not explicitly set, the system checks fallback secrets.

## Runtime Configuration

### NODE_ENV

**Required:** No  
**Default:** `production`  
**Allowed values:** `development`, `production`, `test`

Node.js environment mode. Affects logging verbosity and some runtime optimizations.

### PORT

**Required:** No  
**Default:** `4280`  
**Example:** `8080`

Port for the dev server (when running `npm run dev`). The SWA CLI listens on this port.

## Quick Start: Local Development

Create `packages/web/api/local.settings.json` with the following structure:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-api-key",
    "KICKSTART_CHAT_MODEL": "gpt-5.4-mini",
    "KICKSTART_CODEX_MODEL": "gpt-5.4",
    "KICKSTART_INSPIRE_MODEL": "gpt-5.4-nano",
    "KICKSTART_PLAYGROUND": "false",
    "AZURE_CLIENT_ID": "your-app-id",
    "AZURE_CLIENT_SECRET": "your-secret",
    "AZURE_TENANT_ID": "your-tenant-id",
    "GITHUB_CLIENT_ID": "your-github-app-id",
    "GITHUB_CLIENT_SECRET": "your-github-secret"
  }
}
```

:::caution
Never commit `local.settings.json` to source control. It's already in `.gitignore`.
:::

## .env.sample Reference

Use this as a template for your environment configuration:

```bash
# ============================================================================
# Azure OpenAI (Required)
# ============================================================================

AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=sk-...

# Preferred deployment names (v2 standard)
KICKSTART_CHAT_MODEL=gpt-5.4-mini
KICKSTART_CODEX_MODEL=gpt-5.4
KICKSTART_INSPIRE_MODEL=gpt-5.4-nano

# Legacy fallbacks (deprecated, but still supported)
# AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5.4-mini
# AZURE_OPENAI_CODEX_DEPLOYMENT=gpt-5.4

# ============================================================================
# Packs & Features
# ============================================================================

# Comma-separated list of packs to enable (default: all)
# KICKSTART_PACKS=core,azure,github,aks-automatic

# Enable playground scenarios for component development
KICKSTART_PLAYGROUND=false

# Enable debug logging
KICKSTART_DEBUG_ALLOWED=false

# ============================================================================
# Azure Authentication
# ============================================================================

AZURE_CLIENT_ID=your-app-id
AZURE_CLIENT_SECRET=your-secret
AZURE_TENANT_ID=your-tenant-id

# ============================================================================
# GitHub OAuth (Optional)
# ============================================================================

GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=ghp_...
GITHUB_OAUTH_SCOPES=repo,user:email

# ============================================================================
# Security Keys
# ============================================================================

# Session encryption (falls back to CLIENT_SECRET if not set)
GITHUB_SESSION_SECRET=your-session-secret
DEPLOY_RUN_SECRET=your-run-secret

# ============================================================================
# Runtime
# ============================================================================

NODE_ENV=development
PORT=4280
```

## Troubleshooting

### "Agent model is not configured" error

**Cause:** `KICKSTART_CHAT_MODEL` and fallback `AZURE_OPENAI_CHAT_DEPLOYMENT` are both unset.

**Solution:** Set `KICKSTART_CHAT_MODEL` to a valid Azure OpenAI deployment name.

### Model deployment name mismatch

**Cause:** Deployment names don't exist in your Azure OpenAI resource.

**Solution:** Verify deployment names in Azure Portal → your resource → Deployments. Deployment names are NOT the same as model names (e.g., `gpt-5.4-mini` is a deployment name, not a model ID).

### GitHub OAuth not working

**Cause:** `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is missing or mismatched.

**Solution:** Check GitHub Settings → Developer settings → OAuth Apps. Ensure the redirect URI is correct: `http://localhost:4280/api/github-auth/callback` for local dev, or your production origin for deployments.

### "Endpoint format" error

**Cause:** Wrong endpoint URL format.

**Solutions:**
- For Azure AI Services: `https://resource.cognitiveservices.azure.com/`
- For Azure OpenAI: `https://resource.openai.azure.com/`

Check your resource type in Azure Portal.
