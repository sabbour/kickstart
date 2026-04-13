or hardcode them.
- **Consistent Fluent styling** — all components use `makeStyles`, `tokens`, and Fluent primitives. No inline hardcoded colors.

---

# Decision: Smart Control Pack Patterns for Kickstart A2UI Architecture

**Author:** Leela (Lead)  
**Date:** 2025-07-26  
**Status:** Proposed  
**Supersedes:** None  
**Related:** leela-pragmatic-a2ui-react.md, leela-two-repo-strategy.md

## Context

Ahmed's previous prototype (`sabbour/adaptive-ui-try-aks`) used the **adaptive-ui-framework** — a custom React framework for conversational, agent-driven UIs. It had a **pack system** where bundles of smart components + LLM knowledge + tools + auth were registered as units. We need to understand these patterns and map them into our A2UI v0.9 + React + Fluent UI v9 architecture.

This decision documents every pattern found, assesses A2UI compatibility, and prescribes how to bring each into Kickstart.

## 1. Pack Inventory

### 1.1 Azure Pack (`@sabbour/adaptive-ui-azure-pack`)

| Component | Type | Description |
|-----------|------|-------------|
| `azureLogin` | Self-managing auth | MSAL popup sign-in. Sets `__azureToken` + fetches subscriptions. Auto-selects single subscription. |
| `azureResourceForm` | Dynamic form | Auto-generates forms from ARM provider metadata at runtime — zero hardcoded schemas. |
| `azurePicker` | Data-fetching dropdown | Dropdown that calls ARM API at render time. Used for regions, resource groups, SKUs. Guards against unresolved `{{state}}` interpolation. |
| `azureQuery` | Write-with-confirm | ARM API caller for PUT/POST/PATCH/DELETE with user confirmation dialog. Results stored in state. |

**Tools (inference-time):**
| Tool | Description |
|------|-------------|
| `azure_arm_get` | Read-only ARM REST API. LLM uses to reason before producing UI. Auto-injects subscription ID. |
| `azure_pricing` | Azure retail pricing API. Public, no auth. Returns up to 10 price records. |

**Skills Resolver:** Keyword-triggered domain knowledge injection — ARM PUT body templates for AKS, App Service, Container Apps, ACR, Cosmos DB, Key Vault, Storage, SQL, role assignments. Plus AKS Automatic domain knowledge (Gateway API, Workload Identity, Deployment Safeguards).

**Auth:** MSAL.js (`@azure/msal-browser`). Uses Azure CLI client ID. CORS proxied through `/api/auth-proxy`. Tokens cached in localStorage. Silent + popup flow. Also supports Graph token acquisition for incremental consent.

**Settings UI:** Sign-in/sign-out card injected into settings panel.

**Diagram Icons:** 27 Azure service SVG icons registered for Mermaid diagrams (`%%icon:azure/aks%%`).

### 1.2 GitHub Pack (`@sabbour/adaptive-ui-github-pack`)

| Component | Type | Description |
|-----------|------|-------------|
| `githubLogin` | Self-managing auth | OAuth Device Flow. User enters code on github.com. Polls for token. Shows green confirmation if already signed in. |
| `githubPicker` | Data-fetching dropdown | Fetches from GitHub API at render time. Auto-paginates (up to 300). Used for orgs, repos, branches. Personal account detection. |
| `githubQuery` | Write-with-confirm | GitHub API caller for POST/PUT/PATCH/DELETE with confirm dialog. Auto-rewrites personal account API paths. |
| `githubRepoInfo` | Read-only card | Rich repo card (name, description, language, stars, forks). |
| `githubCreatePR` | Multi-step action | Creates branch, commits all generated artifacts, opens PR. Auto-initializes empty repos. |
| `githubSetSecret` | Encrypted action | Sets GitHub Actions secrets using libsodium sealed box encryption. Self-contained, one-per-turn. |

**Tools (inference-time):**
| Tool | Description |
|------|-------------|
| `github_api_get` | Read-only GitHub REST API with auto-pagination (up to 200 items). Response slimming (repos→6 fields, issues→7 fields). |

**Auth:** OAuth Device Flow OR PAT entry. Token stored in localStorage + module cache. CORS proxied through `/api/github-oauth/*`.

**Settings UI:** OAuth client ID configuration, CORS proxy URL, PAT entry, token inspection.

### 1.3 App-Level Custom Components (try-aks)

| Component | Type | Description |
|-----------|------|-------------|
| `ArchitectureDiagram` | Visualization | Mermaid diagram renderer with ELK layout, pan/zoom, Azure icon substitution, auto-fit. |
| `CostEstimate` | Data display | Scans generated artifacts for cost breakdown. |
| `CompactCodeBlock` | File chip | Override of codeBlock — renders as compact file chip, full code goes to file viewer panel. |
| `DevEnvironmentCard` | Action card | Opens repo in VS Code / vscode.dev / Codespaces. |
| `K8sValidator` | Validation engine | Client-side AKS Deployment Safeguards validation (DS001-DS013). Validates + auto-fixes YAML manifests. |
| `SafeguardsChecker` | LLM feedback | Formats violations as markdown for LLM context injection → self-correction loop. |
| `DiagramBuilder` | Generator | Builds Mermaid diagrams from artifact context (Bicep resources + K8s manifests). |

### 1.4 Core Framework (`@sabbour/adaptive-ui-core`)

Not a "pack" but foundational capabilities all packs depend on:
- **Component Registry** — `registerComponent()`, `registerPackWithSkills()`, `getComponent()`
- **AdaptiveApp** — Conversation orchestrator (turn management, LLM adapter, history)
- **Context** — React Context with state, dispatch, handleAction, sendPrompt, disabled flag
- **Renderer** — Recursive node renderer consuming `AdaptiveUISpec.layout`
- **Interpolation** — `{{state.key}}` resolution in any string prop
- **Tools** — `registerTool()`, `executeTool()`, tool-call loop in LLM adapter
- **Artifacts** — Scoped file storage for generated code
- **Session Manager** — localStorage persistence with 24h TTL
- **Request Tracker** — `trackedFetch()` wrapper for API call monitoring
- **DisabledScope** — Wraps past turns, sets `disabled=true`, components skip side effects
- **Decision Log** — Audit trail of adapter/tool decisions
- **Sanitizer** — XSS protection for rendered content

## 2. Pattern Catalog (14 Patterns)

### P01: Pack Registration
**What:** Bundle of components + system prompt + skills resolver + settings UI + LLM tools, registered as a single unit via `registerPackWithSkills(createAzurePack())`.  
**How it works:** `createAzurePack()` returns a `ComponentPack` object. `registerPackWithSkills()` iterates components → `registry.set()`, stores system prompt, wires skill resolver, registers tools, injects settings.  
**Why it matters:** Clean separation of concerns. Adding GitHub support = one line. Removing it = one line. LLM automatically knows about available capabilities via system prompt injection.

### P02: Self-Managing Login Component
**What:** Login components handle their entire auth flow internally — render sign-in button, trigger popup/device flow, store token in state, fetch initial data (subscriptions, user info), show confirmation.  
**How it works:** Component checks `disabled` flag (skip in past turns). Checks existing token. If no token → renders sign-in UI. On click → triggers auth flow. On success → dispatches `SET` action to store token as `__azureToken`. LLM told to "omit next" — component self-manages.  
**Key detail:** Double-underscore prefix (`__`) = private state, hidden from LLM in form submissions.

### P03: Data-Fetching Picker
**What:** Dropdown that fetches options from an API at render time. Handles loading, error, empty states. Auto-paginates (GitHub: up to 300 items).  
**How it works:** Component receives `api` prop with `{{state.key}}` interpolation in the URL. On mount, resolves interpolation → fetches → renders dropdown. Guards: if interpolation yields literal `{{state.*}}`, shows "Waiting for selection..." instead of making broken API call.  
**Example:** `{type:"azurePicker", api:"/subscriptions/{{state.__azureSubscription}}/locations?api-version=2022-12-01", bind:"region", labelKey:"displayName", valueKey:"name"}`

### P04: Write-with-Confirm Action
**What:** Component that calls a write API (PUT/POST/DELETE) with explicit user confirmation before executing.  
**How it works:** Renders a confirm button (label customizable). On click → calls API with interpolated path + body → stores result in state under `bind` key. Shows loading spinner during execution.  
**Key detail:** `confirm` prop can be boolean (show/hide) or string (custom button label, e.g. "Create Repository").

### P05: LLM Inference-Time Tools
**What:** Functions the LLM calls during text generation, before producing UI. Results feed back into LLM reasoning.  
**How it works:** Tools registered via `registerTool(definition, handler)`. LLM adapter includes tool definitions in API request. When LLM emits tool_call → adapter executes handler → sends result back → LLM continues generating. Loop until LLM produces final response.  
**Example:** LLM calls `azure_arm_get` to check if a resource group exists → gets result → decides whether to show "create new" or "use existing" UI.  
**Key distinction from components:** Tools run DURING inference. Components run AFTER inference (render time). Tools inform LLM reasoning. Components present results to user.

### P06: Knowledge Skills Resolver
**What:** Per-turn prompt enrichment that injects domain knowledge based on conversation context.  
**How it works:** Before each LLM call, `resolvePackSkills(prompt)` runs all registered resolvers. Each resolver checks keywords → returns additional system prompt text. Only injects if content is new (not same as last turn). Content: ARM PUT body templates, AKS Automatic rules (Gateway API, Workload Identity, Deployment Safeguards).  
**Key detail:** Skill content is LARGE (multi-KB). Only injected when relevant. Prevents token waste on irrelevant turns.

### P07: Disabled Context (Past Turn Isolation)
**What:** Past conversation turns rendered in `DisabledScope` — components skip API calls, auth checks, and other side effects.  
**How it works:** `DisabledScope` wraps past-turn rendering, overrides context with `disabled: true`. Components check `useAdaptive().disabled` and short-circuit.  
**Why it matters:** Without this, scrolling through conversation history would re-trigger N auth popups and N×M API calls.

### P08: State-as-Token Convention
**What:** Auth tokens stored in conversation state with `__` prefix. Components check state for token presence to determine auth status. LLM instructions say "show login if `__azureToken` not set."  
**How it works:** Login component sets `__azureToken` → next turn, LLM reads state → sees token present → skips login → shows resource pickers. If token expired, component silently refreshes via `acquireTokenSilent()`.  
**Key detail:** `__` prefix hides from form submit payloads but LLM CAN reference in `{{state.__azureToken}}` for API calls.

### P09: CORS Proxy Pattern
**What:** All external API calls routed through a backend proxy (`/api/*`) to bypass browser CORS restrictions.  
**How it works:** Azure Functions backend with routes: `/api/arm-proxy/*` → ARM API, `/api/auth-proxy/*` → login.microsoftonline.com, `/api/github-oauth/*` → github.com, `/api/pricing-proxy/*` → Azure retail prices. Token forwarded in Authorization header.  
**Why it matters:** MSAL token exchange requires server-side call (CORS). ARM API requires it. GitHub OAuth requires it. The proxy also enables workload identity fallback when no user token is available.

### P10: Artifact-Aware Components
**What:** Components that read/write from a shared artifact store (generated files like Dockerfiles, Bicep, Helm charts).  
**How it works:** `githubCreatePR` reads ALL artifacts → creates branch → commits each file → opens PR. `CompactCodeBlock` renders as a file chip linking to the artifact in the file viewer panel. `CostEstimate` scans artifacts for cost-relevant resources. `DiagramBuilder` generates architecture diagrams from artifact context.  
**Key insight:** Artifacts are the bridge between LLM-generated code and external systems (GitHub, deployment).

### P11: Auto-Continue Component
**What:** Components that automatically advance the conversation after completing their action.  
**How it works:** `githubSetSecret` and `githubCreatePR` call `sendPrompt()` after success with a result summary. LLM picks up the next turn. User sees seamless flow without clicking "Continue."  
**Key detail:** "Self-contained, one per turn" — the system prompt explicitly tells the LLM to show these components alone.

### P12: ARM Introspection
**What:** Runtime discovery of Azure resource type schemas from ARM provider metadata — no hardcoded forms.  
**How it works:** `fetchResourceTypeSchema()` calls `/providers/{namespace}?api-version=...`, finds resource type definition, extracts properties, caches with 5-min TTL. `azureResourceForm` consumes the schema to generate form fields dynamically.  
**Why it matters:** Works for ANY ARM resource type without code changes. New Azure services automatically get forms.

### P13: Client-Side Validation + Auto-Fix
**What:** K8s manifest validator that checks AKS Deployment Safeguards (13 rules) and can auto-fix violations.  
**How it works:** Parses YAML → checks each container for resources, probes, security context, image tags, etc. Returns structured violations. `fixK8sManifest()` applies default fixes (adds resource limits, probes, security settings). Violations formatted as markdown → injected into LLM context → LLM self-corrects in next turn.  
**Key pattern:** Validate → format for LLM → LLM fixes → re-validate loop.

### P14: Intent Resolvers (Preconfigured Components)
**What:** Shortcut names that expand to fully-configured component props.  
**How it works:** `azure-regions` resolver returns `{type:"azurePicker", api:"/subscriptions/.../locations?...", labelKey:"displayName", valueKey:"name", filterKey:"metadata.regionType", filterValue:"Physical"}`. LLM uses intent name instead of specifying full props.  
**Why it matters:** Reduces LLM prompt complexity. Common patterns pre-baked.

## 3. Architecture Recommendations for Kickstart (A2UI + Fluent UI v9)

### R01: ServicePack Abstraction Layer

**Problem:** A2UI has no concept of "packs." It has custom components and that's it. No system for bundling components + prompts + tools + auth.

**Recommendation:** Create a `ServicePack` TypeScript interface in Kickstart's `packages/core`:

```typescript
interface ServicePack {
  name: string;
  displayName: string;
  
  // A2UI custom component registrations
  components: Record<string, A2UICustomComponent>;
  
  // System prompt additions for the LLM
  systemPrompt: string;
  
  // Knowledge skills — injected per-turn based on context
  resolveSkills?: (prompt: string) => Promise<string | null>;
  
  // LLM inference-time tools
  tools?: ToolDefinition[];
  
  // Service connector (auth + API client)
  connector: ServiceConnector;
}
```

This wraps A2UI's component registration with the additional machinery. Kickstart's engine calls `registerServicePack()` at startup, which:
1. Registers each component via `createReactComponent()` (A2UI)
2. Appends system prompt to the LLM context
3. Registers tools with the tool executor
4. Initializes the service connector

### R02: ServiceConnector Pattern (Auth + API)

**Problem:** The old framework stored tokens in conversation state (`__azureToken`). A2UI's data model uses JSON Pointers, not arbitrary state. We need auth tokens accessible to components without polluting the UI data model.

**Recommendation:** Create per-service `ServiceConnector` as React Context + singleton:

```typescript
interface ServiceConnector {
  name: string;
  isAuthenticated: boolean;
  login(): Promise<void>;
  logout(): void;
  getToken(): Promise<string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}
```

Components access via `useServiceConnector('azure')`. Tokens managed internally (MSAL/OAuth), never in A2UI state. Components report results (not tokens) back to the orchestrator via `action.event`.

**Port from old framework:**
- `azureLogin` auth logic → `AzureConnector` (MSAL, silent refresh, proxy routing)
- `githubLogin` auth logic → `GitHubConnector` (Device Flow, PAT, token storage)

### R03: Fat Components for Data-Fetching Controls

**Problem:** A2UI components receive props and render. They don't natively fetch data. The old framework's pickers called APIs at render time.

**Recommendation:** Build each pack control as a **fat A2UI custom component** — self-contained React component registered via `createReactComponent()` that:
1. Receives config props from LLM (API path, bind key, labels)
2. Uses `useServiceConnector()` to get auth + make API calls
3. Manages its own loading/error/empty states (Fluent UI v9 Spinner, MessageBar)
4. Reports selection back via A2UI `action.event` → orchestrator updates data model

**Mapping:**
| Old Component | Kickstart A2UI Component | Notes |
|---------------|-------------------------|-------|
| azureLogin | `<AzureLoginCard>` | Fat component, uses AzureConnector |
| azurePicker | `<AzureResourcePicker>` | Fat component, fetches at render |
| azureResourceForm | `<AzureResourceForm>` | Fat component, ARM introspection |
| azureQuery | `<AzureAction>` | Fat component, confirm + execute |
| githubLogin | `<GitHubLoginCard>` | Fat component, Device Flow |
| githubPicker | `<GitHubPicker>` | Fat component, auto-paginate |
| githubQuery | `<GitHubAction>` | Fat component, confirm + execute |
| githubCreatePR | `<GitHubCommit>` | Fat component, reads artifacts |
| githubSetSecret | `<GitHubSetSecret>` | Fat component, libsodium encryption |

### R04: Keep LLM Tools in Orchestration Layer

**Problem:** A2UI has no tool concept. Tools are a Kickstart concern.

**Recommendation:** Tools stay in Kickstart's LLM adapter (backend SSE endpoint or client-side adapter). Port `azure_arm_get`, `azure_pricing`, `github_api_get`, `fetch_webpage` directly. They use `ServiceConnector.getToken()` for auth instead of reading from state.

### R05: Port Knowledge Skills to Phase Engine

**Problem:** A2UI has no skill resolver concept.

**Recommendation:** Kickstart's 6-phase engine already has per-phase system prompts. Add a skill resolver middleware:
1. Before each LLM call, run all registered pack skill resolvers against the user prompt
2. Append returned knowledge to the system prompt for that turn only
3. Cache to avoid re-injecting identical content

Port `resolveAzureSkills()` directly — the keyword → ARM template mapping is valuable and framework-independent.

### R06: CORS Proxy Backend (Same Pattern)

**Recommendation:** Exact same architecture. SWA Functions backend with:
- `/api/arm-proxy/*` → Azure ARM API (forwards Bearer token or uses managed identity)
- `/api/auth-proxy/*` → login.microsoftonline.com (MSAL token exchange)
- `/api/github-oauth/*` → github.com (Device Flow + token exchange)
- `/api/pricing-proxy/*` → Azure retail pricing API

Already planned in Kickstart infra. No changes needed from the old pattern.

### R07: Artifact Store (Port Directly)

**Recommendation:** Port the artifact store concept to Kickstart's `packages/core`. A2UI components report generated files via `action.event`. The orchestrator stores them. Components like `<GitHubCommit>` read from the store to create PRs.

### R08: Client-Side Validation (Port Directly)

**Recommendation:** Port `k8s-validator.ts` and `safeguards-checker.ts` to `packages/core`. They're pure TypeScript, zero framework dependency. Wire into the phase engine: after Generate phase, validate artifacts → inject violations into LLM context → Review phase auto-corrects.

### R09: Diagram System (Port to A2UI)

**Recommendation:** `ArchitectureDiagram` → A2UI custom component `<ArchitectureDiagram>`. Mermaid + ELK rendering, Azure icon substitution, pan/zoom. Register Azure diagram icons from the Azure pack.

The old framework's diagram registry (`registerDiagramRenderer()`, `registerAzureDiagramIcons()`) maps cleanly to A2UI component registration.

## 4. Gaps — Things A2UI Can't Do Natively

### G01: No Pack/Bundle System
**A2UI provides:** Individual component registration.  
**Gap:** No way to bundle components + prompts + tools + auth as a unit.  
**Solution:** `ServicePack` abstraction (R01). Kickstart concern, not A2UI concern.

### G02: No Service/Connector Layer
**A2UI provides:** Data binding via JSON Pointers on a SurfaceModel.  
**Gap:** No mechanism for components to acquire auth tokens or call external APIs.  
**Solution:** `ServiceConnector` pattern (R02). React Context + hooks.

### G03: No LLM Tool System
**A2UI provides:** Nothing for inference-time tool calls.  
**Gap:** Tools are the bridge between "LLM needs data" and "show UI with data."  
**Solution:** Keep in Kickstart's orchestration layer (R04). Not an A2UI concern.

### G04: No Prompt Injection / Skills System
**A2UI provides:** Nothing for dynamic system prompt management.  
**Gap:** Knowledge skills are critical for Azure domain expertise.  
**Solution:** Phase engine middleware (R05). Not an A2UI concern.

### G05: No Artifact Store
**A2UI provides:** Nothing for file-level artifact management.  
**Gap:** Generated code (Bicep, Dockerfiles, manifests) needs persistent storage and cross-component access.  
**Solution:** Kickstart artifact store in `packages/core` (R07).

### G06: No Disabled/Past-Turn Isolation
**A2UI provides:** Messages are immutable by design once rendered.  
**Gap:** In conversation UIs, past turns must not re-trigger side effects when scrolled into view.  
**Solution:** A2UI's `@a2ui/react` renderer already handles this — past messages are static DOM. But fat components with `useEffect` need their own `isActive` guard. Recommend: components check a `turnActive` prop or context value.

### G07: No Auto-Continue
**A2UI provides:** Components can fire `action.event`, but there's no "auto advance conversation" mechanism.  
**Gap:** Components like `githubCreatePR` need to automatically trigger the next turn.  
**Solution:** Auto-continue middleware in the Kickstart conversation engine. When a component fires a specific event type (e.g., `action.complete`), the engine synthesizes a user prompt and advances.

### G08: No State Interpolation in Props
**A2UI provides:** Data binding via JSON Pointers.  
**Gap:** The old framework used `{{state.key}}` in any string prop (API paths, labels, etc.).  
**Solution:** A2UI uses JSON Pointer references (`/data/region`) which serve the same purpose. LLM generates A2UI JSON with pointer references instead of `{{state.key}}`. Different syntax, same capability.

## 5. Migration Priority

| Priority | Pattern | Effort | Rationale |
|----------|---------|--------|-----------|
| P0 | ServiceConnector (Azure auth) | 1 day | Everything depends on auth |
| P0 | ServiceConnector (GitHub auth) | 1 day | PR creation depends on it |
| P0 | ServicePack abstraction | 0.5 day | Registration framework |
| P0 | CORS proxy backend | 1 day | Already planned in infra |
| P1 | AzureResourcePicker (fat component) | 1 day | Core UX for resource selection |
| P1 | GitHubPicker (fat component) | 1 day | Core UX for repo/branch selection |
| P1 | GitHubCommit (createPR) | 1.5 days | Core deployment path |
| P1 | Azure/GitHub LoginCards | 1 day | Auth UI |
| P1 | K8s Validator + auto-fix | 0.5 day | Pure TS port, zero framework |
| P1 | Knowledge skills resolver | 0.5 day | Prompt middleware |
| P2 | AzureResourceForm (ARM introspection) | 2 days | Dynamic forms are complex |
| P2 | ArchitectureDiagram | 1.5 days | Mermaid + ELK + icons |
| P2 | AzureAction / GitHubAction (write-with-confirm) | 1 day | Write operations |
| P2 | GitHubSetSecret | 0.5 day | Libsodium encryption |
| P2 | CostEstimate | 1 day | Pricing API integration |
| P3 | LLM tools port | 1 day | Already have pattern |
| P3 | DiagramBuilder (auto-generate from artifacts) | 1 day | Nice-to-have |
| P3 | Intent resolvers (shortcuts) | 0.5 day | Convenience, not critical |

**Total estimate:** ~16.5 developer-days for full pack port.

## Decision

Adopt the **ServicePack + ServiceConnector** pattern as Kickstart's extension model. All pack components become fat A2UI custom components. Auth, tools, skills, and artifacts live in Kickstart's orchestration layer, not in A2UI. Port patterns P01-P14 following the priority table above.

This gives us the same rich capabilities as the adaptive-ui-framework while building on A2UI's renderer and Google's component model. We keep what worked (structured JSON, fat components, tools, skills) and drop what A2UI replaces (custom registry, custom renderer, custom context).

---

# Decision: Smart Control Patterns from adaptive-ui-trip-notebook

**Date:** 2025-07-25
**Author:** Leela (Lead)
**Status:** Research / Informational
**Requested by:** Ahmed Sabbour

## Context

Research analysis of `sabbour/adaptive-ui-trip-notebook` — an AI travel planning assistant built on the same adaptive-ui-framework used by the AKS app (`sabbour/adaptive-ui-try-aks`). This app uses 3 domain-specific packs with 11 smart controls, revealing additional architectural patterns beyond what the AKS app demonstrates.

## 1. Control Inventory

