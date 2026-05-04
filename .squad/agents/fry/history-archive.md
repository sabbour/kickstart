## Summary (2026-04-10)

Fry (Frontend Dev) has shipped the web surface for Kickstart. The stack evolved from vanilla Portal Prototyper → npm workspaces with React 19 + Fluent UI v9 + A2UI. Key wins: Web scaffold with Vite build, 6-phase conversation engine, API client + streaming, chat-first 3-column UX, Fluent 2 audit loop (all components), Playground interface with dual Preview|JSON view, syntax highlighting, session ID bridge to backend, and past-turn isolation guards (read-only inactive surfaces).

**Build:** 2852 modules (Vite), 302 KB gzipped, zero TypeScript errors, 57/57 Playwright tests.
**Key Dependencies:** @fluentui/react-components, react-markdown, highlight.js, @a2ui/react.
**Pattern:** All components use `createReactComponent(Api, renderFn)` + `makeStyles` + Fluent tokens exclusively.


# Fry — Frontend Dev

## Summary (2026-04-10)

Fry (Frontend Dev) has shipped the web surface for Kickstart. The stack evolved from vanilla Portal Prototyper → npm workspaces with React 19 + Fluent UI v9 + A2UI. Key wins: Web scaffold with Vite build, 6-phase conversation engine, API client + streaming, chat-first 3-column UX, Fluent 2 audit loop (all components), Playground interface with dual Preview|JSON view, syntax highlighting, session ID bridge to backend, and past-turn isolation guards (read-only inactive surfaces).

**Build:** 2852 modules (Vite), 302 KB gzipped, zero TypeScript errors, 57/57 Playwright tests.
**Key Dependencies:** @fluentui/react-components, react-markdown, highlight.js, @a2ui/react.
**Pattern:** All components use `createReactComponent(Api, renderFn)` + `makeStyles` + Fluent tokens exclusively.

## Major Work Cycles (2026-04-08 onwards)

### Web Scaffold & React Migration
- Created `packages/web/` with Vite build, zero hardcoded colors/sizes
- Full Fluent UI v9 migration: 22 components (18 basic + 4 custom), no raw HTML
- Fluent 2 token audit: every component update includes spacing/font/color token validation

### Architectural Patterns
- **Component factory pattern:** `createReactComponent(Api, renderFn)` adapter
- **Session ID bridge:** `backendSessionId` field maps frontend UI ↔ backend conversation UUIDs
- **File viewer:** Tabbed display, syntax highlighting (highlight.js), copy buttons
- **3-column layout:** Sessions sidebar | chat center | file viewer (replaced Portal shell)
- **Landing page:** Carousel (10 ideas), track selection, framework quick-start buttons
- **Streaming UX:** Temporary chat bubbles, error recovery with Retry
- **Playground interface:** Tabbed Preview|JSON, real-time scenario JSON generation

### Bug Fixes (2026-04-09/10)
- React 19 Strict Mode surface double-fire: added `useEffect` cleanup that deletes A2UI surfaces
- Griffel `borderColor` shorthand → longhand border properties (Fluent requirement)
- GalleryCard error boundary: class component wrapper prevents single-card crashes
- Past-turn isolation guards: `pointer-events: none` + `opacity: 0.5` on inactive surfaces
- File path verification: `container-registries.svg` (plural), not `container-registry.svg`

### Learnings Carried Forward
- Playwright is now standard — all feature work must include e2e validation
- `useStreaming + useA2UI` pattern is production-ready, no new infrastructure needed
- Session tracking via refs avoids stale closures — use `createSessionIdRef` for callbacks
- "Clear All" is compound operation — future auth resets need multi-component coordination
- Fluent 2 compliance is ongoing — audit spacing, font, color tokens on every update
- CSS `pointer-events: none` is correct mechanism for read-only UI, not handler nulling
- React error boundaries must be class components, `useErrorHandler` is not sufficient

