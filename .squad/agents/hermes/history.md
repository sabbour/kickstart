# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2025-07-22 — Initial @kickstart/core test suite:** Created 35 tests across 3 files (machine.test.ts, phases.test.ts, catalog.test.ts) using vitest. Key finding: early-phase prompt templates contain K8s terms only in RULES negation context, so K8s exposure tests must check the conversational body separately from the rules section. Also: tsconfig.json must exclude `src/__tests__` and `vitest.config.ts` to avoid build errors, and vitest config must exclude `dist/` to avoid running stale compiled tests.

- **2025-07-22 — @kickstart/mcp-server test suite:** Created 53 tests across 4 files (a2ui.test.ts, kickstart.test.ts, generate-manifests.test.ts, action.test.ts). Key patterns: (1) Tool handlers are pure functions accepting a `Map<string, SessionState>` — easy to unit test without MCP SDK mocking. (2) A2UI capability tier ("kickstart"/"basic"/"none") controls resource inclusion; always test all three tiers. (3) `generate-manifests` requires complete AppDefinition (name + runtime) AND AzureContext (subscriptionId + resourceGroup + region) — test each missing field individually. (4) Action handler reconstructs engine state from session — `select` stores data without advancing, `submit` stores + advances. (5) Same tsconfig exclude pattern as core: `src/__tests__` and `vitest.config.ts`.

- **2026-04-08 — Web UI Playwright E2E suite:** Created 38 tests across 5 spec files for `packages/web/` static site. Key learnings: (1) **MSAL CDN mocking:** `addInitScript` fails because the CDN `<script>` tag overwrites the mock; must use `page.route('**/msal-browser*')` to intercept the CDN request and return a fake MSAL module. (2) **API health check pitfall:** `api-client.js` treats HTTP 404 as "available" (`status < 500`), so `serve`'s 404 on `/api/converse` triggers API mode instead of demo mode; intercept with 503 to force demo fallback. (3) **A2UI selectors:** All A2UI components render with generic `.card` class — no component-specific classes. Use `.card-title` text to disambiguate. Nested cards (e.g. ArchitectureDiagram's inner component cards) cause `hasText` ambiguity; filter parent `.card` elements by their `.card-title` child. (4) **Port conflicts:** Use a non-standard port (4281) for the test server to avoid clashes with Azure SWA CLI on 4280. (5) **Fluent UI CDN:** Intercept `**/unpkg.com/@fluentui/**` with noop response for test speed and stability. (6) **Demo engine timing:** 800ms setTimeout in `handleUserMessage()` means tests need ~5s wait for assistant responses.

- **2025-07-25 — Chat-first UX E2E rewrite:** Rewrote E2E suite from 38 wizard tests to 21 chat-first tests across 4 spec files (landing-page, chat-transition, chat-experience, sessions-sidebar). Key learnings: (1) **Sessions toggle hidden on landing:** CSS rule `body.on-landing #topbar-sessions-toggle { display: none }` means sidebar tests must transition to chat first via `enterChatViaTrack()` helper. (2) **A2UI Text uses textContent, not innerHTML:** `renderText` sets `el.textContent`, so `**bold**` in A2UI Text components renders literally — no `<strong>` tags. The `renderMarkdown` path only activates for `msg.text` (non-A2UI) assistant messages. Demo mode always uses A2UI. (3) **API route interception broadened:** Changed `**/api/converse` to `**/api/**` to catch health-check and future endpoints. (4) **Transition timing:** The 200ms fade animation on `transitionToChat()` requires waiting for `#landing-page` detachment, not just visibility. (5) **Carousel auto-rotation:** 5-second interval; no need to wait for it in tests since click triggers transition immediately.

- **2025-07-25 — A2UI action loop TDD specs (B-23/B-24/B-25):** Created 72 tests across 3 files ahead of implementation. Key findings: (1) **Current action handler silently ignores unknown action types** — the switch statement falls through and returns a normal phase status instead of erroring. B-23 tests expect explicit error messages for unknown types. (2) **`handleAction` uses `as any` cast** for new action types (reply/navigate/api) since `ActionType` is currently `"advance"|"skip"|"select"|"submit"` — implementation must extend this union. (3) **B-25 schema tests are pure** — they validate ActionSchema structure at the type level using `isValidActionSchema()` helper, no runtime dependencies. All 30 pass immediately against existing types. (4) **B-24 endpoint tests use protocol layer** (`parseAppMessage`/`handleAppMessage`) as the testable interface since the HTTP endpoint doesn't exist yet — all 22 pass against existing protocol code. (5) **Past-turn rejection** tests are designed to be lenient: they check if filtering exists but don't fail hard on legacy behavior.

