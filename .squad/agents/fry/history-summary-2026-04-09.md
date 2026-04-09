# Fry History Summary (as of 2026-04-09)

**Total Size:** 80KB | **Entries:** ~14 major learnings

## High-Level Index

### Foundation & Early Development (2025-07)
- React/TypeScript setup with Fluent UI v9
- Fluent styling patterns (makeStyles, tokens, Griffel CSS-in-JS)
- Portal Prototyper framework familiarization
- CSS media queries and responsive design
- TypeScript strict mode + ESM modules

### A2UI & Chat Integration (2025-07-25)
- A2UI Spec JSON Schema (draft/2020-12)
- Component rendering (`RenderComponent`) with generic props
- `useA2UI` hook pattern for chat integration
- Action dispatch system (reply/navigate/api prefixes)
- Playground implementation (split UI + JSON editor)

### React/Vite Migration & E2E Testing (2025-07-25+)
- React component architecture (ChatShell, SessionsSidebar, Topbar, App.tsx)
- Fluent UI v9 button, button menu, card, text, input field components
- Vite development server + production preview build
- Playwright E2E test setup (webServer config, port 4281)
- Mock mode via `?mock` URL param for demo responses

### Chat First UX & Sessions (2025-07-25)
- Landing page → chat transition (CSS class `body.on-landing`)
- Sessions sidebar with session list + create
- Session context (useState + Context API)
- Message rendering (system + user + assistant turns)
- Chat flow: title editor → send message → receive A2UI surface + scroll to latest

### Styling & Component Polish (2025-07-25+)
- Fluent text tokens (neutralForeground1, neutralForeground2, etc.)
- Button and text field token customization
- Card styling with borders and padding
- Icon rendering (SVG icons from Fluent UI)

### Recent Work (2026-04-08 to 2026-04-09)
- **Playground Create tab:** Wired to real LLM chat via `useStreaming` + `useA2UI`
- **E2E test suite:** 38 tests (landing-page, chat-transition, chat-experience, sessions-sidebar)
- **Fluent UI v9 adoption:** All Fluent components properly styled
- **React lifecycle fixes:** `body.on-landing` class sync, conditional sidebar mounting

## Key Learnings

### Component Architecture
- A2UI `RenderComponent` handles recursive rendering with generic props
- Fluent UI v9 uses Griffel CSS-in-JS (no inline styles, no hardcoded colors)
- Button, TextField, Card, Text from `@fluentui/react-components`

### Testing & E2E
- MSAL mock: intercept CDN with `page.route('**/msal-browser*')`
- API health check: 404 treated as "available", use 503 to force demo mode
- Selector strategy: `.card-title` text to find components (no component-specific classes)
- Port conflicts: Use 4281 (not 4280, which SWA CLI uses)
- Playwright webServer: `vite build && vite preview --port 4281` with 180s timeout

### Chat UX Patterns
- Landing → chat transition via CSS `body.on-landing` + React state
- Sessions toggle hidden on landing (CSS rule `#topbar-sessions-toggle { display: none }`)
- Message history rendered as scrollable list
- A2UI surfaces rendered as cards with actions

## Known Patterns

- **Fluent styling:** All components use `makeStyles` with Fluent tokens
- **A2UI spec:** JSON Schema with oneOf component union, recursive children
- **Action routing:** reply (default) → navigate → api (stubbed)
- **Demo mode:** `?mock` param triggers demo responses instead of API calls

---

**Note:** This summary is an index. See `history.md` for full implementation details, code paths, file locations, and design decisions.
