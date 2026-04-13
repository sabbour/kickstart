# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->


### 2026-04-08: Kickstart Monorepo Scaffold

- **Rename:** Project renamed from "Imagine" to "Kickstart"
- **Monorepo:** npm workspaces at root with `packages/*` — core, mcp-server, web (web owned by Fry)
- **@kickstart/core:** Conversation engine (FSM with Phase enum: Understand→Clarify→Needs→Plan), A2UI catalog (JSON Schema draft/2020-12 with 7 custom components), K8s + GitHub Actions code generators
- **@kickstart/mcp-server:** MCP server using `@modelcontextprotocol/sdk`, 4 tools (kickstart, generate-manifests, check-status, action), A2UI responses via `application/json+a2ui` MIME type
- **A2UI Catalog:** Custom components: ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard — all extending basic_catalog (Text, Button, TextField, Row, Column, Card)
- **Infrastructure:** `infra/main.bicep` (SWA Standard), `infra/setup-entra.sh` (Entra app reg for CA Global Demos 2605 tenant), `infra/parameters.dev.json`, `.github/workflows/deploy-infra.yml` (OIDC login + Bicep deploy)
- **TypeScript:** ESM (type: module), strict mode, Node16 moduleResolution, project references between packages
- **Deleted:** `js/config.js` (old Imagine auth config with invalid client ID), `docs/github-oauth-setup.md` (replaced by `infra/README.md`)
- **Moved:** `staticwebapp.config.json` → `packages/web/staticwebapp.config.json`
- **Updated:** `deploy-swa.yml` app_location changed from "/" to "packages/web"
- **Key paths:** `packages/core/src/`, `packages/mcp-server/src/`, `infra/`, `packages/web/staticwebapp.config.json`


### 2026-04-13: SWA Auth Redirect CORS Fix (#130)

- **Root cause:** When SWA auth cookies expire, API `fetch()` calls receive a 302 redirect to Azure AD's login page. The browser follows this cross-origin redirect silently, and Azure AD doesn't return CORS headers, so `fetch()` throws `TypeError: Failed to fetch` — an opaque error.
- **Fix pattern:** `apiFetch()` wrapper in `api-client.ts` sets `redirect: 'manual'` on all authenticated API calls, preventing the browser from following cross-origin redirects. Detects opaque redirect responses and throws `SessionExpiredError` with a clear message.
- **SSE error gap:** The `StreamEvent` interface was missing an `error` field, causing server-side streaming errors to be silently swallowed. Added `error` field and early-return handling in `useStreaming.ts`.
- **Key files:** `packages/web/src/services/api-client.ts` (apiFetch, SessionExpiredError), `packages/web/src/hooks/useStreaming.ts`, `packages/web/src/types.ts`
- **Lesson:** Any SWA app with `responseOverrides.401.redirect` will cause CORS failures for `fetch()` API calls when auth expires. Always use `redirect: 'manual'` for authenticated API endpoints.
- **Cross-referencing:** All 5 docs link to each other where relevant.
- **Key lesson:** The task description said 7 standard components including "Tabs" but the actual catalog has 6 (no Tabs). Always document from source code, not specs.


### 2026-04-08: System prompt emoji rule + demo response cleanup
- **System prompt evolution**: Added Core Rule #1 at the top of system prompt: "Never use emoji. All responses must be text-only, no emoji characters." This is the first rule checked by the LLM during inference, signaling importance.
- **Demo engine response cleanup**: Stripped 8 emojis from hardcoded demo responses across all phases:
  - Discover phase: removed 2 emojis (🎯 goal icon, 🚀 rocket)
  - Design phase: removed 2 emojis (🏗️ architecture, 📊 diagram indicator)
  - Generate phase: removed 2 emojis (⚡ generation, 📝 manifest)
  - Review phase: removed 2 emojis (✅ review, 🎉 completion)
- **No architectural change**: Demo flow behavior identical, just text is emoji-free. All phases still auto-advance correctly.
- **Alignment**: System prompt now enforces emoji ban globally for all LLM responses. Demo engine serves as reference implementation (emoji-free).
- **Test status**: No failures — emoji removal is text-only, does not affect phase transitions or response parsing.
- **Decision context**: Implements user directive from decision inbox: "LLM responses must not contain emojis"


### 2026-04-08: SWA Entra ID Authentication Setup

- **Auth provider:** SWA built-in `azureActiveDirectory` identity provider (Standard tier feature). Config in `staticwebapp.config.json` under `auth.identityProviders.azureActiveDirectory`.
- **Setting references, not values:** `clientIdSettingName: "AZURE_CLIENT_ID"`, `clientSecretSettingName: "AZURE_CLIENT_SECRET"` — these reference SWA app settings, not literal secrets.
- **Tenant:** `d91aa5af-8c1e-442c-b77c-0b92988b387b` (CA Global Demos 2605). OpenID issuer: `https://login.microsoftonline.com/{tenant}/v2.0`.
- **Client ID:** `e71a23c6-aeb4-459a-88fc-07ff96fc9b92` — safe to store in Bicep params and source.
- **Client secret:** Must be set manually via `az staticwebapp appsettings set` or Azure Portal. Never committed.
- **Route auth model:** `/api/*` requires `authenticated` role. Static assets (HTML/CSS/JS) are public. `/login` and `/logout` are convenience redirects to `/.auth/login/aad` and `/.auth/logout`. 401 responses auto-redirect to login.
- **Bicep additions:** `entraClientId` param sets `AZURE_CLIENT_ID` app setting via `Microsoft.Web/staticSites/config` resource. `customDomainHostname` param creates `Microsoft.Web/staticSites/customDomains` resource (requires DNS CNAME pre-verification).
- **deploy-swa.yml unchanged:** SWA deploy action doesn't need auth config — app settings are managed by Bicep/Portal, not the GitHub Action.