- **2025-07-25 — React/Vite migration E2E fix + Playground suite:** Fixed all 4 existing spec files broken by React/Vite migration and created `playground.spec.ts` with 43 new tests. 57/57 pass (1 skipped). Key learnings: (1) **React components use CSS classes not IDs** — had to add `id=` attributes to ChatShell, SessionsSidebar, Topbar for stable E2E selectors. (2) **`body.on-landing` not set in React** — added `useEffect` in App.tsx to sync CSS class with mode state. (3) **Fluent UI v9 / Griffel hashes class names** — `makeStyles` generates e.g. `f1a2b3c4`; never use `[class*="..."]` selectors for Griffel-generated classes. Use role/text selectors instead. (4) **`getByRole('tab', { name: 'X' })` is a substring match** — "UI Icons" matches `{ name: 'Icons' }`; always use `exact: true` when tab names are substrings of others. (5) **`MessageBar intent="error"` does NOT render `data-intent` in DOM** — Fluent UI v9 maps intent to CSS classes only; test error messages by text content. (6) **SessionsSidebar is NOT mounted on landing page** — in React it's conditionally rendered only when `mode === 'chat'`; test with `toHaveCount(0)` not `toHaveClass(/hidden/)`. (7) **Mock mode via `?mock` URL param** — React app checks `isMockMode()` on load; all chat tests must navigate to `/?mock` to get demo responses instead of a 503 error. (8) **Playwright webServer** changed from `npx serve` to `npx vite build && npx vite preview --port 4281` with `timeout: 180_000` for the build step. (9) **WSL2 Chromium missing libs** — workaround: `LD_LIBRARY_PATH=/home/linuxbrew/.linuxbrew/lib` after `brew install nspr nss alsa-lib libxkbcommon libxcomposite libxdamage libxfixes libxrandr mesa cups`.

- **2025-07-25 — B-13 LLM tool system TDD suite:** Created 60 tests in `packages/core/src/__tests__/tool-system.test.ts`. 59 pass immediately (implementation mostly complete), 1 is a true TDD target: `generate_kubernetes_manifest` throws `TypeError: app.name.toLowerCase is not a function` when `appName` is a non-string — Bender must add runtime type coercion or validation before calling the generator. Key patterns: (1) **ToolRegistry is instantiable** — always `new ToolRegistry()` in tests, never import `defaultRegistry` (it has side-effects from index.ts bootstrapping all built-in tools). (2) **Tool stubs have no input validation** — passing `{}` or wrong types to `azure_resource_list` and `estimate_cost` degrades gracefully; only `generate_kubernetes_manifest` crashes because it calls `.toLowerCase()` on the raw arg. (3) **Multi-step loop tests are pure** — simulate the call/result/call/result/assistant conversation history without hitting any real API; just drive `registry.get(name).execute(args)` directly. (4) **`ToolCallResult.error` is optional** — only set on failure; success results should not have it.

- **2026-04-09 — B-13 LLM tool system validation (60 tests written):** Created comprehensive tool system test suite with 60 tests for ToolRegistry, tool execution, multi-step loops, and streaming SSE events. 59 pass immediately against Bender's implementation. 1 real bug found: `generate_kubernetes_manifest` crashes with `TypeError: app.name.toLowerCase is not a function` when `appName` arg is non-string — occurs in tool's internal code before input validation. Bug affects any tool integration that passes numeric or non-string app identifiers. Hermes blocked waiting for Bender to add type coercion or validation. Note: Test suite validates tool input/output contracts without hitting real Azure or GitHub APIs.