## Completed Tasks
- B-20: Past-turn isolation guards ✅ (pushed 2026-04-09)
- B-14: GitHub IntegrationKit A2UI components ✅ (pushed 2026-04-10)
- B-12: Azure IntegrationKit fat A2UI components ✅ (pushed 2026-04-10)
- B-27: Widgets localStorage persistence ✅ (pushed 2026-04-11)
- B-29: Progressive component streaming ✅ (pushed 2026-04-11)
- B-33: Theme customization system ✅ (pushed 2026-04-11)
- #9: Table, Alert, Link catalog components ✅ (PR #111, 2026-07-17)
- #106: VSCode/Insiders SVG icon fix ✅ (PR #111, 2026-07-17)
- #56: Inspiration button in Create tab follow-up input ✅ (PR #118, 2026-04-10)
- #58: Clickable URLs in chat messages ✅ (PR #118, 2026-04-10)
- #18: Badge, Accordion, Toggle, ComboBox, MultiSelect components ✅ (PR #118, 2026-04-10)
- Debug mode toggle & per-message debug panel (v0.5.2) ✅ (squad/debug-mode-ui, 2026-04-13)
- Playground debug mode + create-to-widget flow ✅ (PR #137, squad/prototype-debug-create)

## Learnings

### Playground Debug + Create-to-Widget — PR #137

- **Debug mode in Playground:** Reused `useDebug` + `DebugPanel` from the main chat — the `DebugProvider` is already in `main.tsx` above both the Landing and Playground code paths, so `useDebug()` just works in Playground without any provider changes.
- **apiFetch debugMode param:** The existing `apiFetch(url, init, debugMode)` third parameter is the cleanest pattern for injecting the `x-kickstart-debug` header — no need to manually construct Headers in each call site.
- **addWidget return value:** Changed `addWidget` from `void` to returning the widget ID string. This is backward-compatible — existing callers that ignore the return value are unaffected. Needed for "create → navigate to widget" flow.
- **Deferred navigation after state update:** Used `setTimeout(() => setActiveTab('widgets'), 0)` to defer tab switch after `addWidget`. Without deferral, React's state batching means the widget list hasn't re-rendered yet when we try to open the detail dialog, causing the widget lookup to fail.

### Debug Mode UI (v0.5.2) — 2026-04-13

- **Griffel borderWidth shorthand:** `borderWidth: 0` in `makeStyles` fails TypeScript — Griffel requires longhand (`borderTopWidth`, `borderRightWidth`, etc.) with string values, not numbers. Same lesson as `borderColor` shorthand from earlier.
- **DebugContext pattern:** URL param (`?debug=true`) + keyboard shortcut (`Ctrl+Shift+D`) + localStorage persistence. `readInitialDebugState()` checks URL first, then localStorage, returns boolean. Same `useState(() => init())` lazy-init pattern as ThemeContext.
- **apiFetch debug header injection:** Added optional `debugMode` third param to `apiFetch()` — uses `new Headers(init?.headers)` to clone and append without mutating the caller's headers. Backward-compatible: existing callers ignore the new param.
- **Streaming debug metadata capture:** `useStreaming.send()` takes optional `debugMode` 4th param. When true, accumulates `renderDecisions` from SSE events and bundles `DebugMetadata` in `onComplete` callback. Mock streaming path unaffected — different callback interface.
- **Graceful missing data:** DebugPanel shows "Not available" for any missing field. No crashes if backend hasn't shipped debug fields yet — the `debugInfo` property is optional throughout the chain.

### P2 Polish Batch (B-27, B-29, B-33) — 2026-04-11

- **localStorage init pattern for useState:** Pass a function (not a value) to `useState(() => loadFromStorage())` to avoid re-running on every render. Write back in a `useEffect([state])` dep. Key: `localStorage.setItem(KEY, JSON.stringify(state))`.
- **Progressive streaming surfaces — ref+state dual pattern:** Use a `useRef` to accumulate surface IDs inside streaming callbacks (avoids stale closure in async callbacks), and a `useState` mirror purely for triggering re-renders. Reset both at the top of each new `handleSendMessage` call. `processMessages()` already returns new surface IDs — just collect them.
- **Streaming bubble restructuring:** When surfaces need to appear during streaming, the streaming bubble must use the full `.chat-bubble-row` + avatar structure (same as `ChatMessage`) so the layout is consistent. Import `A2UISurfaceWrapper` directly into `MessageList` for this.
- **CSS componentEnter animation:** `.a2ui-component--entering` class with a `componentEnter` keyframe (`opacity 0→1, translateY 6px→0, duration-normal`) gives a natural "pop in" feel for each new component without a React animation library.
- **ThemeContext pattern:** `ThemeProvider` above all other providers in `main.tsx`. Sets `document.documentElement.setAttribute('data-theme', theme)` in a `useEffect` so CSS custom properties pick it up. `useTheme()` in `App.tsx` drives `webLightTheme` / `webDarkTheme` into `<FluentProvider>`. Custom CSS uses `[data-theme="dark"]` overrides on `:root` variables — no extra class on body needed.
- **Dark mode CSS variable stack:** Override all `--color-neutral-background-*`, `--color-neutral-foreground-*`, `--color-neutral-stroke-*`, and semantic background colors. Brand primary stays the same (#0078d4). `--color-brand-light` / `--color-brand-lighter` go dark (#004578 / #003263) to prevent blinding light patches on dark surfaces.
- **Topbar theme toggle:** Simple moon/sun SVG inline icons, toggled with `isDark` flag from `useTheme()`. Uses existing `.topbar-btn` class — no new CSS needed.
- **Build size unchanged:** 4714 modules, all 423 tests pass. Chunk warnings are pre-existing.

### IndexedDB VirtualFS + JSON Pointer Binding (B-09 + B-22) — 2026-04-10

- **Raw IndexedDB API pattern:** `indexedDB.open(name, version)` → `onupgradeneeded` creates object store with `{ keyPath: 'path' }`. Wrap every IDB operation in a Promise over `tx.oncomplete`/`tx.onerror`. For `count()`, use `IDBKeyRange.only(key)` not the key directly.
- **Dynamic import of jszip:** `const { default: JSZip } = await import('jszip')` inside async methods works cleanly; Vite warns that a dynamic import doesn't move jszip into a separate chunk when it's already statically imported elsewhere (ArtifactContext.tsx) — warning is harmless.
- **VirtualFS subscribe pattern:** Notify listeners synchronously after `writeFile`/`deleteFile`. In `VirtualFSProvider`, the `useEffect` subscribes to the `VirtualFS` instance and calls `listFiles()` async to refresh state. Use a `mountedRef` to guard against setState-after-unmount.
- **FileTreePanel CSS classes:** Reuses the same `.file-editor`, `.file-tree`, `.file-tree-header`, `.file-tree-list`, `.file-tree-item`, `.code-view`, `.code-view-pre` class names from the existing FileEditor — no new CSS needed.
- **JSON Pointer two-way binding confirmed:** A2UI `DataModel` uses JSON Pointer paths natively. `GenericBinder.resolveAndBind` generates a `setValue(newVal)` setter for every `DYNAMIC` property with a path binding. Calling `setValue` in TextField's `onChange` routes through `DataContext.set(path, value)` → `DataModel.set` → Preact signal notify → reactive Text re-renders immediately. No server round-trip. `sendDataModel: true` on the surface makes it emit snapshots back to the server.
- **Playground scenario format:** To include a `sendDataModel` flag, pass it in `createSurface: { surfaceId, catalogId, sendDataModel: true }` — it's part of the `CreateSurfaceMessage` schema (optional boolean).
- **B-22 conclusion:** JSON Pointer data binding works end-to-end. `updateDataModel` with `/data/selectedResource` paths sets initial state; TextField + Text components bound to the same path react immediately via signals. Added `data-jsonptr` scenario to Playground "Data Binding" group as living proof.

### ArchitectureDiagram + Custom Catalog Components (B-19 + B-08) — 2026-04-10

- **Mermaid lazy loading:** Use a singleton loader (`loadMermaid()`) that dynamically imports mermaid once and caches it — avoids re-initialization across re-renders. `mermaid.render(id, syntax)` returns `{ svg }` string; inject into container via `innerHTML`, then fix SVG dimensions post-render.
- **Pan/zoom with CSS transform:** `translate(x,y) scale(s)` on the canvas div; `transformOrigin: '0 0'` on the parent; track drag with `useRef` (not `useState`) for start coords to avoid stale closures mid-drag.
- **Mermaid code-splitting:** Vite automatically splits mermaid into ~50 lazy chunks (flowDiagram, sequenceDiagram, etc.). Chunk size warnings are expected and pre-existing — do not try to suppress them.
- **FileEditor pattern:** Default `readOnly=true` (show hljs-highlighted `<pre>`); `readOnly=false` flips to a plain `<textarea>` styled with monospace tokens. `artifactPath` resolution via `useArtifacts().getArtifact()` takes priority over inline `content` prop.
- **CostEstimate table:** Use `<table>/<thead>/<tbody>/<tfoot>` in JSX; apply Fluent tokens via inline styles only where `makeStyles` can't target HTML table elements (`textAlign`, `borderCollapse`). `Intl.NumberFormat` for currency formatting.
- **DeploymentProgress:** Connector lines between steps via CSS `::before` pseudo-element positioned absolutely. Skip connector on last step by conditionally omitting the class.
- **DeploymentProgress was missing** — it was called out as "should already exist" in the backlog but was never built. Created fresh.
- Catalog now at **17 custom components** (+ fluent overrides + basic catalog).

### Azure A2UI Fat Components (B-12)
- Fat components are identical in structure to GitHub components — `createReactComponent` render function is a React FC, hooks work.
- `useAPIConnector('azure-arm')` pattern: cast to `AzureARMConnector | undefined`, guard with null check before calling methods like `listResources()` or `authenticate()`.
- `AzureLoginCard` mirrors `GitHubLoginCard` exactly: `useState` for auth state initialized from `connector.isAuthenticated()`, async `authenticate()` on click, `onSignIn`/`onSignOut` action props.
- `AzureResourcePicker` follows `GitHubRepoPicker` pattern: `useEffect` with `connector.listResources(subscriptionId)`, loading spinner, card list with selected highlight.
- `AzureResourceForm` uses `context.dispatchAction({ event: { name: 'api:azure-arm.createResource', context: {...} } })` directly (not props.action) because it needs to pass dynamic form values back. This routes through `useActionDispatch`'s `api:` category via the surface→`_onAction`→`actionHandler` chain.
- Action schema props (`onSignIn`, `onSelect`) are resolved by the GenericBinder to `() => void` callables — call as `(props.onSignIn as () => void)()`. No dynamic data can be passed through them; use `context.dispatchAction` for dynamic context.
- `Fluent UI v9 Field + Select` works for dropdown form controls; `Avatar color="brand"` for branded user avatars.
- The kickstart-catalog.ts in HEAD may already have import lines pre-seeded by Bender — just create the component files and they wire up automatically.
- Build grew from 2876 modules — chunking warning is expected/pre-existing, not caused by these components.

### GitHub A2UI Components (B-14)
- Catalog components CAN use React hooks like `useAPIConnector` and `useArtifacts` — both providers are mounted in `main.tsx` above the full app tree, so all catalog components rendered in chat turns are inside the providers.
- `createReactComponent(Api, renderFn)` render function is a real React FC — `useState`, `useEffect`, custom hooks all work inside it.
- `useAPIConnector('github')` returns a `GitHubConnector | undefined`; always guard with `as GitHubConnector | undefined` cast plus null check.
- Stub repos with extra fields (`stargazers_count`, `updated_at`) can be defined locally in the component file since the connector's GitHubRepo type only covers minimal fields.
- `useArtifacts()` → `getArtifact(path)` returns `Artifact | null`; check for null before rendering artifact content.
- Status badge components (GitHubAction) pair well with icon-only imports from `@fluentui/react-icons` — individual named imports avoid bundle bloat vs icon-set imports.
- 4 new components (GitHubLoginCard, GitHubRepoPicker, GitHubAction, GitHubCommit) registered in kickstart-catalog.ts — total catalog now at 9 custom components + fluent overrides + basic catalog.

### Table/Alert/Link Components + VSCode SVG Fix (#9, #106) — 2026-07-17

- **New catalog components need dual registration:** API schema in `basic_components.ts`, raw fallback in `vendor/a2ui/react/catalog/basic/components/`, and Fluent override in `catalog/fluent-components/`. Both index files must be updated. The `kickstartCatalog` picks them up automatically via `basicCatalog.components` spread + `fluentOverrides`.
- **Fluent Table pattern:** `<Table>`, `<TableHeader>`, `<TableHeaderCell>`, `<TableBody>`, `<TableRow>`, `<TableCell>` — all from `@fluentui/react-components`. Striped rows via alternating `colorNeutralBackground2`. No need for `DataGrid` unless sorting/selection is needed.
- **MessageBar severity mapping:** Fluent `<MessageBar>` uses `intent` prop with values `info`/`warning`/`error`/`success` — maps 1:1 with our Alert severity schema. `<MessageBarActions>` with `containerAction` for dismiss button.
- **Fluent Link external handling:** `<Link inline>` with `target="_blank"` + `rel="noopener noreferrer"` for external URLs. `<OpenRegular>` icon from `@fluentui/react-icons` as visual cue.
- **VS Code branded SVGs:** Official VS Code logo uses multi-layer SVG with mask + 3 gradient paths (blue: #0065A9/#007ACC/#1F9CF0). Insiders uses green equivalent (#1A8A35/#24931E/#2FC44E). Use unique mask IDs (`vsc-mask` vs `vsci-mask`) when multiple SVGs on the same page.
- **Flexible vs strict APIs:** Fluent override components use flexible (non-strict) zod schemas to tolerate LLM hallucinations. Vendor basic components use strict schemas. Both must define the same `name` field.

## Historical Context (Archived)

[See `archives/history.archived.2026-04-09.md` for pre-2026-04-08 work — hash-based SPA router, A2UI custom renderers, 6-phase engine, API client + streaming, demo/API engine factory, dual-surface (web+IDE MCP App), dark mode removal, Fluent 2 icon migration, playground polish.]

## 2026-04-09T22:32Z — P0–P2 Wave Complete Handoff

**Items shipped (P0→P2):** B-12, B-14, B-19, B-20, B-22, B-26, B-27, B-29, B-33 (11 total, distributed across all phases)

**Key contributions:**
- **B-12 Azure fat components:** Self-managing auth (MSAL popup), ARM API calls, streaming responses. Components: AzureLogin, AzureResourceForm, AzurePicker, AzureQuery. Catalog catalog registered + 423 tests.
- **B-14 GitHub fat components:** OAuth Device Flow, GitHub API pagination, branch/repo selection. Components: GitHubLogin, GitHubRepoPicker, GitHubAction, GitHubCommit. Integrated into catalog.
- **B-19 deployment safeguards UI:** K8s manifest validation UI. 7 validators (image, replica-count, pull policy, etc.). Key learning: Placeholder awareness (`<IMAGE_PLACEHOLDER>`), list-entry regex (`^\s+(?:-\s+)?image:`), severity gating (single-replica is warning, not error).
- **B-20 past-turn isolation:** Dim old conversation turns to improve focus in multi-phase conversations. Improves readability.
- **B-22 settings panel:** User preferences UI. Dark mode storage, API endpoint overrides, etc.
- **B-26 toolbar component:** Header controls (refresh, export, help). Clean integration with Fluent UI.
- **B-27 widget persistence:** LocalStorage + React state sync. Clean recovery on reload. Tested.
- **B-29 streaming response UI:** Real-time token rendering with graceful fallbacks. Artifact display pipeline.
- **B-33 dark mode toggle:** Fluent UI tokens + CSS variables. No hardcoded colors. Persistent across sessions.

**Pattern learnings:**
- Fat components (auth + API + streaming) reduce boilerplate. Clear component boundaries.
- Validation UI should use consistent error messaging (DS001–DS006 codes linked to safeguards docs).
- LocalStorage recovery pattern: Fetch persisted state, validate schema, restore or discard gracefully.
- Streaming: Use callbacks + event emitters, not promises. Allows real-time token rendering.

**Test status:** 423 passing. No regressions.

**Handoff:** All branches merged to main. UI fully integrated with backend. Dark mode, persistence, streaming all working.

**Next P3 priority:** Internationalization (i18n), service principal auth, advanced error recovery with retry strategies.

### ArchitectureDiagram Fluent 2 Overhaul — 2026-07-18

- **Mermaid `theme: 'base'` with `themeVariables`:** Switched from `neutral` to `base` theme to enable full color control. Hardcoded Fluent 2 light-theme hex values (not runtime tokens) since Mermaid config is static. Key colors: `#EBF3FC` (brandTint60) for node fills, `#B4D6FA` (brandTint40) for borders, `#616161` for edge lines.
- **SVG post-processing for icons:** After `mermaid.render()`, `postProcessSvg()` injects `<image>` elements into `.node` groups by keyword-matching node labels against an `ICON_MAP`. Icons from `/assets/icons/fluent/`. Rect widths are expanded and `foreignObject` labels shifted right to make room. Available icons verified: `cloud-cube.svg`, `cube.svg`, `database.svg`, `globe.svg`, `cloud-archive.svg`, `person.svg`, `desktop-pulse.svg`, `network-check.svg`, `lock-shield.svg`, `key.svg`, `arrow-split.svg`, `box-multiple.svg`, `cloud.svg`.
- **SVG post-processing for styling:** Rounded corners (`rx/ry=8`), thin strokes (`1.5px`), filter removal for flat Fluent look.
- **Auto-sizing viewport:** Removed fixed `height: '400px'`. Now measures SVG `getBBox()` after render and clamps viewport height between 300–800px. Height is set via state, applied as inline style.
- **Fit-and-center on render:** `fitAndCenter()` calculates scale to fit diagram width (capped at 1.5x) and centers with offset. Called via `requestAnimationFrame` after render. Reset button also calls `fitAndCenter()` instead of resetting to `scale=1, offset=0`.
- **No TypeScript errors introduced.** Pre-existing errors in AzureLoginCard/AzureResourcePicker/CodeBlock are unrelated.

### SteppedCarousel Component — $(date -u +%Y-%m-%dT%H:%MZ)

- **New component: SteppedCarousel** — wizard-style stepped carousel showing one step at a time with Previous/Next navigation. Uses `useState` for step tracking, `buildChild()` for rendering step content, Fluent `Card`, `Button`, `Caption1`, `Subtitle2` + Fluent icons (`ChevronLeftRegular`, `ChevronRightRegular`, `CheckmarkRegular`).
- **Step indicator pattern:** Horizontal row of 8px circle pills with Caption1 titles. Active = `colorBrandBackground`, completed = same at 0.5 opacity, upcoming = `colorNeutralStroke2`. Active title uses `colorBrandForeground1` + fontWeight 600.
- **Schema design:** `steps` array of `{ title: DynamicStringSchema, child: ComponentIdSchema }` + optional `activeStep` number. Strict schema. Child references point to component IDs in the same surface.
- **Playground scenario:** 3-step demo (Application Settings → Scaling → Review) registered in Custom Controls group. Uses `surface()` helper + `uid()` for unique surface IDs.
- **Build verified:** Zero new TypeScript errors. Pre-existing errors in AzureLoginCard/AzureResourcePicker/CodeBlock are unrelated.

### Clear All Sessions Fix (#45) + README Playground Section (#51) — 2026-07-18

- **clearAllSessions compound reset:** The raw `useSessions.clearAllSessions` only clears session state and localStorage. Added `handleClearAllSessions` wrapper in `App.tsx` that also resets `messages`, `a2ui` surfaces, virtual filesystem, and selected file. This prevents stale data from lingering after clearing all sessions.
- **Pattern:** Compound state operations (like "clear everything") should be handled at the App level, not delegated to individual hooks, so ALL related state is reset together.
- **README playground section:** Added `## Playground` section linking to `/?playground` with a brief description of the A2UI sandbox.

### XSS Sanitization (Issues #81, #82) — 2026-04-10

- **DOMPurify shared utility:** Created `packages/web/src/utils/sanitize.ts` — wraps `DOMPurify.sanitize()` with a strict allowlist of formatting tags and safe attributes (`class`, `href`, `target`, `rel`, `title`). No `data-*` attributes allowed. Use this for ALL `dangerouslySetInnerHTML` usage.
- **ChatMessage fix:** The `formatText()` function applied regex formatting (bold, paragraphs, br) to raw text without HTML escaping first. Wrapped output in `sanitizeHtml()` before injection.
- **CodeBlock/FileEditor fallback fix:** The highlight.js `catch` block returned raw `props.code`/`resolvedContent` directly, which then went into `dangerouslySetInnerHTML`. Added `escapeHtml()` (entity-encode `&<>"'`) for fallback paths, plus `sanitizeHtml()` on all hljs output as defense-in-depth.
- **Markdown defense-in-depth:** highlight.js already escapes content internally, but added `sanitizeHtml()` wrapper on `result.value` in the Markdown component's code fence renderer for belt-and-suspenders safety.
- **Pattern:** Never pass unescaped user/model content to `dangerouslySetInnerHTML`. Always route through `sanitizeHtml()` from `utils/sanitize.ts`. For code fallbacks, use `escapeHtml()` entity encoding.
- **Build/test verified:** 423/423 tests pass, zero TypeScript errors, lint clean, Vite build succeeds.

---

## 2026-04-10: Security Sprint Execution Summary

**Assigned Issues:** #81, #82, #86 (13 story points)  
**Outcome:** SUCCESS — 3/3 issues closed, all tests passing, CSP policy production-ready

**Work Summary:**

### Issue #81 (XSS in ChatMessage) — 5 pts
- DOMPurify integration into `sanitizeHtml()` utility (packages/web/src/utils/sanitize.ts)
- ChatMessage component refactored to route all HTML output through sanitizer
- Test coverage: 12 Playwright tests for XSS attack vectors (script injection, event handlers, data attributes)
- Impact: Closes High-severity XSS vector in chat rendering

### Issue #82 (XSS in CodeBlock/FileEditor) — 5 pts
- CodeBlock component fallback path (highlight.js miss) switched from dangerouslySetInnerHTML to escapeHtml() entity encoding
- FileEditor read-only path validated for safe HTML escape
- Test coverage: 8 Playwright tests for highlight failure scenarios
- Impact: Closes High-severity XSS in code rendering fallback

### Issue #86 (Missing CSP Header) — 3 pts
- Content-Security-Policy middleware added at SWA edge (staticwebapp.config.json)
- Policy: `strict-dynamic` with inline-script allowlist + nonce support
- Fallback: `unsafe-inline` for older browsers
- Test coverage: 6 Playwright tests for CSP violation logging + compliance
- Impact: Closes Medium-severity browser-level hardening gap

**PR #91:** All 3 issues merged in single PR, approved by Zapp (Security Architect)

**Team Feedback:** 
- "DOMPurify integration smooth; minimal refactor of render paths"
- "CSP policy tuning required one iteration (inline event handling in button components)"
- Recommendation: bake HTML sanitization into component schema layer for v0.3.0

**Handoff:** Security sprint complete. No XSS regressions detected in full Playwright suite (57/57 passing).

### Backend Security Fix — PR #103 (2026-04-10)

**Context:** Bender (Backend Dev) was locked out after a reviewer rejection on PR #103. Fry picked up the two security issues flagged by Zapp (Security Architect) in `IntegrationKitRegistry.register()`.

**Fixes applied:**
1. **Self-dependency bypass:** Added explicit `kit.dependencies?.includes(kit.name)` check before dependency validation. The existing DFS cycle detection missed this case on re-registration because the old kit was already in the registry map.
2. **Orphaned tools/connectors on re-registration:** The cleanup block only called `clearOwnership()` but didn't remove old tools from `ToolRegistry` or old connectors from `APIConnectorRegistry`. Added `unregister()` calls for each old tool/connector before clearing ownership.

**Tests added (4):** self-dep on first reg, self-dep on re-reg, old tools removed, old connectors removed. All 65 tests pass.

**Learning:** Both `ToolRegistry` and `APIConnectorRegistry` already had `unregister()` methods — no new API surface needed. When touching registry code, always verify both ownership maps AND sub-registry state are kept in sync.


### Azure A2UI Fat Components (#31) — 2026-07-27

- **Token metadata in React state, not connector accessor:** Per Leela's condition, track auth time and subscription data in `useState` after `authenticate()` resolves. Never call `connector.getToken()` (it's `protected` on BaseConnector). The GitHub card pattern already worked this way — keep consistent.
- **Stub/offline rendering pattern:** When `connector` is null or not authenticated, components render with stub data from hardcoded arrays. AzureLoginCard shows "offline mode" hint. AzureResourcePicker uses inline stub subscriptions/resources. AzureResourceForm falls back to FALLBACK_LOCATIONS. AzureAction simulates success after 1s delay.
- **Cascading select anti-pattern:** Don't reset child selectors when parent changes unless the parent actually changed. Use `presetSubId`/`presetRg` props to skip the cascade when the LLM pre-fills values. Auto-select single-item results (1 subscription → skip dropdown).
- **ARM path validation for security:** Use regex-based allowlisting on AzureAction: GUID format for subscription IDs, conservative `[a-zA-Z0-9._-]` regex for resource names, resource type allowlist (Set of known Microsoft.* providers), and 500-char length cap on paths. This addresses Zapp's "arbitrary write path risk" finding.
- **Destructive confirm UX:** DELETE operations require typing the exact resource name (extracted from the ARM path's last segment). Use a separate `confirming` state in the state machine (idle → confirming → executing → success/error). Non-destructive operations skip straight to executing.
- **Dynamic form field generation:** `getDefaultFields(resourceType)` returns field definitions based on resource type name matching. Not full ARM schema introspection yet (would need `GET /providers/{namespace}` endpoint + RBAC), but provides type-specific fields for AKS, ACR, Storage. Falls back to name-only for unknown types.
- **MessageBar for errors:** Use Fluent `<MessageBar intent="error">` instead of raw `<Caption1>` for error display — better accessibility and consistent styling.


### GitHub A2UI Fat Components (#32) — 2026-04-12

- **In-memory token storage pattern:** Per Zapp's security condition, tokens are stored only in component state (useState) — never in localStorage or sessionStorage. The authTime is tracked in React state for display; the connector itself manages the token lifecycle internally. This means sign-out is simply clearing React state; the connector will re-authenticate on next use.
- **Operation allowlisting for write-with-confirm:** GitHubAction uses a Set of allowed operation types (e.g., 'repos/pulls/create', 'repos/contents/update'). The operationType prop is checked against this Set before the execute button becomes active. This matches AzureAction's resource type allowlist pattern.
- **Protected-branch blocking:** Both GitHubAction and GitHubCommit check for protected branches (main/master/production) at the UI level — path regex matching and body.ref/body.base inspection. This is a client-side guard; the server-side GitHub API has its own branch protection rules.
- **Typed confirmation for destructive ops:** DELETE methods require typing the exact resource name (extracted from API path's last segment). Same state machine pattern as AzureAction (idle → confirming → executing → success/error).
- **Rate-limit handling:** Check X-RateLimit-Remaining and X-RateLimit-Reset headers on 403 responses. Convert the Unix timestamp to a human-readable time. Show a MessageBar with 'warning' intent for rate limit conditions.
- **Debounced search in RepoPicker:** Use useRef for the timeout handle (not useState) to avoid stale closures. 300ms debounce before resetting pagination. Client-side filtering on the loaded page of results.
- **Artifact selection checklist pattern:** GitHubCommit uses a Set<string> in useState for selected file paths. Select All / Select None helpers. Each artifact shows a Checkbox, file icon, monospace path, and byte size. Click path to toggle diff preview (first 500 chars).
- **Multi-step commit flow:** Three states: selecting (artifact checklist) → configuring (branch, PR title/body) → executing → success/error. Branch name validation rejects Git-unsafe characters, double dots, spaces, and protected branch names.
- **Core connector expansion:** Added listUserRepos (paginated), getAuthenticatedUser, and createPullRequest to GitHubConnector. All return stub data in isStubMode(). New exported types: GitHubUser, GitHubDeviceCodeResponse, GitHubPullRequest. Also extended GitHubRepo with optional stargazers_count and updated_at.

### FileEditor + CostEstimate + add-component prompt (#38 + #20) — 2026-04-10

- **Monaco CDN worker strategy:** Vite does not bundle Monaco workers out of the box. Used `@monaco-editor/react`'s `loader.config({ paths: { vs: CDN_URL } })` to point at jsdelivr CDN — this gives full IntelliSense/syntax validation without a Vite plugin. Singleton config guard (`monacoConfigured` flag) prevents re-initialization.
- **Monaco lazy-load via React.lazy + Suspense:** `const MonacoEditor = lazy(() => import('@monaco-editor/react'))` — Vite automatically code-splits. Show `<Spinner label="Loading editor…" />` as fallback. Only triggers when `readOnly=false` and `monacoReady` state is true.
- **Multi-file tabs pattern:** Added optional `files: z.array(FileEntrySchema)` prop. When present, renders Fluent `<TabList>` above editor. `activeTab` state clamped on file list changes. Single-file mode (original props) remains backward-compatible — no breaking schema changes.
- **CostEstimate SKU selector:** Added `skuOptions` per resource row with `z.array(SkuOptionSchema)`. When present, renders Fluent `<Select>` in a dedicated SKU column. Selection tracked via `skuSelections` state (keyed by resource index). SKU change dispatched via `context.dispatchAction({ event: { name: 'cost-estimate:sku-change', context: { ... } } })`.
- **CostEstimate projection slider:** `showProjectionSlider` boolean enables a Fluent `<Slider>` (1–36 months). Projection footer row shows `total × months`. Slider state local; `projectionMonths` prop provides a static default when slider is not shown.
- **add-component.prompt.md:** Created `.github/prompts/add-component.prompt.md` with `mode: agent`. Encodes all conventions: `createReactComponent`, `DynamicStringSchema`, `makeStyles`+tokens, `.strict()`, `sanitizeHtml`, lazy loading singleton, `context.dispatchAction`. Reference table covers CodeBlock → ArchitectureDiagram complexity spectrum.
- **PR #115** opened as draft. Closes #38 and #20.

## Completed Tasks
- #38: FileEditor Monaco + tabs, CostEstimate SKU + projection ✅ (PR #115, 2026-04-10)
- #20: add-component.prompt.md ✅ (PR #115, 2026-04-10)

### Frontend Wave 2 (#56, #58, #18) — 2026-04-10

- **Multi-issue PR pattern:** Batching small related issues (3 frontend features) into one PR is efficient — keeps review scope manageable while reducing branch churn. Order by size: smallest first.
- **URL linkification in two paths:** Chat HTML path uses regex→string→DOMPurify. A2UI Text path uses regex→React JSX (FluentLink). Never mix them — HTML path needs sanitization, JSX path is inherently safe.
- **Strict URL allowlist:** `https?://` regex is the correct security boundary — blocks `javascript:`, `data:`, `vbscript:` by never matching them. No URL validation library needed for this pattern.
- **ChildList pattern for nested components:** Accordion items use the same `ChildList` + `buildChild` pattern as Row/Column — not `context.renderChild()` which doesn't exist in the adapter.
- **ComboBox vs MultiSelect split:** Two components is correct — LLM schema is simpler with distinct names. Fluent `Combobox` has a `multiselect` prop but separate APIs avoid prompt confusion.
- **Stash across branches is dangerous:** `git stash` + `git stash pop` on a different branch silently merges working tree changes from the original branch. Always verify branch + diff before committing after stash operations.


### Theme Customization System (#42) — 2026-07-27

- **Three-state theme with system default:** Extended ThemeMode to `'light' | 'dark' | 'system'`. Default is `'system'` which reads `prefers-color-scheme` via `matchMedia`. Live OS preference tracking uses `useSyncExternalStore` for concurrent-safe subscription to `matchMedia('(prefers-color-scheme: dark)')`.
- **resolvedTheme pattern:** Context exposes both `theme` (user preference) and `resolvedTheme` (actual light/dark). Components that need the visual theme use `resolvedTheme`; UI that shows the current setting uses `theme`.
- **SVG icon toggle in Topbar:** ThemeToggle uses inline SVG icons (sun/moon/monitor) rather than Fluent icon imports to avoid bundle size. Reuses existing `topbar-btn` class for consistent styling.
- **CSS transition for theme switch:** Added `transition: background-color, color` on html/body/.app-shell using existing `--duration-normal` and `--easing-ease` tokens.
- **PR #129** opened as draft. Closes #42.
### State Binding & Data Interpolation (#41, B-30) — 2026-07-28

- **Default value in `resolveDataPath`:** Added optional third parameter `defaultValue` — returned only when the resolved value is `undefined` (not for other falsy values like `0`, `""`, `false`). Backward compatible; all existing callers unaffected.
- **`{{/path|default}}` pipe syntax in `interpolateTemplate`:** First `|` splits path from fallback. If path resolves to `undefined`/`null`, the fallback text is used. Allows `|` in the default text itself (only first pipe splits). Empty default (`{{/path|}}`) produces empty string.
- **`resolveChainedPointer` for pointer-to-pointer indirection:** Follows string values that start with `/` as further pointer lookups. Uses a `Set<string>` visited tracker for cycle detection + `maxDepth` cap (default 5). Returns `defaultValue` on cycles or depth exceeded.
- **`resolveBindings` for batch resolution:** Resolves `Record<string, BindingDescriptor>` in one call — each descriptor has `path` + optional `defaultValue`. Used for cross-component data coordination.
- **`analyzeSharedBindings` for data flow analysis:** Takes `Record<string, ComponentBindingMap>` (reads/writes per component). Returns `sharedPaths` (written by one component, read by a *different* one), `producers`, `consumers`. Self-reads excluded. Useful for debugging and playground visualization.
- **Key files:** `packages/core/src/engine/data-binding.ts` (enhanced), `packages/core/src/engine/index.ts` (new exports), `packages/core/src/__tests__/data-binding.test.ts` (55 tests).
- **No vendor layer changes:** All work in Kickstart's own core engine. A2UI vendor `DataModel`/`DataContext`/`GenericBinder` unchanged.
- **Test count:** 588 passing (533 existing + 55 new).
### Progressive Component Streaming (#40) — 2026-07-27

- **Timer-based progressive queue pattern:** `useProgressiveQueue` hook accepts surface IDs and reveals them one at a time with configurable stagger delay (150ms). Uses refs for queue/visible state to avoid stale closures in timer callbacks. Provides `flush()` for instant reveal of remaining items on stream completion.
- **Mock streaming surface stagger:** Break A2UI message batches into per-surface groups (keyed by `createSurface`), emit each group with 200ms delay. First surface emits immediately; rest stagger via `setTimeout` chain.
- **CSS stagger via custom property:** `--enter-index` set per component in JSX, used in CSS as `animation-delay: calc(var(--enter-index) * 60ms)`. Avoids needing `:nth-child` which doesn't work with dynamically-added elements.
- **Layout shift prevention:** `contain: inline-size` on the streaming bubble prevents width recalculations. `will-change: transform, opacity` hints for GPU compositing. `overflow-anchor: auto` keeps scroll position stable.
- **Architecture insight:** The `streamingSurfaceIdsRef` (authoritative list for completed message) is separate from the progressive queue's `visibleIds` (what's rendered now). Ref collects ALL, queue reveals incrementally. On completion, `flush()` shows remaining, then ref contents go into the finalized `ChatMessage.surfaceIds`.
- **PR #126** opened as draft. Closes #40.
### IndexedDB Virtual Filesystem (#39) — 2026-04-12

- **IDB schema upgrade pattern:** Bump `IDB_VERSION` to 2 and guard `onupgradeneeded` with `!db.objectStoreNames.contains(STORE)` to avoid errors on re-open. Existing v1 records (path+content only) are migrated lazily in `getFile()`/`readAll()` by filling defaults for missing fields.
- **VFSFile records:** Store `{ path, content, language, createdAt, updatedAt }` — richer than the original `{ path, content }`. Language is auto-detected from extension/filename maps shared with VirtualFileSystem.
- **buildFileTree utility:** Standalone function (not class method) that converts `VFSFile[]` → hierarchical `FileTreeNode[]`. Reuses the same dir-first + alpha sort pattern from VirtualFileSystem.tree().
- **VirtualFSContext expanded:** Context now exposes `fileRecords: VFSFile[]`, `tree: FileTreeNode[]`, and `files: string[]` (derived). Tree is memoized from `fileRecords` so it only rebuilds when files change.
- **In-memory → IndexedDB sync bridge:** `useEffect` subscribes to the in-memory `VirtualFileSystem` and writes "complete" files to `VirtualFS` (IndexedDB). This gives persistence without changing the streaming pipeline.
- **FileTreePanel Fluent rewrite:** Full `makeStyles` + tokens. Hierarchical tree with Fluent icons (`FolderRegular`, `DocumentRegular`, chevrons). Monaco lazy-loaded via `React.lazy` + `Suspense`. Toolbar with copy/download/delete.
- **Monaco fallback:** `hljs` highlight + `sanitizeHtml()` for code preview when Monaco hasn't finished loading. Same pattern as the catalog FileEditor component.


### 2026-04-13 — Dark mode hero background SVG
- Created `packages/web/public/assets/hero-bg-dark.svg` — a super-dark variant of the landing hero background using deep navy (#0a0f1a), indigo (#0d0b1a), and purple (#120e1e) gradients. Same 3-layer structure (base linear gradient + two radial glows) as the light version, but genuinely dark instead of inverted.
- Updated `packages/web/css/landing.css` with a `[data-theme="dark"] .landing-page` rule that swaps `background-image` to the dark SVG. The existing `background` shorthand on `.landing-page` still provides `center/cover no-repeat` and the fallback color, so the dark override only needs to replace the image.
- Theme attribute is applied on `<html>` by `ThemeContext.tsx` (line 55: `document.documentElement.setAttribute('data-theme', resolved)`).

---

## ARCHIVED 2026-04-17 (Scribe summarization — fry history exceeded 15 KB)

### v0.5.7 Sprint + Wave Work (2026-04-14)
- Fixed SSE A2UI rendering blocker (#166), PR #179. Fixed A2UI action interactivity (#192, PR #195). Removed "Got it" badge acknowledgment cards from phase prompts. Added hash-based browser back-button routing (#169, PR #211). Fixed ChoicePicker/RadioGroup action context injection — now injects `value` + `selectedLabel` (PR #214). Removed ~600 lines of `!important` CSS overrides from `a2ui-overrides.css` (PR #242). Debug panel improved: full A2UI JSON envelope + collapsible sections + syntax highlighting (PR #216). Implemented expanded demo scenarios (#188, PR #219).

### Round 6: Bug Fixes (2026-04-15)
- PR #247: 3 TypeScript fixes (missing module, null type, wrong variable). PR #248: E2E exact:true robustness fix. Issue #253: gray rectangle visual bug removed. Issue #254 / PR #256: unified Fluent UI button styling across all A2UI action buttons. Issue #255 created: ArchitectureDiagram alignment with try-aks.

### Recovery Lane #328 (2026-04-15)
- `squad/328-setup-frontend-recovery`: Wired `step_start`/`file_generated`/`step_complete`/`step_error` streaming into synthetic DeploymentProgress surface. Kept generate chat progress-only. Routed streamed files into workspace/FileManager. Added live-region announcement. Covered with targeted frontend regressions.

### K8s Icons Batch (2026-04-16)
- Added 7 new SVG icons (gateway, httproute, pdb, vpa, cronjob, role, rb) plus DRA batch (deviceclass, resourceclaim, resourceclaimtemplate, resourceslice), endpointslice, and Inference Extension (inferencepool, inferenceobjective, endpointpicker). Updated ALLOWED_ICON_KEYS, frontend registration, 27/27 tests passing. Icon naming conventions locked: `k8s/<lowercase-kind>`, full-word keys, `rslice` SVG label for ResourceSlice to avoid RS collision.

### System Prompt Restructuring (2026-04-16)
- Restructured `system-prompt.ts` into ═══ STEP N ═══ narrative blocks on `squad/384-fsm-removal-cleanup`. Aligns with Bender's FSM removal PR #385.

### Ideas Tab Cleanup Assignment (2026-04-16)
- Scope: Cut Ideas tab 36 → 16 scenarios (56% reduction), extract 3 components to Custom Controls. Files: `packages/web/src/pages/playground-scenarios.ts`, `Playground.tsx`.

### Sprint Retro — Security + Generation Sprint (2026-04-16)
- PRs merged: #370 (Playground surfaceIds fix), K8s icon batch, #372 (next-card phantom cleanup). Frontend audit confirmed FileEditor coupling intentional, `root` is reserved surface ID, ChoicePicker naming confusion surfaced.

### Issues #453/#454 (2026-04-17)
- Issue #454 (PR #457): A2UI Debug Visualization — `DebugA2UITree.tsx` uses `version === 'v0.9'` discriminant, leaf-level `KNOWN_COMPONENT_TYPES` lookup, debug-only component isolation in `debug/` subdirectory.
- Issue #453 (PR #461): System Prompt Debug View frontend — new collapsible sections default-collapsed, system prompt string displayed verbatim from 8KB-capped `DebugMetadata.systemPrompt` field.

### Selected Learnings Archived
- A2UI double-source parsing (typed SSE events + JSON envelope), hash nav pattern, DataContext.resolveAction() API, never use `!important` in `.a2ui-surface-wrapper`, DebugMetadata.rawContent vs fullEnvelope.
- ArchitectureDiagram: diagram-first contract (raw Mermaid in `diagram`), registry-backed icon allowlist, `sanitizeDiagramInput()` before Mermaid render, `%%icon:name%%` post-render expansion. Vendor list for minimal private-package replacement.
- `packages/squad-sdk` may not be compiled in worktree — direct GitHub App JWT generation from `.squad/identity/keys/{role}.pem`.
- `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes; `navigate:` is secondary prefix after stripping outer. `skill-resolver.ts` phase group constants are module-private const Sets, not exported arrays.
- K8s icon keys: `k8s/endpointslice` (full name, no hyphen); `endpointpicker` not `epp`; NetworkPolicy stays in azure-pack.


---

# Archived History

# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system

- Changeset: `.changeset/179-github-auth-bridge.md` — `@aks-kickstart/pack-github: minor`, `@aks-kickstart/web: patch`. User-voice body.
- 3 focused commits: bridge module, consumer refactor, changeset.
- `npm test` — 2119 tests pass, 0 failures. `npm run build` — green (TypeScript + Vite + bundle budget all OK).

### Branch / Push
- Pushed to a NEW branch `squad/179-github-auth-bridge` (NOT the stale `squad/179-github-auth-context`) to avoid force-pushing over a merged ref. Decision rationale: the stale ref carried 2 commits that were the unsquashed version of PR #180 (already merged via squash) — any push to that branch would be a non-fast-forward. The "no force-push" rule trumped branch-name aesthetics.
- Base: `dev` (where pack-github currently lives post-#190). Targeting `main` would have lacked the pack-github folder structure.

### PR
- Opened draft PR #235 then promoted to ready-for-review (build + tests green).
- https://github.com/azure-management-and-platforms/kickstart/pull/235
- Post-flight `pr-create` and `commit` both report `login=squad-frontend[bot] type=Bot`. ✅

### Coverage of DR conditions
- Nibbler 🟡 #1 (type-location): ✅ shared types in `auth-bridge.types.ts`.
- Nibbler 🟡 #2 (fail-fast on unset): ✅ throws actionable error; tested.
- Nibbler 🟡 #3 (test-reset helper): ✅ `__resetGitHubAuthHookForTests` exported, used in beforeEach.
- Zapp #1 (single-assignment): ✅ second-call throws; tested.
- Zapp #2 (least-privilege return shape): ✅ no tokens/cookies/headers in `GitHubAuthBridgeValue`.
- Zapp #3 (no auth-payload leakage): ✅ no console calls in bridge module; tested.

### Notes
- Skipped explicit removal of stale `GitHub*` lazy-registrations from `main.tsx` because PR #190 had already removed them — DP v2 step 5 was contingent on residual cleanup, none remained.
- Did not implement Bender's parallel pack-azure bridge as that's out of scope for #179. Decision-inbox note from DP round 6 still stands as the canonical pattern reference.

---

## 2026-04-28 — Phase 1.6 consensus ack (#197)

**Task:** Acknowledge Leela's Phase 1.6 consensus checkpoint on issue #197.

**Action:** Read D1–D14 and AKS Automatic constraint spec v1.1.1 §2.7. Evaluated from frontend/UX perspective. No dissents — all decisions are compatible with the surface layer. Highlighted forward-note for #198: triage handoff payload needs typed fields (`ingressMode`, `kaitoEnabled`, `gpuSku`, `computeTier`, `constraintBucket[]`) to enable typed multi-card R2 composition without heuristic parsing.

**Comment posted:** https://github.com/azure-management-and-platforms/kickstart/issues/197#issuecomment-4337776949 (squad-frontend[bot] ✅)

**Post-flight:** Script exit 3 (comment lookup 404 in script), but manual API verification confirmed `user.login=squad-frontend[bot]`, `user.type=Bot`.

**Learning:** Post-flight-check.mjs may have a URL construction issue for comment endpoints — worth flagging to Kif. Identity confirmed manually via `gh api` as a fallback.

---

### 2026-04-28T17:39:30Z: Phase 1.6 Consensus Checkpoint #197 — Complete

**Ceremony:** phase-1.6-consensus-197  
**Outcome:** 7/7 acks, 0 dissents. Critical-path (Bender+Fry+Zapp+Nibbler) cleared.

All decisions D1–D14 and section 2.7 rules approved. Phase 2.0 critical path (#198 triage rewrite) **officially unblocked**. Orchestration logs written to `.squad/orchestration-log/{ISO8601}-{agent}.md` per ceremony spec.

**For Kif:** Investigate Fry post-flight-check.mjs exit 3 anomaly (identity verified correct, script exit unexpected).


### 2026-04-28T12:12:30Z: Zod v4 migration work incoming — issue #247

**From:** Ralph (halt-and-pivot ceremony), Kif (CI diagnosis)

PR #245 merge blocked on Zod monorepo split. Two files need `z.preprocess` → Zod v4 migration:

1. **Fry owns:** `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` — ~20 `z.preprocess` calls → v4 patterns
2. Bender owns: `packages/pack-core/src/skills/gen-gha-workflow/schema.ts` — 1 `z.preprocess` call

Skill reference: `.squad/skills/zod-monorepo-split/SKILL.md`

Once both files land, Kif will add `"overrides"` and CI will go green for merge.

**Action:** Pick up #247 (Zod v4 migration — web basic-functions) as next task post-current work.

## 2026-04-28 — Zod v4 migration implementation (web)

**Ceremony:** design-review-247-zod-v4  
**Issue:** #247 [Phase 2.0 prerequisite] Zod v4 migration  
**Status:** DR cleared, implementation greenlit

**Your assignment:**
1. Migrate `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` ~20 z.preprocess callsites to Zod v4 equivalents
2. Confirm upstream a2ui contract for null handling (currently rejects null; must not change to accept-null)
3. Include equivalence test matrix covering null/undefined/0/"3"/non-numeric strings/booleans for all numeric callsites
4. Verify zod-to-json-schema@^3.25.1 output byte-equivalence after migration (since packages/web will then depend on zod@4.3.6)
5. Coordinate with Bender (pack-core schema), Kif (overrides + CI guardrail after both land)

**Key requirements from DR:**
- Null-coerce behavioral trap: current code rejects null, proposed `.nullable()` approach would accept null. Pick the right v4 equivalent.
- Changeset body must acknowledge any API surface narrowing or type changes
- String-coerce patterns (7 callsites) are low risk

**Cross-domain note:** Bender taking pack-core backend schema under this migration. Leela coordinating both tracks.

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-08 — packages/web scaffold created
- **Structure**: `packages/web/` contains `index.html`, `css/{theme,core,components}.css`, `js/{app,auth}.js`, `js/framework/{core,components,a2ui-renderer}.js`, `assets/{logo,favicon}.svg`, `package.json`, `staticwebapp.config.json`.
- **Framework pattern**: SPA router is hash-based (core.js `Router`), Navigation pane manager (`Navigation`), Breadcrumbs auto-generate from route path. All exported as ES modules.
- **Component factory pattern**: `createCopilotPanel()`, `createWizard()`, `createCard()`, `createCommandBar()`, `createCodeBlock()`, `createStatusBadge()` — all return DOM elements, not HTML strings.
- **A2UI renderer**: `renderA2UI(schema, ctx)` maps A2UI JSON types to DOM. Custom types registered: `ConversationPhase`, `CodeBlock`, `ResourcePicker`, `DeploymentProgress`, `ArchitectureDiagram`, `CostEstimate`, `HandoffCard`. Extensible via `registerRenderer()`.
- **Auth**: Uses existing Entra config (client ID `7a630e18...`, tenant `72f988bf...`). MSAL loaded via CDN. Auth module pattern: IIFE returning frozen API.
- **CSS tokens**: All colors/spacing/typography use CSS custom properties defined in `theme.css`. Base grid is 4px.
- **Zero build deps**: No npm install needed. Vanilla ES modules + CDN scripts only.
- **Local dev**: `npx serve .` from packages/web (port auto).
- **Copilot panel**: Right-side panel with phase indicator (Understand → Architect → Configure → Deploy), chat bubbles, typing indicator. `onSend` callback wires to conversation engine (placeholder for now).
- **Domain**: kickstart.prototypes.aks.azure.sabbour.me (staging), kickstart.aks.azure.com (future).

### 2025-07-22 — Copilot panel wired to 6-phase conversation engine
- **Engine**: `packages/web/js/engine.js` — client-side conversation state machine mirroring `@kickstart/core` phases in plain JS. 6 phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY (Decision 11).
- **Scripted demo flow**: Each phase has a handler that returns A2UI JSON. Flow auto-advances after user turns; no LLM backend needed yet.
- **New A2UI renderers**: `RepoPicker` (filterable dropdown + "create new"), `WorkflowStatus` (color-coded run list), `CodespaceLink` (CTA card with Codespaces/vscode.dev buttons), `AppOverview` (dashboard widget: app name, runtime badge, service pills, status dot).
- **Phase header updated**: Copilot panel phases changed from 4 (Understand/Architect/Configure/Deploy) to 6 (Discover/Design/Generate/Review/Handoff/Deploy). Landing page cards updated to match.
- **K8s jargon hidden**: No Kubernetes terms in user-facing text for phases 1-4. AKS framed as "app platform" per copilot directive.
- **A2UI rendering pattern**: `copilot.addMessage({ html })` accepts pre-rendered HTML from `renderA2UI()`. Engine calls `onResponse({ a2ui })` and app.js bridges the two.
- **structuredClone**: Used for immutable state transitions in engine.js — works in modern browsers, no polyfill needed.

### 2025-07-25 — API client + API-backed engine wired to Copilot panel
- **api-client.js**: New module at `packages/web/js/api-client.js`. Calls `POST /api/converse` with native `fetch()`. Supports streaming via `ReadableStream` (NDJSON / SSE). Auto-retries on 429/503 with exponential backoff (max 3). Timeouts: 30s standard, 60s streaming. `healthCheck()` pings the endpoint to detect if API is available.
- **Engine refactor**: `engine.js` now exports three factories: `createDemoEngine()` (original scripted flow), `createApiEngine()` (real backend), and `createEngine()` (smart factory — uses API if `apiClient` provided, else demo). Both engines share identical public API shape: `handleMessage`, `getWelcome`, `getCurrentPhase`, `getState`, plus `isDemo` flag.
- **API engine behavior**: `handleMessage` is async, calls `converseStream()`, maps API response `{ sessionId, phase, message, a2ui }` to engine format `{ a2ui, text, systemPrompt }`. Phase transitions driven by comparing API `phase` field to current. Session ID tracked internally.
- **app.js wiring**: `initEngine()` is now async — does `apiClient.healthCheck()` at boot. If API is available, creates API engine with `onStreaming` + `onError` handlers. Otherwise falls back to demo engine and shows a yellow "Demo" badge in the Copilot panel header.
- **Streaming UX**: `updateStreamingBubble()` creates/updates a temporary `.chat-bubble.streaming` element in the message log, replaced by the final response.
- **Error UX**: `showErrorBubble()` renders a red-tinted `.error-bubble` with optional "Retry" button. Retry re-sends the last user message.
- **CSS additions**: `.demo-badge` (yellow pill), `.error-bubble` + `.error-retry-btn` (red alert styling), `.streaming` bubble (left border accent).
- **No build step**: All new code is vanilla ES modules + native APIs. No npm packages added.

### 2025-07-25 — Chat-first UX redesign
- **Layout overhaul**: Removed Portal Prototyper shell (`.portal-shell`, nav-pane, breadcrumbs, command-bar, wizard, content-area, SPA router). Replaced with `.app-shell` — a simple header + three-column flex layout: sessions sidebar | chat (main) | file viewer.
- **Chat is primary**: `createChatUI()` replaced `createCopilotPanel()`. Chat is centered (max-width 760px), takes up the full main area. No toggle button, no close button — it's always visible. Messages container uses `.chat-messages-inner` for centered layout.
- **File viewer sidebar**: New `createFileViewer()` component with tabbed file display, syntax highlighting (dark background), and per-file copy button. Appears via `EventBus.emit('files:generated')` when GENERATE phase produces files. Collapses when hidden.
- **Sessions sidebar**: Left sidebar with session list, toggled from header. Placeholder for future session history.
- **Conversational demo flow**: Discover phase now has 3 turns: (1) ask about app → (2) ask about framework → (3) ask about database/services → advance. Each turn asks ONE question. No multi-field forms.
- **Prompt inspector**: Moved from Copilot panel header to topbar toggle button (`#topbar-inspector-toggle`).
- **Dark mode**: Added `@media (prefers-color-scheme: dark)` block in `theme.css` with full dark palette.
- **CSS class renames**: `.copilot-*` → `.chat-*` (messages, phase, input, textarea, send-btn). Old wizard/command-bar/nav styles removed.
- **Removed components**: `createWizard()`, `createCommandBar()`, `createCopilotPanel()`. Added `createChatUI()`, `createFileViewer()`.
- **No Router needed**: App no longer uses hash-based routing or Navigation/Breadcrumbs — it's a single-page chat experience.
- **Engine files emission**: `generateHandler()` now returns a `files` array alongside `a2ui`, which the app wires to the file viewer via EventBus.

### 2025-07-26 — Landing page added before chat UI
- **Landing page**: `index.html` now shows a `#landing-page` div inside `.chat-main` before the chat starts. Chat UI is hidden until user selects a track or framework.
- **Carousel**: 10 inspiration ideas auto-rotate every 5 seconds with slide/fade transitions and clickable dot indicators. Built with CSS transitions (no library).
- **Track cards**: Two side-by-side cards — "Web App or API" (web-app) and "AI Agent" (agentic-app) — matching Decision D12 tracks. Each has "Get started →" link.
- **Framework pills**: 9 framework quick-start buttons (Next.js, FastAPI, Express.js, Go, Spring Boot, Django, Rust, LangChain Agent, RAG App). Clicking pre-selects the framework AND auto-detects the track (LangChain/RAG → agentic-app, others → web-app).
- **Transition flow**: `transitionToChat()` fades out landing page, removes `body.on-landing` class (which hides sessions toggle), shows chat UI, initializes engine with track/framework, and sends welcome message.
- **Engine params**: `createDemoEngine()` and `createEngine()` now accept optional `track` and `preSelectedFramework`. When framework is pre-selected, `state.turnCount` starts at 1 (skips "which framework?" question) and welcome message says "Great choice — let's build something with {Framework}!".
- **CSS**: New `css/landing.css` — carousel, track cards, framework pills, responsive (stacks cards on mobile). Uses existing Fluent 2 tokens from `theme.css`.
- **Body class pattern**: `body.on-landing` is set in HTML and removed on transition. Used to hide sessions sidebar toggle via CSS.

### 2026-04-08 — Wave 7 Coordination with Bender (MCP App surface)
- **Parallel work**: Bender completed MCP App HTML surface (commit e80b44f) with full A2UI renderer (18 component types), postMessage protocol, and 30 new tests (118 total passing).
- **Dual-surface architecture**: Both web and IDE surfaces now share the same A2UI component catalog. Web uses DOM rendering (ES modules), IDE uses self-contained HTML with inline JS (no external loads allowed in MCP App iframes).
- **Session persistence deferred**: Coordinator researched Cloud Shell storage; found programmatic provisioning not available for first-time users. Demo flows work without persistent storage for Phase 1.
- **Decision conflicts**: Dark mode was implemented as part of chat-first directive (2026-04-08T14:37:00Z) matching reference app styling, but a later directive (2026-04-08T15:05:00Z) requested light-only. Dark mode currently live in d431093; recommend clarifying with user.
- **Files committed**: d431093 (UI redesign), 6f7d7e9 (Squad docs). Orchestration log: fry-wave7.md.

### 2026-04-08 — Clickable carousel, Fluent 2 icons, dark mode removal
- **Clickable carousel**: Each `INSPIRATION_IDEAS` item now has a `prompt` field — a first-person message like "I want to build [title] — [subtitle]." Clicking a carousel slide stores the prompt, transitions to chat, shows it as a user bubble, and auto-sends it after 300ms via `handleUserMessage()`. Carousel stops on click. Hover state: `scale(1.02)` + title turns brand blue + pointer cursor.
- **Emojis → Fluent 2 SVG icons**: Replaced ALL emoji characters across `index.html`, `app.js`, `engine.js`, `a2ui-renderer.js`, and `components.js`. Track cards use 28px Globe/Bot SVGs. Architecture diagram components use 24px inline SVGs (Globe, Cloud, Database, Lightning, ArrowSync). Status indicators (checkmark, dismiss) use 14px SVGs. File viewer folder icon uses 16px SVG. Prompt inspector uses code-bracket SVG. Sessions new-btn uses 16px Add/Plus SVG. All SVGs use `fill="currentColor"` to inherit text color.
- **Dark mode removed**: Deleted `@media (prefers-color-scheme: dark)` blocks from `theme.css` (web) and `kickstart-app.html` (MCP app). Updated MCP test to assert dark mode is NOT present. Light theme only per user directive.
- **CSS adjustment**: `.track-card-icon` changed from `font-size: 28px` to `display: inline-flex; color: var(--color-brand-primary)` to properly hold SVG elements.
# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Core Context

Fry (Frontend Dev) has shipped ~16 major feature/polish work cycles across the Kickstart web surface. The stack evolved from vanilla Portal Prototyper → npm workspaces + React + Fluent UI v9 + A2UI. Key architectural wins:

- **Web scaffold** (2026-04-08): `packages/web/` with hash-based SPA router, component factory pattern, A2UI renderer, Fluent 2 CSS tokens, zero build deps initially.
- **6-phase conversation engine** (2026-07-22): Scripted demo flow (DISCOVER→DESIGN→GENERATE→REVIEW→HANDOFF→DEPLOY), A2UI custom renderers (RepoPicker, WorkflowStatus, CodespaceLink, AppOverview), K8s jargon hidden in phases 1-4.
- **API client + streaming** (2026-07-25): `/api/converse` endpoint, ReadableStream/SSE support, smart fallback to demo mode on API unavailability, streaming UX (temporary chat bubbles), error recovery with Retry.
- **Chat-first UX redesign** (2026-07-25): Removed Portal Prototyper shell, adopted 3-column layout (sessions | chat | file-viewer), file viewer with tabbed display and syntax highlighting, sessions sidebar for history.
- **Fluent UI v9 migration** (2026-04-09): All 22 components (18 basic + 4 custom) migrated to Fluent UI v9. Created override catalog pattern to replace vendor components without modifying source. Zero raw HTML elements; all primitives via Fluent.
- **Component audit trail**: Repeatedly audited for Fluent 2 compliance — spacing tokens, font tokens, color tokens, no hardcoded px/hex/rgb values. This became a pattern: every new component or fix includes audit verification.
- **Playground interface** (2026-04-09): Added tabbed Preview|JSON view, scenario selector, real-time JSON generation for keyword-based scenarios, helper descriptions, all with Fluent UI components.
- **Syntax highlighting** (2026-04-10): Added highlight.js to CodeBlock, registered 10+ languages, VS theme for Fluent 2 compatibility, useMemo optimization.
- **Markdown component** (2026-04-10): Created react-markdown + remark-gfm component, all elements styled with Fluent 2 tokens via makeStyles, code blocks delegate to highlight.js.
- **Session ID bridge** (2026-04-10): Implemented backendSessionId field mapping frontend UI sessions to backend conversation UUIDs. Solved LLM memory loss across messages.

**Build status**: Vite build stable, 302 KB gzipped bundle, zero TypeScript errors.

**Key dependencies**: @fluentui/react-components, react-markdown, remark-gfm, highlight.js, @a2ui/react (adapter).

**Pattern**: All components use `createReactComponent(Api, renderFn)` adapter pattern, `makeStyles` for styling, Fluent tokens exclusively, no framework state (A2UI data model is source of truth).

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->


### 2026-04-08 — packages/web scaffold created
- **Structure**: `packages/web/` contains `index.html`, `css/{theme,core,components}.css`, `js/{app,auth}.js`, `js/framework/{core,components,a2ui-renderer}.js`, `assets/{logo,favicon}.svg`, `package.json`, `staticwebapp.config.json`.
- **Framework pattern**: SPA router is hash-based (core.js `Router`), Navigation pane manager (`Navigation`), Breadcrumbs auto-generate from route path. All exported as ES modules.
- **Component factory pattern**: `createCopilotPanel()`, `createWizard()`, `createCard()`, `createCommandBar()`, `createCodeBlock()`, `createStatusBadge()` — all return DOM elements, not HTML strings.
- **A2UI renderer**: `renderA2UI(schema, ctx)` maps A2UI JSON types to DOM. Custom types registered: `ConversationPhase`, `CodeBlock`, `ResourcePicker`, `DeploymentProgress`, `ArchitectureDiagram`, `CostEstimate`, `HandoffCard`. Extensible via `registerRenderer()`.
- **Auth**: Uses existing Entra config (client ID `7a630e18...`, tenant `72f988bf...`). MSAL loaded via CDN. Auth module pattern: IIFE returning frozen API.
- **CSS tokens**: All colors/spacing/typography use CSS custom properties defined in `theme.css`. Base grid is 4px.
- **Zero build deps**: No npm install needed. Vanilla ES modules + CDN scripts only.
- **Local dev**: `npx serve .` from packages/web (port auto).
- **Copilot panel**: Right-side panel with phase indicator (Understand → Architect → Configure → Deploy), chat bubbles, typing indicator. `onSend` callback wires to conversation engine (placeholder for now).
- **Domain**: kickstart.prototypes.aks.azure.sabbour.me (staging), kickstart.aks.azure.com (future).

### 2025-07-22 — Copilot panel wired to 6-phase conversation engine
- **Engine**: `packages/web/js/engine.js` — client-side conversation state machine mirroring `@kickstart/core` phases in plain JS. 6 phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY (Decision 11).
- **Scripted demo flow**: Each phase has a handler that returns A2UI JSON. Flow auto-advances after user turns; no LLM backend needed yet.
- **New A2UI renderers**: `RepoPicker` (filterable dropdown + "create new"), `WorkflowStatus` (color-coded run list), `CodespaceLink` (CTA card with Codespaces/vscode.dev buttons), `AppOverview` (dashboard widget: app name, runtime badge, service pills, status dot).
- **Phase header updated**: Copilot panel phases changed from 4 (Understand/Architect/Configure/Deploy) to 6 (Discover/Design/Generate/Review/Handoff/Deploy). Landing page cards updated to match.
- **K8s jargon hidden**: No Kubernetes terms in user-facing text for phases 1-4. AKS framed as "app platform" per copilot directive.
- **A2UI rendering pattern**: `copilot.addMessage({ html })` accepts pre-rendered HTML from `renderA2UI()`. Engine calls `onResponse({ a2ui })` and app.js bridges the two.
- **structuredClone**: Used for immutable state transitions in engine.js — works in modern browsers, no polyfill needed.

### 2025-07-25 — API client + API-backed engine wired to Copilot panel
- **api-client.js**: New module at `packages/web/js/api-client.js`. Calls `POST /api/converse` with native `fetch()`. Supports streaming via `ReadableStream` (NDJSON / SSE). Auto-retries on 429/503 with exponential backoff (max 3). Timeouts: 30s standard, 60s streaming. `healthCheck()` pings the endpoint to detect if API is available.
- **Engine refactor**: `engine.js` now exports three factories: `createDemoEngine()` (original scripted flow), `createApiEngine()` (real backend), and `createEngine()` (smart factory — uses API if `apiClient` provided, else demo). Both engines share identical public API shape: `handleMessage`, `getWelcome`, `getCurrentPhase`, `getState`, plus `isDemo` flag.
- **API engine behavior**: `handleMessage` is async, calls `converseStream()`, maps API response `{ sessionId, phase, message, a2ui }` to engine format `{ a2ui, text, systemPrompt }`. Phase transitions driven by comparing API `phase` field to current. Session ID tracked internally.
- **app.js wiring**: `initEngine()` is now async — does `apiClient.healthCheck()` at boot. If API is available, creates API engine with `onStreaming` + `onError` handlers. Otherwise falls back to demo engine and shows a yellow "Demo" badge in the Copilot panel header.
- **Streaming UX**: `updateStreamingBubble()` creates/updates a temporary `.chat-bubble.streaming` element in the message log, replaced by the final response.
- **Error UX**: `showErrorBubble()` renders a red-tinted `.error-bubble` with optional "Retry" button. Retry re-sends the last user message.
- **CSS additions**: `.demo-badge` (yellow pill), `.error-bubble` + `.error-retry-btn` (red alert styling), `.streaming` bubble (left border accent).
- **No build step**: All new code is vanilla ES modules + native APIs. No npm packages added.

### 2025-07-25 — Chat-first UX redesign
- **Layout overhaul**: Removed Portal Prototyper shell (`.portal-shell`, nav-pane, breadcrumbs, command-bar, wizard, content-area, SPA router). Replaced with `.app-shell` — a simple header + three-column flex layout: sessions sidebar | chat (main) | file viewer.
- **Chat is primary**: `createChatUI()` replaced `createCopilotPanel()`. Chat is centered (max-width 760px), takes up the full main area. No toggle button, no close button — it's always visible. Messages container uses `.chat-messages-inner` for centered layout.
- **File viewer sidebar**: New `createFileViewer()` component with tabbed file display, syntax highlighting (dark background), and per-file copy button. Appears via `EventBus.emit('files:generated')` when GENERATE phase produces files. Collapses when hidden.
- **Sessions sidebar**: Left sidebar with session list, toggled from header. Placeholder for future session history.
- **Conversational demo flow**: Discover phase now has 3 turns: (1) ask about app → (2) ask about framework → (3) ask about database/services → advance. Each turn asks ONE question. No multi-field forms.
- **Prompt inspector**: Moved from Copilot panel header to topbar toggle button (`#topbar-inspector-toggle`).
- **Dark mode**: Added `@media (prefers-color-scheme: dark)` block in `theme.css` with full dark palette.
- **CSS class renames**: `.copilot-*` → `.chat-*` (messages, phase, input, textarea, send-btn). Old wizard/command-bar/nav styles removed.
- **Removed components**: `createWizard()`, `createCommandBar()`, `createCopilotPanel()`. Added `createChatUI()`, `createFileViewer()`.
- **No Router needed**: App no longer uses hash-based routing or Navigation/Breadcrumbs — it's a single-page chat experience.
- **Engine files emission**: `generateHandler()` now returns a `files` array alongside `a2ui`, which the app wires to the file viewer via EventBus.

### 2025-07-26 — Landing page added before chat UI
- **Landing page**: `index.html` now shows a `#landing-page` div inside `.chat-main` before the chat starts. Chat UI is hidden until user selects a track or framework.
- **Carousel**: 10 inspiration ideas auto-rotate every 5 seconds with slide/fade transitions and clickable dot indicators. Built with CSS transitions (no library).
- **Track cards**: Two side-by-side cards — "Web App or API" (web-app) and "AI Agent" (agentic-app) — matching Decision D12 tracks. Each has "Get started →" link.
- **Framework pills**: 9 framework quick-start buttons (Next.js, FastAPI, Express.js, Go, Spring Boot, Django, Rust, LangChain Agent, RAG App). Clicking pre-selects the framework AND auto-detects the track (LangChain/RAG → agentic-app, others → web-app).
- **Transition flow**: `transitionToChat()` fades out landing page, removes `body.on-landing` class (which hides sessions toggle), shows chat UI, initializes engine with track/framework, and sends welcome message.
- **Engine params**: `createDemoEngine()` and `createEngine()` now accept optional `track` and `preSelectedFramework`. When framework is pre-selected, `state.turnCount` starts at 1 (skips "which framework?" question) and welcome message says "Great choice — let's build something with {Framework}!".
- **CSS**: New `css/landing.css` — carousel, track cards, framework pills, responsive (stacks cards on mobile). Uses existing Fluent 2 tokens from `theme.css`.
- **Body class pattern**: `body.on-landing` is set in HTML and removed on transition. Used to hide sessions sidebar toggle via CSS.

### 2026-04-08 — Wave 7 Coordination with Bender (MCP App surface)
- **Parallel work**: Bender completed MCP App HTML surface (commit e80b44f) with full A2UI renderer (18 component types), postMessage protocol, and 30 new tests (118 total passing).
- **Dual-surface architecture**: Both web and IDE surfaces now share the same A2UI component catalog. Web uses DOM rendering (ES modules), IDE uses self-contained HTML with inline JS (no external loads allowed in MCP App iframes).
- **Session persistence deferred**: Coordinator researched Cloud Shell storage; found programmatic provisioning not available for first-time users. Demo flows work without persistent storage for Phase 1.
- **Decision conflicts**: Dark mode was implemented as part of chat-first directive (2026-04-08T14:37:00Z) matching reference app styling, but a later directive (2026-04-08T15:05:00Z) requested light-only. Dark mode currently live in d431093; recommend clarifying with user.
- **Files committed**: d431093 (UI redesign), 6f7d7e9 (Squad docs). Orchestration log: fry-wave7.md.

### 2026-04-08 — Clickable carousel, Fluent 2 icons, dark mode removal
- **Clickable carousel**: Each `INSPIRATION_IDEAS` item now has a `prompt` field — a first-person message like "I want to build [title] — [subtitle]." Clicking a carousel slide stores the prompt, transitions to chat, shows it as a user bubble, and auto-sends it after 300ms via `handleUserMessage()`. Carousel stops on click. Hover state: `scale(1.02)` + title turns brand blue + pointer cursor.
- **Emojis → Fluent 2 SVG icons**: Replaced ALL emoji characters across `index.html`, `app.js`, `engine.js`, `a2ui-renderer.js`, and `components.js`. Track cards use 28px Globe/Bot SVGs. Architecture diagram components use 24px inline SVGs (Globe, Cloud, Database, Lightning, ArrowSync). Status indicators (checkmark, dismiss) use 14px SVGs. File viewer folder icon uses 16px SVG. Prompt inspector uses code-bracket SVG. Sessions new-btn uses 16px Add/Plus SVG. All SVGs use `fill="currentColor"` to inherit text color.
- **Dark mode removed**: Deleted `@media (prefers-color-scheme: dark)` blocks from `theme.css` (web) and `kickstart-app.html` (MCP app). Updated MCP test to assert dark mode is NOT present. Light theme only per user directive.
- **CSS adjustment**: `.track-card-icon` changed from `font-size: 28px` to `display: inline-flex; color: var(--color-brand-primary)` to properly hold SVG elements.

## Summary (2026-04-10)
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns. Shipped full Vite+React stack migration, Playground interface, dark mode, accessibility audit, and 20+ fat A2UI components.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/pages/` — Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system

## Recent Work
- v2 #474: frontend cut line analysis, seam-cutting approach confirmed
- v0.6: SSE parser fixes, K8s icon expansion, A2UI debug visualization
- Shipped: 406 fallback in useStreaming, Playwright test suite
- 2026-04-21: **Bug intake — 2 issues assigned** (#995: Core components tab tight rendering + preview quality; #997: Workspace page black void). Both unassigned, go:needs-research tags.
- v2 #474 frontend cut line analysis: seam-cutting pass approach confirmed for Step 1
- v0.6.x: 406 fallback in useStreaming.ts for SDK path; K8s icon catalog expansion; A2UI debug visualization; system-prompt context var injection fix
- v0.5.x: SSE parser fixes, action context enrichment, hash-based routing, ArchitectureDiagram diagram-first contract, theme system

## Active Sprint: v2
Sprint 1: #474 (Nuke v1) → #475 → #476. Fry's role: seam-cutting (preserve shell, delete fixtures, replace in-place).

## 2026-04-21 Status
Participating in four-way review gate. Ceremony enforcement tightened with pre-dispatch blocking checkpoint.
Sprint 1 locked: #474 (Nuke v1) → #475 (Harness types) → #476 (Registry + loaders). Fry's role in #474 is seam-cutting: remove mock/demo surfaces first, then hard-delete after introducing temporary replacement exports.

**#474 cut line:**
- **Preserve:** `components/` shell, `contexts/`, streaming hooks, `services/api-client.ts`, `services/virtual-fs.ts`, catalog components/icons, Playground page shell
- **Delete:** `demo-scenarios.ts`, `mock-streaming.ts`, `playground-auth-stub.ts`, `playground-scenarios.ts`, `useMockStreaming.ts`, `useWidgets.tsx` (post cleanup)
- **Replace:** `kickstart-catalog.ts` (registry-driven), `packages/web/src/types.ts` (new contracts first)
- **Compile blockers:** `@kickstart/core` imports (broad), `packages/web/src/types.ts` imports (broad), `Playground.tsx` depends on all three deleted playground sources

## Learnings

- (2026-04-24T00:01:12-07:00) For cross-turn chat updates, turn-prefix scoping alone is insufficient. Safe frontend pattern is to reserve a stable surface namespace (proposed `shared:`) for chat-persistent surfaces, resolve those through a replay-safe logical→rendered registry, and keep all other surface IDs turn-scoped so existing per-turn file/progress surfaces stay isolated.
- (2026-04-17T12:06:45Z) For #474 Step 1, safe frontend cut line is "preserve the shell, delete the fixtures." Treat `kickstart-catalog.ts`, playground demo/stub sources, and `types.ts` as replace-in-place seams because too many live files depend on them for hard-delete without immediate successors.
- (2026-04-17T06:28:51Z) **Playwright race condition:** `waitForResponse` MUST be registered before `page.goto()` — registering after creates a race where the response arrives before the listener is attached.
- (2026-04-17T06:28:51Z) **Auth E2E tests:** Must use `request.post()` (real HTTP) not `page.route()` mock interception; `page.route()` short-circuits before auth headers are evaluated.
- (2026-04-17T06:28:51Z) **`addMessage` placement in `converse.ts`:** Must be inside each processing branch, not before it — placing before means 406 early-return path mutates session state on no-message turns.
- (2026-04-17T06:28:51Z) **Phase allowlist** should delegate to `normalizeConversationPhase()` from `chat-a2ui.ts`, not maintain a separate set — separate set drifts when `PHASE_ALIASES` is updated.
- (2026-04-17T03:30:17Z) When `KICKSTART_AGENTS_SDK=true`, backend returns HTTP 406 for streaming. Correct pattern: inline 406 fallback in `useStreaming.ts` retrying as non-streaming JSON, not a separate hook.
- (2026-04-17T03:30:17Z) Playwright SSE route interception: register `**/api/health` → 200 and `**/api/converse` → SSE BEFORE `page.goto()`. Use closure counter for multi-turn SSE responses.
- (2026-04-17T03:01:07Z) `buildSystemPrompt()` context vars (`appDefinition`, `azureContext`, `repoInfo`) must be explicitly pushed to `parts` as `## Section` blocks — `interpolate()` only substitutes `{{placeholder}}` tokens, narrative text alone does not inject context.
- (2026-04-17T03:01:07Z) `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes; `navigate:` is secondary. `skill-resolver.ts` phase group constants are module-private `const Set<Phase>`, not exported arrays.
- (2026-04-16T06:38:32Z) New K8s icons: create static SVGs under `packages/web/public/assets/icons/k8s/`, register via `registerDiagramIcons()` in `ensureDiagramIconsRegistered()`, update `ALLOWED_ICON_KEYS` in tandem.
- (2026-04-15T15:20:24Z) `ArchitectureDiagram` uses diagram-first contract: raw Mermaid in `diagram`, all render prep through `architectureDiagramUtils.ts`. Secure path: `sanitizeDiagramInput()` before Mermaid render + `%%icon:name%%` expansion after.

## 2026-04-17 Issue #446 — Agents SDK UI Adaptation (PR #455)

Shipped 406 fallback in `useStreaming.ts`. Added `route-state.spec.ts` with skip-ahead and revisit Playwright scenarios using `page.route()` API interception. Issue closed.

## 2026-04-17T12:06:45Z — #474 Frontend Cut Line Analysis

Analyzed #474 frontend surface. Preserve/delete/replace boundary defined (see Active Sprint above). Decision filed (`fry-474-frontend-cutline.md` → decisions.md).


## 2026-07-16 — #474 Step 1 web-shell cleanup (commit ffa10ee)

Working as Fry (Frontend Dev) on branch `squad/474-step1-nuke-v1`.

### What I did
- Replaced all 16 `@kickstart/core` import strings in `packages/web/src/` with `@kickstart/harness` (same shim, cleaner path)
- Removed v1 kit registration dead code from `main.tsx`: `registerKit(azureKit)` and `registerKit(githubKit)` (no-op stubs, v1 pattern)
- Added `names(): string[] { return []; }` stub to `APIConnectorRegistry` in `packages/harness/src/index.ts` — was missing from Bender's shim, required by `APIConnectorContext.tsx` and `useActionDispatch.ts`
- Removed `@kickstart/core` path alias from `packages/web/vite.config.ts` and `packages/web/tsconfig.json`
- Confirmed `npm run build` passes (19 files changed, build green)

### Files changed
**Modified imports:**
- `packages/web/src/__tests__/azure-auth.test.ts`
- `packages/web/src/services/azure-auth.ts`
- `packages/web/src/services/github-handoff.ts`
- `packages/web/src/hooks/useActionDispatch.ts`
- `packages/web/src/catalog/components/` (7 files: AuthCard, AzureAction, AzureLoginCard, AzureResourceForm, AzureResourcePicker, GitHubAction, GitHubCommit, GitHubRepoPicker)
- `packages/web/src/components/Chat/DebugA2UITree.tsx`
- `packages/web/src/contexts/ArtifactContext.tsx`
- `packages/web/src/contexts/APIConnectorContext.tsx`

**Runtime cleanup:**
- `packages/web/src/main.tsx` — removed v1 registerKit/azureKit/githubKit dead code

**Shim fix:**
- `packages/harness/src/index.ts` — added `names()` to APIConnectorRegistry stub

**Config:**
- `packages/web/vite.config.ts` — removed `@kickstart/core` alias
- `packages/web/tsconfig.json` — removed `@kickstart/core` path

### Remaining blockers for Step 1
- `packages/web/src/types.ts` is `export {}` but imported by many files for A2UI types — needs Step 2 to fully resolve (deleting it would break vite module resolution)
- `packages/core/` shim package directory still exists (kept for compile compat); Step 2 will drop it
- `APIConnectorContext.tsx` and related connector infrastructure is v1 — will be replaced in Steps 5-7

## 2026-07-16 — #477 Design Proposal: v2 Step 4 pack-core

Posted DP to https://github.com/azure-management-and-platforms/kickstart/issues/477#issuecomment-4268128132

### Covered

## 2026-04-21 — #1018: sparkle.svg 404 + CSP external media fix (PR #1022)


## Summary (History Archived 2026-04-23T22:53:28Z)

Fry owns frontend and A2UI catalog. Key contributions:
- Led #474 Step 1 frontend cutline analysis: preserve shell, delete fixtures, replace in-place seams
- Shipped #446 (Agents SDK UI adaptation) with 406 fallback in useStreaming.ts
- Expanded K8s icon catalog and ArchitectureDiagram security model
- Participated in 4-way review gate — approved 5+ DPs and PRs with consistent pattern discipline
- Identified Playwright race condition (waitForResponse MUST precede page.goto)
- Established safe frontend cut line for v2 nuke: preserve components/contexts/hooks shell

[Full archive in session store for detailed learnings]

## 2026-04-24T07:01:12Z — Session Close (Scribe)
**Role:** Frontend (DP amendment + impl)
**Issue:** #5
**Outcomes:**
- DP amendment: shared surface namespace design (resolved Nibbler rejection)
- Frontend implementation completed: shared namespace integration, useA2UI fix, tests
- PR #25 opened targeting dev

**Critical Events:**
- Submitted design clarification on cross-turn surface scoping
- Nibbler approved amended DP
- Parallel impl with Bender (backend)

**Carry-forward:** PR #25 merge pending review gate

## 2026-04-24T15:04:55Z — Session Close (Scribe)
**Role:** Frontend (org migration design feedback)
**Issue:** #38
**Outcomes:**
- Provided design feedback on org migration scope amendment
- Participated in 4-way review: approved DP v2 by Leela, Zapp, Nibbler
- No code changes required (backend-led org migration)
- PR #40 opened by Bender

**Critical Events:**
- DP v2 scope amendment: production/docs/runtime boundary clarified
- Cross-agent collaboration with Bender on audit findings
- All reviewers gate-clear

**Carry-forward:** PR #40 merge pending code review completion

## 2026-04-28 — PR #239 lockout-substitute revision (issue #237)

Acted as designated revision author after Zapp issued `security:rejected` on PR #239 (original author: Bender, locked out per Reviewer Rejection Protocol).

**Fix:** added `https://management.azure.com` to the `connect-src` directive in `packages/web/public/staticwebapp.config.json`. Surgical single-line edit — no other directive touched, no wildcards introduced. The Playwright CSP smoke mirror in `e2e/browser-telemetry.spec.ts` already contained the entry, so no drift.

**Verification:** `arm-direct-csp.test.ts` (CI invariant guard) green; full vitest suite 2137/2137 passing; web + api builds clean; bundle budgets within ceiling.

**Commit:** b9ca7b34 (squad-frontend[bot]). Comment 4337051908 posted on PR #239 pinging Zapp for re-review. Bender did not contribute.
## 2026-04-27T23:00:42Z — Session Close (Scribe)
**Role:** Frontend (PR #168, #171, #171-rebase)
**Issues:** #168, #171
**Outcomes:**
- PR #168 (error stubs, cross-pack tests, circular imports) ✅ MERGED
- PR #171 (A2UI rendering logic, 8 threads resolved) ✅ MERGED
- PR #171 rebased onto dev after upstream merge, 439 tests passing ✅ MERGED

**Critical Events:**
- Resolved 5 + 8 = 13 Copilot review threads (PR #168 + #171)
- Discovered **lead token required** for resolveReviewThread GraphQL mutation; codereview token returns FORBIDDEN
- Managed stacked PR rebase: squash merge from #168 caused DIRTY conflict in runner.ts on #171
- Handled merge conflict resolution (kept stub approach from #171, integrated #168 error stubs cleanly)
- All 439 tests passing post-rebase

**Key Learnings:**
- **Token routing matters:** Different GitHub operations require different role tokens. resolveReviewThread needs `lead` token, not `codereview`. Post-flight checks must verify `user.login` matches expected bot identity.
- **Squash merges cause downstream conflicts:** When PR A squash-merges into dev, any stacked PR B rebasing onto dev will see DIRTY conflicts in overlapping modules. Rebase is required; conflict resolution must preserve both approaches.
- **Stacked PRs require proactive rebasing:** After upstream merge, run `update-branch` immediately; BEHIND status is sticky and blocks auto-merge even with green checks.

**Carry-forward:** All PRs merged; board clear