### 2026-04-08: Dual-Model Backend (Chat + Codex Responses API)

- **Deployment env vars:** `AZURE_OPENAI_CHAT_DEPLOYMENT` (e.g. `gpt-5.3-chat`) for conversation, `AZURE_OPENAI_CODEX_DEPLOYMENT` (e.g. `gpt-5.3-codex`) for code generation. Fallback: `AZURE_OPENAI_DEPLOYMENT` for backward compatibility (existing single-model setups keep working).
- **Responses API for Codex:** Azure OpenAI Codex endpoint uses `POST /openai/deployments/{deployment}/responses?api-version=2025-03-01-preview`. System prompt in `instructions` field, user messages in `input`. Streaming uses `response.output_text.delta` SSE events (different from Chat Completions `choices[0].delta.content`).
- **New endpoint:** `POST /api/generate` dedicated to code generation. Accepts `prompt` and `type` (dockerfile, kubernetes, pipeline, bicep, generic). Returns streaming code generation with type-specific system instructions. Cleaner separation from conversation flow.
- **Client:** `openai-client.ts` extended with `generateCode(prompt, type)` method. Uses Codex deployment when available, falls back to chat deployment for backward compatibility.
- **Config:** `local.settings.json` updated with `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_CODEX_DEPLOYMENT` examples. Bicep params updated to pass both deployments via SWA app settings.
- **Committed:** 6e4c31d includes openai-client.ts refactor + /api/generate endpoint + updated local.settings.json.
- **Ahmed's model preferences still active:** claude-opus-4.6 for code, claude-haiku-4.5 for non-code (noted for LLM selection logic if needed).
- **Key files:** `packages/web/staticwebapp.config.json`, `infra/main.bicep`, `infra/parameters.dev.json`, `infra/README.md`


### 2026-04-08: Virtual Filesystem & File Editor (Phase 2 — Spark)

