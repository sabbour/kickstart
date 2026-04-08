# Decision: Adaptive UI Ecosystem — Definitive Capability Map

**Date:** 2025-07-20
**Author:** Leela (Lead)
**Requested by:** Ahmed Sabbour
**Status:** FINDING — Capability audit for Kickstart parity planning

---

## Executive Summary

Full source code audit of 4 repositories: `adaptive-ui-azure-pack`, `adaptive-ui-github-pack`, `adaptive-ui-framework`, and `adaptive-ui` (parent). Every exported component, tool, OAuth flow, API proxy route, and framework feature is documented below with implementation details.

**Totals:**
- **10 pack components** (4 Azure + 6 GitHub)
- **25 built-in framework components**
- **3 LLM-callable tools** (2 Azure + 1 GitHub)
- **1 built-in tool** (fetch_webpage)
- **10 API proxy routes** (LLM, ARM, auth, GitHub OAuth, pricing, Bicep, Google Maps/Flights)
- **2 OAuth flows** (MSAL popup + GitHub Device Code)
- **1 artifact/file system** with PR creation
- **1 LLM adapter** (Chat Completions + Responses API, model routing, tool loop)

---

## A. Azure Pack (`@sabbour/adaptive-ui-azure-pack` v0.4.0)

### A.1 Components

#### `azureLogin` — MSAL Popup Sign-In
- **Auth:** `@azure/msal-browser` PublicClientApplication
- **Client ID:** `6c303fad-f9a9-42a1-b92f-3b615179086c` (Azure CLI well-known)
- **Authority:** `https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47` (Microsoft tenant)
- **Scopes:** `https://management.azure.com/user_impersonation`, `https://graph.microsoft.com/User.Read`
- **Token exchange:** Proxied through `/api/auth-proxy` to bypass CORS
- **State writes:** `__azureToken`, `__azureSubscriptions`, `__azureSelectedSubscription`
- **UX:** Popup login → fetches subscriptions → auto-selects if single → shows picker if multiple → "Continue" button for Adaptive mode

#### `azureResourceForm` — Dynamic ARM Schema Form
- **Props:** `resourceType` (e.g. `"Microsoft.ContainerService/managedClusters"`), `bind`
- **Implementation:** Fetches schema via `fetchResourceTypeSchema()` → queries `/providers/{namespace}?api-version=2021-04-01`
- **Renders:** text/number/boolean/enum fields dynamically from ARM provider metadata
- **State writes:** `{bind}_{propertyName}` for each field
- **Cache:** 5-minute TTL schema cache

#### `azurePicker` — Searchable ARM Dropdown
- **Props:** `api`, `bind`, `label`, `labelKey`, `valueKey`, `filterKey`, `filterValue`, `labelBind`, `itemsPath`, `loadingLabel`
- **Implementation:** Calls ARM REST API, auto-resolves API versions from provider metadata cache
- **Guards:** Detects unresolved `{{state.key}}` interpolation → shows "Waiting for selection..." instead of calling API
- **Uses:** `SearchableDropdown` from core framework
- **Side effect:** Syncs `_activeSubscriptionId` module-level var when subscription picked

#### `azureQuery` / `azQuery` (alias) — ARM API Caller
- **Props:** `api`, `bind`, `method` (GET/PUT/POST/DELETE/PATCH), `body`, `confirm` (shows confirmation dialog), `loadingLabel`, `showResult`
- **Auto-execute:** GET on mount; writes require confirmation dialog
- **Interpolation:** `interpolate()` resolves `{{state.key}}` in `api` path and `body`
- **Graph support:** Auto-acquires Graph token for `https://graph.microsoft.com` URLs
- **Output:** Generates Azure Portal links from ARM paths; tabular display for arrays, JSON for objects
- **Fallback:** Shows inline subscription picker if `_activeSubscriptionId` missing

### A.2 Tools (LLM-callable)

| Tool | Type | Auth | Description |
|------|------|------|-------------|
| `azure_arm_get` | GET only | Bearer token (user) or DefaultAzureCredential (workload identity) | ARM REST API. `{sub-id}` placeholder auto-injected. Response truncated at 8000 chars |
| `azure_pricing` | GET only | None (public API) | Azure Retail Prices API via `/api/pricing-proxy`. Filters: `armSkuName`, `serviceName`, `armRegionName`, `currencyCode`. Returns ≤10 records |

