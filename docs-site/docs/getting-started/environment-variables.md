---
sidebar_position: 2
---

# Environment Variables

Complete reference for the environment variables Kickstart reads at runtime. Variable names match the literals grep'd from `packages/harness/src/`, `packages/web/api/src/`, `packages/mcp-server/src/`, and `packages/pack-core/src/`.

---

## OpenAI / Azure OpenAI

| Variable | Where read | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | API + MCP bootstrap | OpenAI API key for non-Azure deployments. |
| `AZURE_OPENAI_API_KEY` | API + MCP bootstrap | Azure OpenAI API key. |
| `AZURE_OPENAI_ENDPOINT` | API + MCP bootstrap | Azure OpenAI endpoint. |
| `KICKSTART_USE_RESPONSES` | Runner | When truthy, route through the OpenAI Responses API (thread continuity via `session.responseId`). |
| `KICKSTART_CHAT_MODEL` | Runner | Default chat model fallback when an agent does not pin a model id. |
| `KICKSTART_CODEX_MODEL` | Codesmith chain | Model used for code-generation steps. |
| `KICKSTART_INSPIRE_MODEL` | Inspirations endpoint | Model used by `/api/inspirations`. |

---

## Auth & identity

| Variable | Purpose |
|---|---|
| `AZURE_TENANT_ID` | Azure AD tenant id used by ARM proxy and managed identity flows. |
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Service-principal credentials when not running with managed identity. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials (`/api/github/auth/*`). |
| `GITHUB_BASE_URL` | GitHub Enterprise base URL. Defaults to `https://github.com`. |
| `GITHUB_OAUTH_SCOPES` | Comma-separated OAuth scopes requested at sign-in. |
| `GITHUB_SESSION_SECRET` | HMAC secret for GitHub OAuth state cookies. |
| `DEPLOY_RUN_SECRET` | Shared secret gating the deploy-run callback endpoint. |

---

## Session storage

| Variable | Purpose |
|---|---|
| `KICKSTART_SESSION_STORE` | `memory` (default) or `azure-table`. Selects the `ISessionStore` implementation. |
| `KICKSTART_SESSION_TTL_SECONDS` | Session lifetime; drives `evictExpired` in the Azure Table backend. |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for `AzureTableSessionStore`. |
| `AZURE_STORAGE_ACCOUNT` / `AZURE_STORAGE_KEY` | Account-key alternative to the connection string. |
| `HARNESS_ALLOW_ANON_HYDRATION` | When truthy, anon sessions can be cold-rehydrated from the persistent store. Default: off. |

Anon-session TTL itself is hard-coded in `runtime/session.ts` as `ANON_SESSION_TTL_MS = 10 * 60 * 1000` (10 minutes); cold-rehydration bounds are `HYDRATION_DEFAULT_CAP = 20` turns and `HYDRATION_CONTENT_MAX_BYTES = 4096` per turn.

---

## Runtime gates & limits

| Variable | Purpose |
|---|---|
| `KICKSTART_PACKS` | Comma-separated active pack list. Empty enables all four (`core,azure,aks,github`). |
| `KICKSTART_PLAYGROUND` | Enables playground stubs (playground env-gate). Refused in production. |
| `KICKSTART_DEBUG_ALLOWED` | Enables the API debug routes. Dev / preview only. |
| `KICKSTART_RUNNER_MAX_TURNS` | Hard cap on turns per `Runner.run`. |
| `KICKSTART_MAX_LIVE_SURFACES` | Cap on concurrent A2UI surfaces per session. |
| `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN` | Per-turn skill-pull byte cap enforced by `core.read_skill`. |
| `KICKSTART_GUARDRAILS_DISABLED` | Dev-only kill-switch for the guardrail engine. Refused if `NODE_ENV=production`. |

---

## Telemetry & observability

| Variable | Purpose |
|---|---|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Server-side App Insights connection string. |
| `BROWSER_APPLICATIONINSIGHTS_CONNECTION_STRING` | Browser-side App Insights connection string surfaced to the SPA bootstrap. |
| `WEB_TELEMETRY_BROWSER_ENABLED` | Opt-in to browser SDK ingestion. |
| `KICKSTART_OTEL_RECORD_CONTENT` | Bypass OTel content redaction. **Dev only.** Production logs a security warning at boot and still redacts. |
| `STARTUP_TRACE_ID` | Trace id stamped on startup logs. Set by the Functions host. |

See [Observability](../operations/observability.md) for the OTel bridge wiring and span layout.

---

## Bicep tooling

| Variable | Purpose |
|---|---|
| `BICEP_CLI_PATH` | Path to a pre-installed Bicep binary. Falls back to download. |
| `BICEP_CLI_VERSION` | Pin a Bicep CLI version. |

---

## Deployment metadata

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Standard Node lifecycle marker. `production` flips several safety rails on. |

---

## Defaults at a glance

| Constant | File | Value |
|---|---|---|
| `ANON_SESSION_TTL_MS` | `runtime/session.ts` | 10 min |
| `HYDRATION_DEFAULT_CAP` | `runtime/session.ts` | 20 turns |
| `HYDRATION_CONTENT_MAX_BYTES` | `runtime/session.ts` | 4096 bytes |
| `INTERRUPT_TTL_MS` | `mcp-server/adapter/interrupt-store.ts` | 15 min |
| `MAX_DATA_BYTES` | `runtime/session-store-azure-table.ts` | 64 KB |
| `AS_TOOL_MAX_TURNS_DEFAULT` | `runtime/as-tool.ts` | 5 turns |

---

## Where these are read

Search for any variable name in the source to find the call site. Most live under `packages/harness/src/` or `packages/web/api/src/`. The MCP server reads the same set so a single env file works for both transports.
