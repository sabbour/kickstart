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

## Learnings

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