### A.3 Skills Resolver
- **File:** `skills-resolver.ts`
- **Mechanism:** Keyword-triggered ARM PUT body templates
- **Covered services:** AKS, App Service, Container Apps, ACR, Cosmos DB, SQL, Storage, Key Vault, Role Assignments
- **AKS Automatic:** Deep domain knowledge (cluster creation, Gateway API, Workload Identity, Deployment Safeguards, ACR integration)
- **Format:** Static templates, no external fetch

### A.4 Intent Resolvers (defined in system prompt)
| Resolver | Component | Pre-configured API |
|----------|-----------|-------------------|
| `azure-regions` | `azurePicker` | ARM regions endpoint |
| `azure-resource-groups` | `azurePicker` | ARM resource groups |
| `azure-skus` | `azurePicker` | ARM SKUs |
| `azure-subscriptions` | `azurePicker` | ARM subscriptions |

### A.5 Icon System
- **`icon-resolver.ts`**: Maps ARM resource types + keywords → SVG icon URLs (21 Azure service icons)
- **`diagram-icons.ts`**: Registers 27 Azure + 15 Kubernetes resource icons for Mermaid diagrams via `registerDiagramIcons()`. Syntax: `%%icon:azure/service-name%%`

### A.6 Settings UI
- `AzureSettings.tsx`: Sign-in/sign-out button injected into settings panel
- Shows account name + username when signed in

---

## B. GitHub Pack (`@sabbour/adaptive-ui-github-pack` v0.4.0)

### B.1 Components

#### `githubLogin` — OAuth Device Flow Sign-In
- **Client ID:** `Ov23liG3k61qLZnRjBGu` (default, configurable in settings)
- **Scopes:** `repo workflow read:user read:org`
- **Flow:** POST `/api/github-oauth/device/code` → display user code + verification URI → poll `/api/github-oauth/access_token` every 5s (max 60 attempts = 5 min)
- **Storage:** Token in `localStorage['adaptive-ui-github-token']`
- **State writes:** `__githubToken`, `__githubUser`
- **Auto-validate:** On mount, checks existing token validity; auto-continues after sign-in
- **CORS:** Dev uses Vite proxy, prod uses `/api/` SWA Functions or user-configured CORS proxy

#### `githubQuery` — GitHub API Caller
- **Props:** `api`, `bind`, `method`, `body`, `confirm` (string = button label), `loadingLabel`, `showResult`
- **Smart fix:** Auto-rewrites `/orgs/<user>/repos` → `/user/repos` for personal accounts (checks `__githubOrgIsPersonal`)
- **Auto-continues** after successful writes

#### `githubRepoInfo` — Rich Repository Card
- **Props:** `repo` (owner/repo string, supports interpolation)
- **Displays:** Name, description, language, stars, forks, issues with avatar

#### `githubPicker` — Searchable Dropdown from GitHub API
- **Props:** `api`, `bind`, `label`, `labelKey`, `valueKey`, `descriptionKey`, `labelBind`, `loadingLabel`, `includePersonal`
- **Auto-paginate:** Up to 300 items (per_page=100)
- **Persistence:** Org/repo selections saved to localStorage across sessions
- **State writes:** `__githubOrgIsPersonal` flag
- **Auto-continues** after selection

#### `githubCreatePR` — Create PR with All Generated Artifacts
- **Props:** `title`, `baseBranch`, `owner`, `repo`, `commitToSameBranch`
- **Implementation:** Calls `createPullRequest()` from core framework's `FilesPanel`
- **Artifact source:** `useSyncExternalStore(subscribeArtifacts, getArtifacts)`
- **Filters:** Excludes `.mmd` files (Mermaid diagrams)
- **Branch naming:** `adaptive-ui/{timestamp}`
- **Features:** Auto-detects default branch, supports updating existing PRs (tracks `__githubPRBranch`, `__githubPRUrl`, `__githubPROwner`, `__githubPRRepo`), initializes empty repos, checkbox for direct-to-base-branch commit