### Travel Data Pack (`@sabbour/adaptive-ui-travel-data-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `weatherCard` | `city` | Client-side fetch + 3-day forecast strip | wttr.in (free, no key) |
| `countryInfoCard` | `country` | Client-side fetch + fact card with flag | restcountries.com (free) |
| `currencyConverter` | `from?, to?` | Interactive widget with amount input + swap | open.er-api.com (free) |
| `travelChecklist` | `items, bind` | Checkbox list with progress bar | None (local state) |
| `budgetTracker` | `items, currency?, bind?` | Category-bar visualization + auto-artifact | None (auto-saves) |

**Tools:** `get_weather`, `get_exchange_rate`, `get_country_info`, `get_time_zone`

### Google Maps Pack (`@sabbour/adaptive-ui-google-maps-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `googleMaps` | `mode, query, origin, destination...` | 5-mode iframe embed | Maps Embed API |
| `googlePlacesSearch` | `query, bind` | Click-to-select place list | Places API (new) |
| `googleNearby` | `location, bind, placeType?` | Photo grid with ratings | Places API (new) |
| `googlePhotoCard` | `query, caption?` | Hero image with overlay | Places API (photos) |

**Tools:** `google_places_search`, `google_place_details`, `google_geocode`

### Google Flights Pack (`@sabbour/adaptive-ui-google-flights-pack`)

| Control | Props | Pattern | API |
|---------|-------|---------|-----|
| `flightSearch` | `from, to, date, bind?` | Live results via CORS proxy + HTML parse | Google Flights (scrape) |
| `flightCard` | `from, to, date` | Deep link card with protobuf URL | None (URL construction) |

**Tools:** `search_flights`

## 2. New Patterns (Not Found in AKS App)

### Pattern A: Component-Autonomous Data Fetching

Components call external APIs themselves at render time. The LLM provides minimal props (`city: "Paris"`) and the component handles the entire API lifecycle: loading state → fetch → parse → render → error recovery. The LLM never sees the fetched data.

**Why it matters:** Saves tokens, parallelizes API calls, and enables real-time data without tool calls. For Kickstart, a `DeploymentStatus` component could poll Azure APIs directly without the LLM orchestrating it.

**Example:** `{type: "weatherCard", city: "Cairo"}` — component fetches wttr.in, shows loading spinner, renders 3-day forecast. LLM moves on immediately.

### Pattern B: Artifact Extraction Pipeline

The app walks the entire AdaptiveUISpec layout tree after each LLM response, extracting structured data from component nodes. Extraction functions recognize component types (`countryInfoCard` → destination, `flightSearch` → flight info, `budgetTracker` → budget items) and persist them as typed artifacts via `upsertArtifact()`.

**Extraction targets:** places, flights, weather, checklists, photos, itinerary days, code blocks — each with its own tree-walking function.

**Why it matters:** Creates a persistent structured data layer from ephemeral chat components. Enables the second-panel "Trip Notebook" to aggregate all trip data across the conversation.

### Pattern C: Dual-Role API Integration (Tool + Component)

Every external API has TWO entry points:
1. **Tool** — LLM calls it at inference time, sees the response, reasons about it
2. **Component** — renders visually for the user, fetches data client-side

The system prompt explicitly instructs when to use each: "Use `get_weather` TOOL when LLM needs data to reason. Use `weatherCard` COMPONENT to display weather visually."

**Why it matters:** Optimizes token usage. The LLM only calls tools when it needs data to make decisions. Visual display uses components that fetch independently. For Kickstart: `check_aks_status` tool for LLM reasoning vs. `aksStatusCard` component for user display.

### Pattern D: Cross-Component State Binding via `{{state.key}}`

The `bind` prop + `{{state.key}}` interpolation creates implicit cross-component communication:
- User selects a hotel in `googlePlacesSearch` → stores in `state.hotel`
- `googleNearby` uses `location: "{{state.hotel}}"` → shows restaurants near selected hotel
- `flightSearch` uses `from: "{{state.fromAirport}}"` → updates when departure is set

State is managed via `dispatch({ type: 'SET', key, value })`. Components read via `interpolate(prop, state)`.

**Why it matters:** Enables multi-step wizards without LLM orchestration. Once state is set, downstream components auto-update. For Kickstart: selecting a runtime could auto-update deployment templates, resource suggestions, and cost estimates.

### Pattern E: Graceful Degradation Chain

FlightSearch demonstrates a 3-tier fallback:
1. **Rich mode:** CORS proxy → fetch Google Flights HTML → parse → show interactive results
2. **Link mode:** No proxy or parse fails → show styled "Search on Google Flights" link card
3. **Error mode:** Missing params → show yellow warning banner

GoogleNearby: Photos attempt Places API photo fetch → fall back to colored placeholder initials.

**Why it matters:** External APIs are unreliable. Every component needs a degradation path. For Kickstart: Azure API down → show cached state → show "check in portal" link.

### Pattern F: Artifact-Driven Side Panel

The TripNotebook panel uses `useSyncExternalStore` to subscribe to the artifact store. It categorizes artifacts by filename prefix convention:
- `place-*` → Overview tab destinations
- `flight-*` → Travel tab flights
- `budget-*` → Budget tab line items
- `weather-*` → Overview tab weather
- `itinerary-day-*` → Itinerary tab (sorted by day number)
- `checklist-*` → Packing tab
- Everything else → Trip Files

**Why it matters:** Decouples data production (chat components) from data consumption (notebook panel). For Kickstart: a "Deployment Dashboard" panel could aggregate all deployment artifacts by convention.

### Pattern G: Protobuf URL Construction

The flights pack includes a minimal protobuf encoder (`protobuf.ts`) that builds binary-encoded Google Flights URLs. It implements the wire format (varint, length-delimited, tags) and specific message types (Airport, FlightData, Info).

**Why it matters:** Pattern for integrating with services that use binary/encoded URL parameters. Could apply to Azure Portal deep links with complex state.

### Pattern H: HTML Scraping as API Alternative

The flights pack parses Google Flights HTML responses to extract structured flight data (`parser.ts`). It looks for specific script tags (`class="ds:1"`) and `AF_initDataCallback` patterns, then walks nested JSON arrays to extract prices, airlines, legs, durations, and carbon emissions.

**Why it matters:** When official APIs don't exist or are too expensive, scraping-via-CORS-proxy is a viable pattern. For Kickstart: could scrape Azure pricing pages or status pages as a fallback.

### Pattern I: Pack Scoping

`getActivePackScope() / setActivePackScope('travel')` + `clearAllPacks()` ensures multi-app isolation. When the travel app mounts, it clears any other app's packs and registers its own.

### Pattern J: Session-Scoped Artifact Persistence

Each session has its own artifact namespace. Switching sessions calls `saveArtifactsForSession(oldId)` then `loadArtifactsForSession(newId)`. Deleting a session also deletes its artifacts.

## 3. Cross-Domain Patterns (Shared with AKS App)

Both apps share the same foundational architecture:

| Pattern | Implementation |
|---------|---------------|
| Pack factory | `create{Name}Pack(): ComponentPack` |
| Registration | `registerPackWithSkills(pack)` |
| Component typing | `AdaptiveComponentProps<T extends AdaptiveNodeBase>` |
| State access | `useAdaptive()` → `{ state, dispatch, disabled }` |
| Template interpolation | `interpolate(value, state)` for `{{state.key}}` |
| Tool definition | OpenAI function-calling format (`type: 'function'`) |
| Tool handler | `async (args: Record<string, unknown>) => string` |
| Observable fetch | `trackedFetch(url, options)` |
| Settings panel | `settingsComponent` in pack definition |
| System prompt per pack | `systemPrompt` string in pack definition |
| API key storage | `localStorage` via settings components |
| Error display | Shared `Banner` component pattern |
| Loading display | Shared `LoadingSpinner` component pattern |

## 4. Architecture Implications for Kickstart A2UI Pack Design

### 4.1 Pack Anatomy Formalized

Every Kickstart pack should have this structure:
```
{
  name: string,
  displayName: string,
  components: Record<string, React.FC>,    // visual controls
  tools: ToolDefinition[],                  // LLM-callable functions
  systemPrompt: string,                     // instructions for when/how to use
  settingsComponent?: React.FC,             // API key / config UI
}
```

### 4.2 Component Autonomy Principle

Components that display external data should fetch it themselves (like `weatherCard` fetches wttr.in). The LLM provides intent (`what` to show), the component handles execution (`how` to get and display it). This saves tokens and enables real-time updates.

**Kickstart application:**
- `aksClusterStatus` — polls Azure for cluster health, shows live status
- `deploymentProgress` — polls deployment, shows step-by-step progress
- `costEstimate` — fetches Azure pricing calculator, shows cost breakdown
- `resourceHealth` — subscribes to Azure Resource Health API

### 4.3 Dual-Entry API Pattern

For every Azure/GitHub API integration:
- **Tool:** `check_deployment_status` — LLM calls it, sees JSON, reasons about next steps
- **Component:** `deploymentStatusCard` — user sees live visual, component polls API
- **System prompt rule:** "Use the tool when you need data to decide. Use the component when showing the user."

### 4.4 Artifact Convention for Dashboard Panel

If we build a Kickstart dashboard panel (like TripNotebook), use filename prefix convention:
- `infra-*` — Infrastructure resources
- `deploy-*` — Deployment status/progress
- `cost-*` — Cost estimates and breakdowns
- `manifest-*` — Generated Bicep/Helm/Dockerfile files
- `auth-*` — Entra/RBAC configuration

### 4.5 State Binding for Multi-Step Flows

Kickstart's 6-phase conversation can use `bind` + `{{state.key}}` for cross-phase data flow:
- Phase 1 (Discover): user picks runtime → `state.runtime`
- Phase 2 (Design): `architectureDiagram` reads `{{state.runtime}}`
- Phase 3 (Generate): manifest templates interpolate `{{state.runtime}}`
- Phase 4 (Review): cost estimate uses `{{state.runtime}}` for pricing

### 4.6 Graceful Degradation Required

Every component that calls an external API must have:
1. Rich interactive mode (API available)
2. Static/cached mode (API slow or intermittent)
3. Link-out mode (API unavailable — "Check in Azure Portal")
4. Error display mode (with actionable message)

## 5. Recommended Kickstart Packs

Based on patterns from both apps:

| Pack | Components | Tools |
|------|-----------|-------|
| `kickstart-azure-pack` | aksClusterStatus, resourceGroup, costEstimate, deploymentProgress | check_cluster, get_pricing, list_resources |
| `kickstart-github-pack` | repoCard, workflowStatus, prCard, codeViewer | create_repo, trigger_workflow, get_file |
| `kickstart-iac-pack` | fileEditor, manifestPreview, architectureDiagram, diffViewer | generate_bicep, generate_helm, validate_k8s |
| `kickstart-auth-pack` | entraAppCard, rbacMatrix, secretsPanel | configure_entra, assign_roles, create_secret |

---

# Decision: Playground JSON Viewer Implementation

**Date:** 2026-04-09  
**Author:** Fry  
**Status:** Implemented  

## Context

Users needed a way to view the raw A2UI JSON behind each scenario in the Playground to understand the structure and learn how to create their own scenarios.

## Decision

Added a tabbed interface to the Playground right panel with "Preview" and "JSON" tabs:

1. **Tab Navigation**: Used Fluent UI React v9 `TabList` and `Tab` components for a consistent, accessible tab interface.

2. **State Management**: 
   - `selectedScenario`: Tracks which scenario is currently active (set when user clicks a scenario)
   - `selectedTab`: Tracks active tab ('preview' | 'json'), defaults to 'preview'

3. **JSON Generation**:
   - For scenarios with `generate()` functions: Call the function and stringify the result
   - For keyword-based scenarios: Call `resetDemoState()` + `getDemoResponse()` to produce real A2UI JSON

4. **Styling Approach**:
   - All styles use Fluent UI tokens (no raw CSS values)
   - Code block uses `tokens.fontFamilyMonospace` for consistency
   - Background uses `colorNeutralBackground3` for subtle contrast
   - Proper spacing with `spacingHorizontalL` and `spacingVerticalM`

5. **Layout Integration**:
   - Tabs header is fixed (flexShrink: 0) to stay visible while scrolling
   - Both tab panels maintain the scrolling behavior from playground.css
   - JSON viewer container has `flex: 1` and `overflow: auto` to fill available space

## Alternatives Considered

1. **Side-by-side split view**: Would have been harder to fit in the already-split layout
2. **Toggle button instead of tabs**: Less discoverable, tabs are more conventional for this use case
3. **Syntax highlighting library**: Decided to keep it simple with monospace font and proper indentation initially; added via separate decision

## Impact

- Users can now inspect the A2UI JSON structure for any scenario
- Helps with learning and debugging
- No breaking changes to existing functionality
- Maintains accessibility through Fluent UI components

---

# Decision: Fluent 2 Polish — Syntax Highlighting, Markdown Control, Component Audit

**Date:** 2026-04-10  
**Decider:** Fry (Frontend Dev)  
**Status:** Implemented

## Context

Ahmed Sabbour identified three UI polish issues in the Kickstart web app:
1. Code blocks lacked syntax highlighting (plain monospace text)
2. No Markdown component for rendering LLM markdown responses with Fluent styling
3. Some controls had slipped Fluent 2 design language (spacing, typography, layout inconsistencies)

These issues affected code readability, content formatting flexibility, and visual consistency.

## Decision

Implemented a three-part polish pass:

### 1. Code Block Syntax Highlighting
- Added `highlight.js` to `CodeBlock.tsx` component
- Registered 10+ common languages (JavaScript, TypeScript, Python, Java, C#, JSON, XML/HTML, CSS, Bash, Markdown)
- Applied VS theme (`highlight.js/styles/vs.css`) to complement Fluent 2 neutral palette
- Used `useMemo` for performance optimization

### 2. Markdown A2UI Component
- Created new `Markdown.tsx` component using `react-markdown` and `remark-gfm`
- All HTML elements styled with Fluent 2 tokens via `makeStyles`
- Code blocks within Markdown delegate to highlight.js
- Registered in `kickstart-catalog.ts` alongside other custom components

### 3. Fluent 2 Component Audit
- Audited all components in `fluent-components/`, `components/`, and `Playground.tsx`
- Fixed violations in Modal.tsx, Icon.tsx, Video.tsx, ProgressSteps.tsx, Playground.tsx
- Replaced inline styles with `makeStyles` classes
- Replaced hardcoded values (px, hex, rgb) with Fluent tokens
- Ensured all spacing/fonts/colors use `tokens.*` references

## Rationale

**Syntax highlighting:** Improves code readability and provides visual hierarchy within code blocks. `highlight.js` chosen for lightweight footprint (190+ languages available) and VS theme chosen for Fluent 2 compatibility.

**Markdown component:** Enables flexible content formatting from LLM responses while maintaining Fluent 2 design system consistency. Using `react-markdown` provides GitHub-flavored markdown support (tables, strikethrough, task lists).

**Component audit:** Ensures visual consistency across the app by enforcing Fluent 2 design language. Using tokens instead of hardcoded values makes theme changes easier and ensures consistency with Microsoft design systems.

## Consequences

**Positive:**
- Code blocks now have professional syntax highlighting
- Markdown content can be rendered with full Fluent 2 styling
- Visual consistency improved across all components
- Design system compliance makes future theme updates easier
- All changes use existing Fluent UI React v9 + A2UI adapter pattern

**Negative:**
- Added two dependencies (`highlight.js`, `react-markdown`, `remark-gfm`)
- Bundle size increased slightly (but build still optimizes to 302 KB gzipped)

## Alternatives Considered

**For syntax highlighting:**
- Prism.js — more plugins but heavier
- Shiki — better accuracy but requires WASM and is slower

**For Markdown:**
- marked.js — smaller but no React integration, harder to style
- Custom markdown parser — too much work for limited benefit

**For audit:**
- Leave inline styles — rejected because it violates Fluent 2 design language
- Create global CSS classes — rejected because `makeStyles` provides better scoping and token integration

## Implementation

- Files changed:
  - `packages/web/src/catalog/components/CodeBlock.tsx` (syntax highlighting)
  - `packages/web/src/catalog/components/Markdown.tsx` (new component)
  - `packages/web/src/catalog/kickstart-catalog.ts` (registration)
  - `packages/web/src/catalog/fluent-components/Modal.tsx` (inline styles removed)
  - `packages/web/src/catalog/fluent-components/Icon.tsx` (hardcoded font size removed)
  - `packages/web/src/catalog/fluent-components/Video.tsx` (inline aspectRatio removed)
  - `packages/web/src/catalog/components/ProgressSteps.tsx` (font family added)
  - `packages/web/src/pages/Playground.tsx` (7 inline styles removed)
- Build verification: `npx vite build` passes with zero errors
- All components follow Fluent 2 audit checklist

---

# Decision: Backend Session ID Bridge Pattern

**Date**: 2026-04-10  
**Author**: Fry (Frontend Dev)  
**Status**: Implemented  

## Context

The LLM had no conversation memory because the frontend and backend used incompatible session ID systems:
- Frontend: `session-{timestamp}-{random}` (generated in `useSessions.ts`)
- Backend: `randomUUID()` (generated in `session-store.ts`)

When the frontend passed its session ID to the backend, it never matched any existing session in the backend's Map, causing a new session to be created for every message. The LLM only saw the system prompt + current message with no history.

## Decision

Introduce a `backendSessionId` field on the `Session` type to bridge the two ID systems:

1. Frontend sessions keep their UI-friendly IDs for localStorage and display
2. Each frontend session tracks its corresponding backend session ID via `backendSessionId?: string`
3. On first message, pass `undefined` to backend → backend creates new session and returns its UUID
4. Capture the backend UUID from the SSE `done` event and store it on the frontend session
5. On subsequent messages, pass the stored `backendSessionId` instead of the frontend ID

## Implementation

- Added `backendSessionId?: string` to `Session` type in `types.ts`
- Updated `StreamCallbacks.onComplete` signature to include `sessionId?: string` parameter
- Modified `useStreaming.ts` to capture `event.sessionId` from SSE responses and pass to `onComplete`
- Updated `useMockStreaming.ts` to match the new callback signature (passes `undefined`)
- Added `updateSession()` method to `useSessions.ts` for updating session metadata
- Modified `App.tsx` to read `backendSessionId` before calling `streaming.send()` and store it on first response

## Consequences

**Positive:**
- LLM now has full conversation history across multiple messages
- Clean separation between UI session IDs and backend session IDs
- No breaking changes to existing session storage format (backendSessionId is optional)

**Neutral:**
- Adds one extra field to session state
- Introduces slight coupling between frontend and backend session models

**Trade-offs:**
- Could have unified to a single ID system, but that would require migrating existing localStorage sessions or changing backend UUID generation
- This approach is minimally invasive and preserves both systems



# Decision: A2UI v0.9 Full Specification Analysis — New Insights

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Research Complete
**Requested by:** Ahmed Sabbour

---

## Context

Read and analyzed the complete A2UI v0.9 specification at https://a2ui.org/specification/v0.9-a2ui/. This supplements prior findings from catalog guides, component reference, agent development guide, and Leela's actions analysis.

## New Findings (beyond prior research)

### F6: Prompt-First Philosophy (Major Design Shift)

v0.9 is explicitly designed to be embedded directly in the LLM prompt — NOT for structured output mode. The spec states: "The LLM is then asked to produce JSON that matches the provided examples and schema descriptions." This requires robust post-generation validation but enables richer, more expressive schemas.

**Impact on Kickstart:** Validates our R3 recommendation (inject schema into system prompt). This is not just a good practice — it's the core design intent of v0.9. Our converse.ts endpoint MUST include the catalog schema in the system prompt.

### F7: Swappable Catalog via $ref Indirection

The envelope schema (`server_to_client.json`) uses `$ref: "catalog.json#/$defs/anyComponent"` — a placeholder filename. To use a custom catalog, you simply map `catalog.json` to your own file. The same envelope schema works with ANY compliant catalog without modification.

**Impact on Kickstart:** Our Kickstart catalog should be a standalone JSON Schema file that can be swapped in as `catalog.json`. Not a wrapper around Basic Catalog — a complete replacement per F1 (No Mappers Needed).

### F8: Client inlineCatalogs Capability

`a2uiClientCapabilities` supports `inlineCatalogs` — the client can send its full catalog definition inline to the server at runtime. This means the client pushes the catalog to the agent dynamically, no hardcoding needed on the server.

**Impact on Kickstart:** We could have the web client announce its Kickstart catalog to the backend, which then includes it in the LLM prompt. This enables catalog versioning without backend redeployment.

### F9: formatString Interpolation System

Rich `${/path}` syntax for inline data binding within strings, with function call nesting: `${formatDate(value:${/currentDate}, format:'yyyy-MM-dd')}`. Supports relative paths in collection scopes.

**Impact on Kickstart:** We're not using formatString at all. This enables dynamic text like "Welcome, ${/user/name}!" or "You have ${/items/length} items" without custom components.

### F10: Button Checks = Auto-Disable

Buttons can define `checks` with compound conditions (`and`, `or`, `not`) that auto-disable the button when conditions fail. Example: "Submit" disabled until terms accepted AND (email OR phone provided).

**Impact on Kickstart:** Form submission gates with zero custom code. LLM can generate self-validating forms natively.

### F11: Prompt-Generate-Validate Loop (Official Pattern)

The spec defines a three-step loop: (1) Prompt with schema + examples, (2) Generate JSON, (3) Validate against schema. On failure, send `VALIDATION_FAILED` error with `code`, `surfaceId`, `path`, and `message` back to LLM for self-correction.

**Impact on Kickstart:** This is exactly what R6 (agent-side validation) should implement. The error format is standardized — we should use it.

### F12: Transport Bindings — A2A, AG-UI, MCP

A2UI officially supports A2A (Agent-to-Agent), AG-UI, MCP, SSE/JSONRPC, WebSocket, and REST as transport layers. The spec provides concrete binding details for A2A (messages map to A2A Part payloads, metadata carries data model and capabilities).

**Impact on Kickstart:** Our current REST approach works fine. Future evolution path: A2A for multi-agent orchestration, or AG-UI for framework integration. Not blocking, but good to know.

### F13: Server Capabilities Advertisement

Servers advertise via `server_capabilities.json` which catalogs they can generate UI for and whether they accept inline catalogs from clients. This is exchanged via transport metadata (Agent Cards in A2A, capabilities in MCP).

**Impact on Kickstart:** When we build the agent endpoint, it should declare: "I support `kickstart` catalog" and "I accept inline catalogs". This enables proper capability negotiation.

### F14: Validator Compliance for Custom Catalogs

Custom catalogs MUST use `ComponentId` type from `common_types.json` for single child references and `ChildList` type for list references. Validators trace structural links by looking for these specific `$ref` types — raw strings are treated as static text.

**Impact on Kickstart:** When building `kickstart_catalog.json`, we must use proper `$ref` types, not raw `"type": "string"` for component ID fields. Otherwise validators won't check parent-child integrity.

### F15: Two-Way Binding is Local-Only

Input components (TextField, CheckBox, Slider, ChoicePicker, DateTimeInput) update the local data model IMMEDIATELY on user interaction. Server sync ONLY happens when an action is dispatched (button click). The data model is reactive — a TextField bound to `/user/name` and a Text also bound to `/user/name` update in real-time as the user types.

**Impact on Kickstart:** Our vendor DataContext class supports this, but we never wire it. Interactive forms should "just work" once we enable data binding — no custom state management needed.

---

## Updated Recommendation Table (cumulative)

| # | Action | Priority | Source |
|---|--------|----------|--------|
| R1 | Create `kickstart_catalog.json` as NATIVE catalog (standalone JSON Schema, not mapping Basic) | P0 | F1, F7, F14 |
| R2 | Change catalogId to URI format | P0 | Prior |
| R3 | Feed catalog schema + few-shot examples to LLM system prompt (prompt-first design) | P0 | F2, F6 |
| R4 | Implement updateDataModel for interactive components | P1 | F5, F15 |
| R5 | Define custom functions in catalog | P1 | Prior |
| R6 | Agent-side validation via jsonschema + VALIDATION_FAILED error format | P1 | F2, F11 |
| R7 | Catalog versioning strategy (consider F8 inlineCatalogs) | P2 | F8 |
| R8 | Graceful degradation + error reporting | P2 | Prior |
| R9 | Wire action handler (replace console.log dead-end) | P0 | Leela G1 |
| R10 | Add backend action endpoint | P0 | Leela G2 |
| R11 | Fix response-processor button schema to proper A2UI ActionSchema | P0 | Leela G3 |
| R12 | Build tool system for LLM (registerTool, executeTool, tool-call loop) | P1 | Leela G4 |
| R13 | Build ServiceConnector + auth (MSAL for Azure, GitHub OAuth) | P1 | Leela G5 |
| R14 | Build pack system (KickstartPack interface) | P1 | Leela G6 |
| R15 | Implement formatString support in renderer | P2 | F9 |
| R16 | Implement button checks / auto-disable | P2 | F10 |
| R17 | Server capabilities advertisement | P2 | F13 |


### 2026-04-09T07:15:00Z: A2UI Catalog Best Practices — Gap Analysis & Recommendations
**By:** Ahmed Sabbour (via Copilot Coordinator)
**Source:** https://a2ui.org/concepts/catalogs/ (reviewed 2026-04-09)

**What:** Our Kickstart catalog implementation has significant gaps compared to A2UI's official catalog best practices. We need a proper catalog JSON Schema, URI-based catalogId, catalog negotiation, validation, data binding, and versioning.

**Gap Analysis:**

| A2UI Best Practice | Our Status | Priority |
|---|---|---|
| Catalog JSON Schema file defining components, props, types, required fields | ❌ Missing — only have runtime TS `Catalog` object | P0 |
| URI-based catalogId (globally unique, stable identifier) | ❌ Using bare string `'kickstart'` | P0 |
| Catalog negotiation (`supportedCatalogIds` in message metadata) | ❌ Not implemented | P1 |
| Agent-side validation (validate LLM output before sending to client) | ❌ None | P1 |
| Client-side schema validation | 🟡 Partial (A2UI web_core basic processing only) | P2 |
| Data binding (`updateDataModel` messages + JSON Pointer bindings) | ❌ Not used anywhere | P1 |
| Custom functions definition in catalog | ❌ None defined | P1 |
| Versioning strategy in catalogId | ❌ None | P2 |
| Graceful degradation (fallback for unknown components) | 🟡 Partial — silently fails | P2 |
| Error reporting (`VALIDATION_FAILED` events back to agent) | ❌ None | P3 |
| Freestanding/self-contained catalog JSON | ❌ N/A (no JSON to make freestanding) | Depends on P0 |
| Composition via `$ref` / `allOf` extending basic catalog | ❌ Not applicable yet | Depends on P0 |

**Recommendations:**

**R1 (P0): Create `kickstart_catalog.json`**
- Define a proper JSON Schema catalog file reflecting our Fluent UI v9 design system
- Include all component definitions: basic catalog components + our custom components (CodeBlock, Markdown, ProgressSteps, FormGroup, RadioGroup) + all 18 Fluent overrides
- Each component schema must define: type, description, properties (with types + descriptions), required fields
- Follow A2UI's recommendation: "build catalogs that directly reflect a client's design system rather than trying to map the Basic Catalog to it through an adapter"
- Use `--extend-basic-catalog` pattern: import all basic catalog components, then add/override with our Fluent implementations
- Location: `packages/web/src/catalog/kickstart_catalog.json` (or a `catalogs/` directory)

**R2 (P0): Use URI-based catalogId**
- Change from `'kickstart'` to `'https://imagine.aks.azure.com/catalogs/kickstart/v1/catalog.json'`
- This URI does NOT need to be fetchable at runtime — it's just a stable identifier
- Update in: `kickstart-catalog.ts`, `playground-scenarios.ts`, `demo-scenarios.ts`, `Playground.tsx`

**R3 (P1): Feed catalog schema to the LLM**
- The catalog JSON Schema is what tells the LLM what components/props are available
- Include it in the system prompt (or as a tool/context) so the LLM generates valid A2UI JSON
- This is the single biggest improvement for LLM output quality — currently it's guessing

**R4 (P1): Implement `updateDataModel` usage**
- Start sending `updateDataModel` messages alongside `updateComponents`
- Use JSON Pointer data bindings (`{ "$data": "/path" }`) in component props instead of hardcoded values
- Enable `sendDataModel: true` on surfaces that need to read user input back
- Critical for: forms, pickers, multi-step flows, smart controls

**R5 (P1): Define custom functions in catalog**
- Functions are the A2UI way to define client-side callable actions
- Define functions for: form submission, navigation, state updates, pack connector calls
- These replace our ad-hoc `action.functionCall` usage

**R6 (P1): Agent-side validation**
- Before sending A2UI JSON to client, validate it against our catalog schema
- On validation failure: attempt to fix/regenerate, or fall back to text
- This catches LLM hallucinated properties and malformed structures

**R7 (P2): Catalog versioning strategy**
- Embed version in URI: `.../kickstart/v1/catalog.json`
- Breaking changes (new containers, removed containers, type changes) → bump major
- Non-breaking changes (new leaf components, optional props) → stay at current version
- Plan for v1 → v2 migration using dual-catalog negotiation

**R8 (P2): Graceful degradation**
- Implement fallback placeholder for unknown components (generic card with component name)
- Text fallback when entire surface fails to render
- Error reporting via `VALIDATION_FAILED` events

**Why:** The catalog JSON is the foundational contract between the LLM and our renderer. Without it, we have no formal component contract, no validation, no negotiation, and the LLM generates A2UI by guessing. This is the single most impactful architectural improvement for Kickstart's A2UI integration quality.

**Decision:** Proceed with R1-R2 (P0) first, then R3-R6 (P1), then R7-R8 (P2). The catalog JSON unblocks everything else.


### 2026-04-09T07:20:00Z: A2UI "Defining Your Own Catalog" guide + Agent Development findings
**By:** Ahmed Sabbour (via Copilot research)
**Status:** Accepted — augments prior catalog best practices decision
**References:** https://a2ui.org/guides/defining-your-own-catalog/, https://a2ui.org/reference/components/, https://a2ui.org/guides/agent-development/

#### New Findings (beyond prior gap analysis)

**F1: "No Mappers Needed" principle**
The official guide explicitly states: "It is recommended to build catalogs that directly reflect your client's design system rather than trying to map a generic catalog (like the Basic Catalog) to it through an adapter." We are currently doing the opposite — overriding Basic Catalog components with Fluent UI wrappers. Recommendation: define a Kickstart-native catalog JSON Schema where components ARE our Fluent-based implementations, not mapped from generic ones.

**F2: Agent Development — Concrete LLM Integration Pattern**
The agent development guide shows exactly how to feed A2UI to an LLM:
- Inject the full A2UI JSON Schema into the system prompt as `A2UI_SCHEMA`
- Add few-shot UI template examples (`RESTAURANT_UI_EXAMPLES` pattern) for in-context learning
- Use a `---a2ui_JSON---` delimiter — LLM outputs conversational text first, then raw JSON list of A2UI messages
- Parse and validate the JSON against the schema using `jsonschema.validate()` before sending to client
- This directly maps to our R3 (feed schema to LLM) and R6 (agent-side validation)

**F3: v0.9 Component Syntax Confirmed**
Full v0.9 component reference confirms flat syntax we should use:
- `"component": "Text"` (not nested `"component": { "Text": { } }`)
- Direct string values (not `{ "literalString": "..." }`)
- `variant` instead of `usageHint`
- `justify`/`align` instead of `distribution`/`alignment`
- `ChoicePicker` instead of `MultipleChoice`
- Actions use `{ "event": { "name": "..." } }` format

**F4: Security Requirements**
- Allowlist components: only register trusted components
- Validate properties: ensure agent messages match expected type constraints
- Sanitize text: avoid rendering un-sanitized content from agent

**F5: Data Binding Pervasive in Interactive Components**
Every interactive component (TextField, CheckBox, Slider, ChoicePicker, DateTimeInput) uses `{ "path": "/data/field" }` for data binding. This reinforces R4 (implement updateDataModel) — without it, none of these components can read/write state.

#### Updated Recommendation Priority

| # | Action | Priority | New insight |
|---|--------|----------|-------------|
| R1 | Create `kickstart_catalog.json` as native catalog (NOT mapping Basic Catalog) | P0 | F1 changes approach — direct catalog, not override |
| R3 | Feed schema + few-shot examples to LLM using delimiter pattern | P0 (bumped) | F2 provides concrete implementation pattern |
| R6 | Agent-side validation via jsonschema before sending to client | P1 | F2 confirms this is standard practice |
| R4 | Implement updateDataModel for all interactive components | P1 | F5 — every input component requires it |

R2, R5, R7, R8 unchanged from prior decision.


# Decision: A2UI Actions System Analysis — Gap Analysis & Implementation Path

**Author:** Leela (Lead)
**Date:** 2025-07-26
**Status:** Analysis Complete
**Requested by:** Ahmed Sabbour

---

## 1. A2UI Action Model Summary

A2UI v0.9 provides a two-tier action system designed for security-first, sandboxed UI interaction:

### 1.1 Events (Agent-Side)

Events dispatch user interactions to the backend agent for processing. They carry:

| Field | Description |
|-------|-------------|
| `name` | Stable identifier the agent switches on (e.g., `submit_reservation`) |
| `surfaceId` | Which surface originated the event |
| `sourceComponentId` | Which component triggered it |
| `timestamp` | ISO 8601 timestamp |
| `context` | Key-value map with resolved data model paths |

Events are the primary mechanism for user→agent communication. The renderer resolves all `path` references against the local data model before dispatch, so the agent receives fully resolved values.

### 1.2 Functions (Local/Renderer)

Functions execute locally without a network round-trip. The agent is NOT informed. Limited to:

- `openUrl` — opens a URL in new window
- Validation checks (`required`, `regex`, `length`, `numeric`, `email`)
- Arithmetic, comparison, logic, string operations, formatting

Functions act as a sandboxed execution layer — no arbitrary code injection possible.

### 1.3 Data Model & State

- **Write Contract:** Input components write to the local data model synchronously. No race conditions between typing and clicking.
- **Data Model Sync:** When `sendDataModel: true`, the renderer attaches the FULL data model to every outgoing message. Agent becomes stateless — receives complete UI state with each interaction.
- **Checks:** Client-side validation rules that auto-disable buttons when conditions fail. UX-only; data integrity validated agent-side.

### 1.4 Transport & Security

- Transport-agnostic (A2A, WebSockets)
- Sandboxed execution — agents can only trigger pre-registered behaviors
- Surface ownership pattern for multi-agent orchestration
- Data model isolation enforced by orchestrator (data from surface A never leaks to agent B)
- Error reporting: `VALIDATION_FAILED` errors flow from renderer→agent for self-correction

### 1.5 What A2UI Does NOT Provide

- No tool/function-calling system for LLM inference
- No service pack bundling (components + prompts + tools + auth)
- No external API bridging
- No artifact storage
- No auth token management
- No dynamic system prompt injection
- No multi-step workflow orchestration beyond event→response cycles

---

## 2. Gap Table: A2UI Native vs adaptive-ui-framework vs Kickstart

| Capability | A2UI v0.9 Native | adaptive-ui-framework | Kickstart Current |
|---|---|---|---|
| **Event→Agent dispatch** | ✅ Full (`action.event` → `client_to_server.json`) | ✅ `handleAction()` in AdaptiveProvider | ⚠️ Vendor code works, but handler only `console.log`s — dead end |
| **Local functions** | ✅ `openUrl`, validation, math/string ops | ✅ Same + custom via interpolation | ✅ Vendor basic functions available |
| **Action types** | 2 (event, functionCall) | 5 (sendPrompt, setState, navigate, submit, custom) | 0 implemented (buttons use non-standard `action: "reply"`) |
| **State binding** | ✅ JSON Pointers, DataModel, Signals | ✅ `{{state.key}}` interpolation, `bind` prop | ⚠️ DataModel class exists in vendor, not wired to app state |
| **Data Model Sync** | ✅ `sendDataModel: true` sends full state | N/A (uses state store directly) | ❌ Not configured |
| **Form submission** | ✅ Local write → event with resolved context | ✅ `submit` action serializes state to prompt | ❌ No form→backend pipeline |
| **Client validation** | ✅ Checks with auto-disable | ✅ Validation rules on inputs | ⚠️ Vendor code supports it, no components use it |
| **Action→Backend endpoint** | Spec only (transport-agnostic) | ✅ `sendPrompt()` → LLM adapter | ❌ No action endpoint. Only `/api/converse` for chat |
| **Tool system (LLM calls)** | ❌ Not in scope | ✅ `registerTool()`, tool-call loop, `fetch_webpage`, `azure_arm_get`, `github_api_get` | ❌ None |
| **Service packs** | ❌ Not in scope | ✅ `ComponentPack` (components + systemPrompt + tools + skills + settings) | ❌ None |
| **Auth/ServiceConnector** | ❌ Not in scope | ✅ `entra-auth.ts` (MSAL), GitHub OAuth, per-pack settings | ❌ None |
| **Knowledge skills** | ❌ Not in scope | ✅ `resolveSkills()` — dynamic prompt injection per pack | ❌ None |
| **Artifact store** | ❌ Not in scope | ✅ `artifacts.ts` — typed extraction, session-scoped | ❌ None |
| **Custom action dispatch** | ❌ (events are the mechanism) | ✅ `onCustomAction` callback for host app | ❌ None |
| **Disabled context (past turns)** | ❌ Not in scope | ✅ `DisabledScope` — components skip side effects | ❌ None |
| **Auto-continue** | ❌ Not in scope | ✅ LLM adapter re-invokes on phase transitions | ❌ None |
| **Error self-correction** | ✅ `VALIDATION_FAILED` → agent retry | ❌ Not implemented | ❌ Not implemented |
| **Orchestration routing** | ✅ Surface ownership pattern | N/A (single-agent) | ❌ Not needed yet |

---

## 3. Critical Gaps in Kickstart

### G1: Action Dead-End (CRITICAL)

`useA2UI.ts` line 23-25:
```ts
(action) => {
  console.log('[A2UI] action:', action);
}
```

A2UI events fire from components, bubble through `ComponentContext → SurfaceModel → SurfaceGroupModel → MessageProcessor`, and then... nothing. The action handler is a console.log. No backend communication, no state updates, no prompt generation.

**Impact:** Every interactive component (buttons, forms, pickers) in our catalog is decorative. User clicks produce no effect.

### G2: No Action Endpoint

`converse.ts` accepts `{ sessionId, message }` — a chat message. There is no endpoint for structured A2UI action events. No way to send `{ action: { name, surfaceId, context } }` back to the backend.

### G3: Hybrid Action Model Mismatch

`response-processor.ts` generates buttons with `action: "reply", data: { text: "..." }` — this is NOT the A2UI ActionSchema. It's a custom format that doesn't go through `dispatchAction()`. It's a separate code path that bypasses the entire A2UI action infrastructure.

### G4: No Tool System

The LLM has no tools. It can't query Azure ARM, check GitHub repos, validate K8s manifests, or fetch documentation. adaptive-ui-framework's power comes from tools being available during LLM inference — the LLM decides whether to call `azure_arm_get` or `github_api_get` before generating its UI response.

### G5: No Service Layer

No `ServiceConnector` for managing auth tokens. No CORS proxy. No way for components to make authenticated API calls to Azure or GitHub.

### G6: No Pack System

Components, prompts, tools, and auth are not bundled. When we add an Azure pack, there's no mechanism to register its tools, inject its system prompt, or wire its auth.

---

## 4. Recommended Implementation Path

### Phase 1: Wire the Action Loop (2-3 days)

**Goal:** Make A2UI events produce actual effects.

1. **Implement action handler in `useA2UI.ts`** that maps A2UI event names to behaviors:
   - `sendPrompt` events → call `converse()` with the event context as a structured message
   - `setState` events → update the data model locally
   - `navigate` events → `window.location.href`
   - All other events → serialize to a prompt: `"User triggered action: {name} with context: {JSON.stringify(context)}"`

2. **Add action endpoint to backend** — extend `converse.ts` or create new `/api/action` endpoint that accepts `A2uiClientAction` payloads. Convert them to LLM messages like adaptive-ui does:
   ```ts
   const query = `User action "${action.name}" with context: ${JSON.stringify(action.context)}`;
   ```

3. **Fix response-processor.ts** — stop generating non-standard `action: "reply"` buttons. Use proper A2UI ActionSchema: `{ event: { name: "select-runtime", context: { value: "Node.js" } } }`.

4. **Enable DataModel Sync** — set `sendDataModel: true` on surface creation. Include data model in action payloads.

**Maps to ServicePack:** This is the foundation. Without a working action loop, no ServicePack can function.

### Phase 2: Tool System (3-4 days)

**Goal:** LLM can call external APIs during inference.

1. **Port `tools.ts` pattern from adaptive-ui-framework** — `registerTool()`, `executeTool()`, tool-call loop.
2. **Implement tool-call loop in `converse.ts`** — when LLM returns `tool_calls`, execute them server-side, send results back, continue until LLM produces final response.
3. **Register initial tools:** `fetch_webpage` (documentation), `azure_arm_get` (ARM queries), `github_api_get` (repo info).

**Maps to ServicePack:** Tools are a ServicePack export. Each pack registers its tools via `pack.tools`.

### Phase 3: ServiceConnector + Auth (3-4 days)

**Goal:** Components can make authenticated API calls.

1. **Build ServiceConnector abstraction** — React Context providing `getToken(scope)` per service (Azure, GitHub).
2. **Wire MSAL for Azure** — `entra-auth.ts` already exists in adaptive-ui-framework, port it.
3. **Wire GitHub OAuth** — device flow + PAT fallback.
4. **CORS proxy** — SWA API function that proxies authenticated requests to Azure ARM / GitHub API.

**Maps to ServicePack:** ServiceConnector is the R02 gap from our prior pack architecture decision. It's the foundation stone — once connectors exist, fat components can register and orchestrator can wire tools.

### Phase 4: Pack System (2-3 days)

**Goal:** Bundled component packs with prompts, tools, auth, and skills.

1. **Define `KickstartPack` interface** — mirrors adaptive-ui-framework's `ComponentPack` but with A2UI component registration:
   ```ts
   interface KickstartPack {
     name: string;
     components: ReactComponentImplementation[];
     systemPrompt: string;
     tools?: ToolDefinition[];
     resolveSkills?: (prompt: string) => Promise<string | null>;
     serviceConnector?: ServiceConnectorConfig;
   }
   ```

2. **Register packs at app startup** — auto-inject system prompts, register tools, wire auth.
3. **Build initial packs:** `azure-pack`, `github-pack`, `iac-pack`.

**Maps to ServicePack:** This IS the ServicePack architecture from decision `leela-pack-architecture.md`. Phase 4 makes it real.

### Phase 5: Rich Interactions (2-3 days)

**Goal:** Approach adaptive-ui-framework's interaction depth.

1. **Custom action handler** — `onCustomAction` for pack-specific actions (deploy, validate, create-repo).
2. **Artifact extraction** — walk A2UI component tree after each response, extract structured data.
3. **Auto-continue** — when phase engine detects transition, auto-invoke next LLM turn.
4. **Disabled context** — past-turn components become read-only, skip API calls.

---

## 5. Architecture Mapping: A2UI Actions → ServicePack

| A2UI Concept | ServicePack Mapping | Implementation |
|---|---|---|
| `action.event` | Pack event handler | Action handler in `useA2UI.ts` routes by event name to pack-specific logic |
| `action.functionCall` | Local functions from pack catalog | Registered via pack's component catalog |
| `DataModel` + JSON Pointers | Pack state namespace | Each pack gets a `/packName/*` prefix in the data model |
| `sendDataModel` | State sync for tools | Tool calls receive current data model for context |
| `checks` | Pack validation rules | Client-side validation per pack's component schemas |
| `surfaceId` | Pack surface ownership | Each pack creates surfaces with `{packName}-{surfaceType}` IDs |
| Error reporting | Self-correction loop | Validation errors → re-prompt LLM with error context |

### Key Insight: A2UI Events ARE the ServicePack Action Bus

A2UI's event system (`action.event.name` + `action.event.context`) is exactly the primitive we need. The gap is that we're not USING it. The event name becomes the action type, the context becomes the payload, and the action handler becomes the router to pack-specific logic:

```
Component fires event → A2UI dispatchAction → MessageProcessor actionHandler
  → Router: "deploy" → azure-pack handler → calls ARM API
  → Router: "select-runtime" → sends structured prompt to LLM
  → Router: "approve-arch" → updates state + triggers next phase
```

This is architecturally identical to adaptive-ui-framework's `handleAction` switch, but using A2UI's native event plumbing instead of a custom action object.

---

## 6. Estimated Timeline

| Phase | Effort | Depends On | ServicePack Alignment |
|-------|--------|------------|----------------------|
| Phase 1: Wire Action Loop | 2-3 days | Nothing | Foundation |
| Phase 2: Tool System | 3-4 days | Phase 1 | Pack tool registration |
| Phase 3: ServiceConnector | 3-4 days | Phase 1 | R02 gap closure |
| Phase 4: Pack System | 2-3 days | Phases 2+3 | Full ServicePack |
| Phase 5: Rich Interactions | 2-3 days | Phase 4 | Pack capabilities |
| **Total** | **~12-17 days** | | |

Phase 1 is the critical path. Everything else builds on a working action loop.

---

## 7. Summary

A2UI provides the right primitives for rich interaction — events, data binding, validation, sandboxed functions. What it doesn't provide (tools, packs, auth, artifacts) is exactly what adaptive-ui-framework adds on top. Our Kickstart implementation has the A2UI vendor code properly wired for action dispatch, but the app layer treats it as a dead end (console.log). The fix is straightforward: wire the action handler to a router, add a backend action endpoint, and build up from there to tools, auth, and packs. The ServicePack architecture we already decided on maps cleanly to A2UI events as the action bus.



# Decision: A2UI Implementation Patterns — Concrete Code References

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Reference Material
**Requested by:** Ahmed Sabbour
**Sources:**
- https://a2ui.org/guides/defining-your-own-catalog
- https://a2ui.org/guides/agent-development/#generating-a2ui-messages

---

## 1. Custom Catalog Implementation Steps (from Defining Your Own Catalog guide)

The official guide prescribes 5 steps for custom catalogs:

1. **Define the Catalog**: Create a JSON Schema listing components, functions, and styles
2. **Register the Catalog**: Register catalog + component implementations (renderers) with client
3. **Announce Support**: Client informs agent via `supportedCatalogIds` in capabilities metadata
4. **Agent Selects Catalog**: Agent chooses catalog via `catalogId` in `createSurface`
5. **Agent Generates UI**: Agent generates messages using catalog component names

### Key Principle: "No Mappers Needed"
> "It is recommended to build catalogs that directly reflect your client's design system rather than trying to map a generic catalog (like the Basic Catalog) to it through an adapter."

**What this means for Kickstart:** Our current approach of composing `basicCatalog + fluentOverrides + customComponents` in `kickstart-catalog.ts` is explicitly against the recommended pattern. We should create a standalone `kickstart_catalog.json` that directly defines our Fluent UI React v9 components — NOT override/map the Basic Catalog.

### Security Requirements
1. **Allowlist components** — Only register trusted components in catalog definition
2. **Validate properties** — Always validate component properties from agent messages match expected types
3. **Sanitize text** — Avoid rendering un-sanitized agent content unless safe bounds established

---

## 2. Agent Development — Generating A2UI Messages (Concrete Pattern)

The agent development guide provides the exact implementation pattern for LLM → A2UI generation.

### Step 1: Import the Schema
```python
from .a2ui_schema import A2UI_SCHEMA  # The full JSON Schema for A2UI messages
```

### Step 2: Construct System Prompt with Schema + Examples
```python
RESTAURANT_UI_EXAMPLES = """
# (few-shot examples of valid A2UI JSON for in-context learning)
"""

A2UI_AND_AGENT_INSTRUCTION = AGENT_INSTRUCTION + f"""
Your final output MUST be a a2ui UI JSON response.

To generate the response, you MUST follow these rules:
1. Your response MUST be in two parts, separated by the delimiter: `---a2ui_JSON---`.
2. The first part is your conversational text response.
3. The second part is a single, raw JSON object which is a list of A2UI messages.
4. The JSON part MUST validate against the A2UI JSON SCHEMA provided below.

--- UI TEMPLATE RULES ---
Follow these rules to select the appropriate UI template:
{RESTAURANT_UI_EXAMPLES}

---BEGIN A2UI JSON SCHEMA---
{A2UI_SCHEMA}
---END A2UI JSON SCHEMA---
"""
```

### Step 3: Parse and Validate Output
```python
# 1. Parse the JSON (split on ---a2ui_JSON--- delimiter)
parsed_json_data = json.loads(json_string_cleaned)

# 2. Validate against A2UI_SCHEMA
jsonschema.validate(instance=parsed_json_data, schema=self.a2ui_schema_object)
```

### What Kickstart Needs to Implement

**In `converse.ts` (backend):**
1. Load our `kickstart_catalog.json` schema
2. Inject it into the LLM system prompt using the `---BEGIN A2UI JSON SCHEMA---` / `---END A2UI JSON SCHEMA---` delimiters
3. Add few-shot examples of valid Kickstart A2UI JSON between `--- UI TEMPLATE RULES ---` markers
4. Use `---a2ui_JSON---` as the delimiter between conversational text and A2UI JSON

**In `response-processor.ts` (backend):**
1. Split LLM response on `---a2ui_JSON---` delimiter
2. Parse the JSON portion
3. Validate against our catalog schema (use `ajv` or similar for JSON Schema validation in TypeScript)
4. On validation failure, send `VALIDATION_FAILED` error back to LLM for self-correction
5. On success, stream the A2UI messages to the client

**This replaces our current approach** where response-processor.ts manually constructs A2UI components from LLM markdown. Instead, the LLM generates the A2UI JSON directly — we just validate and pass through.

---

## 3. Impact on Current Architecture

### Current Flow (Broken)
```
User → converse.ts → LLM (no schema awareness) → markdown text
  → response-processor.ts manually constructs A2UI components
  → Client renders
```

### Target Flow (Per A2UI Spec)
```
User → converse.ts → LLM (with catalog schema + examples in prompt)
  → text + ---a2ui_JSON--- + A2UI JSON list
  → response-processor.ts validates JSON, passes through
  → Client renders native catalog components
```

The key shift: **LLM generates A2UI JSON directly** instead of us post-processing markdown into components. This is more reliable, supports the full component catalog, and enables the prompt-generate-validate loop the spec prescribes.

# Decision: A2UI Official Sample Implementation Analysis

**Author:** Copilot (Coordinator)
**Date:** 2025-07-26
**Status:** Research Finding
**Requested by:** Ahmed Sabbour
**Sources:**
- https://github.com/google/A2UI/tree/main/samples/agent/adk/restaurant_finder
- https://github.com/google/A2UI/tree/main/samples/agent/adk/contact_lookup
- https://github.com/google/A2UI/tree/main/samples/agent/adk/rizzcharts

---

## Summary

Analyzed all three official A2UI ADK sample implementations. Found two distinct agent architectures and seven new findings (F16-F22) with direct impact on Kickstart's implementation approach.

## Two A2UI Agent Architectures

### Pattern 1: Prompt-Inject + Validate (restaurant_finder, contact_lookup)
- Schema + few-shot examples injected into LLM system prompt via `A2uiSchemaManager.generate_system_prompt()`
- LLM generates A2UI JSON inline in text output, wrapped in `A2UI_OPEN_TAG`/`A2UI_CLOSE_TAG` tags
- Backend parses response, validates with `jsonschema`, retries on failure (max_retries=1)
- Uses `BasicCatalog.get_config()` — no custom catalog
- Both v0.8 and v0.9 supported with separate runners per version

### Pattern 2: Tool-Based (rizzcharts) ⭐ RECOMMENDED FOR KICKSTART
- LLM calls `send_a2ui_json_to_client` TOOL with A2UI JSON as argument
- Schema/examples loaded into session state (not prompt) by executor at setup time
- Toolset reads schema from session state, validates JSON, returns error as tool response
- Uses `CatalogConfig.from_path()` for CUSTOM catalog + BasicCatalog as fallback
- `BuiltInPlanner` with `ThinkingConfig` enables reasoning before UI generation
- `include_schema=False, include_examples=False` in system prompt — toolset handles it

## New Findings

### F16: Two A2UI Agent Architectures
**What:** Google's official samples demonstrate two distinct patterns for A2UI generation: (1) prompt-inject where the LLM outputs A2UI in text, and (2) tool-based where the LLM calls a function with A2UI JSON.
**Impact:** The tool-based pattern (rizzcharts) is more reliable for OpenAI models because:
- Structured output via function calling (no text parsing needed)
- Validation happens in tool — error goes back as natural tool response
- LLM reasoning is separate from A2UI output
- More compatible with OpenAI's function calling / Responses API
**Recommendation:** Adopt tool-based pattern for Kickstart. Define a `render_ui` function/tool that accepts A2UI JSON, validates it, and streams to client.

### F17: Actions = Re-Prompt LLM (All Three Samples)
**What:** ALL three samples handle user button clicks by translating the action into natural language and re-prompting the LLM. Example from restaurant_finder agent_executor.py:
- `"book_restaurant"` action → `"USER_WANTS_TO_BOOK: {restaurant_name}, Address: {address}, ImageURL: {image_url}"`
- `"submit_booking"` action → `"User submitted a booking for {restaurant_name} for {party_size} people at {reservation_time}..."`
**Impact:** This is fundamentally different from our adaptive-ui-framework approach (direct action dispatch to handlers). In A2UI, the LLM stays in full control of ALL state transitions. No separate action handlers needed.
**Recommendation:** For Kickstart, convert button click events to conversation messages. The LLM decides what happens next based on the action context. This aligns perfectly with our conversation-driven architecture.

### F18: Custom Catalog is Self-Contained (rizzcharts)
**What:** Rizzcharts' custom catalog (~35KB JSON Schema) includes ALL basic catalog components (Text, Image, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, etc.) PLUS custom components (Chart, GoogleMap, Canvas). It is NOT a delta/extension — it's a full standalone catalog.
**Impact:** Confirms R1 (create kickstart_catalog.json as native catalog). Our catalog must define ALL components we want the LLM to use, not just custom ones.
**Components in rizzcharts catalog:** Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Modal, Divider, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, Canvas, Chart, GoogleMap
**Recommendation:** Our kickstart_catalog.json should include: all Fluent UI components we support + custom Kickstart components (AzureResourcePicker, GitHubRepoPicker, DeploymentStatus, CostEstimate, etc.)

### F19: Canvas Component = Side Panel Pattern
**What:** The rizzcharts catalog defines a `Canvas` component described as: "Renders the UI element in a stateful panel next to the chat window." Used as root component for surfaces that should appear alongside (not inline with) the conversation.
**Impact:** This is exactly what we need for file editor, architecture diagrams, cost estimates — content that persists alongside the chat. The Canvas pattern provides a spec-compliant way to implement our split-pane playground layout.
**Recommendation:** Include a `Canvas` (or `Panel`) component in kickstart_catalog.json for side-panel rendering. Map to our existing split-pane layout.

### F20: Multi-Catalog Support
**What:** Rizzcharts registers BOTH its custom catalog AND the basic catalog simultaneously:
```python
catalogs=[
    CatalogConfig.from_path(name="rizzcharts", ...),
    BasicCatalog.get_config(version=version, ...),
]
```
Agent selects catalog based on client `supportedCatalogIds` capability.
**Impact:** We can support multiple catalogs — a rich Kickstart catalog for our app, plus basic catalog as fallback for simpler clients.
**Recommendation:** Register kickstart_catalog + basic_catalog. Use kickstart_catalog by default, fall back to basic_catalog for external/third-party clients.

### F21: SendA2uiToClientToolset Pattern (rizzcharts)
**What:** Instead of parsing A2UI from text output, rizzcharts uses `SendA2uiToClientToolset` — the LLM calls `send_a2ui_json_to_client` as a tool/function:
```python
tools=[
    get_store_sales,
    get_sales_data,
    SendA2uiToClientToolset(
        a2ui_catalog=self._a2ui_catalog_provider,
        a2ui_enabled=self._a2ui_enabled_provider,
        a2ui_examples=self._a2ui_examples_provider,
    ),
]
```
The toolset:
- Reads catalog schema from session state (via providers)
- Validates the A2UI JSON the LLM passes as argument
- Returns validation errors as tool response (natural retry)
- Streams validated A2UI to client
**Impact:** This is the cleanest integration pattern. For Kickstart with OpenAI, we define `render_ui` as a function in the Responses API. The LLM calls it with A2UI JSON. Our backend validates and streams.
**Recommendation:** Implement a `render_ui` tool/function for our converse.ts endpoint. LLM calls it to send UI. We validate and stream. This replaces our current response-processor.ts manual construction.

### F22: Session State for A2UI Context
**What:** Rizzcharts' executor injects A2UI metadata into session state at runtime:
```python
state_delta={
    _A2UI_ENABLED_KEY: True,
    _A2UI_CATALOG_KEY: a2ui_catalog,
    _A2UI_EXAMPLES_KEY: examples,
}
```
The toolset reads from session state when the LLM calls it — catalog and examples are available dynamically, not baked into the system prompt.
**Impact:** Decouples A2UI setup from prompt construction. The system prompt stays lean (role + workflow + UI description). Schema/examples are injected at runtime based on client capabilities negotiation.
**Recommendation:** For Kickstart, store catalog schema and examples in conversation context (or session state). The render_ui tool reads them when called. System prompt only needs role description, workflow rules, and UI template rules.

## Architecture Comparison: Current vs Target

### Current Flow (Broken)
```
User → converse.ts → LLM (no schema, no tools) → markdown text
  → response-processor.ts manually constructs A2UI components
  → Client renders (actions → console.log dead-end)
```

### Target Flow (Per Rizzcharts Pattern)
```
User → converse.ts → LLM (with render_ui tool + data tools)
  → LLM calls render_ui(a2ui_json) ← validated by tool
  → Stream A2UI messages to client
  → Client renders → user clicks → action → translate to NL → re-prompt LLM
```

### Key Architectural Shifts
1. **LLM generates A2UI directly** via tool call (not post-processing markdown)
2. **Actions re-prompt LLM** (not direct dispatch to handlers)
3. **Catalog schema as tool context** (not in system prompt)
4. **Validation in tool** (not in response processor)
5. **Multiple tools** — data tools (Azure, GitHub APIs) + render_ui tool (A2UI output)

## Updated Cumulative Recommendations

| ID | Priority | Recommendation | Updated By |
|----|----------|---------------|------------|
| R18 | P0 | Implement `render_ui` tool/function for LLM to output A2UI JSON (tool-based pattern from rizzcharts) | F16, F21 |
| R19 | P0 | Convert action events to conversation messages and re-prompt LLM (action re-prompting pattern from all 3 samples) | F17 |
| R20 | P1 | Include Canvas/Panel component in kickstart_catalog for side-panel rendering | F19 |
| R21 | P1 | Register multi-catalog (kickstart + basic) with capability-based selection | F20 |
| R22 | P2 | Store catalog schema/examples in session state, not system prompt | F22 |

Note: R18 supersedes R3 (feed catalog to system prompt) and R10 (add backend action endpoint). The tool-based pattern is cleaner than both.
Note: R19 supersedes R9 (wire action handler) and R11 (fix button schema). Actions become conversation messages, not dispatched events.
# Decision: Playground Gallery Layout Redesign

**Date**: 2026-01-XX  
**Decider**: Fry (Frontend Dev)  
**Status**: Implemented  

## Context

The A2UI Playground had a traditional split-pane layout (left: scenario explorer accordion, right: rendered output). This required users to click individual scenarios one-at-a-time to preview them. The A2UI Composer gallery (https://a2ui-composer.ag-ui.com/gallery) demonstrated a superior pattern: all scenarios visible simultaneously in a masonry card grid.

## Decision

**Redesign the Playground as a masonry card gallery** where ALL scenarios render as live A2UI previews in a responsive grid. Add Gallery/Create tabs for viewing vs. authoring. Replace accordion navigation with search/filter.

## Rationale

1. **Discoverability**: Users see all 23 scenarios at once — no need to expand accordions or guess which category contains what they need.
2. **Visual scanning**: Masonry grid allows quick visual comparison of components side-by-side.
3. **Responsive design**: Multi-column layout adapts to viewport width (1-4 columns).
4. **Reduced clicks**: No more "click scenario → wait for render → click another scenario" loop.
5. **Modern UX**: Gallery pattern matches expectations from component libraries (Storybook, Fluent UI docs, A2UI Composer).

## Implementation Details

### Gallery View
- **Masonry grid**: CSS `column-count` with responsive breakpoints (640px → 2 cols, 1024px → 3 cols, 1280px → 4 cols).
- **GalleryCard component**: Each card has isolated A2UI state (`useA2UI()` instance per card). Surfaces generated on mount via `useMemo()`. Wrapped in `React.memo()` for performance.
- **Card styling**: Fluent UI tokens only — no hardcoded values. Uses `colorNeutralBackground1` (80% opacity), `borderRadiusXLarge`, `shadow4` → `shadow8` hover effect.
- **Click behavior**: Opens Fluent UI `Dialog` with full-size preview + JSON tab.

### Create Tab
- Moved custom JSON editor from accordion to separate tab.
- Rendered surfaces display below editor as stacked cards.
- "Clear All" button visible only on Create tab.

### Search/Filter
- `SearchBox` in top bar filters scenarios by label/description.
- Count badge updates dynamically.

### Removed
- Accordion navigation (left sidebar)
- Activity log
- "Load All" button
- Split-pane CSS

## Consequences

**Positive**:
- 23 live A2UI surfaces render simultaneously — showcases full component library at a glance.
- Faster scenario exploration — no navigation overhead.
- Responsive design handles mobile → desktop viewports.
- Search enables quick lookup by keyword.

**Negative**:
- Initial render cost: 23 `useA2UI()` instances + surface generation on mount. Mitigated by `React.memo()` and `useMemo()`.
- More DOM nodes: each card has its own A2UI surface tree. Performance acceptable for 23 scenarios.

**Neutral**:
- Removed activity log (previously tracked scenario injection history). Not critical for gallery UX.

## Files Changed

- `packages/web/src/pages/Playground.tsx` — Major rewrite (~350 lines)
- `packages/web/css/playground.css` — Replaced split-pane with masonry grid

## Build Verification

```
npx vite build
✓ 2826 modules transformed
✓ built in 9.33s
```

Zero TypeScript errors. 301 KB gzipped bundle (unchanged).

## Future Considerations

- **Lazy loading**: If scenario count grows beyond 50, consider virtualizing the gallery or lazy-loading cards outside viewport.
- **URL state**: Add ?scenario={id} query param to deep-link to specific scenario dialogs.
- **Keyboard navigation**: Add arrow key navigation for gallery cards (a11y improvement).
# Decision: Naming Abstractions for ServiceConnector and ServicePack

**Date**: 2026-01-XX  
**Decider**: Leela (Lead)  
**Related Issues**: B-10, B-11  
**Status**: Proposed  

## Context

Two core abstractions in the Kickstart auth/integration layer currently have generic names that don't convey their purpose:

1. **ServiceConnector (B-11)**: Authenticated API client adapter. Handles auth tokens, MSAL + GitHub OAuth flows, CORS proxying, and request lifecycle. Isolates auth/API concerns from the A2UI data model. Deployed as a React Context provider.

2. **ServicePack (B-10)**: Composable integration module. Bundles related components + tools + prompts + auth config into a registerable unit (like a plugin). Example: "Azure pack" = AzureLoginCard + AzureResourcePicker + azure_arm_get tool + Azure prompts.

## Naming Candidates

### ServiceConnector → API Client Adapter Options

| Option | Rationale |
|--------|-----------|
| **APIClient** | Direct, clear. Conveys the core responsibility (API client). TypeScript fits: `interface APIClient {}`. Drawback: Slightly generic; doesn't hint at auth handling. |
| **AuthGateway** | Emphasizes auth token management and request filtering. Suggests a "gate" that all outbound calls pass through. TypeScript fits: `class AuthGateway {}`. Drawback: Less clear this is an API client. |
| **ServiceConnector** | Existing name. Hints at "service" connectivity but doesn't clarify *what* kind of service or *how* connectivity works. |
| **APIBridge** | Implies bridging between local UI (A2UI) and external services (Azure, GitHub). "Bridge" suggests abstraction layer. TypeScript fits: `interface APIBridge {}`. Drawback: Bridge is somewhat overloaded in architecture. |
| **RemoteServiceClient** | Explicitly "remote" (external) + "service" (Azure ARM, GitHub, pricing APIs) + "client" (makes requests). Verbose but precise. TypeScript fits: `class RemoteServiceClient {}`. Drawback: Long name for daily use. |
| **AuthenticatedServiceAdapter** | Full clarity: "authenticated" (handles tokens), "service" (Azure/GitHub/etc), "adapter" (bridges to A2UI). TypeScript fits: `interface AuthenticatedServiceAdapter {}`. Drawback: Very long; not ergonomic. |

**Top Pick: `APIClient`**  
*Rationale:* Shortest, clearest intent. "API" immediately signals external service communication; the "client" part is standard terminology. Auth token management is an implementation detail that doesn't need to be in the name (auth is always assumed for client libs in this context). Clean in code: `const client = new APIClient(); await client.getResources(...)`.

---

### ServicePack → Integration Module Options

| Option | Rationale |
|--------|-----------|
| **IntegrationKit** | "Kit" suggests a bundle of pre-assembled pieces (components + tools + prompts). Conveys "ready to plug in". TypeScript fits: `interface IntegrationKit {}`. Drawback: "Kit" feels slightly informal/product marketing. |
| **CapabilityModule** | "Capability" emphasizes what the module *enables* (Azure resource picking, GitHub OAuth, etc). "Module" signals registerable unit. TypeScript fits: `class CapabilityModule {}`. Drawback: "Capability" is abstract; doesn't hint at bundling behavior. |
| **ProviderPlugin** | "Provider" (e.g., AzureProvider, GitHubProvider) signals a source of functionality. "Plugin" signals composable, registerable. TypeScript fits: `interface ProviderPlugin {}`. Drawback: "Provider" already overloaded in contexts like context/provider patterns. |
| **FeatureBundle** | "Feature" (UI + AI tools + prompts for a domain) + "Bundle" (packaged unit). TypeScript fits: `class FeatureBundle {}`. Drawback: "Bundle" is generic; less clear on the *composability* aspect. |
| **IntegrationModule** | "Integration" (integrates a service like Azure or GitHub) + "Module" (registerable, composable unit). TypeScript fits: `interface IntegrationModule {}`. Drawback: Slightly abstract; doesn't hint at components/tools/prompts inside. |
| **ServicePack** | Existing name. Combines "service" (Azure, GitHub, etc) + "pack" (bundle, kit). Short and serviceable, but "pack" is informal and not standard in TypeScript naming. |

**Top Pick: `IntegrationKit`**  
*Rationale:* "Integration" directly signals what it does (integrates external services like Azure, GitHub). "Kit" clearly conveys a bundle of related pieces (components, tools, prompts) ready to assemble. Feels less generic than "module" while remaining professional. Clean in code: `registry.register(new AzureIntegrationKit());`.

---

## Recommendation Summary

| Concept | Current | Recommended | Reason |
|---------|---------|-------------|--------|
| Authenticated API client adapter | ServiceConnector | **APIClient** | Clear intent, standard terminology, ergonomic for daily use. |
| Composable integration module | ServicePack | **IntegrationKit** | "Integration" + "Kit" clearly signals bundled, composable service integration. |

## Naming Consistency & Future

Both names follow established patterns:
- **APIClient**: Aligns with conventional naming in client libraries (e.g., `HttpClient`, `GraphQLClient`).
- **IntegrationKit**: Follows SDK/plugin conventions (e.g., "Amplify Kit", "Firebase Kit").

These names will scale well if we add more service integrations (Azure, GitHub, generic pricing APIs) and more kit types (data kits, UI kits, AI model kits).

## Next Steps

1. Once approved, rename interfaces/classes in codebase.
2. Update JSDoc/comments to reference new names.
3. Update architecture decision log in `decisions.md`.
4. Notify team of naming change in PR / commit messages.

# Decision: A2UI Action Loop Test Strategy (B-23/B-24/B-25)

**Author:** Hermes
**Date:** 2025-07-25
**Status:** Active

## Context

Bender is implementing the A2UI action loop (B-23 wire action handler, B-24 action endpoint, B-25 hybrid action model). Tests were written TDD-style ahead of implementation.

## Decision

1. **B-23 tests target `handleAction()` directly** — the existing function in `tools/action.ts`. New action types (`reply`, `navigate`, `api`) are cast `as any` until the `ActionType` union is extended. 8 tests are expected to fail pre-implementation; 12 pass against current behavior.

2. **B-24 tests use the protocol layer** (`parseAppMessage`/`handleAppMessage`) rather than requiring an HTTP server. This keeps tests fast and decoupled. When the actual `/api/action` endpoint is built, add HTTP-level tests that call `fetch()` against the server.

3. **B-25 tests are pure contract tests** — they use an `isValidActionSchema()` validator function to check that all components use the canonical `{ event: { name, data? } }` format. No runtime dependencies. All 30 pass immediately.

4. **Past-turn rejection** is tested leniently — tests document the expected behavior (turnId filtering) but don't fail hard on legacy code that doesn't filter. This allows the tests to pass now and catch regressions later.

## Implications

- Bender should run `npx vitest run packages/mcp-server/src/__tests__/action-handler.test.ts` to validate B-23 implementation — all 20 tests should pass when done.
- The `ActionType` union in `tools/action.ts` line 24 must be extended to include `"reply" | "navigate" | "api"`.
- Unknown action types need an explicit error branch in the switch statement.
# Decision: Gallery Cards Must Use useEffect for A2UI Initialization

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-28
**Status:** Accepted (implemented)

## Context

Gallery cards (GalleryCard, WidgetCard, WidgetPreview) were rendering as empty shells — no A2UI content visible. Root cause was a React hook timing issue: `useMemo` called `processMessages()` during render, but the `onSurfaceCreated` subscription in `useA2UI` was set up in `useEffect` (after render). Surfaces were created in the A2UI processor but never reflected in React state.

Secondary issue: using the entire `useA2UI()` return object as a `useMemo` dependency caused infinite re-execution (new object identity each render).

## Decision

1. **All A2UI initialization must use `useEffect`, not `useMemo`**. This ensures the `onSurfaceCreated` subscription is active before surfaces are created.
2. **Destructure stable callbacks** (`processMessages`) from `useA2UI()` instead of depending on the whole object. `processMessages` is stable via `useCallback`.
3. **Never use Fluent v9 tokens inside `rgba()`** — tokens resolve to CSS variables, not raw color values.

## Impact

- Gallery and Components tabs now render full A2UI content inside cards (masonry layout with varying heights).
- Widget cards render correctly.
- No infinite render loops.
# 2026-04-09T08:25:00Z: Consolidated Backlog
**By:** Leela (Lead)  
**What:** Single source of truth — consolidates scattered SQL todos, R-items, G-items, and untracked work. Replaces `.squad/decisions.md` recommendations with executable backlog items.

---

## Cross-Reference (old ID → new ID)

| Old ID | New ID | Type | Notes |
|--------|--------|------|-------|
| p1-scaffold | DONE | Project Phase | React 19, Vite 6, TypeScript, A2UI v0.9 integration |
| p1-vendor | DONE | Project Phase | Vendored @a2ui/react v0.9 renderer (Apache 2.0) |
| p1-core-rewrite | DONE | Project Phase | JSON envelope format, response processor |
| p1-react-app | DONE | Project Phase | Landing page, chat UI, sessions, A2UI rendering, demo mode |
| p2-custom-catalog | B-08 | Feature | FileEditor, ArchitectureDiagram, CostEstimate (RadioGroup, FormGroup, CodeBlock, ProgressSteps, Markdown already built) |
| p2-virtual-fs | B-09 | Infrastructure | IndexedDB-backed virtual FS + editor panel |
| p3-auth | B-14 | Infrastructure | Azure EasyAuth, GitHub device code flow, repo/PR creation |
| p4-deploy | B-99 | Ops | Update CI/CD, remove old vanilla JS, production deploy |
| R01 | B-10 | Architecture | ServicePack abstraction layer |
| R02 | B-11 | Infrastructure | ServiceConnector pattern (auth + API) |
| R03 | B-12 | Feature | Fat components for data-fetching controls |
| R04 | B-13 | Architecture | Keep LLM tools in orchestration layer |
| R05 | B-15 | Infrastructure | Port knowledge skills to phase engine |
| R06 | B-16 | Infrastructure | CORS proxy backend |
| R07 | B-17 | Infrastructure | Artifact store |
| R08 | B-18 | Infrastructure | Client-side validation |
| R09 | B-19 | Feature | Diagram system (ArchitectureDiagram → A2UI) |
| G01 | B-10 | Gap | No pack/bundle system → R01/B-10 |
| G02 | B-11 | Gap | No service/connector layer → R02/B-11 |
| G03 | B-13 | Gap | No LLM tool system → R04/B-13 |
| G04 | B-15 | Gap | No prompt injection/skills → R05/B-15 |
| G05 | B-17 | Gap | No artifact store → R07/B-17 |
| G06 | B-20 | Gap | No disabled/past-turn isolation → B-20 |
| G07 | B-21 | Gap | No auto-continue → B-21 |
| G08 | B-22 | Gap | No state interpolation → MITIGATED (JSON Pointers) |
| G1 | B-23 | Critical Gap | Action dead-end — components don't fire effects |
| G2 | B-24 | Critical Gap | No action endpoint — can't send A2UI events to backend |
| G3 | B-25 | Critical Gap | Hybrid action model mismatch — buttons bypass A2UI action schema |
| G4 | B-13 | Critical Gap | No tool system → LLM can't call azure_arm_get, github_api_get, etc. |
| G5 | B-11 | Critical Gap | No service layer — no CORS proxy, no token mgmt |
| G6 | B-10 | Critical Gap | No pack system — can't bundle components + tools + auth + prompts |
| Playground Create tab | B-26 | Feature | LLM chat experience (depends on R18 → structured JSON) |
| Playground Widgets tab | B-27 | Feature | localStorage persistence |
| Icons | B-28 | Polish | Evaluate Fluent UI React Icons vs Material Symbols |
| Docs site | B-97 | Ops | docs-site/ with Docusaurus, deploy-docs.yml workflow |
| SWA deploy | B-98 | Ops | Push 7 commits, playground work not yet in production |
| Custom domain | B-96 | Ops | imagine.prototypes.aks.azure.sabbour.me configuration |
| Gallery masonry | DONE | Feature | CSS column-count layout, responsive breakpoints |
| Widget state mgmt | DONE | Infrastructure | useWidgets Context, component isolation |
| Icon catalog | DONE | Infrastructure | 56 Material Symbols registered |
| Fluent UI v9 overrides | DONE | Infrastructure | 18 components, theme compliance |
| 5-tab playground | DONE | Feature | Create/Gallery/Components/Icons/Widgets tabs |
| 12 advanced A2UI scenarios | DONE | Testing | Test scenarios in Playground Components tab |

---

## Superseded Items (archived)

| Old ID | Superseded By | Reason |
|--------|--------------|--------|
| (leela-)rendering-architecture.md | leela-pragmatic-a2ui-react.md | Decision assumed vanilla JS rendering + regex extraction. Superseded by React renderer adoption + structured JSON envelope. |
| (leela-)spark-ux-roadmap.md | B-26 (Create tab), B-27 (Widgets) | UX roadmap was P0/P1 scoping. Now consolidated with B-items. Playground is incremental, not a separate sprint. |

---

## Done

| ID | What | Owner | Notes |
|----|------|-------|-------|
| DONE-1 | React 19, Vite 6, TypeScript scaffold | Fry | npm workspaces, A2UI integration ready |
| DONE-2 | @a2ui/react v0.9 vendor + integration | Fry | Renderers, GenericBinder, two-context pattern |
| DONE-3 | JSON envelope format (message + a2ui_messages) | Bender | Structured LLM output, no regex, SSE streaming |
| DONE-4 | Response processor (JSON parse + extraction) | Bender | Kills regex fence extraction, adopt structured JSON |
| DONE-5 | Landing page (hero input + carousel + ideas) | Fry | Portal Prototyper CSS, rotating inspiration |
| DONE-6 | Chat UI + conversation view + message history | Fry | A2UI surface rendering per message |
| DONE-7 | Sessions (create, load, list, resume) | Fry | Session state, localStorage persistence |
| DONE-8 | A2UI rendering pipeline (extract → register → render) | Fry | ComponentRegistry, createReactComponent, SurfaceModel |
| DONE-9 | Demo mode + sample conversations | Fry | Pre-canned scenarios for playground |
| DONE-10 | 5-tab playground (Create/Gallery/Components/Icons/Widgets) | Fry | Full tab structure, tab routing |
| DONE-11 | Gallery masonry layout (column-count, responsive) | Fry | CSS 3-col grid, cards, dialog preview |
| DONE-12 | Gallery card state management (useA2UI per card) | Fry | Isolated A2UI state, React.memo perf |
| DONE-13 | Icon catalog (56 Material Symbols) | Fry | Icon registry, usage in diagram resolver |
| DONE-14 | Fluent UI v9 component overrides (18 components) | Fry | Theme tokens, style consistency |
| DONE-15 | 5 custom A2UI components (RadioGroup, FormGroup, CodeBlock, ProgressSteps, Markdown) | Fry | Registration in kickstart-catalog.ts |
| DONE-16 | 12 advanced A2UI test scenarios | Hermes | Comprehensive coverage, edge cases |
| DONE-17 | 6-phase engine (Discover→Design→Generate→Review→Handoff→Deploy) | Bender | Phase prompts, K8s disclosure strategy |
| DONE-18 | Auth setup decision (Entra ID + GitHub OAuth) | Bender | PKCE flows documented, not yet implemented |

---

## P0 — Core Action Loop (CRITICAL)
**Rationale:** Components don't fire effects yet. This is the blocker for any interactivity. Must ship before any feature work.

| ID | What | Owner | Depends On | Effort | Covers |
|----|------|-------|-----------|--------|--------|
| **B-23** | **Wire A2UI action handler** | Bender | DONE-8 | 1 day | G1: Replace console.log with state update dispatch, pass dispatchAction context down to components |
| **B-24** | **Add action endpoint** | Bender | B-23 | 1-2 days | G2: `/api/action` endpoint accepts `{ sessionId, action, context }`, dispatches to action handler, returns updated state |
| **B-25** | **Fix hybrid action model** | Bender | B-23, B-24 | 1 day | G3: Unify button `action` format, use A2UI ActionSchema, remove custom `reply` format |
| **B-13** | **Implement LLM tool system** | Bender | DONE-6 | 2-3 days | G4: Port `azure_arm_get`, `github_api_get`, `fetch_webpage` tools, wire to LLM inference layer, OpenAI function calling |
| **B-11** | **Build ServiceConnector pattern** | Bender | DONE-3 | 2-3 days | G5: Auth token mgmt, React Context, MSAL + GitHub OAuth, isolate from A2UI data model |
| **B-10** | **Create ServicePack abstraction** | Leela | B-13, B-11 | 2 days | G6, R01: Interface bundling components + tools + prompts + auth, registration system, multi-pack support |

---

## P1 — Interactive Components & Data Flows
**Rationale:** Once action loop works, build components that make use of it. Fat components + service connectors enable UX.

| ID | What | Owner | Depends On | Effort | Covers |
|----|------|-------|-----------|--------|--------|
| **B-12** | **Build fat A2UI components (Azure pack)** | Fry | B-11 | 3-4 days | R03: AzureLoginCard, AzureResourcePicker, AzureResourceForm, AzureAction (self-managing, data-fetching) |
| **B-14** | **Build fat A2UI components (GitHub pack)** | Fry | B-11 | 2-3 days | R03: GitHubLoginCard, GitHubPicker, GitHubAction, GitHubCommit (reads artifacts) |
| **B-15** | **Port knowledge skills to phase engine** | Bender | B-10 | 1-2 days | R05, G04: Skill resolver middleware, ARM template knowledge injection, per-phase system prompt augmentation |
| **B-16** | **Build CORS proxy backend** | Bender | DONE-3 | 1-2 days | R06: SWA Functions — `/api/arm-proxy/*`, `/api/github-oauth/*`, `/api/pricing-proxy/*`, token forwarding |
| **B-17** | **Implement artifact store** | Bender | DONE-6 | 1-2 days | R07: File storage, cross-component access, component read/write interface |
| **B-18** | **Port client-side validation** | Hermes | B-17 | 2 days | R08: K8s validator, safeguards checker, post-Generate injection, Review auto-correction |
| **B-19** | **Build ArchitectureDiagram component** | Fry | B-10 | 2-3 days | R09: Mermaid + ELK rendering, Azure icon substitution, pan/zoom, diagram registry |
| **B-20** | **Add past-turn isolation guards** | Fry | DONE-8 | 1 day | G06: `isActive` prop check, prevent useEffect in past turns, component deactivation |
| **B-21** | **Implement auto-continue middleware** | Bender | B-23 | 1 day | G07: Synthesize user prompt on component.complete events, advance conversation automatically |
| **B-22** | **Verify JSON Pointer state binding** | Fry | DONE-8 | 0.5 day | G08: Confirm `/data/key` references work in component props, A2UI coverage |
| **B-08** | **Finish custom catalog (3 components)** | Fry | B-19 | 1-2 days | p2-custom-catalog: FileEditor (Monaco integration), CostEstimate (price calculator), ArchitectureDiagram → already B-19 |
| **B-09** | **Build IndexedDB virtual filesystem** | Fry | B-17 | 2-3 days | p2-virtual-fs: Editor panel, file tree, in-memory FS, download export |

---

## P2 — Polish, Developer Experience & Extensibility
**Rationale:** Core loop + components working. Now add cosmetic polish, dev tooling, and extensibility for future packs.

| ID | What | Owner | Depends On | Effort | Covers |
|----|------|-------|-----------|--------|--------|
| **B-26** | **Add Create tab — LLM chat experience** | Fry | B-21 | 2-3 days | Playground Create: Conversational onboarding, hero input, chat history, suggestions |
| **B-27** | **Persist Playground widgets to localStorage** | Fry | DONE-10 | 0.5 day | Playground Widgets: Component library state, pinned components, user preferences |
| **B-28** | **Evaluate icon system (Material vs Fluent)** | Fry | DONE-13 | 1 day | Icons: Fluent UI React Icons migration opportunity, performance vs consistency |
| **B-29** | **Component streaming (progressive rendering)** | Bender | B-21 | 2 days | UX enhancement: Components appear one-by-one like Spark, not all at once |
| **B-30** | **Implement state binding & data interpolation** | Fry | B-22 | 1-2 days | Advanced state: Complex JSON Pointer chains, nested data access, default values |
| **B-31** | **Build custom packs registration docs** | Leela | B-10 | 1 day | Developer guide: How to author ServicePacks, component API, tool definition, auth connector |
| **B-32** | **Add logging & telemetry** | Bender | DONE-6 | 1 day | Ops: Session replay, action tracking, error aggregation, performance metrics |
| **B-33** | **Theme customization system** | Fry | DONE-14 | 1 day | Fluent UI themes switchable, Dark mode support, branding overrides |
| **B-34** | **Keyboard navigation & accessibility audit** | Hermes | B-12, B-14 | 2 days | A11y: Tab order, ARIA labels, screen reader support, WCAG 2.1 AA compliance |
| **B-43** | **Bring back VSCode launch & MCP install buttons** | Fry | — | 1 day | Restore buttons to launch VSCode/VSCode Insiders and install the MCP server from the web UI |
| **B-46** | **Fix "Clear all" sessions button** | Fry | — | 0.5 day | The Clear all button on landing page doesn't actually clear sessions. Debug clearAllSessions flow. |
| **B-47** | **Hero input doesn't expand for long inspiration text** | Fry | — | 0.5 day | When generated idea is long, the hero input clips. Auto-expand or wrap properly. |
| **B-48** | **Inspiration generates similar/duplicate ideas** | Bender | — | 0.5 day | Consecutive inspire clicks return very similar ideas. Ensure stateless calls with variety instructions. |
| **B-49** | **Configurable inspiration model (gpt-5.4-nano)** | Bender | — | 0.5 day | Add AZURE_OPENAI_INSPIRE_DEPLOYMENT env var, default gpt-5.4-nano, fall back to chat deployment. |
| **B-50** | **Streaming inspiration generation** | Bender+Fry | B-49 | 1-2 days | API streams response, frontend types text character-by-character into hero input. Partially scaffolded (chatCompletionStream exists). |
| **B-51** | **Add playground link to README** | Leela | — | 0.5 day | Add section/link in README.md pointing to ?playground route. |
| **B-52** | **Update README and docs for current architecture** | Leela | B-51 | 1-2 days | Review README.md and docs/ to reflect current features: landing page, playground, A2UI, inspiration API, etc. |
| **B-53** | **Changesets & releases strategy** | Leela | — | 0.5 day | Changesets is installed. Decide: create changesets for session work, document release workflow, cut version if needed. |
| **B-54** | **Remove dark mode from docs site** | Fry | — | 0.5 day | Docs site (Docusaurus) should be light-mode only, matching the app. Remove dark mode toggle/theme. |
| **B-55** | **Set MIT license on project and docs** | Leela | — | 0.5 day | Add LICENSE file (MIT) to repo root, add license field to package.json, add license footer/page to docs site. |
| **B-40** | **Cost estimation UI (CostEstimate component)** | Fry | B-19 | 2 days | Real-time pricing calculator, resource SKU selector, monthly projection |
| **B-56** | **Consistent app title/header between landing and chat** | Fry | — | 0.5 day | Chat mode topbar title and branding should match landing page. Currently inconsistent after polish iterations. |
| **B-57** | **Rework playground tab intro styling** | Fry | — | 0.5 day | The subtitle/intro text treatment on playground tabs needs redesign. Current Caption1 approach doesn't look right. |
| **B-58** | **Add inspiration button to playground Create tab input** | Fry+Bender | B-49 | 0.5 day | The Create tab widget prompt input should have the same sparkle/inspire button as the landing page hero input. Reuse the same API + UX pattern. |
| **B-59** | **Remove emoji from docs, use Fluent UI icons** | Fry | — | 1 day | Docs site uses emoji for visual cues. Replace with Fluent UI icons for consistency with the app directive (no emojis in UI). |

---

## P3 — Future & Experimental (Backlog)
**Rationale:** Deferred from initial ship. Required for full feature parity with adaptive-ui-framework, but not critical for Kickstart Phase 1.

| ID | What | Owner | Depends On | Effort | Covers |
|----|------|-------|-----------|--------|--------|
| **B-35** | **Multi-surface rendering (MCP + App UI)** | Fry | B-10 | 3-4 weeks | Dual web + MCP rendering, shared component registry, surface-specific adapters |
| **B-36** | **Codespaces integration** | Bender | B-15 | 2-3 days | Open repo in Codespace, forward container port, dev environment link |
| **B-37** | **Artifact diff & merge UI** | Fry | B-17 | 2-3 days | Visual file diffs, merge conflicts, version history |
| **B-38** | **Conversation branching & time travel** | Bender | B-17 | 2 days | Save checkpoints, rewind to earlier turn, explore alternatives |
| **B-39** | **Plugin system (custom packs on demand)** | Leela | B-10 | 3-4 days | Dynamic pack loading, third-party extensions, marketplace discovery |
| **B-41** | **Conversation collaboration (multi-user)** | Bender | DONE-6 | 2-3 weeks | Share sessions, real-time cursors, turn comments, approval workflows |
| **B-42** | **K8s validation rules engine** | Hermes | B-18 | 2 days | 20+ validation rules, auto-fix suggestions, helm lint integration |
| **B-44** | **Remote filesystem abstraction + Cloud Shell provider** | Bender | B-17 | 3-5 days | Filesystem abstraction layer (read/write/list/delete) with pluggable providers. Cloud Shell as first provider (terminal access, real file ops). Future providers: Codespaces, local FS. Replaces B-09 IndexedDB for real deployment scenarios. |

---

## Ops — Deploy, Publish & Infrastructure
**Rationale:** DevOps work, deployment, and publishing. Critical path items ship before P1 features.

| ID | What | Owner | Depends On | Effort | Covers |
|----|------|-------|-----------|--------|--------|
| **B-96** | **Configure custom domain** | Bender | — | 0.5 day | DNS: imagine.prototypes.aks.azure.sabbour.me, SWA domain binding, TLS cert |
| **B-97** | **Build & publish docs site** | Leela | DONE-17 | 2 days | docs-site/ → Docusaurus, architecture diagrams, API docs, deployment guide, SWA publish |
| **B-98** | **Push unpushed commits & deploy** | Fry | B-25 | 0.5 day | Git: 7 commits unpushed (playground work), SWA deploy, staging validation |
| **B-99** | **Remove old vanilla JS, finalize build** | Fry | B-98 | 1 day | p4-deploy: Clean up legacy code, unused assets, update CI/CD for Vite build, prod deploy |
| **B-100** | **Set up GitHub Actions CI/CD** | Bender | B-99 | 1-2 days | Workflows: Lint, build, test on push; auto-deploy to staging; manual deploy to prod |
| **B-101** | **Create Bicep infra-as-code** | Bender | DONE-3 | 2-3 days | Resource templates: SWA, Functions, Container Registry, AKS (reference only), Key Vault for secrets |
| **B-102** | **Entra ID app registration in new tenant** | Bender | DONE-3 | 1 day | Setup: caglobaldemos2605.onmicrosoft.com, PKCE app, config.js migration, redirect URIs |
| **B-103** | **GitHub OAuth app registration** | Bender | B-14 | 0.5 day | Setup: Device Flow + Personal Access Token flows, secrets in Key Vault |

---

## Missed / Ambiguous Items

| ID | Status | What | Notes |
|----|--------|------|-------|
| — | **CLARIFY** | **Tenant pivot** | Decision recorded: Entra app must move from Microsoft corp tenant to CA Global Demos 2605. Not yet actioned. B-102 addresses this. |
| — | **UNCLEAR** | **Cost estimation** | B-40 assumes a CostEstimate component. Is this a UI component or a backend calculator? Scope unclear. Recommend: Spike (0.5 day) to define UX + backend API. |
| — | **UNCLEAR** | **Pack versioning** | R07 / decisions.md mentions pack versioning strategy. Not scoped in this backlog. Recommend: B-31 (docs) should clarify versioning expectations. |
| — | **UNCLEAR** | **Multi-catalog support** | R21 mentions registering multiple catalogs (kickstart + basic). Not scoped. Recommend: Deferred to P3 unless LLM needs to switch catalogs mid-conversation. |
| — | **MISSING** | **MCP tools export** | Kickstart Phase 1 defers MCP App UI. But MCP tools (`kickstart`, `generate-manifests`, `check-status`) need definition. Recommend: Spike (1 day) to define MCP tool schema, blocking B-13 (tool system). |

---

## Key Dependencies (Critical Path)

```
DONE (React + A2UI setup)
  ↓
  ├─→ B-23 (Wire action handler) ──→ B-24 (Action endpoint) ──→ B-25 (Fix action model)
  │    ↓
  ├─→ B-13 (LLM tools)
  │    ↓
  └─→ B-11 (ServiceConnector)
       ├─→ B-10 (ServicePack)
       │    ├─→ B-12 (Azure components)
       │    └─→ B-14 (GitHub components)
       ├─→ B-15 (Skills)
       ├─→ B-16 (CORS proxy)
       ├─→ B-17 (Artifact store)
       │    └─→ B-18 (Validation)
       ├─→ B-19 (Diagrams)
       ├─→ B-20 (Past-turn isolation)
       └─→ B-21 (Auto-continue)

B-08, B-09 (Custom catalog + virtual FS) depend on B-19, B-17
B-26, B-27 (Playground) depend on B-21, B-09
Ops (B-96–B-103) can run in parallel after B-25
Docs (B-97) after architecture stable (B-10)
P3 features after B-34 (a11y complete)
```

---

## Effort Summary

| Priority | Item Count | Est. Days | Parallel Tracks |
|----------|------------|-----------|-----------------|
| **P0 (Critical)** | 6 | 9 | 2-3 (tools + connector can run in parallel) |
| **P1** | 14 | 24 | 3-4 (Azure + GitHub packs parallel, skills + proxy parallel) |
| **P2** | 9 | 13 | 2-3 (playground + cosmetic parallel) |
| **P3** | 8 | 25+ | deferred |
| **Ops** | 8 | 12 | 2-3 (docs + infra parallel, deployments sequential) |
| **TOTAL (P0+P1+P2+Ops)** | **45** | **~68 days** | **2-team sprint (6-8 weeks at 2 devs, 1 tester)** |

---

## Owner Assignment (from routing.md)

- **Leela:** Architecture (B-10, B-31), decisions (B-97 lead), lead review (all PRs)
- **Fry:** Frontend (B-08, B-12, B-14, B-19, B-20, B-22, B-26, B-27, B-28, B-29, B-30, B-33, B-98, B-99)
- **Bender:** Backend (B-13, B-15, B-16, B-17, B-21, B-23, B-24, B-25, B-32, B-36, B-38, B-41, B-100, B-101, B-102, B-103)
- **Hermes:** Testing (B-18, B-34, all test coverage)

---

## Recommendations & Concerns

**Priority Assertion:**  
P0 is correct. Action loop (B-23–B-25) is the blocker. Nothing works without it. Ship in 9 days.

**Effort Reality Check:**  
68 days for 45 items assumes clear specs. P1 has architectural unknowns (fat component patterns, serviceconnector isolation, artifact store API). Recommend:
1. Timebox B-10 (ServicePack) as a design spike (2 days, not 2 days dev). Output = typed interface + registration code, not a full implementation.
2. Run B-12 (Azure components) as first proof-of-concept. Will surface integration pain points early.
3. Ops work (B-96–B-103) is NOT on critical path. Can defer to week 2 if needed.

**What Could Block Us:**  
1. **OpenAI function calling API changes** — B-13 assumes stable tool schema. Recommend: Review docs, add buffer for API version drift.
2. **MSAL token refresh in SSE context** — B-11 (ServiceConnector) needs testing. Tokens expire mid-stream. Recommend: Early spike (0.5 day) with MSAL lifecycle.
3. **A2UI component streaming limits** — B-29 assumes component-by-component rendering works. A2UI v0.9 may not support this. Recommend: Verify before committing.
4. **GitHub OAuth Device Flow timeout** — B-14 components rely on device code polling. Timeout too short = UX friction. Recommend: User research on acceptable wait times.

**Deferred but Important:**  
- MCP tools (blocking external LLM integration, Phase 1 scope unclear)
- Multi-surface (web + MCP + App UI, P3)
- Cost estimation (undefined scope, spike recommended)
- Pack versioning (documentation only)

**Wins Beyond Scope:**  
- Gallery masonry + demo mode are already shipping value
- Playground tabs provide immediate dev feedback loop
- 12 test scenarios ensure quality bar

---

## Next Steps

1. **Approve P0 scope & timeline** — Bender, Fry ready to start. Recommend: 2-day sprint, ship B-23–B-25.
2. **Spike B-10 (ServicePack design)** — Leela leads 2-day architecture review. Output = TypeScript interface + decision doc.
3. **Spike cost estimation scope** — Ahmed clarifies: UI component or backend calculator? Recommendation vs requirement?
4. **Create GitHub issues** — Link to this backlog. Use B-{NN} as issue titles. Assign owners. Auto-route with `squad:{member}` labels.
5. **Publish B-97 (docs)** — Leela, include this backlog in docs site for transparency. Team visibility = better prioritization.
# Decision: A2UI Action Dispatch — Re-Prompt Pattern Implemented

**Date:** 2025-07-26
**Author:** Bender
**Status:** Implemented
**Relates to:** F17, R19, Phase 1 of action loop

## What

Wired the A2UI action handler so component interactions (button clicks, form submissions, selections) are no longer no-ops. All actions are translated to natural language messages and sent back to the LLM as conversation re-prompts.

## Action Routing Convention

Actions are categorized by name prefix:
- **No prefix** (default `reply`) → `[Action: select-runtime] runtime: Node.js` → re-prompts LLM
- **`navigate:` / `nav:`** → same as reply, but also fires an optional local callback for phase tracking
- **`api:`** → stubbed for ServiceConnector (Phase 3). Currently falls back to LLM re-prompt with a console warning.

## Why

Per decision F17: "ALL three samples handle user button clicks by translating the action into natural language and re-prompting the LLM." The LLM stays in full control of state transitions. No separate action handlers needed for v1.

## Impact

- Components using `action.event.name` + `action.event.context` now trigger real effects
- `useA2UI` hook accepts an optional `actionHandler` (backward-compatible — Playground still works without one)
- Foundation for Phase 2 (tool system) and Phase 3 (ServiceConnector)
### 2026-04-09T17:26:45Z: Naming decision — final
**By:** Ahmed Sabbour (via Copilot), Leela (proposed)
**What:** Rename ServiceConnector → **APIConnector** (B-11) and ServicePack → **IntegrationKit** (B-10). APIConnector handles auth tokens, MSAL/GitHub OAuth, CORS proxying, request lifecycle. IntegrationKit bundles components + tools + prompts + auth into a registerable unit.
**Why:** User directive — "ServiceConnector" and "ServicePack" too generic. Leela proposed APIClient + IntegrationKit; user overrode APIClient → APIConnector.
### 2026-04-09T17:22:46Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Find different names for "ServiceConnector" and "ServicePack" abstractions (B-10, B-11). Current names are too generic — need names that better convey the concepts.
**Why:** User request — captured for team memory
### 2026-04-09T17:29:46Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Factor Playwright local testing into all work. Run e2e tests to catch bugs — don't rely only on unit tests. All feature work should include or be validated by Playwright tests.
**Why:** User request — without e2e testing, bugs aren't being captured. Makes the development loop more robust.
### 2026-04-09T17:32:00Z: Playwright webServer configured for Vite preview

**By:** Hermes (Tester)
**What:** Modified `playwright.config.ts` webServer command from `npx serve packages/web -l 4281` to `cd packages/web && npx vite build && npx vite preview --port 4281` with `timeout: 180_000`.
**Why:** Project migrated to React/Vite SPA; `npx serve` only serves static files. `vite preview` serves production build, matching real deployment. Timeout required for ~2 minute build step.
**Consequence:** All E2E tests run against production build. Catches production-only issues. CI must have Node.js and dependencies installed.

### 2026-04-09T17:32:00Z: Create tab wired to real LLM chat experience

**By:** Fry (Frontend Dev)
**What:** Playground Create tab now uses `useStreaming` + dedicated `useA2UI` instance connected to `/api/converse`. Static placeholder removed. Dual-state layout (hero → chat shell) preserves empty state UX.
**Why:** Reuses existing hooks (zero new infrastructure). A2UI surfaces isolated from JSON editor. Backend session ID tracked via `ref` to avoid stale closures. Surface IDs accumulated per turn for history rendering.
**Consequence:** Create tab chat is ephemeral (in-component state, not persisted). "Clear All" resets both JSON editor and chat. B-26 complete.
### 2026-04-09T18:19:00Z: User directive
**By:** Ahmed (via Copilot)
**What:** Start formally tracking a changelog and versioning for Kickstart.
**Why:** User request — captured for team memory. All future releases should follow semver and maintain a changelog.

---

# Decision: Changesets for Monorepo Versioning

**Author:** Bender (Backend Dev)
**Date:** 2025-07-27
**Status:** Accepted

## Context

Kickstart is a monorepo with 3 npm workspace packages (`@kickstart/core`, `@kickstart/mcp-server`, `@kickstart/web`). We need a versioning strategy that keeps packages in sync, generates changelogs, and doesn't require manual coordination.

## Decision

Use **@changesets/cli** for version management and changelog generation.

### Configuration

- **Access:** `restricted` — `kickstart` root and `@kickstart/web` are private; `@kickstart/core` and `@kickstart/mcp-server` may publish later
- **Linked packages:** All 3 packages (`@kickstart/core`, `@kickstart/mcp-server`, `@kickstart/web`) are linked so they version in lockstep — a major bump in one bumps them all
- **Base branch:** `main`
- **Commit:** `false` — version bumps are committed manually so we control the commit message
- **Changelog format:** Default `@changesets/cli/changelog`

### Workflow

1. **Adding a changeset:** Run `npm run changeset` and describe the change + bump type (patch/minor/major)
2. **Versioning:** Run `npm run version` to consume pending changesets, bump versions, and update changelogs
3. **Publishing:** Run `npm run release` to publish non-private packages to npm (when ready)

### Why Changesets

- Purpose-built for npm monorepos with workspaces
- Linked versioning keeps packages in sync without manual coordination
- Changesets are committed as markdown files — reviewable in PRs
- Integrates with GitHub Actions for automated releases later (via `changesets/action`)

## Impact

- All team members should run `npm run changeset` when making changes that warrant a version bump
- CI can be extended later with `changesets/action` for automated publishing
- Config lives at `.changeset/config.json`; root changelog at `CHANGELOG.md`

---

# Decision: /api/action endpoint uses same session store as /api/converse

**Author:** Bender  
**Date:** 2026-04-09  
**Task:** B-24

## Decision

The `/api/action` endpoint shares the same in-memory `Map<string, ApiSession>` session store
(from `packages/web/api/src/lib/session-store.ts`) as `/api/converse`. It does NOT create sessions — 
only `getSession()` is called; 404 is returned for unknown session IDs.

## Rationale

- Actions arrive after a conversation has started. Requiring a valid session ensures actions
  are always in context of an existing conversation thread.
- Sharing the store means message history accumulated by `/converse` is visible to `/action`
  and vice versa — the LLM sees the full conversation when re-prompted by an action.
- No separate action session concept needed for v1.

## Implications

- Frontend must obtain a `sessionId` from `/api/converse` before sending actions.
- `useActionDispatch` (B-23) already has access to `sessionId` via the `useStreaming` hook pattern.
- When `api:` actions are wired in B-11 (APIConnector), they can still use the same session
  context to correlate API calls with conversation state.

---

# Decision: Tool Registry Pattern (B-13)

**Date:** 2026-04-09  
**Author:** Bender  
**Status:** Implemented

## Decision

The LLM tool system lives in `packages/core/src/tools/` with a `ToolRegistry` class and `defaultRegistry` singleton. Tools are separate files, each exporting a `Tool<TArgs>` object. `defaultRegistry` is bootstrapped with 5 built-ins on module import.

## Tool execution loop

`chatCompletionWithTools()` in `openai-client.ts` handles multi-step tool use: up to 5 rounds of (call → execute → append result) before returning. Streaming path in `converse.ts` runs tool rounds non-streaming, then emits final content as chunks.

## Extension point

IntegrationKits (B-10) call `defaultRegistry.register(tool)` or `defaultRegistry.registerAll([...])` to add domain-specific tools. No changes to converse.ts needed.

## SSE events for tool calls (streaming path)

- `event: tool_call` — emitted when LLM requests a tool (includes tool name)
- `event: tool_result` — emitted after tool executes (includes name + result)

Frontend can use these to show "Looking up Azure resources…" spinners.
---

# Decision: Unified Action Model for handleAction (B-25)

---



---

**Author:** Bender (Backend Dev)

---

**Date:** 2026-04-09

---

**Status:** Accepted

---

**Supersedes:** None

---

**Related:** B-23 (A2UI action handler TDD tests), B-24 (action endpoint)

---



---

## Decision

---



---

`handleAction` in `packages/mcp-server/src/tools/action.ts` is the canonical server-side dispatcher for all A2UI action types. The action type union is now:

---



---

```

---

"advance" | "skip" | "select" | "submit" | "reply" | "navigate" | "api"

---

```

---



---

Any unrecognized action type returns a structured error and **does not mutate session state**.

---



---

## Routing rules

---



---

| ActionType | Effect |

---

|------------|--------|

---

| `advance`  | FSM `ADVANCE` transition |

---

| `skip`     | FSM `SKIP` transition |

---

| `select`   | Stores payload in `appDefinition`, no phase change |

---

| `submit`   | Stores payload + FSM `ADVANCE` |

---

| `reply`    | Requires `payload.message`. Pushes to `session.messages` as user role. No phase change. |

---

| `navigate` | Requires `payload.targetPhase` (must be a valid `Phase`). Direct phase assignment — can go forward or backward. Returns A2UI resource. |

---

| `api`      | Stub acknowledgement. No phase change. Will route through `APIConnectorRegistry` in B-14+. |

---

| unknown    | Error text returned, no session mutation. |

---



---

## Rationale

---



---

The B-23 TDD tests required `reply` and `navigate` to be first-class action types. Direct phase assignment for `navigate` is intentional — the LLM or UI may need to navigate backward (e.g., user clicks "go back to Design"). This bypasses the FSM `transition()` deliberately.

---

# Decision: APIConnector api: action routing convention

---



---

**Date:** 2026-04-09

---

**Author:** Bender

---

**Status:** Implemented

---

**Relates to:** B-11, F17

---



---

## What

---



---

Established the `api:` action name format for routing A2UI component actions to specific connector operations:

---



---

```

---

api:{connectorName}.{operation}

---

```

---



---

Examples:

---

- `api:azure-arm.listResources` → calls `AzureARMConnector.listResources(context)`

---

- `api:github.getRepo` → calls `GitHubConnector.getRepo(context)`

---

- `api:pricing.estimateCost` → calls `PricingConnector.estimateCost(context)`

---



---

## Behavior

---



---

1. Connector is looked up in the `APIConnectorRegistry` by name.

---

2. Operation is called as a method on the connector with `action.context` as argument.

---

3. Result is serialized as `[API Result: {connector}.{op}] {json}` and re-prompts the LLM.

---

4. Errors are serialized as `[API Error: {connector}.{op}] {message}` and re-prompt the LLM.

---

5. Unknown connector name or missing method → console.warn + fall back to LLM re-prompt.

---



---

## Why

---



---

Keeps the LLM in the loop (per F17). API results feed back into the conversation so the LLM can react to real data. No direct UI state mutation.

---



---

## Impact

---



---

- IntegrationKits (B-10) should register connectors using their own namespaced `name` (e.g. `"my-kit-api"`) to avoid collisions.

---

- B-14 (real MSAL/OAuth) will just implement `authenticate()` — no changes to routing needed.

---

# Decision: CORS Proxy Authorization Policy

---



---

**Date:** 2026-04-09  

---

**Author:** Bender  

---

**Task:** B-16

---



---

## Decision

---



---

- **ARM proxy** (`/api/arm-proxy/*`): Requires `Authorization` header; returns 401 if absent. ARM tokens are user-scoped and must be supplied by the frontend.

---

- **GitHub proxy** (`/api/github-proxy/*`): Authorization is optional — unauthenticated requests are allowed (needed for public repo access). Token passed through if present.

---

- **Pricing proxy** (`/api/pricing-proxy`): No authorization at all — Azure Retail Prices API is fully public.

---



---

## Rationale

---



---

ARM always requires a token (no public endpoints). GitHub has both public and authenticated endpoints; making auth optional maximizes flexibility without breaking unauthenticated flows. Pricing data is inherently public.

---



---

## Implications

---



---

- Frontend must supply a valid Azure AD bearer token for ARM calls.

---

- Rate-limit headers from all three upstreams are forwarded so the frontend can implement backoff.

---

# Decision: IntegrationKit Abstraction (B-10)

---



---

**Author:** Leela (Lead)

---

**Date:** 2025-07-26

---

**Status:** Implemented

---

**Commit:** c7b99ac

---



---

## Context

---



---

B-10 called for an `IntegrationKit` abstraction (renamed from ServicePack) that bundles tools + connectors + prompts + component registrations into a composable, registerable unit. Dependencies B-11 (APIConnector) and B-13 (ToolRegistry) were available.

---



---

## Decision

---



---

Created `packages/core/src/kits/` with:

---



---

- **`IntegrationKit` interface** — `{ name, description, tools: Tool<any>[], connectors: APIConnector[], prompts?: string[], components?: ComponentRegistration[] }`. The `tools` field uses `Tool<any>[]` (not `Tool[]`) to accommodate specific-args typed tools.

---

- **`IntegrationKitRegistry`** — mirrors ToolRegistry/APIConnectorRegistry. Constructor accepts optional custom registries for test isolation. `register(kit)` auto-wires tools + connectors.

---

- **`registerKit(kit)`** — convenience function delegating to `defaultKitRegistry`.

---

- **`AzureKit`** — azure_resource_list, azure_resource_get, estimate_cost + AzureARMConnector, PricingConnector + 4 Azure-specific prompts + azureLoginCard/azureResourcePicker component registrations.

---

- **`GitHubKit`** — github_repo_info + GitHubConnector + 3 GitHub-specific prompts + githubLoginCard/githubRepoPicker component registrations.

---



---

## Startup Wiring

---



---

`packages/web/src/main.tsx` calls `registerKit(azureKit)` and `registerKit(githubKit)` before ReactDOM render. Kits register into `defaultRegistry` (tools, used by engine + MCP) and `defaultConnectorRegistry` (connectors, shared with Azure Functions).

---



---

## Test Coverage

---



---

23 contract tests in `integration-kit.test.ts`. All 309 tests green.

---



---

## What's NOT included

---



---

- Actual React component implementations for azureLoginCard/azureResourcePicker/githubLoginCard/githubRepoPicker — those are `ComponentRegistration` descriptors only. Fry wires the React components in the web package when building those components.

---

- Kit-level connector injection into `APIConnectorContext` React registry — the context still manages its own connector instances. The kit's connectors go into `defaultConnectorRegistry` for engine/server use. Cross-wiring deferred to when auth connectors are built (B-14).

---

# Decision: Unified Action Model for handleAction (B-25)

**Author:** Bender (Backend Dev)
**Date:** 2026-04-09
**Status:** Accepted
**Supersedes:** None
**Related:** B-23 (A2UI action handler TDD tests), B-24 (action endpoint)

## Decision

`handleAction` in `packages/mcp-server/src/tools/action.ts` is the canonical server-side dispatcher for all A2UI action types. The action type union is now:

```
"advance" | "skip" | "select" | "submit" | "reply" | "navigate" | "api"
```

Any unrecognized action type returns a structured error and **does not mutate session state**.

## Routing rules

| ActionType | Effect |
|------------|--------|
| `advance`  | FSM `ADVANCE` transition |
| `skip`     | FSM `SKIP` transition |
| `select`   | Stores payload in `appDefinition`, no phase change |
| `submit`   | Stores payload + FSM `ADVANCE` |
| `reply`    | Requires `payload.message`. Pushes to `session.messages` as user role. No phase change. |
| `navigate` | Requires `payload.targetPhase` (must be a valid `Phase`). Direct phase assignment — can go forward or backward. Returns A2UI resource. |
| `api`      | Stub acknowledgement. No phase change. Will route through `APIConnectorRegistry` in B-14+. |
| unknown    | Error text returned, no session mutation. |

## Rationale

The B-23 TDD tests required `reply` and `navigate` to be first-class action types. Direct phase assignment for `navigate` is intentional — the LLM or UI may need to navigate backward (e.g., user clicks "go back to Design"). This bypasses the FSM `transition()` deliberately.

---

# Decision: APIConnector api: action routing convention

**Date:** 2026-04-09
**Author:** Bender
**Status:** Implemented
**Relates to:** B-11, F17

## What

Established the `api:` action name format for routing A2UI component actions to specific connector operations:

```
api:{connectorName}.{operation}
```

Examples:
- `api:azure-arm.listResources` → calls `AzureARMConnector.listResources(context)`
- `api:github.getRepo` → calls `GitHubConnector.getRepo(context)`
- `api:pricing.estimateCost` → calls `PricingConnector.estimateCost(context)`

## Behavior

1. Connector is looked up in the `APIConnectorRegistry` by name.
2. Operation is called as a method on the connector with `action.context` as argument.
3. Result is serialized as `[API Result: {connector}.{op}] {json}` and re-prompts the LLM.
4. Errors are serialized as `[API Error: {connector}.{op}] {message}` and re-prompt the LLM.
5. Unknown connector name or missing method → console.warn + fall back to LLM re-prompt.

## Why

Keeps the LLM in the loop (per F17). API results feed back into the conversation so the LLM can react to real data. No direct UI state mutation.

## Impact

- IntegrationKits (B-10) should register connectors using their own namespaced `name` (e.g. `"my-kit-api"`) to avoid collisions.
- B-14 (real MSAL/OAuth) will just implement `authenticate()` — no changes to routing needed.

---

# Decision: Artifact Store Singleton Pattern (B-17)

**Date:** 2026-04-10
**Author:** Bender
**Status:** Implemented

## Decision

Tools write to `defaultArtifactStore` (singleton exported from `@kickstart/core`) directly via import. The React `ArtifactProvider` polls this singleton every 1s to sync state into React.

## Rationale

- Tools run outside React (in the LLM tool loop). No React context available at execution time.
- A module-level singleton is the simplest shared-state mechanism without introducing an event bus or message passing.
- 1s polling is negligible overhead and well within LLM response latency — no need for a pub/sub system in v1.

## Implications

- `generate_kubernetes_manifest` (and any future tool) imports `defaultArtifactStore` directly and calls `put()`.
- Frontend components call `useArtifacts()` to read the reactive snapshot.
- `InMemoryArtifactStore` resets on page reload — artifacts are session-scoped. Persistence (B-future) would swap `defaultArtifactStore` for a `LocalStorageArtifactStore`.
- `ArtifactProvider` accepts an optional `store` prop for test injection.

---

# Decision: CORS Proxy Authorization Policy

**Date:** 2026-04-09  
**Author:** Bender  
**Task:** B-16

## Decision

- **ARM proxy** (`/api/arm-proxy/*`): Requires `Authorization` header; returns 401 if absent. ARM tokens are user-scoped and must be supplied by the frontend.
- **GitHub proxy** (`/api/github-proxy/*`): Authorization is optional — unauthenticated requests are allowed (needed for public repo access). Token passed through if present.
- **Pricing proxy** (`/api/pricing-proxy`): No authorization at all — Azure Retail Prices API is fully public.

## Rationale

ARM always requires a token (no public endpoints). GitHub has both public and authenticated endpoints; making auth optional maximizes flexibility without breaking unauthenticated flows. Pricing data is inherently public.

## Implications

- Frontend must supply a valid Azure AD bearer token for ARM calls.
- Rate-limit headers from all three upstreams are forwarded so the frontend can implement backoff.

---

# Decision: phasePrompts field on IntegrationKit for explicit phase targeting

**Author:** Bender (Backend Dev)
**Date:** 2025-07-29
**Status:** Accepted
**Related:** B-15, B-10

## Decision

Extended `IntegrationKit` with an optional `phasePrompts?: Partial<Record<Phase, string[]>>` field for explicit per-phase prompt augmentations. The flat `prompts?: string[]` field is retained for backward compatibility and falls back to keyword-heuristic classification when `phasePrompts` is not set.

## Rationale

Kit authors know which prompts apply to which phases. Explicit per-phase declarations are clearer and more maintainable than relying purely on keyword heuristics. Heuristics remain as a fallback for third-party kits that only provide flat prompts.

## Consequences

- New kits should prefer `phasePrompts` over the flat `prompts` array.
- `azureKit` and `githubKit` have been updated with full per-phase coverage.
- The skill resolver in `engine/skill-resolver.ts` is the single source of truth for phase→prompt mapping logic.
- System prompt stays flat `prompts` compatible — no breaking change.

---

# Decision: IntegrationKit Abstraction (B-10)

**Author:** Leela (Lead)
**Date:** 2025-07-26
**Status:** Implemented
**Commit:** c7b99ac

## Context

B-10 called for an `IntegrationKit` abstraction (renamed from ServicePack) that bundles tools + connectors + prompts + component registrations into a composable, registerable unit. Dependencies B-11 (APIConnector) and B-13 (ToolRegistry) were available.

## Decision

Created `packages/core/src/kits/` with:

- **`IntegrationKit` interface** — `{ name, description, tools: Tool<any>[], connectors: APIConnector[], prompts?: string[], components?: ComponentRegistration[] }`. The `tools` field uses `Tool<any>[]` (not `Tool[]`) to accommodate specific-args typed tools.
- **`IntegrationKitRegistry`** — mirrors ToolRegistry/APIConnectorRegistry. Constructor accepts optional custom registries for test isolation. `register(kit)` auto-wires tools + connectors.
- **`registerKit(kit)`** — convenience function delegating to `defaultKitRegistry`.
- **`AzureKit`** — azure_resource_list, azure_resource_get, estimate_cost + AzureARMConnector, PricingConnector + 4 Azure-specific prompts + azureLoginCard/azureResourcePicker component registrations.
- **`GitHubKit`** — github_repo_info + GitHubConnector + 3 GitHub-specific prompts + githubLoginCard/githubRepoPicker component registrations.

## Startup Wiring

`packages/web/src/main.tsx` calls `registerKit(azureKit)` and `registerKit(githubKit)` before ReactDOM render. Kits register into `defaultRegistry` (tools, used by engine + MCP) and `defaultConnectorRegistry` (connectors, shared with Azure Functions).

## Test Coverage

23 contract tests in `integration-kit.test.ts`. All 309 tests green.

## What's NOT included

- Actual React component implementations for azureLoginCard/azureResourcePicker/githubLoginCard/githubRepoPicker — those are `ComponentRegistration` descriptors only. Fry wires the React components in the web package when building those components.
- Kit-level connector injection into `APIConnectorContext` React registry — the context still manages its own connector instances. The kit's connectors go into `defaultConnectorRegistry` for engine/server use. Cross-wiring deferred to when auth connectors are built (B-14).
# APIConnector & IntegrationKit Audit

**Date:** 2025-07-24
**Author:** Bender (Backend Dev)
**Requested by:** Ahmed Sabbour

---

## APIConnector System

### `APIConnector` Interface (`packages/core/src/connectors/types.ts`)
✅ **Working.** Clean interface with `name`, `baseUrl`, `authenticate()`, `request()`, `isAuthenticated()`. All three connectors implement it correctly.

### `APIConnectorRegistry` (`packages/core/src/connectors/registry.ts`)
✅ **Working.** Map-backed registry with `register()`, `get()`, `has()`, `names()`, `unregister()`. Shared singleton `defaultConnectorRegistry` is used by both kits and React context. No issues.

### `AzureARMConnector` (`packages/core/src/connectors/AzureARMConnector.ts`)
⚠️ **Stubbed (by design).**
- `authenticate()` is a no-op (TODO B-14 MSAL).
- `isAuthenticated()` always returns `false` since `_token` starts null.
- `request()` is a **real implementation** — it builds a proper fetch with auth headers, content-type, signal. Will work once a token is set.
- Domain methods (`listResources`, `getResource`, `createResource`) return **stub data** when not authenticated, and delegate to real ARM calls when authenticated.
- **No crashes or noisy warnings.** Stub path is silent and well-shaped.

### `GitHubConnector` (`packages/core/src/connectors/GitHubConnector.ts`)
⚠️ **Stubbed (by design).**
- Same pattern as AzureARM: `authenticate()` is a no-op (TODO B-14 OAuth Device Flow).
- `request()` is real — proper fetch with GitHub API headers, auth token injection.
- Domain methods (`getRepo`, `createRepo`, `listBranches`) return stub data when not authenticated.
- **No crashes or noisy warnings.**

### `PricingConnector` (`packages/core/src/connectors/PricingConnector.ts`)
✅ **Working.**
- `authenticate()` is a no-op (correct — public API, no auth needed).
- `isAuthenticated()` always returns `true`.
- `request()` is a real fetch to `prices.azure.com`.
- `estimateCost()` uses a **stub pricing table** (not the real API) but returns well-shaped data.

### CORS Proxy Endpoints
✅ **Working.** All three Azure Functions proxy handlers are properly implemented:
- `/api/arm-proxy/{*path}` — forwards to `management.azure.com`, requires auth header, injects default api-version.
- `/api/github-proxy/{*path}` — forwards to `api.github.com`, auth optional, correct API headers.
- `/api/pricing-proxy` — forwards to `prices.azure.com/api/retail/prices`, no auth, 5-minute cache header.
- **Note:** Connectors currently call upstream APIs directly (not through proxies). When CORS blocks browser calls, the connectors will need to be updated to route through these proxies.

### React Context (`packages/web/src/contexts/APIConnectorContext.tsx`)
✅ **Working.** Clean provider/hook pattern:
- `APIConnectorProvider` creates a registry with all 3 connectors, calls `authenticate()` on mount.
- `useAPIConnector(name)` hook for individual lookup.
- `useAPIConnectorRegistry()` hook for full registry access.
- Errors on `authenticate()` are intentionally swallowed (correct for stub connectors).

---

## IntegrationKit System

### `IntegrationKit` Interface (`packages/core/src/kits/types.ts`)
✅ **Working.** Bundles tools, connectors, prompts, phasePrompts, and component registrations.

### `IntegrationKitRegistry` (`packages/core/src/kits/registry.ts`)
✅ **Working.** `register()` auto-wires kit tools into `ToolRegistry` and kit connectors into `APIConnectorRegistry`. The `registerKit()` convenience function delegates to the singleton `defaultKitRegistry`.

### `azureKit` (`packages/core/src/kits/azure-kit.ts`)
✅ **Working.**
- Registers 3 tools: `azure_resource_list`, `azure_resource_get`, `estimate_cost`.
- Registers 2 connectors: `AzureARMConnector`, `PricingConnector`.
- Has proper phase-specific and general system prompts.
- Registers 2 component types: `azureLoginCard`, `azureResourcePicker`.

### `githubKit` (`packages/core/src/kits/github-kit.ts`)
✅ **Working.**
- Registers 1 tool: `github_repo_info`.
- Registers 1 connector: `GitHubConnector`.
- Proper phase-specific and general system prompts.
- Registers 2 component types: `githubLoginCard`, `githubRepoPicker`.

### Tool Implementations
⚠️ **All 4 tools are stubbed but functional:**
- `azure_resource_list` — returns hard-coded AKS + ACR resources with `_stub: true` flag.
- `azure_resource_get` — returns hard-coded cluster properties with `_stub: true` flag.
- `estimate_cost` — returns computed estimates from a stub pricing table with `_stub: true` flag.
- `github_repo_info` — returns hard-coded repo metadata with `_stub: true` flag.
- All tools are callable, return well-shaped data, and don't crash.

### Kit Registration at App Startup
✅ **Working.** `main.tsx` calls `registerKit(azureKit)` and `registerKit(githubKit)` before rendering.

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| APIConnector interface | ✅ Working | Clean, well-typed |
| APIConnectorRegistry | ✅ Working | Map-backed, thread-safe |
| AzureARMConnector | ⚠️ Stubbed | Auth no-op, request() is real, domain methods return stubs |
| GitHubConnector | ⚠️ Stubbed | Auth no-op, request() is real, domain methods return stubs |
| PricingConnector | ✅ Working | No auth needed, estimateCost uses stub pricing table |
| CORS proxy (arm) | ✅ Working | Azure Function, requires auth header |
| CORS proxy (github) | ✅ Working | Azure Function, auth optional |
| CORS proxy (pricing) | ✅ Working | Azure Function, no auth, cached |
| React context | ✅ Working | Provider + hooks, silent auth on mount |
| IntegrationKit interface | ✅ Working | Clean bundle type |
| KitRegistry | ✅ Working | Auto-wires tools + connectors |
| azureKit | ✅ Working | 3 tools, 2 connectors, prompts |
| githubKit | ✅ Working | 1 tool, 1 connector, prompts |
| Kit startup registration | ✅ Working | main.tsx registers both kits |
| Tool implementations | ⚠️ Stubbed | All 4 tools return stub data with `_stub: true` |

**No bugs found.** The system is architecturally sound. Auth is intentionally stubbed pending MSAL (B-14). Connectors don't crash, don't log noisy warnings, and return well-shaped stub data. The `request()` methods are real implementations that will work once tokens are set.

**Next milestone:** B-14 (MSAL + GitHub OAuth) will complete the auth story. When that lands, connectors will need to route through the CORS proxies instead of calling upstream APIs directly from the browser.

---


---

## Decisions Merged from Inbox (2026-04-10T07:00Z)

### 2026-07-26: Decision — A2UI Message Protocol for Dynamic Surfaces
**Author:** Bender  
**Status:** Accepted (enforced by fix for #54)

When creating A2UI surfaces dynamically (e.g. from LLM responses), always use the **two-message pattern**:
1. `{ version: 'v0.9', createSurface: { surfaceId, catalogId } }` — creates an empty surface
2. `{ version: 'v0.9', updateComponents: { surfaceId, components: [...] } }` — adds components

Never put a `body` field on `createSurface` — it is silently ignored. One component in the `updateComponents` array **must** have `id: "root"` — this is the renderer's entry point. Components use the flat format: `{ id, component, ...props, children: ["child-id-refs"] }`. Never nest component objects inline.

**Implications:**
- Any new code that creates A2UI surfaces must follow this pattern.
- LLM system prompts that generate A2UI must teach the flat format with `id: "root"`.
- The `normalizePlaygroundComponents()` function in Playground.tsx can be reused as a safety net for LLM output normalization.

---

### 2026-07-27: Decision — Content Safety Guardrails for LLM-Generated Content
**Author:** Bender  
**Status:** Implemented

Public-facing LLM endpoints (inspirations, converse) could generate or respond to inappropriate content. Two layers of defense:

1. **System prompt hardening** — All 4 inspiration generation prompts include a safety clause forbidding weapons, violence, illegal activities, adult content, gambling, and harmful/offensive ideas.
2. **User input pre-flight check** — New `content-safety.ts` module performs lightweight LLM classification (`safe`/`unsafe`) on user messages before they reach the main converse flow. Uses `maxTokens: 10`, `temperature: 0` for speed/cost. Gracefully skips if OpenAI is unavailable or the check fails.

**Implications:**
- All agents/team members adding new LLM prompts should include the safety clause.
- The content safety check uses the chat deployment (not inspire), keeping it on the faster model path.
- This is a first layer — not a comprehensive content moderator. Future work may add Azure Content Safety service integration.

---

### 2026-07-27: Decision — Dedicated /api/playground Endpoint for A2UI Playground
**Author:** Bender  
**Status:** Accepted

Playground Create tab was calling `/api/converse`, which uses the full Kickstart onboarding engine (phases, kit skills, phase indicators). Wrong context — the playground needs free-form A2UI component generation, not an AKS deployment guide.
## Merged from Inbox

### 2026-04-10: A2UI Message Protocol for Dynamic Surfaces (Bender)

When creating A2UI surfaces dynamically (e.g. from LLM responses), always use the two-message pattern:
1. `{ version: 'v0.9', createSurface: { surfaceId, catalogId } }` — creates an empty surface
2. `{ version: 'v0.9', updateComponents: { surfaceId, components: [...] } }` — adds components

Never put a `body` field on `createSurface` — it is silently ignored. One component in the `updateComponents` array must have `id: "root"` — this is the renderer's entry point.

### 2026-04-10: Content Safety Guardrails for LLM-Generated Content (Bender)

Public-facing LLM endpoints (inspirations, converse) include two layers of defense:
1. System prompt hardening — All inspiration generation prompts include a safety clause forbidding weapons, violence, illegal activities, adult content, gambling, and harmful/offensive ideas.
2. User input pre-flight check — `content-safety.ts` performs lightweight LLM classification (`safe`/`unsafe`) on user messages before they reach the main converse flow.

All agents adding new LLM prompts should include the safety clause.

### 2026-04-10: Dedicated /api/playground Endpoint for A2UI Playground (Bender)

Created a dedicated `POST /api/playground` endpoint with:
- Its own system prompt focused on A2UI component design
- Its own lightweight in-memory session store (separate from onboarding sessions)
- JSON mode (`response_format: json_object`) for reliable structured output
- Simpler response shape: `{ sessionId, message, a2ui }` — no phases, no streaming
- Content safety via the existing shared `checkContentSafety` module

Frontend `Playground.tsx` updated to call `/api/playground` with direct fetch instead of SSE-based `useStreaming` hook.

**Rationale:**
- **Separation of concerns:** Playground and onboarding are fundamentally different use cases.
- **Simpler contract:** Playground doesn't need phases, tool calling, or SSE streaming — single JSON round-trip is cleaner and easier to debug.
- **Independent session state:** Playground sessions don't pollute onboarding session storage and vice versa.

---

### 2026-07-26: Decision — Widget Inspiration Prompts — Dev/Deploy/Ops Focus
**Author:** Bender  
**Status:** Implemented

Widget inspiration system (Ideas tab in Playground) was generating generic "chat-based AI assistant UX" component ideas. Too vague for one-shot component generation and not aligned with Kickstart's focus on Kubernetes/AKS deployment operations.
Frontend `Playground.tsx` updated to call `/api/playground` with direct fetch instead of the SSE-based `useStreaming` hook.

### 2026-04-10: Widget Inspiration Prompts — Dev/Deploy/Ops Focus (Bender)

All widget inspiration prompts are now scoped exclusively to:
1. Kubernetes deployment and operations (rollouts, scaling, pod health, events, logs)
2. CI/CD pipelines and container workflows (GitHub Actions, image builds, registry scanning)
3. Cloud infrastructure monitoring (resource usage, cost tracking, SLOs, alerting)
4. Developer productivity for cloud-native apps (Helm releases, GitOps sync, secret management)

Prompts now include explicit instructions to specify A2UI component types, realistic sample data, interactions, and layout — enabling one-shot complete component generation.

**Impact:**
- `widget-inspirations.ts` — Both streaming and non-streaming LLM prompts + 12 fallback ideas rewritten
- `playground.ts` — System prompt upgraded with one-shot design rules and worked example
- No API contract changes; temperature and token limits preserved

---

### 2026-07-18: Decision — ArchitectureDiagram Fluent 2 Theme & Auto-sizing
**Author:** Fry  
**Status:** Implemented

ArchitectureDiagram used Mermaid's `neutral` theme with fixed 400px viewport, producing tiny diagrams that didn't match Fluent 2 visuals.

**Choices:**
1. **Mermaid `base` theme with Fluent 2 `themeVariables`** — hardcoded hex values (not runtime tokens) since Mermaid config is static.
2. **SVG post-processing** — icon injection via keyword matching on node labels, rounded corners, thin strokes, flat styling.
3. **Auto-sizing viewport** — 300–800px range based on SVG natural dimensions.
4. **Fit-and-center** — diagram scales to fit container width and centers on render; reset button re-fits instead of going to 1:1.

**Rationale:**
- `theme: 'base'` gives full color control; `neutral` ignores `themeVariables`.
- Post-processing is necessary because Mermaid has no native icon support.
- Auto-sizing prevents "tiny diagram in a big box" problem and avoids scroll for small diagrams.

---

### 2026-07-18: Decision — SteppedCarousel Component Pattern
**Author:** Fry  
**Status:** Implemented

Needed wizard-style alternative to FormGroup for multi-step flows where showing all steps at once is overwhelming.

**Implementation:** Created `SteppedCarousel` as a custom A2UI component using the same `createReactComponent` pattern.
- **Client-side state only:** Step navigation is purely `useState` — no server round-trip needed for step changes.
- **Child-based content:** Each step references a `child` ComponentId, same delegation pattern as FormGroup. Step content is composable from any A2UI components.
- **No animation:** Simple content swap keeps it lightweight and avoids CSS transition complexity.

**Impact:** New component available in kickstart catalog. No breaking changes to existing components.

---

### 2025-07-27: Decision — PR + Tagged Release Workflow
**Author:** Leela  
**Status:** Accepted  
**Requested by:** Ahmed Sabbour

Team was pushing directly to main and deploying on every merge, creating risk. No gate for review or rollback control. Ahmed requested proper flow: PRs for all work, tagged releases for production deploys.

**Branch Strategy:**
```
squad/{issue}-{slug} → PR to main → merge → tag release → deploy to SWA
```
- **Branch naming:** `squad/{issue-number}-{kebab-case-slug}` (existing convention, now enforced)
- **Main is protected:** Requires a PR to merge. 0 approvers required (agents are the team), but PR flow gives CI a gate.
- **No direct pushes to main.**

**CI on PRs (`.github/workflows/ci.yml`):**
1. Lint (`npm run lint`)
2. TypeScript check (`cd packages/web && npx tsc --noEmit`)
3. Build core, API, web
4. Unit tests (`vitest`)
5. Playwright e2e tests

**SWA Deploy on Tags (`.github/workflows/deploy-swa.yml`):**
Production deploys trigger on:
- **Version tags:** `v*` (e.g., `v0.2.0`)
- **Manual dispatch:** `workflow_dispatch` (emergency deploys)

PR preview environments still work — `pull_request` trigger is preserved for staging builds. Staging environments close when PRs close.

**Release Flow:**
1. Each PR includes a changeset (`npx changeset`) describing the change
2. When ready to release: `npx changeset version` bumps versions + updates CHANGELOG
3. Tag the release: `git tag v0.X.Y && git push --tags`
4. Tag push triggers SWA production deploy automatically

**Who Can Tag Releases:**
- **Ahmed (human):** Manual releases at any time
- **Ralph (automated):** Can tag releases after N PRs merge (future automation)
- **Philosophy:** Release early, release often

**Infra and Docs Deploys:**
`deploy-infra.yml` and `deploy-docs.yml` still trigger on push to main (path-scoped). Lower-risk, no tag gate needed. Can be revisited later.

---

### 2026-04-10T06:03Z: User Directive — Project Board Integration
**By:** Ahmed Sabbour  
**What:** Use GitHub project board (https://github.com/users/sabbour/projects/3/views/2) and move items through stages (Backlog → Ready → In progress → In review → Done) as agents work on them.
**Why:** User request — captured for team memory

---

### 2026-04-10T06:03Z: User Directive — Deploy from Tagged Releases Only
**By:** Ahmed Sabbour  
**What:** Only deploy to public website from tagged releases. Use pull requests for work instead of pushing directly to main. Agents should create branches, open PRs, and releases can be cut early and often.
**Why:** User request — production deployment control. No more direct pushes to main.

---

### 2026-04-10T06:08Z: User Directive — Milestones Tied to Releases
**By:** Ahmed Sabbour  
**What:** Use GitHub milestones when updating work items. Tie milestones to releases so work is grouped by version.
**Why:** User request — captured for team memory

---

### 2026-04-10T06:08Z: User Directive — SWA Slots for Pre-Prod/Prod
**By:** Ahmed Sabbour  
**What:** If SWA supports slots or similar, use main branch as pre-prod and tagged releases as prod deployment. Investigate SWA preview/staging environments.
**Why:** User request — production deployment control

---

### 2026-04-10T06:08Z: User Directive — Track ALL Work on GitHub Issues
**By:** Ahmed Sabbour  
**What:** Always track work backlog on GitHub Issues to avoid losing context and memory. Don't rely on in-memory state or decisions.md alone — GitHub is the source of truth for work items.
**Why:** User request — durability of work tracking across sessions

---

### 2026-04-10T06:08Z: User Directive — Hire Consultant for Complex/Stuck Work
**By:** Ahmed Sabbour  
**What:** For complex things that have been failing, need a second opinion, or involve major architecture decisions/redesigns, hire a 3rd-party "consultant" agent using gpt-5.4 model. This is a temporary team member for specific tasks.
**Why:** User request — escalation path for hard problems

---

### 2026-04-10T06:52:30Z: User Directive — Claude Opus 4.6 for Code
**By:** Ahmed Sabbour  
**What:** Use claude-opus-4.6 for all code-writing work (implementation, refactoring, bug fixes, test code, prompts).
**Why:** User request — captured for team memory

---

### 2026-04-10T06:53:57Z: User Directive — GitHub Comments on Issues
**By:** Ahmed Sabbour  
**What:** As part of workflow, each issue must be updated with major findings in form of GitHub comments. When agents work on issue, they should post comments summarizing key findings, decisions, progress, and results.
**Why:** User request — captured for team memory

---

### 2026-04-10T07:01:13Z: User Directive — Assign Issues to @sabbour
**By:** Ahmed Sabbour  
**What:** When agent picks up work in Ralph loop, assign GitHub issue to @sabbour since AI agents have no GitHub accounts. Use `gh issue edit <number> --add-assignee sabbour`.
**Why:** User request — agents can't be assigned issues directly, so use human owner's account.

Prompts now include explicit instructions to specify A2UI component types, realistic sample data, interactions, and layout.

### 2026-04-10: ArchitectureDiagram Fluent 2 Theme & Auto-sizing (Fry)

ArchitectureDiagram now uses:
1. Mermaid `base` theme with Fluent 2 `themeVariables` (hardcoded hex values, not runtime tokens)
2. SVG post-processing for icon injection via keyword matching, rounded corners, thin strokes, flat styling
3. Auto-sizing viewport (300–800px range based on SVG natural dimensions)
4. Fit-and-center logic — diagram scales to fit container width and centers on render; reset button re-fits

### 2026-04-10: SteppedCarousel component pattern (Fry)

Created `SteppedCarousel` as a custom A2UI component using the `createReactComponent` pattern:
- Client-side state only via `useState` — no server round-trip for step changes
- Child-based content — each step references a `child` ComponentId for composable step content
- No animation — simple content swap keeps it lightweight

### 2026-04-10: PR + Tagged Release Workflow (Leela, Ahmed directive)

All work flows through PRs:
```
squad/{issue}-{slug} → PR to main → merge → tag release → deploy to SWA
```

CI runs on every PR (lint, TypeScript check, build, unit tests, Playwright e2e). Production deploys trigger on version tags `v*` or manual dispatch. Each PR includes a changeset; release tags are created with `git tag v0.X.Y && git push --tags`.

### 2026-04-10: Sprint Planning — Release Roadmap v0.2.0–v0.5.0 (Leela)

Four milestones created mapping to tagged releases, grouping by Priority order, dependency chains, and agent capacity balance:

- **v0.2.0 — Core Loop** (34 story points, 10 issues): End-to-end app functionality + release infra
- **v0.3.0 — Feature Enrichment** (40 story points, 8 issues): API integrations + rich components
- **v0.4.0 — Polish & Prompt Tuning** (17 story points, 12 issues): Prompt accuracy + UI polish
- **v0.5.0 — Stretch** (68 story points, 18 issues): All P2 nice-to-have items

### 2026-04-10: Project Board Fields Required on All Issues (Ralph directive)

All GitHub issues must have:
1. **Priority** — P0, P1, P2
2. **Size** — XS, S, M, L, XL (story points)
3. **Estimate** — Fibonacci points matching Size
4. **Status** — Backlog → Ready → In progress → In review → Done

Update Status as work progresses through lifecycle stages.

### 2026-04-10: User directives (Ahmed Sabbour, Copilot captured)

- **2026-04-10T06:03Z:** Use GitHub project board stages (Backlog → Ready → In progress → In review → Done) as agents work on items.
- **2026-04-10T06:03Z:** Deploy from tagged releases only. Use PRs for work, no direct pushes to main.
- **2026-04-10T06:08Z:** Use GitHub milestones tied to releases to group work by version.
- **2026-04-10T06:08Z:** Investigate SWA slots for pre-prod/prod deployment (main = pre-prod, tags = prod).
- **2026-04-10T06:08Z:** Track ALL work on GitHub Issues — GitHub is the source of truth, not in-memory state.
- **2026-04-10T06:08Z:** For complex/stuck work, hire a 3rd-party "consultant" agent using gpt-5.4 model.
- **2026-04-10T06:28Z:** Always set Estimate (1/2/3/5/8) and Priority (Critical/Important/Nice-to-have) on all issues. Update Status as work moves.
- **2026-04-10T06:34Z:** Milestones must be set on all issues. Use sprint planning and sprint retro ceremonies. Derive roadmap from work item details.

## 2026-04-10: Post v0.2.0 Decisions

### 2026-04-10T10:42Z: User directive — Lead does not write code

**By:** Ahmed Sabbour (via Copilot)

When review comments on Leela's PRs require code changes, route the implementation fix to Fry (frontend) or Bender (backend), not Leela. Leela reviews and triages; she does not write feature code. This aligns with her charter boundary.

**Why:** User correction — Leela was incorrectly routed to make an aria-expanded code fix on PR #76 when Fry should have handled it.

### 2026-04-10T10:45Z: User directive — capture review process inefficiencies in retro

**By:** Ahmed Sabbour (via Copilot)

Sprint retros must capture inefficiencies in the PR review process and propose improvements. Key issues observed in v0.2.0:
1. Copilot reviewer never gives APPROVED status, always COMMENTED — causes merge blocks requiring --admin bypass.
2. Review comment loops — same comment re-flagged after fix because Copilot doesn't diff against previous review.
3. Agents addressing review comments should be routed by charter (Fry/Bender for code, Leela for triage only).
4. Force pushes from rebase create timeline noise.

**Why:** User request — improve velocity by streamlining the review→merge pipeline.

### 2026-04-10T10:49Z: User directive — track wall-clock time vs estimates in retros

**By:** Ahmed Sabbour (via Copilot)

Sprint retros must include actual wall-clock time spent on work items compared to story point estimates. This data should be used to calibrate future estimates and improve roadmap planning. Retroactively include this in the current v0.2.0 retro.

**Why:** User request — better velocity tracking for accurate sprint planning and roadmap estimates.

### 2026-04-10: OIDC credentials use `secrets.*` not `vars.*`

**Date:** 2026-04-10  
**Author:** Bender  
**Context:** PR #65 review by Copilot

All references to AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_SUBSCRIPTION_ID in prompt knowledge, workflow generators, and documentation MUST use `${{ secrets.* }}` — NOT `${{ vars.* }}`.

**Rationale:** The existing codebase (deploy-infra.yml, github-actions.ts generator, demo-scenarios.ts, docs/deployment.md) uniformly uses `secrets.*` for these values. While GitHub supports both `vars` and `secrets`, mixing them causes inconsistent generated workflows and confuses the LLM. One convention, enforced everywhere.

**Scope:** Prompt knowledge (kits), workflow generators, documentation, demo scenarios.

### 2026-04-10: Questionnaire schema conventions

**Date:** 2026-04-10  
**Author:** Fry  
**Context:** PR #66 review feedback

1. **IDs in component schemas must use `z.string()`, not `DynamicStringSchema`** — IDs are used as React keys and state-map keys and must be stable literals. `DynamicStringSchema` allows data-bindings/function calls that can produce unstable values.

2. **All interactive components must expose `ActionSchema` callback props** (e.g., `onSubmit`, `onSelect`) instead of hard-coding event names. This is the established catalog convention (AzureLoginCard, RadioGroup, GitHubRepoPicker all follow it).

3. **Required-field validation must gate submit** — visual `*` markers without actual validation is a UX bug. Submit buttons should be disabled until all required fields pass.

### 2025-07-17: Split Playwright E2E into separate CI job

**By:** Fry  
**What:** CI workflow now has two jobs: `lint-build` (must pass) and `e2e` (continue-on-error: true). E2E job builds core + web before running Playwright so it has the artifacts it needs, but failures don't block PRs.  
**Why:** 15 pre-existing Playwright failures were blocking unrelated PRs (like the TS error fix in PR #68). This unblocks merges while a separate issue tracks fixing the tests.

### 2026-04-10: Update PR #76 description to reflect Theater/Tutorial removal

**Date:** 2026-04-10  
**Author:** Leela  
**Context:** Copilot reviewer flagged that PR #76's description mentioned disabled Theater and Tutorial sidebar items, but the implementation only has 5 tabs. Theater/Tutorial were intentionally removed per issue #79.

**Decision:** Updated PR description to remove Theater/Tutorial references and document the removal per #79. This is a description-only change — no code impact.

**Rationale:** PR descriptions must match shipped code to avoid reviewer confusion and maintain accurate change logs.

### 2026-04-10: v0.2.0 Sprint Retro Action Items

**Author:** Leela (Lead)  
**Date:** 2026-04-10  
**Status:** Accepted  
**Context:** Sprint Retro for v0.2.0 milestone

**D1: Charter-Respecting Routing**

Agents must not be routed to work outside their charter boundaries. Specifically, Lead (Leela) should never be spawned to write feature code. If a task requires code implementation, route to Fry (frontend) or Bender (backend) based on the affected package.

**Rationale:** PR #76 had Leela writing an aria-expanded fix — a clear frontend implementation task that belongs to Fry. This wastes Lead capacity and blurs ownership.

**D2: Copilot Review Workaround**

The `copilot-pull-request-reviewer[bot]` only posts COMMENTED reviews, never APPROVED. Branch protection should not require Copilot approval as a merge gate. Options:
- Adjust branch protection to require 0 approvals (rely on CI + squad review)
- Add a human approval bypass for bot-reviewed PRs

**Rationale:** Copilot reviewer is useful for feedback but cannot satisfy approval requirements, creating unnecessary merge friction.

**D3: Force-Push Noise Reduction**

Rebase + force-push cycles should be minimized. Preferred approach:
- Rebase only once before marking PR ready (not on every push)
- Use squash-merge to keep main history clean regardless of branch history
- Document in PR workflow skill

**Rationale:** Multiple force pushes per PR create noisy notifications and can invalidate review comments.

**D4: Mandatory Story Point Estimates**

All issues must have an Estimate field set during sprint planning. This enables meaningful velocity tracking in retros.

**D5: Feature PRs Include Test Updates**

Feature PRs that change UI behavior must include Playwright test updates or explicitly flag test debt as a follow-up issue. No silent test breakage.

---

# Decision: Track and prioritize post-v0.2.0 security hardening before v0.3.0

- **Author:** Zapp
- **Date:** 2026-04-10
- **Status:** Proposed

## Context
A full security audit was executed across API, AI/LLM integration, frontend rendering, infrastructure, and dependencies. Multiple exploitable or high-likelihood weaknesses were identified that materially affect security posture.

## Decision
Create and track explicit remediation work under a dedicated **Security** milestone with severity-tagged issues and OWASP mapping. Prioritize remediation in this order:
1. Frontend XSS vectors (#81, #82)
2. Public AI endpoint abuse controls (#83)
3. Prompt and error-information exposure (#84, #85)
4. Browser and infra hardening (#86, #87)
5. Supply-chain cleanup (#88)

## Consequences
- Security debt is now visible and schedulable for v0.3.0 planning.
- Release risk reduces by addressing exploitable client-side and API-surface vulnerabilities first.
- Future security reviews should block release if High findings remain open.

---

# Decision: DOMPurify for all dangerouslySetInnerHTML

**Date:** 2026-04-10
**Author:** Fry
**Issues:** #81, #82
**PR:** #90

## Decision

All `dangerouslySetInnerHTML` usage in the web package must route HTML through `sanitizeHtml()` from `packages/web/src/utils/sanitize.ts` (DOMPurify with strict allowlist). Code highlight fallback paths must use `escapeHtml()` entity encoding to prevent raw content injection.

## Rationale

Security audit (Zapp) flagged ChatMessage, CodeBlock, and FileEditor as High-severity XSS vectors. DOMPurify is the industry standard for HTML sanitization with a minimal allowlist approach.

---

# Decision: API Security Hardening

**Date:** 2026-04-10
**Author:** Bender
**PR:** #89
**Issues:** #83 (CRITICAL), #84 (MEDIUM), #85 (MEDIUM)

## Context

Zapp's security audit (v0.2.0) identified three API vulnerabilities: unauthenticated AI endpoints, system prompt exposure, and internal error leakage.

## Decisions

1. **SWA auth for AI endpoints.** `/api/converse`, `/api/playground`, `/api/action`, `/api/generate` now require `authenticated` role via SWA config. Public-safe endpoints (`/api/health`, `/api/inspirations`) stay anonymous.

2. **In-memory rate limiter as defense-in-depth.** Sliding-window rate limiter at `lib/rate-limiter.ts` (30 req/min per IP). Applied to all AI endpoints. This supplements SWA auth — even authenticated users get throttled.

3. **Never return system prompts to clients.** The `systemPrompt` field was removed from the converse response type and response body. Clients don't need it, and it exposes attack surface for prompt injection.

4. **Generic error messages only.** All API error handlers use shared `lib/error-response.ts` utilities (`safeErrorResponse`, `safeStreamError`). Clients receive `"An error occurred processing your request."` — never raw exception text. Full details (including stack traces) are logged server-side.

## Convention

Any new API endpoint that calls an LLM **must** import `checkRateLimit` + `safeErrorResponse` from the shared lib.

---

# Decision: Security Sprint Planning Decisions
**Date:** 2026-04-10  
**Facilitator:** Leela (Lead)  
**Participants:** All-active (Fry, Bender, Hermes, Zapp)

---

## Decisions

### Decision 1: Sprint Goal & Scope
**Decision:** Execute all 8 security findings (#81–#88) from Zapp's audit in a single focused sprint before v0.3.0.

**Rationale:**
- All 8 issues are triaged, assigned, and ready to start
- Security-critical nature justifies dedicated sprint (XSS and API auth are high-impact)
- Clearing security backlog before feature development improves team confidence
- v0.2.0 shipped; team has momentum and fresh context

**Consequences:**
- Sprint slightly over-capacity (39 pts vs 35 pt baseline), but justified by criticality
- Feature work deferred to v0.3.0; schedule reflected in roadmap
- Requires Zapp availability for architecture reviews (coordinated upfront)

**Approved by:** Leela

---

### Decision 2: Story Point Estimates (Fibonacci Scale)
**Decision:** Assign estimates using Fibonacci scale (1, 2, 3, 5, 8, 13) based on complexity and effort.

| Issue | Points | Reasoning |
|-------|--------|-----------|
| #81 | 5 | XSS audit (chat component) + sanitization + testing |
| #82 | 5 | XSS audit (CodeBlock/FileEditor) + mitigation + testing |
| #83 | 8 | Full API surface audit, auth middleware, rate limiting, broad test coverage |
| #84 | 3 | Targeted fix (redact system prompt), low risk |
| #85 | 5 | Error handling audit across all handlers, standardization work |
| #86 | 3 | CSP header middleware, browser testing |
| #87 | 8 | Key Vault integration, CI/CD injection, dev environment setup |
| #88 | 2 | npm audit, dependency resolution, regression testing |

**Sprint Total:** 39 story points

**Rationale:**
- Estimates based on auditor (Zapp) discovery + complexity of fix
- P0 critical = 5–8 pts (high complexity, broad impact)
- P1 important = 3–8 pts (medium-to-high complexity)
- P2 nice-to-have = 2 pts (straightforward dependency work)
- 8-point estimates reflect cross-cutting nature (#83 API audit, #87 infra work)

**Approved by:** Leela

---

### Decision 3: Agent Capacity & Skill Alignment
**Decision:** Allocate issues to maximize parallel execution and match agent expertise.

| Agent | Assigned | Points | Justification |
|-------|----------|--------|---------------|
| **Fry** (Frontend) | #81, #82, #86 | 13 pts | XSS vulnerabilities (DOM/component-level) + CSP header config. Fry's core competency. |
| **Bender** (Backend) | #83, #84, #85, #87 | 24 pts | API authentication, error handling, Key Vault infra. Bender's core competency. Largest load, justified by critical API work. |
| **Hermes** (QA) | #88 | 2 pts | Dependency updates and regression testing. Light load allows ad-hoc security testing support. |

**Parallelization Strategy:**
- Week 1: Fry (#81/#82) + Bender (#83) + Bender (#87) in parallel → fast P0 resolution
- Week 2: Fry (#86) + Bender (#84/#85) in parallel → P1 sweep
- Week 3: Hermes (#88) + team retesting

**Approved by:** Leela

---

### Decision 4: Review Gates & Zapp Involvement
**Decision:** All security PRs (#81–#87) require architecture review from Zapp before merge (hard gate). Standard code review is secondary.

**Rationale:**
- Zapp performed the audit; she understands threat model and remediation intent
- Security issues require domain expertise beyond code style review
- Sets precedent for security-critical work: architect first, then code review
- Hard gate prevents premature merge of incomplete security fixes

**Implementation:**
- Add `@zapp` as required reviewer on all #81–#87 PRs
- Target 24 hr SLA for Zapp review (coordinate calendar availability)
- Zapp focuses on: threat mitigation, compliance, design correctness (not style/nitpicks)
- Standard reviewer (Leela or domain expert) handles code quality after Zapp approval

**Note:** #88 (dependency management) is standard review only (no security architecture needed).

**Approved by:** Leela

---

### Decision 5: Dependency Sequencing
**Decision:** #83 (API auth audit) informs #84 and #85, but does not hard-block them. Can be done in loose sequence.

**Rationale:**
- Bender needs to understand full API surface before writing error handling (#85) and prompt redaction (#86)
- #83 discovery (1–2 days) is front-loaded; allows #84/#85 to start mid-Week 1
- Loose dependency avoids hard blocking; Bender can parallelize with #87 infra work while processing #83 findings

**Critical path:**
1. #81/#82 (Fry) and #83 (Bender) parallel → P0 complete by end Week 1
2. #84/#85/#86/#87 (Bender & Fry) parallel → P1 complete by end Week 2
3. #88 (Hermes) → P2 by end Week 3

**Approved by:** Leela

---

### Decision 6: Definition of Done for Security Issues
**Decision:** Each security issue must include: code fix, tests, Zapp architecture sign-off, standard code review, and regression testing.

**Checklist per issue:**
- [ ] Threat/vulnerability fixed (verified by Zapp)
- [ ] Automated tests added (unit + integration)
- [ ] Edge cases covered
- [ ] Zapp architecture review approved
- [ ] Standard code review approved
- [ ] CI/CD pipeline green
- [ ] Manual security verification (if applicable)
- [ ] Full test suite passes (no regressions)
- [ ] PR merged

**Approved by:** Leela

---

### Decision 7: Escalation & Risk Mitigation
**Decision:** If Zapp is unavailable or review is blocked, escalate to Leela immediately. Daily standup includes Zapp review status.

**Risks tracked:**
- Zapp availability (schedule reviews upfront)
- XSS pattern reuse across multiple components (scope creep in v0.3.0)
- Key Vault integration complexity (pair with infra if needed)
- Transitive dependency conflicts in #88 (full test suite mandatory)

**Approved by:** Leela

---

## Appendix: Issue Triage Summary

All 8 security issues were triaged by Zapp (Security Architect) and are ready for sprint execution:

| # | Title | Severity | Assigned | Status |
|---|-------|----------|----------|--------|
| #81 | XSS in assistant chat message rendering | High | Fry | Ready |
| #82 | XSS in CodeBlock/FileEditor highlight fallback | High | Fry | Ready |
| #83 | Public AI endpoints lack auth and rate limiting | High | Bender | Ready |
| #84 | /api/converse exposes full system prompt | Medium | Bender | Ready |
| #85 | API handlers leak internal error details | Medium | Bender | Ready |
| #86 | Missing Content-Security-Policy header | Medium | Fry | Ready |
| #87 | Infra secrets not integrated with Key Vault | Medium | Bender | Ready |
| #88 | Vulnerable transitive dev dependencies | Low | Hermes | Ready |

**Total:** 8 issues, 39 story points, 3 agents, 2–3 week sprint


---

## Sprint Planning & Process Governance (2026-04-10)

### Decision 8: ServicePack Security Conditions Implementation
**Date:** 2026-04-10  
**Author:** Bender  
**Decision:** All 4 security conditions from Zapp's review (issue #30) addressed in `squad/30-servicepack` branch (PR #103):

1. **Transactional register/unregister:** `register()` rolls back on `onActivate` failure (removes tools, connectors, ownership, kit entry; restores previous kit on re-register). `unregister()` keeps kit if `onDeactivate` throws.

2. **Cycle detection:** DFS-based `detectCycle()` walks existing dependency graph. Throws with human-readable cycle path (e.g. `A → B → C → A`).

3. **Auth schema validation:** `validateAuth()` runs before registration. Rejects empty provider, empty scopes, scopes containing empty strings. Warns on duplicate provider within same kit.

4. **Trust model documentation:** JSDoc on `IntegrationKit` interface and `IntegrationKitRegistry` class: "Kits are trusted first-party code. No sandboxing. If third-party kits needed, implement capability restrictions first."

**Implementation:** 16 new tests cover all conditions (61 total, all passing). `ToolRegistry.unregister()` was added as a side-effect (needed for rollback); matches existing `APIConnectorRegistry.unregister()`.

**Status:** Complete in PR #103 (61 tests passing)

---

### Decision 9: v0.3.0 Sprint Execution Plan
**Date:** 2026-04-10  
**Lead:** Leela  
**Decision:** Execute v0.3.0 as a 2-week sprint delivering foundational service architecture and component authoring capability. After closing #79 (fixed in PR #76), execute 8 issues in 3 waves:

1. **Wave 1 (Days 1–4):** Independent foundational items (#25, #34, #37, #44)
2. **Wave 2 (Days 5–7):** ServicePack abstraction + LLM tool system (#30, #26)
3. **Wave 3 (Days 8–10):** A2UI component packs (#31, #32)

**Critical Path:** #25 (ServiceConnector) → #30 (ServicePack) → #26 (LLM tools), #31/#32 (A2UI packs)

**Story Points & Velocity:**
- Total: 34 story points
- Velocity: 17 pts/week
- Commitment: 100%

**Assignments:**
- **Bender:** #25 (8), #34 (5), #37 (3), #26 (5) = 21 pts
- **Fry:** #44 (3), #31 (5), #32 (5) = 13 pts
- **Leela:** #30 design + architecture review
- **Hermes:** Testing, accessibility, E2E coverage

**Success Metrics:**
- All 8 issues completed
- >30 story points completed (>90%)
- Test coverage >80%
- WCAG A: All new components
- Release: v0.3.0 tagged 2026-04-24

---

### Decision 10: IntegrationKit (ServicePack) Architecture Design
**Date:** 2026-04-10  
**Decider:** Leela  
**Related Issues:** #30 (B-10)  
**Decision:** Extend IntegrationKit with new optional fields and support dynamic kit-driven catalog assembly:

**D1:** Extend IntegrationKit, don't replace it. Add `auth` (KitAuthRequirement[]), `dependencies` (string[]), `onActivate`, and `onDeactivate` as optional fields to the existing interface. Fully backward-compatible.

**D2:** Kit-driven catalog assembly. Replace the hardcoded flat component list in `kickstart-catalog.ts` with a dynamic `buildCatalog()` function that assembles components from registered kits via `registerKitComponents()`. Web-layer kit component bindings live in `packages/web/src/kits/{kit-name}/components.ts`.

**D3:** Registration-time dependency validation. Enhanced `IntegrationKitRegistry.register()` validates that all declared dependencies are already registered and warns on tool/connector name collisions. Registration order is the caller's responsibility (no topological sorting).

**D4:** Auth requirements are declarative. Kits declare auth requirements (connector name + strategy + label) so the host app can wire providers without inspecting connector internals.

**D5:** `register()` becomes async to support lifecycle hooks (`onActivate`). Existing synchronous `registerKit()` convenience function wraps it.

**Impact:** Changes to `packages/core/src/kits/types.ts`, `packages/core/src/kits/registry.ts`, `packages/web/src/catalog/kickstart-catalog.ts`, and new directory `packages/web/src/kits/`.

**Status:** Approved by Zapp with 4 conditions (implemented in PR #103)

---

### Decision 11: Security Conditions for DP #30
**Date:** 2026-04-10  
**Reviewer:** Zapp  
**Issue:** #30  
**Decision:** APPROVED WITH CONDITIONS

**Required Conditions Before Implementation Sign-off:**
1. Registration/unregistration must be transactional with rollback on lifecycle hook failures.
2. Dependency validation must include explicit circular dependency detection (including re-registration paths).
3. `KitAuthRequirement` inputs must be schema-validated (provider allowlist + constrained scopes).
4. Trust boundary must be explicit: kits are trusted first-party code only unless sandbox/capability controls are added.

**Rationale:** These controls prevent authorization drift, inconsistent runtime state, and plugin-level abuse paths while preserving the DP's backward-compatible architecture.

**Status:** All conditions implemented in PR #103

---

## Ceremony & Process Improvements (2026-04-10)

### Decision 12: Enforce Full Ceremony Lifecycle
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**Decision:** Ralph must enforce the full ceremony lifecycle for every sprint:

1. **Sprint Planning** (before sprint starts) — Leela facilitates
2. **Design Review** (before multi-agent work on shared systems) — Leela facilitates, Zapp participates for security input
3. **Sprint Retro** (after sprint completes) — Leela facilitates, includes wall-clock vs estimate analysis

The Design Review ceremony is already in `ceremonies.md` but was being skipped. It must fire before Wave-level work where 2+ agents modify shared packages (e.g., packages/core).

**Rationale:** Design Reviews were being skipped despite being configured as auto-triggered ceremonies. This gate prevents architectural drift.

---

### Decision 13: Design Proposal (DP) Process — KEP-Inspired
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**Decision:** Implement a Design Proposal (DP) process with hard gates:

**Process:**
1. Issue = requirements + acceptance criteria (problem statement written by Ahmed/Leela)
2. Agent picks up issue and posts a **Design Proposal (DP)** comment on the issue BEFORE writing code
3. DP includes: problem statement, proposed approach, files to modify, patterns/dependencies, API contracts, security considerations, alternatives considered
4. Leela reviews DP for architecture quality
5. Zapp reviews DP for security
6. Both approve → agent implements
7. Draft PR opened for code review only (design already approved)
8. PR marked ready → CI → merge

**Key Principles:**
- Design discussion happens on the ISSUE, not the PR
- The DP comment IS the architecture decision record
- PRs are for code review only — design is settled before code starts
- For foundational issues, DP may reference a design doc in `docs/architecture/`
- DP is a HARD GATE — no coding until both Leela and Zapp approve
- Ralph enforces this gate by spawning agents in 3 steps: (1) post DP, (2) review by Leela+Zapp, (3) implement

**DP Ownership:**
- Issue body (problem + acceptance criteria) = written by Ahmed/Leela
- DP comment (proposed approach) = written by implementing agent
- Agents do NOT write problem statements — they propose solutions to defined problems

**Status:** New process effective immediately

---

### Decision 14: Ceremony Artifacts Linked on GitHub
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**Decision:** Ceremony artifacts must be visible and linked on GitHub, not buried in `.squad/log/`:

1. **Sprint Plans** → Create a GitHub Discussion (or issue comment on the milestone) linking to the plan. Include sprint goal, issue list, wave breakdown, capacity.
2. **Sprint Retros** → Create a GitHub Discussion (or issue comment on the milestone) with retro summary, including wall-clock vs estimates.
3. **Design Reviews** → Capture as comments on relevant issue(s). Include design decisions, participants, action items. If multi-issue, create a Discussion and link from each issue.

**Rationale:** Ceremony artifacts are invisible on GitHub. Stakeholders and future sessions can't find them without digging through `.squad/log/` files.

**Status:** Process updated

---

### Decision 15: Pre-Code Architecture Review (DP) Before Post-Code (PR)
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**Decision:** Architecture and security reviews happen at TWO points:

**BEFORE code (on the issue via DP):**
- Implementing agent posts Design Proposal comment on issue
- Leela reviews for architecture quality
- Zapp reviews for security concerns
- Implementation proceeds ONLY after both approve
- Lightweight format — 2-3 paragraphs

**AFTER code (on the PR):**
- Standard PR review as before — Leela for architecture, Zapp for security
- Catches implementation issues not visible in the approach

**Architecture Decision Records:**
- Each issue's DP comment becomes the architecture record
- Decisions affecting other issues go to `decisions.md` via inbox
- Foundational patterns (#25-type issues) create a design doc in `docs/architecture/`

**Rationale:** Reviews only on PRs mean architecture problems are caught after code is written — expensive to fix. Pre-code DP review is cheap and catches design issues early.

**Status:** Active (supersedes earlier approach-on-issue directive)

---

### Decision 16: Versioning Policy — Use Appropriate Semver Levels
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**Decision:** Releases use appropriate semver levels based on actual changes:

- **Patch** (v0.x.Y): bug fixes, security fixes, docs updates, dependency bumps — anything without new user-facing features
- **Minor** (v0.X.0): new features, new APIs, new capabilities
- **Major** (vX.0.0): breaking changes (post-1.0 only)

**Examples:**
- Security-fixes milestone = patch (v0.2.1)
- New feature sprint = minor (v0.3.0)
- Bug-only release = patch (v0.2.1)

**Rationale:** All releases were minor bumps regardless of content. Proper semver communicates what changed.

**Impact:** Changesets should specify the correct bump level in their metadata.

**Status:** Policy effective for future releases

---

---

### Decision 17: No Agent Lockout on Reviewer Rejection
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**What:** When a reviewer requests changes, the original author should address the feedback and resubmit — not be locked out. The lockout protocol from squad.agent.md is overridden for this project.

**Why:** The lockout pattern doesn't match real-world workflows where the author iterates on review feedback.

**Status:** Team memory / override

---

### Decision 18: Work-in-Progress Issue Status Visibility
**Date:** 2026-04-10  
**By:** Ahmed Sabbour (User Directive)  
**What:** When Ralph is working an issue (e.g., DP posted, review in progress, implementation started), the issue should be moved to "ready" or an equivalent in-progress state on GitHub. Issues shouldn't sit as "open/unstarted" when active work is happening.

**Why:** Visibility into what's actively being worked on vs. what's truly idle.

**Status:** Team memory / process improvement

---

### Decision 19: Azure A2UI Fat Component Patterns
**Author:** Fry (Frontend Dev)  
**Date:** 2026-07-27  
**Status:** Implemented  
**PR:** #104  
**Issue:** #31  

**Context:** Azure stub components needed to become self-managing ("fat") with real data fetching, auth flows, and security guardrails.

**Decisions:**

1. **Token metadata via React state** — Auth timestamps and subscription lists are tracked in `useState` after `authenticate()` resolves. Raw tokens are never exposed in UI. This keeps the connector API clean and follows the pattern already used by GitHubLoginCard.

2. **Operation allowlisting on AzureAction** — AzureAction validates ARM paths against a hardcoded Set of ~14 known resource types. Arbitrary ARM paths are blocked. This addresses Zapp's security finding about LLM-supplied write paths.

3. **Destructive operation confirmation** — DELETE operations require the user to type the resource name to confirm. Non-destructive operations (PUT/POST/PATCH) use a single-click confirm with action preview.

4. **Cascading picker with auto-select** — AzureResourcePicker cascades subscription → resource group → resource. Single-item results are auto-selected to reduce UX friction. Pre-filled props (`subscriptionId`, `resourceGroup`) skip the corresponding dropdown.

5. **Dynamic form fields by resource type** — AzureResourceForm generates type-specific fields (e.g., Kubernetes version for AKS, access tier for Storage) using string matching on the resource type name. Full ARM schema introspection deferred pending RBAC evaluation.

**Impact:**
- All 4 Azure A2UI components are now fat and production-ready
- New core types (AzureSubscription, AzureLocation) and methods (listSubscriptions, listResourceGroups, listLocations) available for other consumers
- azure-kit component registrations updated with full prop documentation

---

### Decision 20: GitHub A2UI Fat Component Security Patterns
**Author:** Fry (Frontend Dev)  
**Date:** 2026-04-12  
**Status:** Implemented  
**Related:** #32, DP v2 (Zapp-approved)  

**Context:** GitHub fat components needed security guardrails matching Zapp's review conditions from the DP v2. These patterns are now established and should be followed for any future integration kit components.

**Decisions:**

1. **In-memory token storage only** — GitHub tokens are stored in React component state via `useState`, never in `localStorage` or `sessionStorage`. This matches Zapp's explicit security condition. Sign-out clears React state; the connector re-authenticates on next use.

2. **Operation allowlisting for write components** — `GitHubAction` uses a `Set<string>` of allowed operation types. Any `operationType` prop not in the allowlist is blocked at the UI level before the user can click execute. Same pattern used for `AzureAction` with ARM resource types.

3. **Protected-branch blocking** — Both `GitHubAction` and `GitHubCommit` block direct writes to `main`, `master`, and `production` branches. This is a client-side guard matching GitHub's server-side branch protection.

4. **Typed confirmation for destructive operations** — DELETE methods require the user to type the exact resource name extracted from the API path. This follows the same state machine pattern used in `AzureAction`.

5. **Rate-limit handling** — All GitHub API responses check `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. Rate-limited responses show a warning MessageBar with the reset time.

**Impact:** These patterns are now the standard for any future integration kit components (e.g., if we add GitLab, Bitbucket, or other service packs). Security review should verify all new write-capable components follow these guardrails.

---

### Decision: Theme System Architecture
**Author:** Fry (Frontend Dev)  
**Date:** 2026-04-13  
**Status:** Approved (PR #129)  
**Issue:** #42  

**Context:** Theme customization system needed dark mode support with user preference persistence.

**Decisions:**
1. **Three-state ThemeMode** — `light | dark | system`. The `system` mode uses `matchMedia(prefers-color-scheme: dark)` and updates live when OS preference changes.
2. **resolvedTheme pattern** — Context exposes both `theme` (user choice) and `resolvedTheme` (actual light/dark). FluentProvider and CSS `data-theme` attribute use `resolvedTheme`.
3. **Default to system** — New users get OS-matching theme without action. Returning users get their saved preference from localStorage.
4. **Inline SVG icons** — ThemeToggle uses inline SVG (sun/moon/monitor) to avoid Fluent icon package dependency.

**Impact:** All components inheriting from FluentProvider automatically get themed tokens. CSS custom properties in theme.css continue to work via `data-theme` attribute on `<html>`.

---

### Decision: resolvedTheme Pattern as Standard
**Author:** Leela (Lead)  
**Date:** 2026-04-13  
**Status:** Approved  
**Issue:** #42 | **PR:** #129  

**Context:** Fry's theme system introduces a `resolvedTheme` pattern — separating user preference (`theme`: light/dark/system) from the rendered value (`resolvedTheme`: light/dark). This is a clean abstraction.

**Decision:** The `resolvedTheme` pattern should be the standard approach for any user setting that includes a "system/auto" option. Components rendering visual state use the resolved value; UI showing the current setting uses the raw preference.

**Also:** `useSyncExternalStore` is the preferred hook for subscribing to browser APIs (matchMedia, ResizeObserver, etc.) — prefer over manual useEffect+useState patterns.

**Impact:** Future settings with auto/system modes should follow this pattern. Document in architecture guide when next updated.

---

### Decision: Rules Engine Architecture Approved
**Author:** Leela (Lead)  
**Date:** 2026-04-13  
**Status:** Approved  
**Issue:** #49 | **PR:** #128  

**Decision:** The RulesEngine composition pattern (wrapping ValidationEngine) is the approved architecture for rule metadata, categorized filtering, and AKS constraint mapping. ALL_RULES serves as the canonical rule registry.

**Follow-up items:**
1. Fix container-port-names (DS014) regex to accept any valid port name, not just protocol prefixes.
2. Address cross-branch contamination process: PRs should only contain changes related to their issue.

**Status:** Approved — merge when ready.