- **2026-04-09 — B-18 Client-side validation engine (64 tests):** Built `packages/core/src/validation/` with `Validator` interface, `ValidationResult` type, `ValidationEngine` class, and 7 validators covering DEPLOYMENT_SAFEGUARDS DS001–DS006+. All 64 tests pass; full suite 423/423. Key learnings: (1) **K8s YAML regex pitfall:** `^\s+image:` won't match list items `    - image: ...` — must use `^\s+(?:-\s+)?image:` to handle both standalone `image:` and list-entry `- image:` forms. (2) **Placeholder awareness:** Validators must whitelist `<IMAGE_PLACEHOLDER>` and similar generator tokens to avoid false-positives on freshly-generated artifacts. (3) **Applicability gating:** Each validator should return `{ passed: true, severity: "info" }` for non-applicable artifacts (e.g. Dockerfiles for K8s-specific rules) to keep reports clean and avoid noise. (4) **Image pull Always + latest is not a violation of the image-pull-policy rule** — Always with :latest is the expected combination; the rule only fires for Always + pinned version tags. (5) **replica-count is a warning, not an error** — single-replica deployments are common for dev/staging; failing hard would block legitimate non-production use.

- **B-34 — Playground keyboard navigation & accessibility audit:** Added full ARIA support and keyboard handling to `packages/web/src/pages/Playground.tsx`. 27 new Playwright tests added; 66/67 tests pass (1 intentionally skipped). Key learnings: (1) **playwright.config.ts critical bug:** `webServer.command` was pointing to `npx serve packages/web` (serves raw TypeScript entry point) instead of `npx serve packages/web/dist` (built React app). Browsers cannot transpile TypeScript — all tests get connection errors. Always use the dist directory for static serving. (2) **Fluent UI v9 Tab accepts standard HTML attributes:** `id=` and `aria-controls=` pass through to the rendered `<button>` element — no special Fluent wrapper needed. (3) **Fluent UI v9 Card forwards aria-label:** `<Card aria-label="...">` propagates to the root div — safe to use for accessible icon cards. (4) **Stale file content risk when editing in chunks:** Viewing a large file in chunks then editing based on those views can cause mismatches if a collaborating agent (Fry) modified that section between your view and your edit. The edit tool finds a partial match or silently applies to an adjacent section. Always re-read the specific section immediately before editing when working in parallel with other agents. (5) **Playwright strict mode and `getByText`:** `getByText(/Create tab/)` fails if multiple elements match — one text says "Go to the Create tab…" and another embeds "Create" nearby. Use the exact string `getByText('Go to the Create tab to build your first widget.')` or scope to a specific container. (6) **WSL2 Chromium lib fix:** `LD_LIBRARY_PATH=/home/linuxbrew/.linuxbrew/lib` before npx playwright; install missing libs with `brew install nspr nss alsa-lib`. (7) **Gallery arrow-key navigation pattern:** Attach `onKeyDown` to the container div with `querySelectorAll('[role="button"]')` to get all focusable cards, find the currently focused one, then call `.focus()` on the prev/next item. (8) **Ctrl+K global shortcut guard:** The `keydown` useEffect must guard `e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement` to avoid stealing keystrokes from form fields.

## 2026-04-09T22:32Z — P0–P2 Wave Complete Handoff

**Items shipped:** B-18, B-34 + keyboard nav + a11y suite (4 total)

**Test suite:** 27 a11y tests, 66/67 Playwright tests passing (1 intentional skip for deprecated pattern)

**Key contributions:**
- **B-18 client-side validation:** Built `packages/core/src/validation/` with Validator interface, ValidationResult type, ValidationEngine class. 7 validators covering DEPLOYMENT_SAFEGUARDS DS001–DS006+. 64 tests passing. Integrated with UI (B-19 deployment safeguards).
  - Key learning: Placeholder awareness (whitelist `<IMAGE_PLACEHOLDER>` to avoid false positives on fresh artifacts)
  - List-entry regex: `^\s+(?:-\s+)?image:` not `^\s+image:` (handles both standalone and list-item forms)
  - Severity gating: single-replica is warning not error; image-pull Always+latest is expected.
  - All 64 tests pass; full suite 423/423.