#### `githubSetSecret` — Set GitHub Actions Repository Secrets
- **Props:** `secretName`, `secretValue`, `owner`, `repo`, `confirm`, `bind`
- **Encryption:** `tweetnacl-sealedbox-js` for libsodium sealed box encryption
- **Flow:** GET public key → encrypt with sealed box → PUT encrypted secret
- **Dependencies:** `tweetnacl`, `tweetnacl-sealedbox-js`, `tweetnacl-util`

### B.2 Tools (LLM-callable)

| Tool | Type | Auth | Description |
|------|------|------|-------------|
| `github_api_get` | GET only | Bearer token (user PAT or OAuth) | GitHub REST API with auto-pagination (up to 200 items). Slims repos→essential fields, orgs→login+desc, issues→number+title+state. Truncated at 30000 chars |

### B.3 Intent Resolvers (defined in system prompt)
| Resolver | Component | Pre-configured API |
|----------|-----------|-------------------|
| `github-orgs` | `githubPicker` | `/user/orgs` |
| `github-repos` | `githubPicker` | `/orgs/{org}/repos` |

### B.4 Auth System (`auth.ts`)
- **Two methods:** OAuth Device Flow or PAT (Personal Access Token)
- **Token inspection:** `inspectStoredToken()` → returns scopes, `hasWorkflowScope`, `tokenPreview`
- **Persistence:** Org/repo selections stored in localStorage across sessions
- **CORS handling:** Dev = Vite proxy, prod = `/api/` SWA Functions or user CORS proxy

### B.5 Settings UI (`GitHubSettings.tsx`)
- OAuth App Client ID input (pre-filled with default)
- Device code display with user code + verification URI
- Connected state: shows user, token inspection (scopes, workflow scope check)
- Disconnect button

---

## C. Core Framework (`@sabbour/adaptive-ui-core`)

### C.1 Built-in Components (25 total)

| # | Component | Category | Description |
|---|-----------|----------|-------------|
| 1 | `text` | Text | Semantic text with variants (h1-h4, body, caption, code) |
| 2 | `button` | Action | Interactive button; primary/secondary/danger/ghost variants |
| 3 | `input` | Input | Text or textarea field with form binding |
| 4 | `select` | Input | Searchable dropdown with filtered options |
| 5 | `combobox` | Input | Dropdown allowing custom values |
| 6 | `questionnaire` | Guided | Stepped question card with radio + freeform text |
| 7 | `image` | Content | Sanitized image with error fallback |
| 8 | `container` | Layout | Flex column wrapper |
| 9 | `columns` | Layout | Grid multi-column layout with custom widths |
| 10 | `card` | Layout | Padded container with optional click handler |
| 11 | `list` | Data | Array items rendered via `itemTemplate` |
| 12 | `table` | Data | Data rows with configurable/inferred columns |
| 13 | `form` | Input | Form wrapper with submit handler |
| 14 | `tabs` | Layout | Tab navigation with panels |
| 15 | `progress` | Feedback | Horizontal progress bar with percentage |
| 16 | `alert` | Feedback | Colored alert box (info/success/warning/error) |
| 17 | `chatInput` | User Input | Text input with send button + prompt history |
| 18 | `markdown` | Content | Simple markdown rendering |
| 19 | `radioGroup` | Input | Radio button group with descriptions |
| 20 | `multiSelect` | Input | Checkbox group; comma-separated values |
| 21 | `toggle` | Toggle | On/off switch; stores 'true'/'false' string |
| 22 | `slider` | Input | Range slider with live value display |
| 23 | `divider` | Layout | Horizontal line with optional label |
| 24 | `badge` | Feedback | Inline colored pill (blue/green/red/yellow/gray/purple) |
| 25 | `accordion` | Layout | Collapsible sections |
| 26 | `codeBlock` | Content | Syntax-highlighted code with Copy + Save buttons |
| 27 | `link` | Action | Anchor tag with optional external icon |

### C.2 Component Registry (`registry.ts`)
- **Interface:** `ComponentPack { name, displayName, components, systemPrompt, initialize?, resolveSkills?, settingsComponent?, tools? }`
- **API:** `registerPack()`, `resolvePackSkills()`, pack prompt management
- Dynamic pack loading — packs self-register their components + system prompts + tools

