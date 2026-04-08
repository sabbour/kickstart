# GitHub OAuth App Setup

The Imagine app needs a GitHub OAuth App so it can act on behalf of users — creating repos, pushing generated code, opening PRs, etc.

> **GitHub OAuth Apps cannot be created via CLI.** Follow these manual steps.

---

## Step 1: Create the OAuth App

1. Go to **GitHub Settings → Developer settings → OAuth Apps**
   - Direct link: <https://github.com/settings/developers>
2. Click **"New OAuth App"**
3. Fill in the form:

| Field | Value |
|---|---|
| **Application name** | `Imagine - AKS Onboarding` |
| **Homepage URL** | `https://imagine.prototypes.aks.azure.sabbour.me` |
| **Application description** | AI-guided onboarding experience for deploying apps to AKS |
| **Authorization callback URL** | `https://imagine.prototypes.aks.azure.sabbour.me/.auth/login/github/callback` |

4. Click **"Register application"**

## Step 2: Note the credentials

After creation, GitHub shows you:

- **Client ID** — This is public. Copy it into `js/config.js` (replace `REPLACE_WITH_GITHUB_CLIENT_ID`).
- **Client Secret** — Click "Generate a new client secret". **Copy it immediately** — you won't see it again.

## Step 3: Add additional callback URLs

GitHub OAuth Apps support only **one** callback URL in the settings form. For multi-environment support, you have two options:

### Option A: Use a single OAuth App with environment routing

Register the production callback URL and handle environment routing in your callback handler. The `state` parameter can encode which environment initiated the flow.

### Option B: Create separate OAuth Apps per environment (recommended for dev)

| Environment | Callback URL |
|---|---|
| Local dev (port 8080) | `http://localhost:8080/.auth/login/github/callback` |
| SWA CLI (port 4280) | `http://localhost:4280/.auth/login/github/callback` |
| Staging | `https://imagine.prototypes.aks.azure.sabbour.me/.auth/login/github/callback` |
| Production | `https://imagine.aks.azure.com/.auth/login/github/callback` |

> **Note:** For local development, create a separate OAuth App with `http://localhost:8080` as the callback. GitHub OAuth requires exact URL matches.

## Step 4: Store secrets

### In GitHub repo secrets (for CI/CD and SWA backend API)

Go to **repo → Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | The Client ID from Step 2 |
| `GITHUB_OAUTH_CLIENT_SECRET` | The Client Secret from Step 2 |

### In Azure Static Web Apps application settings (for runtime)

If using SWA's built-in auth or a backend API:

```bash
az staticwebapp appsettings set \
  --name <your-swa-name> \
  --setting-names \
    GITHUB_OAUTH_CLIENT_ID=<client-id> \
    GITHUB_OAUTH_CLIENT_SECRET=<client-secret>
```

## Step 5: Update app config

Edit `js/config.js` and replace `REPLACE_WITH_GITHUB_CLIENT_ID` with the actual Client ID.

```js
clientId: "your-actual-github-client-id",
```

## Required Scopes

The Imagine app requests these GitHub scopes during the OAuth flow:

| Scope | Why |
|---|---|
| `repo` | Full access to repositories — needed to create repos and push generated code |
| `user` | Read user profile info for the onboarding experience |
| `workflow` | Create and trigger GitHub Actions workflows in generated repos |

## OAuth Flow

1. User clicks "Connect GitHub" in the app
2. App redirects to `https://github.com/login/oauth/authorize?client_id=...&scope=repo+user+workflow&state=...`
3. User authorizes on GitHub
4. GitHub redirects back to the callback URL with a `code` parameter
5. Backend API (SWA function or proxy) exchanges the `code` for an access token using the client secret
6. Access token is stored in the user's session (never exposed to frontend)

> **Important:** The code-to-token exchange MUST happen server-side (in an Azure Function or SWA API) because it requires the client secret. The SPA never sees or handles the client secret.

## Security Notes

- **Client ID** is public — safe to commit to source code
- **Client Secret** is private — NEVER commit to source code, store in GitHub Secrets / SWA app settings only
- **Access tokens** are private — store server-side, pass to frontend only via secure httpOnly cookies or session
- Use the `state` parameter to prevent CSRF attacks