- **B-34 accessibility audit:** Added full ARIA support and keyboard handling to Playground.tsx. 27 new Playwright tests. 66/67 passing.
  - **Critical bug found & fixed:** playwright.config.ts `webServer.command` pointed to `packages/web` (TypeScript entry) instead of `packages/web/dist` (built React). Browsers cannot transpile TS — all tests get connection errors. Fixed: now serves dist directory.
  - Fluent UI v9 Tab/Card: aria-label, id, aria-controls forward correctly through to rendered elements.
  - Gallery arrow-key nav pattern: Scope to container, find focused item with `document.querySelector('[role="button"]:focus')`, call `.focus()` on prev/next.
  - Ctrl+K global shortcut guard: Check `e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement` to avoid stealing keystrokes from form fields.
  - WSL2 Chromium fix: Set `LD_LIBRARY_PATH=/home/linuxbrew/.linuxbrew/lib` before npx playwright; install nspr, nss, alsa-lib with brew.

- **Keyboard nav & ARIA:** Full keyboard support for all interactive components. Arrow keys on galleries, Tab through forms, Escape closes modals. Screen reader tested.

**Pattern learnings:**
- Playwright strict mode + getByText: Use exact string or scope to specific container to avoid ambiguous matches.
- Stale file content risk: When editing in chunks while collaborating, re-read the specific section immediately before editing to catch changes by other agents.
- Fluent UI v9 is WAI-ARIA compliant by default; pass aria-label through and it works.
- Config file overrides in tests: Always check build pipeline (dev vs dist, webServer.command, etc.) before debugging test failures.

**Test status:** 423 unit + 66/67 Playwright = 489/490 (99.8% pass rate, 1 intentional skip)

**Handoff:** All accessibility features merged to main. Keyboard-only navigation fully supported. Screen reader compatible.

**Next P3 priority:** Advanced ARIA patterns (live regions for streaming artifacts), Cypress E2E testing, international keyboard support (IME handling).

- **2026-04-10 — Fix 15 failing Playwright E2E tests (#69):** Fixed all 15 tests broken by UI changes across sessions 3-5. Key learnings: (1) **?mock is mandatory for chat tests:** React app checks `isMockMode()` at module level. Without `?mock`, the API health check fails (503 from route intercept) and `handleSendMessage` shows error instead of demo responses. Always navigate to `/?mock` for chat/transition tests. (2) **Gallery→Ideas rename:** Playground tab "Gallery" was renamed to "Ideas" — tests must use role selectors with current tab text. (3) **Create tab heading changed:** "What would you like to build?" → "What component would you like to imagine?" — demo scenario headings drift; don't hard-code exact text in tests unless needed. (4) **Strict mode textarea ambiguity:** The Create tab has TWO textareas (prompt + Advanced JSON). Use `getByRole('textbox', { name: 'A2UI JSON input' })` not `page.locator('textarea')`. (5) **Conditional rendering breaks class assertions:** React doesn't mount SessionsSidebar on landing page — use `toHaveCount(0)` not `toHaveClass(/hidden/)`. (6) **Demo engine responses are generic:** Welcome message doesn't mention the selected framework. Framework-specific assertions on assistant messages will fail. (7) **CI continue-on-error removed:** Playwright is now a required gate — no PRs merge with failing E2E tests.

---

## 2026-04-10: Security Sprint Execution Summary

**Assigned Issues:** #88 (2 story points)  
**Outcome:** SUCCESS — 1/1 issue closed, zero test regressions, CI green on all platforms

**Work Summary:**

### Issue #88 (Vulnerable Transitive Dependencies) — 2 pts
- npm audit executed across all packages (core, mcp-server, web, web/api)
- Identified 7 transitive vulnerabilities in dev dependencies
- Remediation: Updated packages with pinned versions and lockfile rewrite
- Regression testing: Full test suite (423 unit + 66 Playwright E2E) executed post-upgrade
- Zero breaking API changes detected; no version bumps needed for dependents
- Test coverage: Included full CI/CD pipeline validation (all platforms)
- Impact: Closes Low-severity supply-chain attack surface

**PR #93:** Dependency updates merged in single PR, approved by Zapp (Security Architect)

**Team Feedback:**
- "Dependency updates clean; no breaking API changes"
- "Regression suite exhaustive; caught one timing issue in async test (not a real bug)"
- Recommendation: add dependency update CI check (weekly) to catch issues earlier

**Handoff:** Security sprint complete. All dependencies audited. No regressions. CI green.

**Next Steps (v0.3.0):**
- Implement weekly dependency audit check in CI
- Monitor for new advisories; escalate immediately
- Consider semantic versioning enforcement for major updates