### C.3 Artifact / File System (`artifacts.ts`)
- **In-memory + localStorage** virtual filesystem
- **Operations:** `save`, `upsert`, `remove`, `clear`, `download` (individual or all)
- **Session-scoped** persistence (localStorage key: `adaptive-ui-artifacts`)
- **Language → extension** mapping for auto-naming
- **External store pattern:** `subscribeArtifacts`, `getArtifacts` → React `useSyncExternalStore` compatible

### C.4 PR Creation (`FilesPanel.tsx`)
- **`createPullRequest()`**: Creates branch `adaptive-ui/{timestamp}` from base → commits each artifact file → opens PR
- **`updatePullRequestBranch()`**: Updates files on an existing PR branch
- **Retry logic:** Up to 3 attempts per file commit (handles GitHub eventual consistency 404/409/422)
- **Empty repo handling:** Auto-initializes with README if repo has no commits
- **Direct commit mode:** `commitToSameBranch` option bypasses PR branch creation
- **Standalone FilesPanel:** Also has a built-in "⬢ PR" button that reads GitHub token/org/repo from localStorage

### C.5 File Viewer (`FileViewer.tsx`)
- **Two editor modes:** `prism` (default lightweight Prism.js) and `monaco` (VS Code-like, lazy-loaded)
- **Mermaid diagrams:** `.mmd` files rendered via registered diagram renderer
- **Edit features:** In-editor editing with Save/Cancel, Ctrl+S shortcut, Tab→2 spaces
- **Syntax languages:** bicep, json, yaml, bash, dockerfile, hcl/terraform, typescript, javascript, python, css, sql, markdown, html, xml
- **Actions:** Copy, Download, Edit

### C.6 Tool System (`tools.ts`)
- **`registerTool(name, description, parameters, handler)`**: Makes function callable by LLM
- **Built-in tool:** `fetch_webpage` with SSRF protection (domain allowlist)
- **Tool call loop:** LLM requests tool → adapter executes → sends result back → up to 5 rounds
- **Pack tools:** Each pack registers its own tools at initialization time

### C.7 Schema (`schema.ts`)
- **`AdaptiveUISpec`:** `{ version, title, layout, state, agentMessage, theme, diagram }`
- **`ConversationTurn`:** `{ id, userMessage, userData, agentSpec, timestamp }`
- **24+ node types** defined with full TypeScript interfaces
- **Actions:** `setState`, `navigate`, `submit`, `dismiss`, `continue`
- **Validation** for spec structure

### C.8 LLM Adapter (`llm-adapter.ts`)
- **APIs supported:** Chat Completions (`/v1/chat/completions`) and Responses API (`/responses`)
- **Model routing:** Task-based router with `code`, `planning`, `default` slots; classifies via LLM call
- **Default model:** `gpt-4o` fallback; configurable per-app
- **System prompt assembly:** Base ADAPTIVE_UI_SYSTEM_PROMPT + COMPACT_PROMPT + pack prompts + optional suffix
- **Skill injection:** New skills from `resolvePackSkills()` added as one-time user context message
- **Tool loop:** Max 5 rounds; retries with `response_format: { type: 'json_object' }` if non-JSON after tools
- **JSON repair:** 7-stage repair pipeline (strip fences, extract balanced JSON, escape newlines, close truncated brackets, etc.)
- **Context compaction:** Triggers when >100k prompt tokens; keeps last 6 messages, summarizes older
- **Retry logic:** Exponential backoff for 429, 502-504 errors; max 3 attempts
- **No streaming:** All requests are request/response (no SSE streaming)

### C.9 Conversation Orchestrator (`AdaptiveApp.tsx`)
- **Turn-based conversation:** Manages `ConversationTurn[]` with agent specs and user responses
- **State management:** React context with dispatch; per-spec theme cascading via CSS variables
- **History persistence:** Optional localStorage persistence via `persistKey`
- **Rewind & reissue:** Pop last turn, optionally switch models mid-conversation
- **Settings panel:** LLM mode toggle (hosted proxy vs BYO API key), model selection, pack-specific settings injection
- **Token tracking:** Per-request and cumulative; `lastRequestUsage` exposed for cost tracking
- **Activity indicator:** Shows live HTTP request log (method + URL)

### C.10 Compact JSON Notation (`compact.ts`)
- Shorthand JSON format for LLM output compression
- Reduces token count by ~30-50% for component specs