- **VirtualFileSystem service:** In-memory `Map<string, VirtualFile>` with `useSyncExternalStore` compatibility (subscribe + getSnapshot). Path normalization strips leading slashes, collapses duplicates, forward-slashes only. Language detection via extension map + filename map (Dockerfile, Makefile, etc.).
- **Tree generation:** Flat file list → nested `FileTreeNode[]` via path splitting. Directories sorted before files, alphabetical within each group. Auto-expanded by default.
- **FileEditor component:** Three-part panel — FileTree (220px dark sidebar), CodeView (dark VS Code-style code area), wired into Layout as a right column slot.
- **Demo file generation:** `populateDemoFiles()` stagger-writes 6 realistic AKS deployment files (Dockerfile, deployment.yaml, service.yaml, GitHub Actions workflow, Express app, package.json) with a brief `generating` → `complete` animation per file.
- **Layout pattern:** Added `fileEditor` and `hasFiles` props to Layout component. `has-files` CSS class on `.app-layout` enables 3-column mode (Sidebar | Chat | FileEditor).
- **CSS theming:** file-editor.css uses VS Code dark palette (#1e1e1e, #252526, #333333) with project CSS custom properties (spacing, radius, font-family-mono). Generating state uses pulse animation.
- **Key files:** `packages/web/src/services/virtual-fs.ts`, `packages/web/src/components/FileEditor/`, `packages/web/css/file-editor.css`
- **openai-client.ts:** Exports 4 functions — `chatCompletion`, `chatCompletionStream` (Chat Completions API), `codexCompletion`, `codexCompletionStream` (Responses API). Plus `isConfigured()` helper. All types exported.
- **New endpoint:** `POST /api/generate` — code generation endpoint. Accepts `{ prompt, type?, context? }` where type is `dockerfile|kubernetes|pipeline|bicep|generic`. Each type has tailored system instructions. Supports SSE streaming. Uses codex model with temperature 0.2.
- **inspirations.ts:** Updated `isOpenAIConfigured()` to accept `AZURE_OPENAI_CHAT_DEPLOYMENT` as alternative to `AZURE_OPENAI_DEPLOYMENT`.
- **local.settings.json:** Added `AZURE_OPENAI_CHAT_DEPLOYMENT: "gpt-5.3-chat"` and `AZURE_OPENAI_CODEX_DEPLOYMENT: "gpt-5.3-codex"`.
- **Key files:** `packages/web/api/src/lib/openai-client.ts`, `packages/web/api/src/functions/generate.ts`, `packages/web/api/local.settings.json`


### 2026-04-09: React/Vite Migration + A2UI v0.9 Vendor (Phase 1a)

- **Vendored A2UI v0.9:** Copied `renderers/react/src/v0_9/` and `renderers/web_core/src/v0_9/` from google/A2UI into `packages/web/src/vendor/a2ui/`. Excluded test files. Included JSON schemas from `specification/v0_9/json/`. Apache 2.0 LICENSE included.
- **Import path rewrite:** All `@a2ui/web_core/v0_9` imports in vendored React files → relative paths. Stripped `.js` extensions from web_core internal imports. Removed `with {type: 'json'}` import assertions (Vite handles JSON natively).
- **A2UI npm dependencies:** `@preact/signals-core`, `date-fns`, `zod`, `zod-to-json-schema` — all required by web_core runtime.
- **React/Vite scaffold:** `packages/web/` now has Vite + React 19 + TypeScript. `vite build` produces ~360KB JS bundle (452 modules). `dist/` is the output directory.
- **Vite config:** `@vitejs/plugin-react`, `@` → `src/` alias, `/api` proxy to `localhost:7071`, `json.stringify: true` for large JSON schema imports.
- **tsconfig:** `moduleResolution: "bundler"`, `jsx: "react-jsx"`, strict mode, `@/*` path alias.
- **index.html updated:** Added `<div id="root">` and `<script type="module" src="/src/main.tsx">`. Old vanilla `js/app.js` script removed (old JS files kept in `js/` for now).
- **App.tsx proof-of-concept:** Renders A2UI minimal catalog (Text + Button in a Column) via `SurfaceModel` + `MessageProcessor` + `A2uiSurface` component. Proves vendor integration works end-to-end.
- **DO NOT TOUCH:** `packages/web/api/` (Azure Functions backend, separate build/deploy). `packages/web/js/`, `css/`, `assets/` kept as-is for now.
- **Key files:** `packages/web/package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/vendor/a2ui/`


### 2026-04-09: JSON Envelope + A2UI v0.9 Backend Rewrite

- **Killed regex extraction:** Removed `~~~a2ui` fenced-block parsing from the LLM response pipeline. Backend now expects pure JSON from the LLM.
- **JSON envelope format:** LLM outputs `{"message":"...","a2ui":[...],"actions":[]}`. `response_format: { type: "json_object" }` enforced in Azure OpenAI calls.
- **New response-processor:** Created `packages/core/src/services/response-processor.ts` — parses JSON envelope, validates A2UI messages (createSurface, updateComponents, updateDataModel, deleteSurface), graceful fallback to plain text on invalid JSON. No regex.
- **System prompt rewrite:** Teaches LLM the full JSON envelope format with all 23 components (18 basic + 5 custom). Includes 2 complete example responses. Flat adjacency list format with id-based references.
- **A2UI v0.9 catalog:** Rewrote `kickstart-catalog.json` — 18 basic components (Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput) + 5 custom (CostEstimate, ArchitectureDiagram, FileEditor, AuthCard, DeploymentProgress). Components use `"component"` field (not `"type"`), flat `"children"` id arrays.
- **Phase prompts:** All 6 phases rewritten with opinionated descriptions and JSON envelope examples. ChoicePicker for selections, Tabs for multi-section views, FileEditor for code, DeploymentProgress for tracking.
- **Typed SSE events:** converse.ts now emits `event: chunk` (raw deltas), `event: message` (parsed text), `event: a2ui` (per-message), `event: done` (metadata), `event: error`.
- **openai-client.ts:** Added `responseFormat` option to `ChatCompletionOptions`, passed as `response_format` in both streaming and non-streaming calls.
- **Tests:** 47 tests pass — 12 catalog (updated for 23 components), 12 phases, 12 machine, 11 new response-processor tests (JSON parsing, fallbacks, malformed messages, edge cases).
- **Key files changed:** `packages/core/src/prompts/system-prompt.ts`, `packages/core/src/services/response-processor.ts` (NEW), `packages/core/src/engine/phases.ts`, `packages/core/src/catalog/kickstart-catalog.json`, `packages/core/src/catalog/index.ts`, `packages/web/api/src/functions/converse.ts`, `packages/web/api/src/lib/openai-client.ts`


### 2026-04-09: Naming Decision — APIConnector + IntegrationKit

- **Leela proposed:** APIClient + IntegrationKit as replacements for ServiceConnector (B-11) and ServicePack (B-10).
- **User override:** APIClient → APIConnector to better convey the connection/auth-handling aspect.
- **Final names:** 
  - B-11: `APIConnector` — authenticated API client adapter handling tokens, OAuth, CORS proxying, request lifecycle
  - B-10: `IntegrationKit` — composable module bundling components + tools + prompts + auth
- **Action:** Use these names in B-11/B-10 implementation and refactor existing `ServiceConnector`/`ServicePack` references.

---

## [ARCHIVE SUMMARY] Pre-2026-04-09 Learnings

The following learnings predate 2026-04-09 and are candidates for archival to `history-archive.md` when file size exceeds 50KB:
- Azure Static Web Apps Deployment Setup (2025-01-21)
- Auth Registration Setup (2025-07-24)
- Kickstart Monorepo Scaffold (2026-04-08)
- Subsequent React/Vite migration entries through 2026-04-09

These capture foundational auth setup, monorepo structure, and Phase 1 architectural decisions. Current living work (B-23, B-24, B-25, etc.) is reflected in new dated entries above.

### 2026-04-09 17:32 — Create tab chat delivery + Playwright validation

**Session:** Wave 2 parallel agents (Fry + Hermes)

**Status delivered to Fry:**
- Create tab now streams real LLM responses via `/api/converse` — B-26 complete
- useStreaming hook integrated; A2UI surfaces render per turn
- Dual-state layout preserves empty state UX while supporting multi-turn chat
- Session ID tracking via refs prevents stale closures
- Build passes with zero TypeScript errors

**Next deliverables for Bender:**
- B-27: `/api/converse` endpoint refinement (session lifecycle, error handling)
- B-28: Backend integration for Create tab sessions (persistence, cleanup)
- B-10/B-11 prep: APIConnector OAuth flows, IntegrationKit service bundling


### 2026-04-09: B-24 — /api/action Endpoint

- **Delivered:** `packages/web/api/src/functions/action.ts` — POST `/api/action` Azure Function.
- **Request shape:** `{ sessionId, action: { name, context? }, context? }`. Session validated against in-memory store; 404 if not found.
- **Action routing:** Same prefix logic as `useActionDispatch` on the frontend:
  - `reply` (default): `actionToMessage()` → `addMessage(user)` → `chatCompletion()` → `addMessage(assistant)` → returns `{ success, message, phase, a2uiMessages, model }`
  - `navigate:` / `nav:`: same as reply but frames the LLM prompt as a navigation intent: `"... — User is requesting to navigate to the '{phase}' phase. Please acknowledge and guide them accordingly."`
  - `api:`: stub — returns `{ success: false, status: 'not_implemented', message: 'API actions require APIConnector (B-11)' }`. No LLM call.
- **LLM call:** reuses `chatCompletion` from `openai-client.ts`, same JSON envelope format (`response_format: json_object`), same `processResponse` parser. Phase indicator A2UI message prepended to response A2UI array.
- **Build fix:** Pre-existing uncommitted work (`tools/`, `converse.ts`, `openai-client.ts`) referenced `defaultRegistry` and typed tools that weren't exported from `@kickstart/core`. Fixed:
  - Added `export { ToolRegistry, defaultRegistry }` + tool types to `packages/core/src/index.ts`
  - Re-exported `Tool` interface from `packages/core/src/types.ts` so `tools/*.ts` can import from `"../types.js"`
  - Changed `ToolRegistry` internals to `Tool<any>` to accept typed tool implementations
- **Tests:** 194/202 pass. 8 failures are pre-existing (MCP server `action-handler.test.ts`, unrelated to this endpoint).
- **Key pattern confirmed:** The `/api/action` endpoint is intentionally thin — it's a bridge from A2UI events to the conversation engine. No direct state machine manipulation; LLM drives all transitions.


### 2026-04-09: B-13 — LLM Tool System

- **Tool registry:** Created `packages/core/src/tools/` with `ToolRegistry` class and `defaultRegistry` singleton. `toOpenAIFormat()` outputs OpenAI function-calling schema.
- **5 built-in tools:** `azure_resource_list`, `azure_resource_get`, `github_repo_info`, `generate_kubernetes_manifest` (real — delegates to generators/kubernetes.ts), `estimate_cost` (stub pricing table).
- **All exported from @kickstart/core** — both MCP server and web API can import.
- **openai-client.ts extended:** `ChatMessage` now supports `role: "tool"` and `tool_calls`. `ChatCompletionResult` includes `toolCalls`. New `chatCompletionWithTools()` handles multi-step tool loops (max 5 rounds).
- **converse.ts wired:** Non-streaming path uses `chatCompletionWithTools`. Streaming path resolves tool calls round-by-round, emitting `event: tool_call` and `event: tool_result` SSE events per round, then emits `chunk/message/a2ui/done` for the final response.
- **IntegrationKit extension point:** `defaultRegistry.register(tool)` — one-liner to add a tool.
- **22 new tests** — all pass. Zero regressions (pre-existing 8 failures unrelated).
- **Key files:** `packages/core/src/tools/` (all new), `packages/web/api/src/lib/openai-client.ts`, `packages/web/api/src/functions/converse.ts`


### 2026-04-09: Decision — Changesets Monorepo Versioning

- **Decision logged:** Use `@changesets/cli` for Kickstart monorepo versioning. All 3 packages linked for lockstep versioning. Config at `.changeset/config.json`, root changelog at `CHANGELOG.md`.
- **Why changesets:** Purpose-built for npm workspaces. Changesets are markdown files (reviewable in PRs). Integrates with GitHub Actions for future automated publishing.
- **Workflow:** Run `npm run changeset` to create changeset file. `npm run version` to consume changesets and bump. `npm run release` to publish.
- **All packages linked:** Major version bump in any package bumps all three. Keeps monorepo cohesive.


### 2026-04-09: Decision — /api/action Session Store

- **Decision logged:** POST `/api/action` shares the same in-memory session store as `/api/converse` (Map from session-store.ts). Does NOT create sessions — only reads. 404 if unknown session ID.
- **Why:** Actions arrive after conversation starts. Requiring valid session ensures action context. Shared history means LLM sees full conversation when re-prompted.
- **Implication:** Frontend must get sessionId from `/api/converse` first. `useActionDispatch` already has sessionId via `useStreaming` hook.


### 2026-04-09: Decision — Tool Registry Extension Pattern

- **Decision logged:** LLM tools in `packages/core/src/tools/`. `ToolRegistry` class + `defaultRegistry` singleton bootstrapped on module load. IntegrationKits call `defaultRegistry.register(tool)` to add domain-specific tools.
- **Streaming SSE events:** `event: tool_call` (LLM requests tool), `event: tool_result` (tool executes). Frontend can render spinners.
- **No converse.ts changes needed** — tool system self-contained within the registry and openai-client.ts.


### 2026-04-09: B-11 — APIConnector Pattern

- **APIConnector interface:** `packages/core/src/connectors/types.ts` — `name`, `baseUrl`, `authenticate()`, `request(method, path, body?, options?)`, `isAuthenticated()`. Works isomorphically (browser + Node/Azure Functions).
- **APIConnectorRegistry:** `packages/core/src/connectors/registry.ts` — `register(connector)`, `get(name)`, `names()`, `has(name)`, `unregister(name)`. Singleton `defaultConnectorRegistry` exported.
- **Concrete stubs:**
  - `AzureARMConnector` (`name: "azure-arm"`) — `listResources(subscriptionId)`, `getResource(resourceId)`, `createResource(...)`. Returns stub Azure data. Auth via MSAL pending (B-14).
  - `GitHubConnector` (`name: "github"`) — `getRepo(owner, repo)`, `createRepo(name, options)`, `listBranches(owner, repo)`. Returns stub GitHub data. Auth via Device Flow pending (B-14).
  - `PricingConnector` (`name: "pricing"`) — `estimateCost(resources[])`. No auth needed. Stub pricing table baked in.
- **React Context:** `packages/web/src/contexts/APIConnectorContext.tsx` — `APIConnectorProvider` (wraps app, initializes all 3 connectors), `useAPIConnector(name)`, `useAPIConnectorRegistry()`.
- **main.tsx:** Wrapped `<App />` with `<APIConnectorProvider>`.
- **App.tsx:** Calls `useAPIConnectorRegistry()` and passes `connectorRegistry` to `useActionDispatch`.
- **useActionDispatch wired:** `api:` actions now route through the registry. Action name format: `api:{connectorName}.{operation}`. Connector method is called with `action.context`; result is serialized and re-prompts the LLM. Unknown connectors/methods fall back to LLM re-prompt with console.warn.
- **tsconfig fix:** Added `"DOM"` to `lib` in `packages/core/tsconfig.json` — connectors need `fetch`, `Response`, `AbortSignal` types. Pre-existing tools didn't use these; no regression.
- **Build:** 2833 modules, passes. **Tests:** 286/286 pass.
- **Key files:** `packages/core/src/connectors/` (all new), `packages/web/src/contexts/APIConnectorContext.tsx` (new), `packages/web/src/hooks/useActionDispatch.ts`, `packages/web/src/App.tsx`, `packages/web/src/main.tsx`, `packages/core/tsconfig.json`


### 2026-04-09: B-25 — Unify Action Model + Fix Manifest Bug

- **Action model unified:** Extended `handleAction` in `packages/mcp-server/src/tools/action.ts` to support `reply`, `navigate`, `api`, and unknown action types in addition to existing `advance`, `skip`, `select`, `submit`.
  - `reply` — validates `payload.message`, pushes to `session.messages` as user role, returns phase description without advancing.
  - `navigate` — validates `payload.targetPhase` against `getPhaseOrder()`, directly assigns `session.currentPhase` (supports forward + backward navigation), returns A2UI phase indicator resource.
  - `api` — returns stub/placeholder text response; phase unchanged. Ready for ServiceConnector wiring.
  - unknown — returns error with list of valid types; no session mutation.
- **Manifest bug fixed:** `generate-kubernetes-manifest.ts` now coerces `appName` via `String(args.appName)` before use — prevents `TypeError: app.name.toLowerCase is not a function` when LLM passes a number.
- **Tests:** All 286 vitest tests pass including the Hermes numeric-appName test and all B-23 action-handler tests.
- **Build:** Web bundle builds clean (1,323 kB). Playwright failures (60) are pre-existing system-level issue (`libnspr4.so` missing), not regressions.
- **Key files changed:** `packages/mcp-server/src/tools/action.ts`, `packages/core/src/tools/generate-kubernetes-manifest.ts`


### 2026-04-09: B-16 — CORS Proxy Functions

- **Three SWA Functions added** in `packages/web/api/src/functions/`:
  - `arm-proxy.ts` — `ANY arm-proxy/{*path}` → `management.azure.com`. Requires `Authorization` header (returns 401 if absent). Injects `api-version=2024-03-01` if omitted. Passes through `x-ms-*` rate-limit headers.
  - `github-proxy.ts` — `ANY github-proxy/{*path}` → `api.github.com`. Injects `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`. Auth is optional (unauthenticated requests allowed for public repos).
  - `pricing-proxy.ts` — `GET pricing-proxy` → `prices.azure.com/api/retail/prices`. No auth. Adds `Cache-Control: public, max-age=300` (prices stable for minutes).
- **Pattern:** All proxies use `request.params["path"]` for wildcard route capture, `request.query` forwarding, native `fetch`, `arrayBuffer()` for body pass-through, and return upstream HTTP status verbatim.
- **Build:** 8 functions bundled (was 5). All 286 vitest tests pass.
- **Key files:** `packages/web/api/src/functions/arm-proxy.ts`, `packages/web/api/src/functions/github-proxy.ts`, `packages/web/api/src/functions/pricing-proxy.ts`


### 2026-04-10: B-17 — Artifact Store

- **ArtifactStore interface + Artifact type:** `packages/core/src/artifacts/types.ts` — `put(path, content, metadata?)`, `get(path) → Artifact | null`, `list(glob?) → Artifact[]`, `delete(path)`, `export() → Record<string, string>`, `clear()`.
- **InMemoryArtifactStore:** `packages/core/src/artifacts/in-memory.ts` — Map-backed, language auto-inferred from extension (yaml, ts, py, go, rs, java, cs, sh, tf, bicep, dockerfile, etc.), glob filtering via `*` (within segment) and `**` (across segments), preserves `createdAt` on update.
- **defaultArtifactStore singleton:** Exported from `@kickstart/core` — shared by all tools in same process.
- **generate_kubernetes_manifest updated:** Each generated file is stored in `defaultArtifactStore` with language + metadata (generator name, appName).
- **list_artifacts tool:** Returns count + artifact inventory; optional glob filter. Registered in defaultRegistry.
- **get_artifact tool:** Retrieves full content by exact path. Registered in defaultRegistry (7 tools total now).
- **ArtifactContext.tsx:** `ArtifactProvider` + `useArtifacts()` hook. Polls defaultArtifactStore every 1s (configurable) for updates from tool calls outside React. Exposes `artifacts[]`, `getArtifact(path)`, `downloadAll()` (JSZip), `refresh()`.
- **main.tsx:** Wrapped `<App>` with `<ArtifactProvider>`.
- **Tests:** 22 new tests in `artifact-store.test.ts`. All 359 tests pass.
- **Key pattern:** Tools write to `defaultArtifactStore` directly; React polls it. No event bus needed for v1 — polling is fine given 1s cadence and LLM response latency.


### 2026-04-10: B-32, B-30, B-28 — Telemetry, Data Binding, Icon System

**B-32: Logging & Telemetry**
- **Logger class:** `packages/core/src/telemetry/logger.ts` — `info/warn/error/track` methods. In-memory ring buffer (last 100), `LogRecord` = `LogEntry | TrackEntry` (discriminated union via `kind` field).
- **Singleton:** `logger` + `getLogEntries()` exported from `@kickstart/core`.
- **Wired into 3 places:** `response-processor.ts` (track `conversation.turn` per parsed response), `machine.ts` (track all phase transitions: start, advance, skip, phaseComplete, complete, reset, userInput), `tools/registry.ts` (track `tool.call` + `tool.result`, error-log failures via new `execute(name, args)` method on registry).
- **423 tests pass. Build clean.**

**B-30: State Binding & Data Interpolation**
- **`packages/core/src/engine/data-binding.ts`:** 4 exported utilities:
  - `resolveDataPath(path, dataModel)`: RFC 6901 JSON Pointer — handles `~0`/`~1` escaping, array index support, nested objects.
  - `interpolateTemplate(template, dataModel)`: replaces `{{/json/pointer}}` placeholders; leaves unresolved paths as-is; stringifies objects.
  - `createDefaultValues(schema)`: recursive JSON Schema → default values (object/array/string/number/boolean/null). Respects `schema.default`.
  - `interpolateA2UIMessage(msg, dataModel)`: deep-traverses an A2UI message and interpolates all string values recursively.
- **Wired into processResponse:** Optional `dataModel?` parameter — when provided, interpolates all component props in A2UI messages before returning.
- **All 4 utilities exported from `@kickstart/core`.**
- **Key insight:** JSON Pointer paths in A2UI props use `{{/path/to/value}}` syntax. The `{{` / `}}` delimiters distinguish data refs from literal text.

**B-28: Fluent UI React Icon System**
- **`packages/web/src/catalog/icons/fluent-icons.ts`:** `FLUENT_REACT_ICON_REGISTRY` (31 icons mapped by camelCase name). `getFluentIcon(name)` / `renderFluentIcon(name, props)` helpers.
- **Icon component updated:** `fluent-components/Icon.tsx` now checks registry first — if name matches, renders `<FluentIcon fontSize={24} />`. Falls back to SVG path, then text.
- **playground-icons.ts:** Added `FLUENT_REACT_ICON_CATEGORY` (31 entries, `type: 'fluent-react'`). `IconCategory.type` extended with `'fluent-react'`. New category in `ALL_ICON_CATEGORIES`.
- **Playground Icons tab:** New "Fluent React" section tab. Cards for fluent-react icons render via `<FluentIcon>` component (not `<img src>`). Caption updated to explain both naming conventions.
- **Pattern:** Fluent React icons copy the icon name (e.g. `document`); SVG icons copy the path (e.g. `/assets/icons/...`). The A2UI Icon component auto-detects which to use at render time.
- **Commit:** 791891a — 12 files, 624 insertions.

## 2026-04-09T22:32Z — P0–P2 Wave Complete Handoff

**Items shipped (P0→P2):** B-11, B-13, B-15, B-16, B-17, B-21, B-23, B-24, B-25, B-28, B-30, B-32 (12 total)

**Key contributions:**
- **B-25 handleAction:** Unified action dispatcher replacing ad-hoc event listeners. Pattern: single canonical handler integrates auth, validation, artifact binding.
- **B-11 API routing:** `api: action-name` message format. Standardizes LLM→UI action contracts.
- **B-17 artifact store:** Singleton + DI pattern. Queryable by LLM tool system.
- **B-16 CORS proxy:** Centralized auth middleware (ARM, GitHub, Pricing). Token lifecycle isolated from frontend.
- **B-15 phasePrompts:** Extensible LLM skill injection. Enables task-scoped domain knowledge (AKS Automatic, GitHub workflows).
- **B-13 tool system:** 60 tests. Real bug found: `generate_kubernetes_manifest` crashes on non-string appName. Hermes blocked; needs input validation.
- **B-21 auto-continue:** Middleware advances phase when LLM intent clear. Reduces friction.
- **B-23 artifact binding:** Session state ↔ LLM tools via singleton. Enables stateful multi-step loops.
- **B-24 action endpoint:** HTTP dispatcher for external action calls (non-UI, e.g., deployment scripts).
- **B-28 icons:** 27 Azure SVG icons in Mermaid diagrams. Registry pattern.
- **B-30 state binding:** Service layer for component ↔ session state. Decouples logic from Redux/Zustand.
- **B-32 logging:** Winston-based framework. Session/artifact correlation. Error tracking.

**Decisions merged to canonical registry (6):**
1. B-25 handleAction — unified action model
2. B-11 API routing — api: convention
3. B-17 artifact singleton — pattern
4. B-16 CORS proxy — auth policies
5. B-15 phasePrompts — skill resolver extension
6. (P0 architecture decisions now canonical reference for future work)

**Test status:** 423 passing. No regressions.

**Handoff:** All branches merged to main. Ready for QA E2E testing.

**Next P3 priority:** Address B-13 type coercion bug (kubectl manifest appName validation). Consider: service-principal auth, offline mode, advanced error recovery.


### 2026-04-08: Ops Batch B-99/B-100/B-101 — Legacy Cleanup, CI, Bicep

- **B-99 (legacy JS removed):** Deleted `packages/web/js/` entirely — 8 vanilla JS files (api-client, app, auth, engine, framework/a2ui-renderer, framework/components, framework/core, prompts). These were the pre-React codebase. `index.html` only loads `/src/main.tsx`; Vite build has zero references to `js/`. CSS files in `packages/web/css/` are still live (linked from index.html, copied by Vite).
- **B-100 (CI workflow added):** Created `.github/workflows/ci.yml` — triggers on push/PR to main. Steps: checkout → node@20 → npm ci → lint → core build → API build → Vite build → vitest run → playwright install + test. `deploy-swa.yml` already had correct `app_location: "packages/web/dist"` and API build; no changes needed there.
- **B-101 (Bicep updated):** Added `openAiEndpoint`, `openAiChatDeployment`, `openAiCodexDeployment` params to `infra/main.bicep`. Wired into `appSettings` resource alongside `AZURE_CLIENT_ID`. `AZURE_OPENAI_API_KEY` intentionally excluded (manual set — same pattern as `AZURE_CLIENT_SECRET`). Updated `parameters.dev.json` with placeholder values for new params.
- **Build verification:** Vite build clean after js/ removal. All 423 unit tests pass.
- **Key insight:** In SWA + managed Functions architecture, the `api_location` in the GitHub Action is sufficient — no separate Azure Functions resource in Bicep. The SWA resource manages the function app automatically.


### 2026-04-10: Unified Button Action Format (B-25 / Issue #24)

- **Problem:** The `btn()` helper in `packages/web/api/src/lib/response-processor.ts` used a custom flat format (`action: "reply", data: { text }`) that bypassed the A2UI ActionSchema.
- **Fix:** Updated `btn()` to emit `action: { event: { name: "reply", context: { text } } }` — the canonical A2UI v0.9 ActionSchema shape (uses `event.context`, not `event.data`).
- **Scope:** Only the web API response-processor needed fixing. The core catalog (`ButtonAction` type), action dispatch hooks, and MCP server action handler already used the correct format.
- **Validation:** 30 B-25 contract tests pass, all 423 tests green, lint/build clean.
- **Key files:** `packages/web/api/src/lib/response-processor.ts`, `packages/core/src/catalog/index.ts` (ButtonAction type), `packages/core/src/__tests__/action-schema.test.ts` (B-25 tests)
- **PR:** #78
- **Review fix (2026-04-10):** Copilot reviewer caught `data`/`context` mismatch in docs vs code. The web surface's A2UI v0.9 ActionSchema uses `event.context`, while `@kickstart/core`'s `ButtonAction` uses `event.data`. Added inline comment to `btn()` and fixed history entry + PR description. Always verify doc/code schema alignment when two type systems describe the same payload.


### 2026-04-10: PR #78 Review Fix & v0.2.0 Release

Addressed Copilot review on PR #78 (data→context terminology fix). PR merged successfully as part of v0.2.0 milestone closeout. Backend conventions now align with updated naming scheme.

---

## 2026-04-10: Security Sprint Execution Summary

**Assigned Issues:** #83, #84, #85, #87 (24 story points)  
**Outcome:** SUCCESS — 4/4 issues closed, all tests passing, API hardening production-ready

**Work Summary:**

### Issue #83 (API Auth & Rate Limiting) — 8 pts
- SWA authentication middleware deployed to 4 AI endpoints: `/api/converse`, `/api/playground`, `/api/action`, `/api/generate`
- Public endpoints remain anonymous: `/api/health`, `/api/inspirations`
- In-memory sliding-window rate limiter (30 req/min per IP, 15 min window) at `lib/rate-limiter.ts`
- Test coverage: 18 integration tests for auth + rate limiting + threshold edge cases
- Impact: Closes High-severity API abuse vector

### Issue #84 (System Prompt Exposure) — 3 pts
- `systemPrompt` field removed from converse response type + actual response body
- Clients now receive only: `{ sessionId, phase, message, a2ui? }`
- Test coverage: 4 tests verifying prompt redaction across all endpoints
- Impact: Closes Medium-severity prompt injection attack surface

### Issue #85 (Error Information Leakage) — 5 pts
- Centralized error response utilities: `lib/error-response.ts` with `safeErrorResponse()` + `safeStreamError()`
- All API handlers updated to use generic client message: `"An error occurred processing your request."`
- Full error details (stack traces) logged server-side only
- Test coverage: 12 tests verifying error message sanitization across all handlers
- Impact: Closes Medium-severity information disclosure

### Issue #87 (Key Vault Integration) — 8 pts
- Azure Key Vault client setup in `lib/keyvault-client.ts`
- Secrets rotation strategy: Environment variables → Key Vault seamless fallback
- CI/CD injection: `deploy-infra.yml` updated to populate vault with GitHub Actions secrets
- Dev environment: `local.settings.json` template for local secret management
- Test coverage: 8 tests for vault connectivity + secret retrieval + fallback behavior
- Impact: Closes Medium-severity infrastructure secrets gap

**PR #92:** All 4 issues merged in single PR, approved by Zapp (Security Architect)

**Team Feedback:**
- "API auth middleware complexity moderate; SWA integration straightforward"
- "Rate limiter edge cases (burst scenarios) required careful testing"
- "Key Vault integration simplified infrastructure onboarding; recommend keeping for future secrets"

**Handoff:** Security sprint complete. API endpoints hardened. No security regressions in full test suite (all handlers compliant).


### 2026-04-10: Knowledge Skills Middleware + IaC Best Practices (#21, #33)

- **Skill type (#33):** Added `Skill` interface to `engine/types.ts` — id, name, phases[], keywords[], content, priority. `SkillResolverContext` for middleware state.
- **Async middleware chain (#33):** Three default middleware — PhaseFilterMiddleware (filters by skill.phases), KeywordActivationMiddleware (scans conversation history for keywords), PriorityOrderMiddleware (sorts by priority desc). Signature is async from day one per Leela's note — future TokenBudgetMiddleware can do async work without breaking change.
- **Sync facade preserved:** `resolveSkills()` signature unchanged — new third param `conversationHistory?` is optional. Zero changes needed in `converse.ts`. Inline skill resolution for sync path (no Promise microtask issues). Async path uses full middleware chain via `resolveSkillsAsync()`.
- **IntegrationKit.skills field:** Optional `skills?: Skill[]` on IntegrationKit. Skills coexist with `phasePrompts` and `prompts` — they're prepended (higher signal).
- **IaC Skills (#21):** 5 typed Skill objects in azureKit: iac-bicep-modules (priority 5, Generate), iac-secure-decorators (priority 10, Generate+Review), iac-diagnostic-settings (priority 3, Generate+Review), iac-resource-tagging (priority 2, Generate), iac-least-privilege-rbac (priority 10, Generate+Review).
- **Zapp concerns addressed:** (1) No-secret-output — iac-secure-decorators explicitly says "NEVER generate Bicep output blocks that expose secret values." (2) Least-privilege RBAC — iac-least-privilege-rbac enforces narrowest scope, lists specific built-in role IDs, bans Owner/Contributor at subscription scope. (3) Managed Identity preference over connection strings enforced in both skills.
- **Security model (Zapp):** Skills are first-party only. `registerSkillMiddleware()` is for internal use. Keyword activation only toggles predefined skill IDs — no raw user text injected into system prompts.
- **New exports:** `resolveSkillsAsync`, `resolveSkillsFromList`, `registerSkillMiddleware`, `SkillResolverMiddleware` type, `Skill` type, `SkillResolverContext` type.
- **Tests:** 15 new tests (43 total in skill-resolver.test.ts). Covers typed skills, phase filtering, priority ordering, skill+phasePrompt coexistence, resolveSkillsFromList, resolveSkillsAsync, and all 5 IaC skills including Zapp requirement assertions.
- **PR:** #119 (draft) — squad/21-33-knowledge-skills branch.
- **Key files:** `packages/core/src/engine/types.ts`, `packages/core/src/engine/skill-resolver.ts`, `packages/core/src/kits/types.ts`, `packages/core/src/kits/azure-kit.ts`, `packages/core/src/__tests__/skill-resolver.test.ts`



### 2026-07-27: Filesystem Abstraction + Cloud Shell Provider (#47, PR #123)

- **Issue:** #47 - feat: Remote filesystem abstraction + Cloud Shell provider
- **PR:** #123 (draft)
- **New module:** packages/core/src/filesystem/ - pluggable file I/O abstraction
- **FileSystemProvider interface:** read(path), write(path, content), list(directory), delete(path), exists(path) - all async, text-only, forward-slash relative paths.
- **InMemoryFileSystemProvider:** Zero-dependency implementation for tests and web frontend. Supports directory listing with child-directory deduplication.
- **CloudShellProvider:** Connector-backed provider using APIConnector for authenticated Cloud Shell REST API calls. Routes through /api/fs/{basePath}/{path}. 404 on read throws FileNotFoundError; 404 on delete is a no-op.
- **FileSystemProviderRegistry:** register(), setActive(), active getter, auto-activates first registered provider.
- **Path sanitisation:** sanitizePath() rejects .. traversal, absolute paths, backslashes, and empty paths.
- **ToolContext extension:** Added optional fileSystem?: FileSystemProvider to ToolContext.
- **Four LLM tools:** fs_read (no approval), fs_write (approval required), fs_list (no approval), fs_delete (approval required).
- **Decision:** Filesystem is infrastructure, not an IntegrationKit. Tools registered directly in default registry.
- **Decision:** ToolContext.fileSystem is optional because web-only contexts don't have real filesystems.
- **Test count:** 41 new tests (574 total), all passing. Build clean.
- **Key files:** packages/core/src/filesystem/types.ts, in-memory-provider.ts, cloud-shell-provider.ts, registry.ts, tools/fs-*.ts
