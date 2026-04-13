or hardcode them.
- **Consistent Fluent styling** — all components use `makeStyles`, `tokens`, and Fluent primitives. No inline hardcoded colors.

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
### Decision: Progressive Component Rendering — DP Approved, PR Scope Split Required
**Author:** Leela (Lead)
**Date:** 2026-07-27
**Status:** Pending split
**PR:** #126
**Issue:** #40

**Context:** Fry's DP for progressive component rendering (#40) proposes a three-layer pipeline: `useProgressiveQueue` hook (150ms stagger), mock streaming surface stagger (200ms), CSS `--enter-index` animation with layout shift prevention.

**Decisions:**

1. **DP architecture approved** — The three-layer approach is clean, follows existing patterns, introduces no new security surface. The `useProgressiveQueue` hook with refs for stale closure avoidance is the standard pattern for future staggered UI reveals.

2. **PR #126 requires scope split** — The PR bundles validation safeguards (issue #36, commit d023d31, ~1500 lines) with progressive rendering (#40). Per DP compliance policy, each PR maps to one issue. Fry must split #36 into its own branch/PR with its own DP review cycle.

3. **`--enter-index` is the standard for animated component entry** — Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` CSS custom property for consistent staggered appearance.

**Impact:** PR #126 blocked until #36 work is extracted. Progressive rendering code itself is approved and can merge once isolated.
### Decision: Progressive Component Rendering Pattern
**Author:** Fry (Frontend Dev)
**Date:** 2026-07-27
**Status:** Implemented
**PR:** #126
**Issue:** #40

**Context:** Components were rendered all at once after the LLM response completed, creating a jarring UX.

**Decision:**
1. **Timer-based progressive queue** — `useProgressiveQueue` hook sits between `onA2UI` and render state. Incoming surface IDs are queued and revealed one-at-a-time with a 150ms stagger delay. This pattern is independent of the streaming source (works for both mock and real SSE).

2. **Mock streaming stagger** — `sendMock()` emits each surface's A2UI message pair individually with 200ms delays, rather than dumping all at end. Groups by `createSurface` boundaries.

3. **CSS stagger via `--enter-index`** — Each component receives a `--enter-index` CSS custom property. Animation delay is `calc(var(--enter-index) * 60ms)`. This is the standard approach for any future animated component entry.

**Impact:** Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` for consistent progressive appearance.
### Decision: A2UI Component Accessibility Patterns
**Author:** Hermes (Tester)
**Date:** 2026-07-27
**Issue:** #43
**PR:** #124
**Status:** Implemented

**Context:** WCAG 2.1 AA audit revealed that the A2UI schema defines `accessibility.label` and `accessibility.description` on all components via CommonProps, but no component consumed these props. Additionally, custom interactive components (RadioGroup, ProgressSteps) lacked keyboard navigation and semantic roles.

**Decisions:**

1. **accessibility.label passthrough** — All components that render standalone elements (Icon, Image, Video, AudioPlayer, List) must read `props.accessibility?.label` and apply it as `aria-label`. Decorative elements default to `aria-hidden="true"`.

2. **Custom interactive components use WAI-ARIA patterns** — RadioGroup uses the roving tabIndex pattern (first item tabIndex=0, rest -1, arrow keys cycle). ProgressSteps uses semantic `<ol>/<li>` with `aria-current="step"`.

3. **Dynamic content needs `aria-live`** — Components that update in real-time (DeploymentProgress, SteppedCarousel content area) must include `aria-live="polite"` regions.

4. **Form label association** — All form components must connect labels to inputs via `htmlFor`/`id`. Required fields use `aria-required` and decorative asterisks are `aria-hidden="true"`.

5. **External link context** — Links opening in new windows must include visually-hidden "(opens in new window)" text and `aria-hidden="true"` on the external icon.

**Impact:** All future A2UI components must follow these patterns. The a11y test suite (`packages/web/src/__tests__/a11y-components.test.ts`) validates these patterns statically.
# Decision: IndexedDB VFS Architecture (Dual Filesystem + Sync Bridge)

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-12
**Status:** Implemented
**Issue:** #39