### C.11 Session Management (`SessionsSidebar.tsx`)
- Multi-session sidebar with session list
- Session persistence, rename, delete
- ~32KB of UI code

---

## D. API Proxy (`api/src/functions/proxy.ts`)

Single Azure Functions catch-all handler (`httpTrigger`, route `{*path}`).

| # | Route | Purpose | Auth |
|---|-------|---------|------|
| 1 | `/api/llm-proxy` | LLM proxy. Injects API keys from env (`LLM_PROXY_API_KEY`, `LLM_PROXY_MODELS_CONFIG`). Supports Azure OpenAI, Azure AI Foundry, Chat Completions + Responses API. Exponential backoff retry. | Server-side API key |
| 2 | `/api/llm-proxy/models` | Returns available model list from proxy config | None |
| 3 | `/api/arm-proxy` | ARM API proxy. Forwards user Bearer token or falls back to `DefaultAzureCredential` (workload identity/managed identity) | User token or managed identity |
| 4 | `/api/auth-proxy` | Rewrites to `login.microsoftonline.com` — CORS bypass for MSAL token exchange | Passthrough |
| 5 | `/api/github-oauth/device/code` | Proxies to `github.com/login/device/code` | None (public) |
| 6 | `/api/github-oauth/access_token` | Proxies to `github.com/login/oauth/access_token` | None (public) |
| 7 | `/api/pricing-proxy` | Proxies to `prices.azure.com` | None (public) |
| 8 | `/api/bicep-compile` | Compiles Bicep → ARM JSON using `az bicep build` | None |
| 9 | `/api/gmaps-key` | Returns Google Maps API key from env | None |
| 10 | `/api/gflights-proxy` | Proxies to `google.com` for flights data | None |

**SSRF Protection:** `ALLOWED_TARGETS` allowlist for external fetch.
**Dependencies:** `@azure/functions` v4, `@azure/identity`.

---

## E. Parent Repo (`adaptive-ui`)

- **Workspace:** Git submodules for framework + 5 packs + 3 demo apps
- **Demo apps:** `adaptive-ui-solution-architect`, `adaptive-ui-trip-notebook`, `adaptive-ui-try-aks`
- **Tooling:** `workspacectl.mjs` — release/sync/doctor/contract commands
- **Deployment:** Azure Static Web App with linked Functions API
- **SWA landing page:** `swa/index.html`

---

## F. Gap Analysis — What Kickstart Needs to Build for Parity

### F.1 Must-Have (Core capabilities that make the system work)

| Capability | A2UI Has | Kickstart Equivalent Needed |
|------------|----------|---------------------------|
| **Component registry with dynamic pack loading** | `registerPack()`, `ComponentPack` interface | Pack system that loads Azure/GitHub components at runtime |
| **LLM adapter with tool loop** | Chat Completions + Responses API, 5-round tool loop, JSON repair | LLM integration with tool calling support |
| **Artifact/file system** | In-memory + localStorage virtual FS, save/upsert/remove/clear/download | File management for generated code |
| **PR creation from artifacts** | `createPullRequest()`, `updatePullRequestBranch()` with retry logic | GitHub integration to push generated files |
| **Azure MSAL auth** | Popup login, multi-subscription picker, ARM + Graph tokens | Azure sign-in for ARM operations |
| **GitHub OAuth** | Device code flow, PAT support, token inspection | GitHub auth for repo operations |
| **ARM API calling** | `azureQuery` with interpolation, auto-execute GET, confirmation for writes | Azure resource management |
| **GitHub API calling** | `githubQuery` with personal account auto-fix | GitHub resource management |
| **Searchable dropdowns** | `azurePicker` / `githubPicker` with auto-pagination, API version resolution | Dynamic data-driven selectors |
| **System prompt + pack prompt injection** | Base prompt + pack prompts + skill injection | LLM context management |

### F.2 Should-Have (Significant UX/DX features)

