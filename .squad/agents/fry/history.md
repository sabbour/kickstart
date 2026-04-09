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

## Learnings

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