## Context

The app has two virtual filesystems with different lifecycle concerns:
1. **VirtualFileSystem** (in-memory) — tracks streaming state ("generating" vs "complete"), used for real-time file generation feedback during conversation.
2. **VirtualFS** (IndexedDB) — persistent storage that survives page reloads.

## Decision

Keep both filesystems. Add a sync bridge in `App.tsx` that auto-persists "complete" files from the in-memory FS to IndexedDB. The UI shows both:
- In-memory `FileEditor` for streaming feedback (generating state)
- IndexedDB `FileTreePanel` for persistent file browsing with Monaco

## Rationale

- Merging into one system would complicate the streaming pipeline (can't await IndexedDB during synchronous useSyncExternalStore updates).
- The sync bridge is a clean one-way flow: in-memory → IndexedDB on completion.
- Session clear/new wipes both stores to prevent stale data.

## Files Affected

- `packages/web/src/services/virtual-fs.ts` — VFSFile records, buildFileTree, clear()
- `packages/web/src/contexts/VirtualFSContext.tsx` — tree + fileRecords exposure
- `packages/web/src/components/FileTreePanel.tsx` — Fluent UI panel with Monaco
- `packages/web/src/App.tsx` — sync bridge + dual panel rendering
### Decision: A2UI Schema Props Require Type Narrowing for Native HTML Attributes
**Author:** Leela (Lead)
**Date:** 2026-07-27
**Issue:** #43
**PR:** #124
**Status:** Pending (fix required)

**Context:** The A2UI schema defines `accessibility.label` and `accessibility.description` as union types (`string | { path: string } | { call: string; args: Record<string, any>; returnType: string }`) to support dynamic resolution. When components pass these props directly to native HTML attributes like `aria-label`, TypeScript rejects the assignment because React expects `string | undefined`.

**Decision:** All A2UI components that consume `props.accessibility?.label` (or any other union-typed schema prop) for native HTML attributes must narrow the type first:

```tsx
const a11yLabel = typeof props.accessibility?.label === 'string'
  ? props.accessibility.label
  : undefined;
```

A shared utility (`resolveA11yLabel`) should be considered if this pattern appears in 5+ components.

**Impact:** Applies to all current and future A2UI components consuming CommonProps. Hermes to fix in PR #124; pattern to be documented in component guidelines.
# Decision: IndexedDB VFS Dual-Filesystem Architecture Approved

**Author:** Leela (Lead)
**Date:** 2026-04-13
**Status:** Approved
**Issue:** #39
**PR:** #125

## Context

Fry proposed a dual-filesystem architecture: in-memory VirtualFileSystem for streaming state and IndexedDB VirtualFS for persistence, connected by a one-way sync bridge.

## Decision

Architecture approved. The dual-FS approach is correct because:
1. In-memory FS uses synchronous useSyncExternalStore — cannot await IndexedDB in the streaming hot path.
2. One-way sync (in-memory to IndexedDB on "complete") avoids bidirectional state conflicts.
3. IDB v2 schema with lazy v1 record migration avoids destructive store rewrites.

## Impact

- Sets precedent for future persistence layers: keep streaming/real-time state separate from durable storage.
- buildFileTree() utility is reusable for any future file-browsing UI.
- Sync bridge pattern (subscribe + idempotent put) can be reused for other in-memory to persistent flows.




---
---
---
---




# Decision: Build metadata via Vite `define` (not inline scripts)

**Date:** 2026-04-13  
**Author:** Bender  
**Status:** Applied

## Context
The deployed SWA had two CSP `script-src 'self'` violations:
1. A leftover CDN `<script>` for `@fluentui/web-components` (unused after React migration)
2. An inline `<script>` setting `window.__BUILD_SHA__` (blocked by CSP)

The CI pipeline used `sed` to replace values in inline scripts at deploy time.

## Decision
- **All build metadata** (`__BUILD_VERSION__`, `__BUILD_SHA__`) is now injected via Vite `define` at build time
- **No inline scripts** in `index.html` — keeps CSP `script-src 'self'` clean
- **No `sed` hacks in CI** — the "Stamp build metadata" step is removed; Vite reads `GITHUB_SHA` from the environment during build
- **No CDN scripts** — all dependencies come through npm/bundler

## Convention
When adding new build-time constants, add them to `vite.config.ts` `define` block and declare the type in `src/vite-env.d.ts`. Never use inline `<script>` tags in `index.html`.
# Decision: Debug Mode UI Architecture

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-13
**Context:** v0.5.2 debug mode feature

## Decisions

1. **DebugContext as a separate React context** — not merged into ThemeContext or any existing context. Debug mode is orthogonal to theming and should be independently toggleable.

2. **Three activation methods:** URL param `?debug=true` (shareable), keyboard shortcut `Ctrl+Shift+D` (quick toggle during dev), localStorage persistence (sticky across sessions). URL param takes priority on page load.

3. **Debug header via apiFetch()** — the `x-kickstart-debug: true` header is injected at the `apiFetch()` layer (not in individual hooks or components). All authenticated API calls can opt into debug mode by passing the third parameter.

4. **DebugPanel uses Fluent makeStyles + tokens only** — no custom CSS classes, no raw HTML widgets. Follows the established pattern from the Fluent 2 audit.

5. **Graceful degradation** — the UI handles missing backend debug fields without crashing. Every field in `DebugMetadata` is optional, and the DebugPanel renders "Not available" for absent data. This means the frontend can ship before the backend debug fields are fully wired.
# Decision: IndexedDB VFS Architecture (Dual Filesystem + Sync Bridge)

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-12
**Status:** Implemented
**Issue:** #39

## Context

The app has two virtual filesystems with different lifecycle concerns:
1. **VirtualFileSystem** (in-memory) — tracks streaming state ("generating" vs "complete"), used for real-time file generation feedback during conversation.
2. **VirtualFS** (IndexedDB) — persistent storage that survives page reloads.

## Decision

Keep both filesystems. Add a sync bridge in `App.tsx` that auto-persists "complete" files from the in-memory FS to IndexedDB. The UI shows both:
- In-memory `FileEditor` for streaming feedback (generating state)
- IndexedDB `FileTreePanel` for persistent file browsing with Monaco

## Rationale

- Merging into one system would complicate the streaming pipeline (can't await IndexedDB during synchronous useSyncExternalStore updates).
- The sync bridge is a clean one-way flow: in-memory → IndexedDB on completion.
- Session clear/new wipes both stores to prevent stale data.

## Files Affected

- `packages/web/src/services/virtual-fs.ts` — VFSFile records, buildFileTree, clear()
- `packages/web/src/contexts/VirtualFSContext.tsx` — tree + fileRecords exposure
- `packages/web/src/components/FileTreePanel.tsx` — Fluent UI panel with Monaco
- `packages/web/src/App.tsx` — sync bridge + dual panel rendering
### Decision: Progressive Component Rendering Pattern
**Author:** Fry (Frontend Dev)
**Date:** 2026-07-27
**Status:** Implemented
**PR:** #126
**Issue:** #40

**Context:** Components were rendered all at once after the LLM response completed, creating a jarring UX.

**Decision:**
1. **Timer-based progressive queue** — `useProgressiveQueue` hook sits between `onA2UI` and render state. Incoming surface IDs are queued and revealed one-at-a-time with a 150ms stagger delay. This pattern is independent of the streaming source (works for both mock and real SSE).

2. **Mock streaming stagger** — `sendMock()` emits each surface's A2UI message pair individually with 200ms delays, rather than dumping all at end. Groups by `createSurface` boundaries.

3. **CSS stagger via `--enter-index`** — Each component receives a `--enter-index` CSS custom property. Animation delay is `calc(var(--enter-index) * 60ms)`. This is the standard approach for any future animated component entry.

**Impact:** Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` for consistent progressive appearance.
# Decision: RulesEngine layer + ALL_RULES canonical registry

**Author:** Hermes (Tester)
**Date:** 2026-07-28
**Status:** Implemented
**Issue:** #49
**PR:** #128

## Context

The validation system had 16 individual validators registered manually in `createDefaultValidationEngine()`. Adding 7 more validators for #49 (23 total) made it clear we needed a canonical registry and metadata layer.

## Decision

1. **`ALL_RULES` array** in `validation/index.ts` is the single source of truth for all validators. Both `createDefaultValidationEngine()` and `createDefaultRulesEngine()` iterate over it — no manual registration.

2. **`RulesEngine`** wraps `ValidationEngine` (composition, not inheritance) to add metadata without breaking existing API consumers.

3. **`ValidationRule`** type adds: category, tags, aksConstraint (optional), autoFixAvailable — enabling filtering and AKS Automatic policy mapping.

## Implications

- New validators go in the `ALL_RULES` array — never in individual factory functions.
- Categories map to AKS Automatic constraint families for policy alignment.
- Existing `ValidationEngine` and `createDefaultValidationEngine()` continue to work unchanged.
# Decision: MCP App is Primary MCP Surface for Kickstart

**Author:** Leela (Lead)
**Date:** 2026-07-26
**Issue:** #46

## Context

The v1 Design Proposal for multi-surface rendering (issue #46) treated MCP as a text/markdown-only surface. Three official specs — MCP Apps, A2UI over MCP, and A2UI Dynamic Rendering within MCP Apps — define a much richer path.

## Decision

1. **MCP App (sandboxed iframe with A2UI) is the primary MCP surface.** Text/markdown is the fallback, not the default. This reverses v1 D3.
2. **Three-tier degradation:** MCP App with A2UI (Tier 1) > A2UI EmbeddedResource (Tier 2) > text (Tier 3).
3. **A2UI payloads use `createSurface` + `updateComponents` message format** per the A2UI-over-MCP spec, replacing our flat `{ version, root }` documents.
4. **Tools declare `_meta.ui.resourceUri`** pointing to `ui://kickstart/app` for MCP App preloading.
5. **Resource Annotations** (`audience: ["user"]`) control whether LLMs see raw A2UI JSON.
6. **Bidirectional interactivity** via MCP Apps JSON-RPC is in scope (was previously excluded).

## Impact

- **Bender:** MCP server A2UI format changes in Phase 1; MCP App build pipeline in Phase 2.
- **Fry:** No immediate impact; web surface unchanged. Phase 4 integrates shared registry.
- **Hermes:** New test tiers for MCP App, A2UI resource, and text fallback paths.

## Revised DP

Posted as comment on issue #46. File updated at `dp-46-body.md`.
# Decision: Multi-Surface Rendering Architecture

**Author:** Leela (Lead)
**Date:** 2026-04-13
**Status:** Proposed (pending DP review)
**Issue:** #46
**Milestone:** v0.5.0

## Context

A2UI components currently render only in the web surface (React/Fluent UI). The MCP server has basic A2UI support (capability negotiation, `degradeToBasic()` fallback) but no per-component rendering pipeline. Issue #46 requires dual web + MCP rendering with a shared component registry.

## Decision

Introduce a **SurfaceAdapter** abstraction in `@kickstart/core` with per-surface implementations:

1. **`SurfaceAdapter<TOutput>` interface** — generic over output type, with `render()`, `supports()`, `renderFallback()` methods
2. **`SurfaceRegistry`** — manages adapter registration, dispatches rendering to the correct adapter
3. **`ComponentManifest`** — extends existing `ComponentRegistration` with optional `renderHints` (per-surface rendering strategy)
4. **`WebSurfaceAdapter`** — wraps existing `Catalog` class (no behavior change)
5. **`MCPSurfaceAdapter`** — new, with per-component renderers that produce text/markdown for MCP tool results

### Key architectural choices:

- **Surface = architectural boundary, not runtime detection.** Web and MCP are separate packages.
- **Adapter pattern over strategy pattern.** Output types are fundamentally different (ReactElement vs MCPContentItem).
- **MCP renderers produce text/markdown.** Most MCP clients render text natively; A2UI JSON requires client-side support.
- **Auth components omitted on MCP.** Auth is transport-level in MCP (OAuth, API keys).
- **`renderHints` is optional with sensible defaults.** Existing components work without changes.
- **Phase 1 is a pure refactor.** De-risks the abstraction before adding MCP rendering.

### Phasing:

1. **Phase 1 (Week 1):** Core interfaces + WebSurfaceAdapter wrapper (zero behavior change)
2. **Phase 2 (Weeks 2-3):** MCPSurfaceAdapter with per-component renderers
3. **Phase 3 (Weeks 3-4):** Kit-driven registration auto-wires both surfaces

## Impact

- All future A2UI components should include `renderHints.mcp` in their `ComponentManifest`
- Existing web rendering is unchanged (WebSurfaceAdapter wraps existing Catalog)
- MCP tool responses will return rich text representations instead of raw JSON fallbacks
- IntegrationKit `components` field gains `renderHints` and optional `mcpRenderer`
### Decision: Progressive Component Rendering — DP Approved, PR Scope Split Required
**Author:** Leela (Lead)
**Date:** 2026-07-27
**Status:** Pending split
**PR:** #126
**Issue:** #40

**Context:** Fry's DP for progressive component rendering (#40) proposes a three-layer pipeline: `useProgressiveQueue` hook (150ms stagger), mock streaming surface stagger (200ms), CSS `--enter-index` animation with layout shift prevention.

**Decisions:**

1. **DP architecture approved** — The three-layer approach is clean, follows existing patterns, introduces no new security surface. The `useProgressiveQueue` hook with refs for stale closure avoidance is the standard pattern for future staggered UI reveals.

2. **PR #126 requires scope split** — The PR bundles validation safeguards (issue #36, commit d023d31, ~1500 lines) with progressive rendering (#40). Per DP compliance policy, each PR maps to one issue. Fry must split #36 into its own branch/PR with its own DP review cycle.

3. **`--enter-index` is the standard for animated component entry** — Any future A2UI component rendering path should use the `a2ui-component--entering` class with `--enter-index` CSS custom property for consistent staggered appearance.

**Impact:** PR #126 blocked until #36 work is extracted. Progressive rendering code itself is approved and can merge once isolated.
# Security Review: DP #46 — Multi-Surface Rendering (v2)

**Reviewer:** Zapp, Security Architect  
**Date:** 2026-07-26  
**Status:** REJECT (Critical Security Issues Must Be Addressed)

---

## VERDICT: REJECT

The DP v2 introduces MCP Apps as the primary MCP surface — architecturally sound. However, it **fails to specify critical security controls** for:

1. **postMessage origin validation** (CRITICAL)
2. **userAction context validation** (CRITICAL)
3. **Session authentication and integrity** (CRITICAL)

Additionally, CSP, payload validation, and catalog whitelisting are **underspecified for production use**.

These are **not cosmetic gaps**. They are exploitable security issues that **MUST be addressed before implementation**.

---

## DETAILED EVALUATION

### 1. MCP Apps Sandbox Model

**Status:** Partially Specified

**✓ What's Good:**
- DP correctly identifies iframe sandboxing as the isolation mechanism
- CSP mentioned in tool declaration: `{ "connect-src": ["'self'"] }`
- Single-file bundling via Vite is good for containment

**⚠️ Critical Gaps:**

- **CSP is Incomplete.** Only `connect-src` specified. Missing:
  - `script-src` (should restrict to `'self'`, possibly `'wasm-unsafe-eval'`)
  - `object-src` (should be `'none'`)
  - `frame-src` (should be `'none'` — no nested iframes)
  - `style-src` (needed for A2UI styling)
  - `default-src` (security baseline)
  
  **Current CSP is insufficient for production.**

- **Sandbox Attributes Undocumented.** The DP assumes the host enforces iframe sandboxing but never specifies:
  - What sandbox tokens are expected? (`allow-same-origin`? `allow-scripts`?)
  - Who sets them — host or server?
  - What happens if host doesn't enforce sandbox?

- **No Integrity Protection.** Single-file bundling is good, but:
  - No mention of SRI (Subresource Integrity) hash
  - How is tampering in transit detected?
  - Version pinning strategy missing

- **Missing COEP/COOP.** Modern iframe isolation requires Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers — not mentioned.

---

### 2. postMessage Security

**Status:** NOT SPECIFIED — CRITICAL VULNERABILITY

**⚠️ The Core Problem:**

The DP shows: "App sends JSON-RPC via `window.parent.postMessage`"  
**Missing:** Origin validation and targetOrigin specification.

**Attack Scenario:**
```
Scenario: Malicious iframe on same host

1. Kickstart iframe posts: window.parent.postMessage(
     { method: "ui/advance_phase", sessionId: "abc-123" },
     "*"  // ← WRONG: any origin can receive
   )

2. Attacker iframe (different tab, same host) intercepts the message
3. Attacker sees: sessionId, phase data, user action context
4. Attacker forges new userAction: "destroy_cluster"
5. Attacker sends forged postMessage back to real iframe
6. Iframe processes it as legitimate userAction
```

**Required Fixes:**

- **Specify targetOrigin:** `window.parent.postMessage(msg, 'https://chat.openai.com')`
- **Specify origin validation:** All receivers must check `if (event.origin !== expectedOrigin) { ignore; }`
- **Specify targetOrigin discovery:** How does iframe know the correct origin?
  - Injected by host? Hardcoded per host? Negotiated?

**Current DP Status:** Fails this criterion.

---

### 3. A2UI Payload Validation

**Status:** Partially Addressed

**✓ What's Good:**
- Zod schema support mentioned (ComponentManifest)
- MessageProcessor assumed to render safely

**⚠️ Gaps:**

- **No Payload Size Limits.** An A2UI `updateComponents` message could include thousands of nested components. What prevents DoS?

- **No Nesting Depth Limits.** Deeply nested component trees cause stack overflow in `MessageProcessor.render()`.

- **Trust in Third-Party MessageProcessor.** DP assumes A2UI's MessageProcessor validates input. **What if it doesn't?**
  - Kickstart should NOT trust MessageProcessor alone
  - Server should validate ALL A2UI payloads before sending to iframe
  - **DP should state:** "All A2UI payloads validated against v0.9 schema before transmission"

- **degradeToBasic() is Underspecified.** What does "degradation" actually do?
  - Could it strip security-critical metadata?
  - Example: Button with permission `["admin"]` degraded to one without?

**Required Fix:** Add payload validation spec with size/depth limits and explicit server-side validation requirement.

---

### 4. Catalog Negotiation

**Status:** Good Design, Underspecified

**✓ What's Good:**
- Client advertises `supportedCatalogIds` in handshake
- Per-message `_meta` override path is clever

**⚠️ Gaps:**

- **No Whitelist Enforcement.** DP doesn't specify: can Kickstart server send arbitrary catalogIds?
  
  **Risk:** If server sends `{ catalogId: "https://attacker.com/evil" }`:
  - MessageProcessor might fetch from attacker.com (SSRF)
  - MessageProcessor might crash on unknown catalog
  - MessageProcessor might render malicious components

  **Required Fix:** Specify that Kickstart server **only emits from whitelist:**
  ```typescript
  const ALLOWED_CATALOGS = [KICKSTART_CATALOG_ID, BASIC_CATALOG_ID];
  ```

- **Version Pinning Missing.** URIs include "v0.9" (good), but does runtime version-check?

---

### 5. Data Flow — userAction Context

**Status:** Underspecified

**⚠️ Critical Questions:**

The DP shows: `action: { event: { name: "advance_phase", context: { sessionId: "..." } } }`

- **What's in context?** Only sessionId shown. But could it include:
  - Azure subscription ID?
  - Access tokens? (MAJOR security risk)
  - Secrets from prior turns?
  - Sensitive user data?

- **How is context Validated?** DP doesn't say:
  - Is it schema-validated? (z.object required)
  - Is it sanitized? (no JSON injection, no nested objects)
  - Could a malicious client forge context data?

- **Server Validation Missing.** handleAction() must validate context before processing. **DP doesn't specify this.**

**Required Fix:** Add strict context schema and server validation:
```typescript
const actionContext = z.object({
  sessionId: z.string().length(32)  // only sessionId, nothing else
});
```

---

### 6. Content Security Policy (CSP)

**Status:** Partially Specified

**✓ What's Good:**
- CSP mentioned in `_meta.ui` field
- Example shows `connect-src` restriction

**⚠️ Gaps:**

Current example CSP is **too permissive**:
```javascript
csp: { "connect-src": ["'self'"] }
```

For a Kickstart MCP App that renders user-controlled components, recommended baseline:
```javascript
{
  "default-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "object-src": ["'none'"],
  "frame-src": ["'none'"],
  "form-action": ["'self'"],
  "connect-src": ["'self'"],
}
```

**Open Questions:**
- Who sets CSP — host or server?
- Does host enforce it? Must verify.
- Why `unsafe-inline` for styles? (A2UI requirement?)

**Required Fix:** Provide production-ready CSP baseline with justifications.

---

### 7. SWA Auth Integration

**Status:** Critical Concern — Severely Underspecified

**⚠️ The Problem:**

DP states: "Auth components omitted on MCP surface. MCP handles auth at transport level (OAuth, API keys)."

**But what does this MEAN for the iframe?**

The MCP App iframe is **sandboxed**. It has **NO access to:**
- `document.cookie` (auth cookies)
- `sessionStorage` (auth tokens)
- `localStorage` (auth tokens)
- HTTP headers (Authorization header set by host)

**How does iframe know which USER is authenticated?**

**Current Assumption (from decisions.md):**
- Auth happens at transport level
- Tokens stored in app-level state
- Components access tokens via app context

**For MCP App, this breaks down:**
- Iframe is isolated — no access to app state
- Server MUST inject authenticated sessionId via A2UI context
- **If sessionId generation is weak, attacker can:**
  - Forge session IDs
  - Access other users' sessions
  - Escalate to other users' Azure subscriptions

**DP Doesn't Specify:**
- How sessionId is generated (CSPRNG? UUID? Hash?)
- How session state is protected from tampering
- What happens if iframe receives unauthenticated sessionId
- Whether sessionIds are time-limited
- Whether session data is encrypted at rest

**Example Attack:**
```
1. Attacker knows sessionId format: UUID v4
2. Attacker generates 1M UUIDs offline
3. Attacker injects into iframe via forged postMessage
4. One UUID matches a real user's session
5. Attacker accesses that user's deployment history, manifests, etc.
```

**Required Fixes:**

Add new Section: **Session & Authentication Specification**

- **SessionId Generation:** CSPRNG with 256-bit entropy minimum
  ```typescript
  const sessionId = crypto.getRandomValues(new Uint8Array(32));
  ```

- **Session Storage:** Encrypted at rest, tamper-proof (use server-side session store)

- **Session Expiry:** TTL with maximum 1 hour

- **Server Validation:** All tool calls authenticated
  ```typescript
  const session = await sessions.get(sessionId);
  if (!session || session.isExpired) throw new UnauthorizedError();
  ```

- **Isolation:** Iframe cannot access other sessionIds
  - Never transmit sessionId in A2UI UI data
  - Inject sessionId in server response ONLY
  - Validate on every server action

---

## SEVERITY SUMMARY

| Severity | Issue | Blocking |
|----------|-------|----------|
| CRITICAL | postMessage origin validation missing | YES |
| CRITICAL | userAction context validation missing | YES |
| CRITICAL | Session authentication underspecified | YES |
| HIGH | CSP too minimal | YES |
| HIGH | A2UI MessageProcessor trusted without validation | YES |
| HIGH | Catalog ID whitelisting not enforced | YES |
| HIGH | Payload size/depth limits missing | YES |
| MEDIUM | Sandbox attributes undocumented | NO |
| MEDIUM | COEP/COOP not mentioned | NO |
| MEDIUM | degradeToBasic() behavior underspecified | NO |
| LOW | CSP reporting (report-uri) missing | NO |

---

## REQUIRED CHANGES FOR APPROVAL

### MUST FIX (Blocking Rejection)

**[1] Add postMessage Security Section (Section 3.3a)**
- Specify targetOrigin for all postMessage() calls
- Define how iframe discovers correct targetOrigin
- Specify origin validation in message receivers
- Example: `window.parent.postMessage(msg, 'https://chat.openai.com')`
- Require: `if (event.origin !== expectedOrigin) { return; }`

**[2] Add userAction Context Validation (Section 4.5a)**
- Define strict Zod schema for context field
- Example: `z.object({ sessionId: z.string().length(32) })`
- Specify sanitization (no nested objects, no JSON injection)
- Require: `context validated before handleAction()`

**[3] Add Session & Authentication Spec (New Section 3.5a)**
- Specify sessionId generation: CSPRNG 256-bit minimum
- Specify session storage: encrypted at rest, tamper-proof
- Specify session expiry: TTL max 1 hour
- Require: "All tool calls authenticated via sessionId"
- Specify: "Iframes cannot access other sessionIds"

**[4] Upgrade CSP Specification (Section 3.1)**
- Replace with production baseline (see above)
- Justify each exception
- Specify: "Host enforces CSP before rendering iframe"

### SHOULD FIX (Strongly Recommended, Not Blocking)

**[5] Add Payload Validation Spec (Section 4.2a)**
- Specify: maximum payload size (suggest 10MB)
- Specify: maximum component nesting depth (suggest 50)
- Require: all A2UI payloads validated against v0.9 schema
- Specify: MessageProcessor error handling for malformed payloads

**[6] Add Catalog Whitelisting (Section 4.1a)**
- Require: server only emits catalogId from whitelist
- Example: `const ALLOWED = [KICKSTART_CATALOG_ID, BASIC_CATALOG_ID]`
- Require: server validates catalogId before sending

**[7] Add Single-File HTML Integrity (Section 3.2a)**
- Specify: SRI hash for bundled HTML
- Specify: version pinning strategy
- Specify: tampering detection mechanism

**[8] Document Sandbox Expectations (Section 3.1a)**
- Specify: expected iframe sandbox attributes
- Clarify: host vs. server responsibility
- Example: `sandbox="allow-scripts allow-same-origin"`

---

## GUIDANCE FOR REVISION

### For Leela (Lead)

Before re-submitting DP v3:

1. Add Section 3.3a (postMessage Security) — define the security model for host ↔ iframe communication
2. Add Section 3.5a (Session & Authentication) — define how unauthenticated iframes are prevented from accessing user data
3. Upgrade Section 3.1 (CSP) — provide production-ready policy
4. Review all "SHOULD FIX" items and include at least [5] and [6] before finalizing spec

### For Implementation (Phase 1)

Once DP is approved:

- Unit tests for postMessage origin validation
- Unit tests for userAction schema validation
- Unit tests for sessionId generation (cryptographic strength test)
- Integration test: forge sessionId → verify rejection

### For Phase 2 (MCP App Build)

- Add CSP headers to vite.config.app.ts
- Add payload size/depth guards to MessageProcessor integration
- Add session verification to protocol.ts

---

## HARDENING SUGGESTIONS (If Approved)

Once security spec is complete, recommend:

1. **Session Signing:** Sign sessionId + action with HMAC-SHA256
   ```typescript
   const signature = sign(sessionId + action, serverSecret);
   // iframe sends: { sessionId, action, signature }
   // server verifies: hmac(sessionId + action) === signature
   ```

2. **Nonce-Based Replay Prevention:** Each userAction includes a nonce
   ```typescript
   // iframe: { action, nonce: crypto.getRandomValues(...) }
   // server: store nonce, reject duplicates
   ```

3. **Rate Limiting:** Rate-limit actions per sessionId
   ```typescript
   if (actions[sessionId].count > 10/minute) throw TooManyRequestsError();
   ```

4. **Audit Logging:** Log all sensitive actions (phase changes, manifest generation, etc.)
   ```typescript
   auditLog.record({ sessionId, action, timestamp, result });
   ```

5. **CSP Reporting:** Add `report-uri` for policy violations
   ```javascript
   "report-uri": ["/api/security/csp-violations"]
   ```

---

**Next Steps:** Submit revised DP v3 addressing critical gaps. Zapp will re-review before Phase 1 begins.