| Capability | A2UI Has | Notes |
|------------|----------|-------|
| **25 built-in components** | text, button, input, select, combobox, questionnaire, image, container, columns, card, list, table, form, tabs, progress, alert, chatInput, markdown, radioGroup, multiSelect, toggle, slider, divider, badge, accordion, codeBlock, link | Kickstart needs most of these |
| **Skills resolver** | Keyword-triggered ARM body templates for 9 Azure services | Domain knowledge injection |
| **ARM schema introspection** | `fetchResourceTypeSchema()` for dynamic forms | Makes `azureResourceForm` work |
| **Mermaid diagram support** | Icon registration, diagram renderer, `.mmd` artifacts | Architecture visualization |
| **Monaco editor** | Lazy-loaded VS Code-like editing in browser | Code editing UX |
| **Context compaction** | Auto-summarize when >100k tokens, keep last 6 messages | Long conversation support |
| **Model routing** | Task-based (code/planning/default) with LLM classification | Cost optimization |
| **GitHub secret setting** | `githubSetSecret` with sealed box encryption | CI/CD setup |
| **Session persistence** | Multi-session sidebar, localStorage, rename/delete | Conversation management |

### F.3 Nice-to-Have (Polish features)

| Capability | Notes |
|------------|-------|
| **Compact JSON notation** | Reduces LLM output tokens ~30-50% |
| **Rewind & model switching** | Pop last turn, switch models mid-conversation |
| **Token usage tracking** | Per-request + cumulative |
| **Activity indicator** | Live HTTP request log |
| **Prompt history** | ArrowUp/Down navigation in chat input |
| **Icon system** | 21 Azure + 15 K8s icons for diagrams |
| **Bicep compilation** | Server-side Bicep→ARM JSON via `az bicep build` |
| **Google Maps/Flights proxies** | Trip notebook demo features |

### F.4 Key Architectural Differences to Note

1. **A2UI uses nested JSON specs** (agent returns full UI layout as JSON); Kickstart currently uses `~~~a2ui` fenced blocks in markdown
2. **A2UI has no streaming** — full request/response; Kickstart has SSE streaming but the A2UI extraction breaks
3. **A2UI packs are npm packages** that self-register; Kickstart components are built-in
4. **A2UI state is global key-value** (`{{state.key}}` interpolation); Kickstart has similar but with phase-based state
5. **A2UI artifacts are browser-side only** (localStorage); no server-side file storage

---

## G. OAuth Flow Details (for Security Review)

### Azure MSAL Flow
1. User clicks "Sign in with Azure"
2. `msalInstance.loginPopup({ scopes })` — opens popup to `login.microsoftonline.com`
3. Popup redirects back with auth code
4. MSAL exchanges code for token (via `/api/auth-proxy` CORS bypass)
5. Token stored in MSAL cache (sessionStorage)
6. `acquireTokenSilent()` refreshes silently; falls back to `acquireTokenPopup()`
7. ARM token scope: `https://management.azure.com/user_impersonation`
8. Graph token scope: `https://graph.microsoft.com/User.Read`

### GitHub Device Code Flow
1. App POSTs to `/api/github-oauth/device/code` with `client_id` + `scope`
2. Server proxies to `github.com/login/device/code`
3. Response: `device_code`, `user_code`, `verification_uri`, `interval`
4. App displays user code + link to `https://github.com/login/device`
5. App polls `/api/github-oauth/access_token` every 5s with `device_code` + `client_id` + `grant_type=urn:ietf:params:oauth:grant-type:device_code`
6. On success: token stored in `localStorage['adaptive-ui-github-token']`
7. Token validated via `GET /user` API call

### GitHub PAT Flow (Alternative)
1. User pastes PAT in settings
2. App validates via `GET /user` with Bearer token
3. Token stored in same localStorage key

---

## H. Recommendations for Kickstart

1. **Start with the core loop:** Component registry → LLM adapter → artifact system → PR creation. This is the minimum viable path.
2. **Port the pack system:** The `ComponentPack` interface is clean and extensible. Adopting it means Azure/GitHub packs can be developed independently.
3. **Reuse auth code:** The MSAL and GitHub Device Code implementations are self-contained and can be extracted with minimal changes.
4. **Decide on spec format:** Either adopt A2UI's nested JSON spec approach (which works well for declarative UIs) or fix the `~~~a2ui` extraction regex (see prior audit `leela-a2ui-audit.md`).
5. **Prioritize the 10 pack components over the 25 built-ins:** The pack components (Azure/GitHub login, picker, query, PR creation) are what make the product unique. The 25 built-ins are commodity UI primitives.
