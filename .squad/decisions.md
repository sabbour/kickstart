# Decision: Continuous SWA deployment from main + version-SHA footer

**Author:** Bender (Backend Dev)
**Date:** 2026-04-14
**PR:** #177

## Context

SWA deployment only triggered on release tags (`v*`) and PRs, meaning changes merged to `main` didn't deploy until a release was cut. Ahmed needed immediate deployment on every merge.

## Decisions

1. **Push-to-main trigger** — `deploy-swa.yml` now triggers on `push → branches: [main]` with path filters (`packages/**`, `package.json`, `package-lock.json`, `tsconfig.json`). Tag-based releases still trigger deployment as before.

2. **Unified version string** — `__BUILD_VERSION__` is now `{semver}-{shortSHA}` (e.g. `0.5.6-abc1234`). Git SHA is resolved via `git rev-parse --short HEAD` at build time, falling back to `GITHUB_SHA` env var, then `dev`.

3. **Footer simplification** — Landing and Playground footers show the unified version string instead of version + SHA separately. Every build is uniquely identifiable.

## Impact

- Every push to `main` that touches package code auto-deploys to SWA
- Release workflow unchanged — tag pushes still work
- Fry: footer components (`Landing.tsx`, `Playground.tsx`) now use `__BUILD_VERSION__` only (SHA embedded)
# Decision: Roadmap Gap Analysis — v0.6.0 / v1.0.0 / Backlog

**Author:** Leela (Lead)
**Date:** 2026-04-14
**Status:** Proposed

## Context

Holistic analysis of the Kickstart project (v0.5.6) to identify features, improvements, and gaps for a compelling AI-guided AKS onboarding experience. Compared against competitive tools (Azure Portal AI, Copilot for Azure, GitHub Copilot). Excludes items already tracked in open issues (#46, #167–#186).

---

## Proposed Enhancements

### Category 1: Conversation Engine & Intelligence

#### 1. `feat: Server-side session persistence (Cosmos DB or Table Storage)`
Sessions are in-memory with 1hr TTL — restart kills everything. Users can't resume onboarding across devices or browser sessions. This is the single biggest gap for a production experience.
- **Priority:** P0 critical
- **Milestone:** v0.6.0

#### 2. `feat: Real Azure Pricing API integration for cost estimation`
`estimateCost` tool returns hardcoded stub data. Users need accurate, real-time pricing to make deployment decisions. The PricingConnector and `/api/pricing-proxy` already exist — just need to wire them.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 3. `feat: Bicep/Terraform infrastructure code generation`
Only K8s manifests and GitHub Actions are generated. The system prompt references Bicep in demo scenarios but there's no generator. Users expect a complete "push and deploy" package including infrastructure-as-code.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 4. `feat: Dockerfile generation from app analysis`
The generate phase shows a Dockerfile in demo scenarios but the actual generator only covers K8s manifests and GitHub Actions. Adding a Dockerfile generator closes the "zero to deployed" artifact gap.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 5. `feat: Phase back-navigation — allow users to revisit earlier phases`
The phase machine only supports ADVANCE and SKIP. Users can't go back to change their app description or architecture decisions without starting over. Competitive tools all support non-linear navigation.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 6. `feat: Conversation branching — explore alternate architectures`
Users should be able to fork a conversation to compare two architecture options (e.g., Cosmos DB vs PostgreSQL) without losing progress. "What if" exploration is a killer feature for design decisions.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 7. `feat: Multi-turn context window management and summarization`
Long conversations will exceed token limits. Need a summarization strategy that compresses earlier phases into a context summary while keeping recent turns verbatim.
- **Priority:** P1 important
- **Milestone:** v1.0.0

---

### Category 2: UX & Frontend

#### 8. `feat: Guided onboarding tour for first-time users`
No explanation of what Kickstart does, how phases work, or what to expect. First-time users land on a chat and don't know what to type. A lightweight coach-mark tour (3-4 steps) would dramatically improve activation.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 9. `feat: Progress sidebar showing phase journey and collected data`
Users have no visibility into what the AI knows about their app or how far along they are. A persistent sidebar showing phase progress + collected data (app name, runtime, services, etc.) creates transparency and trust.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 10. `feat: Artifact download as ZIP bundle`
Users can view generated files and push to GitHub, but can't download everything as a local ZIP. Not everyone wants to create a repo immediately — some want to inspect locally first.
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

#### 11. `feat: Conversation export (share link or markdown)`
No way to share a completed onboarding session with a teammate for review. Export as markdown or a shareable read-only link would enable team collaboration.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 12. `feat: Keyboard shortcuts for power users`
No keyboard shortcuts beyond Ctrl+Shift+D (debug). Common shortcuts: Enter to send, Cmd+K for new session, Escape to cancel, arrow keys for navigation. Power users expect this.
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

#### 13. `feat: Mobile-responsive layout for tablet/phone`
The chat interface likely works on mobile but A2UI components (tables, architecture diagrams, file editors) probably don't. Azure Portal's mobile story is weak — this is a differentiation opportunity.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 14. `feat: User feedback mechanism (thumbs up/down per response)`
No way to collect signal on response quality. Even a simple thumbs up/down with optional text would enable prompt tuning and identify failure modes.
- **Priority:** P1 important
- **Milestone:** v0.6.0

---

### Category 3: Code Generation & Artifacts

#### 15. `feat: Docker Compose generation for local development`
Users need to test locally before deploying. A Docker Compose file with the app + its dependencies (database, cache, etc.) lets users validate their architecture locally.
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

#### 16. `feat: Helm chart generation as alternative to raw manifests`
Many teams use Helm for K8s packaging. Offering Helm chart generation alongside raw manifests addresses a large segment of enterprise users.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 17. `feat: Kustomize overlay generation for multi-environment deployments`
Production users need dev/staging/prod configurations. Kustomize overlays are the AKS-recommended approach for environment-specific manifest management.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 18. `feat: Manifest validation against live AKS cluster`
The 20 deployment safeguards validate statically. Connecting to a real cluster (via user's Azure creds) to validate namespace availability, RBAC, quotas, and API versions would catch real deployment issues.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

---

### Category 4: Observability & Telemetry

#### 19. `feat: Application Insights integration for production telemetry`
The telemetry module is an in-memory ring buffer. No production observability — can't track usage, errors, latency, or conversation completion rates. App Insights is the natural fit given the Azure stack.
- **Priority:** P0 critical
- **Milestone:** v0.6.0

#### 20. `feat: Conversation analytics dashboard (completion rates, drop-off phases)`
Once telemetry exists, need a dashboard showing: sessions started, phase completion funnel, average time per phase, common drop-off points. This drives product decisions.
- **Priority:** P1 important
- **Milestone:** v1.0.0

#### 21. `feat: Structured error tracking with source maps (Sentry or App Insights)`
Frontend errors in production are invisible. Source-mapped error tracking catches component rendering failures, API errors, and streaming issues in real deployments.
- **Priority:** P1 important
- **Milestone:** v0.6.0

---

### Category 5: Testing

#### 22. `feat: React component unit tests with Testing Library`
The web package has only 1 unit test file (a11y audit). Zero component-level tests for ChatShell, MessageList, Landing, A2UISurfaceWrapper, or any hook. This is the biggest testing gap.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 23. `feat: Automated accessibility testing with axe-core in CI`
The a11y audit is a static source analysis. Runtime axe-core tests catch actual DOM accessibility violations. Should run as part of E2E suite against rendered components.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 24. `feat: API function integration tests`
No tests for the 11 Azure Functions API endpoints. Conversation flow, action routing, code generation, and proxy endpoints need integration tests with mocked Azure OpenAI responses.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 25. `feat: Visual regression testing for A2UI components`
49+ components with no visual regression baseline. A Playwright screenshot comparison or Chromatic integration would catch unintended UI changes.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 26. `chore: Test coverage reporting and thresholds in CI`
No coverage measurement. Add coverage to vitest config with minimum thresholds (e.g., 70% core, 50% web) to prevent regression.
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

---

### Category 6: DevEx & Build

#### 27. `feat: Storybook for A2UI component development and documentation`
49+ components with no isolated development environment. Storybook enables component development without running the full app, serves as living documentation, and enables visual testing.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 28. `chore: Bundle analysis and size budgets in CI`
No bundle size tracking. Vite's built-in analyzer + a CI check would catch unexpected bundle growth (Monaco Editor alone is likely a big chunk).
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

#### 29. `feat: OpenAPI specification for Azure Functions API`
11 API endpoints with no machine-readable spec. An OpenAPI spec enables auto-generated client SDKs, Swagger UI for testing, and API documentation.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 30. `chore: Route-based code splitting for web app`
Only 2 components use React.lazy(). The Playground, FileTreePanel, and Monaco Editor should be lazy-loaded. Reduces initial bundle size significantly.
- **Priority:** P2 nice-to-have
- **Milestone:** v0.6.0

---

### Category 7: Security & Compliance

#### 31. `feat: Content Security Policy headers for Static Web App`
No CSP configuration. The SWA should have strict CSP headers blocking inline scripts, restricting font/image sources, and preventing XSS vectors.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 32. `feat: Per-user rate limiting on API endpoints`
Rate limiter exists (`rate-limiter.ts`) but it's unclear if it's per-user or global. Per-user rate limiting prevents abuse and ensures fair usage in multi-tenant deployments.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 33. `feat: Audit logging for sensitive operations (GitHub push, Azure resource creation)`
No audit trail for destructive or sensitive operations. When a user pushes code to GitHub or creates Azure resources, that should be logged with user identity and timestamp.
- **Priority:** P1 important
- **Milestone:** v1.0.0

---

### Category 8: Deployment & Infrastructure

#### 34. `feat: Staging environment with separate Azure OpenAI quota`
Single environment (dev). No staging for testing deployments before production. Separate Azure OpenAI quota prevents staging traffic from impacting production.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 35. `feat: Infrastructure monitoring and alerting (Azure Monitor)`
No monitoring or alerting configured. Need alerts for: API error rate spikes, latency degradation, Azure OpenAI quota exhaustion, SWA availability.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 36. `feat: Database backend for session persistence (CosmosDB or Table Storage)`
Companion to item #1. The infra template needs a database resource for session storage. Cosmos DB serverless is the natural fit — low cost at low volume, scales with usage.
- **Priority:** P0 critical
- **Milestone:** v0.6.0

---

### Category 9: Content & Onboarding Quality

#### 37. `feat: Expanded demo scenarios covering all 6 phases`
Only 4 demo scenarios exist (WELCOME, ARCHITECTURE, DESIGN_DETAIL, FILE_GENERATION). Missing: REVIEW phase demo, HANDOFF phase demo, DEPLOY phase demo. Demo mode should showcase the full journey.
- **Priority:** P1 important
- **Milestone:** v0.6.0

#### 38. `feat: Template library — pre-built architectures for common patterns`
Instead of starting from scratch every time, offer templates: "Node.js API + PostgreSQL", "Python ML service + Redis", "Java Spring Boot + CosmosDB". Reduces time-to-value dramatically.
- **Priority:** P1 important
- **Milestone:** v1.0.0

#### 39. `feat: "Bring your own repo" — analyze existing codebase for AKS readiness`
Currently starts from a blank slate. Enterprise users have existing apps they want to containerize. Analyzing a GitHub repo to detect runtime, dependencies, and port would be a premium feature.
- **Priority:** P2 nice-to-have
- **Milestone:** v1.0.0

#### 40. `feat: Multi-language system prompt and UI localization`
English-only. No i18n framework. For global Azure adoption, at minimum Japanese, Chinese, Korean, Spanish, Portuguese, and German would be expected.
- **Priority:** P2 nice-to-have
- **Milestone:** Backlog

---

## Priority Summary

| Priority | Count | Key Items |
|----------|-------|-----------|
| **P0** | 3 | Session persistence (#1, #36), Production telemetry (#19) |
| **P1** | 18 | Real pricing (#2), Bicep gen (#3), Dockerfile gen (#4), Phase navigation (#5), Onboarding tour (#8), Progress sidebar (#9), Feedback (#14), App Insights (#19), Error tracking (#21), Component tests (#22), a11y automation (#23), API tests (#24), CSP (#31), Rate limiting (#32), Staging env (#34), Monitoring (#35), Demo scenarios (#37), Templates (#38) |
| **P2** | 19 | Branching (#6), ZIP download (#10), Export (#11), Shortcuts (#12), Mobile (#13), Docker Compose (#15), Helm (#16), Kustomize (#17), Cluster validation (#18), Analytics dashboard (#20), Visual regression (#25), Coverage (#26), Storybook (#27), Bundle budgets (#28), OpenAPI (#29), Code splitting (#30), Audit logging (#33), Bring-your-own-repo (#39), i18n (#40) |

## Impact

This analysis establishes the roadmap backlog for v0.6.0 and v1.0.0. Items should be converted to GitHub issues with DPs before implementation. P0 items should be tackled first — without session persistence and production telemetry, Kickstart cannot be used in a real onboarding scenario.
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
### 2026-04-14T09:12:02.022Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Finish all remaining v0.5.6 issues (#147, #158, #159, #161) and docs update FIRST, then run ceremonies (retro/planning) BEFORE starting work on #46.
**Why:** User request — captured for team memory
### 2026-04-14T07:27:27.935Z: User directive — update docs after sprint
**By:** Ahmed Sabbour (via Copilot)
**What:** Update the docs after the v0.5.6 sprint work is all done
**Why:** User request — documentation needs to reflect all the bug fixes and changes made during v0.5.6
### 2026-04-14T06:31:19.532Z: User directive — no agent lockout
**By:** Ahmed Sabbour (via Copilot)
**What:** Do NOT enforce reviewer rejection lockout. The original author CAN revise their own work after a rejection. Skip the lockout protocol entirely.
**Why:** User directive — the lockout rule adds unnecessary friction for this team's workflow. Original authors have the best context to address review feedback.
### 2026-04-14T09:28:47.967Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Track and capture cycle times for each task (DP→review→implement→review→merge) for the sprint retro. Ahmed wants to discuss how long the ceremony pipeline takes per issue.
**Why:** User request — retro needs data on where time is spent to improve process efficiency
# Decision: Sprint Retrospective — v0.5.6 Bug Sprint

**Date:** 2026-04-14  
**Author:** Leela (Lead)  
**Status:** Accepted  
**Ceremony:** Sprint Retrospective

---

## 1. What Happened (Facts Only)

**Sprint scope:** 10 issues closed (8 bug fixes, 1 security hardening, 1 feature). Two agents active: Fry (8 issues), Bender (2 issues).

### Cycle Time Observations

| Bucket | Issues | Avg Time | Notes |
|--------|--------|----------|-------|
| Fast (< 5 min) | #148, #141 | ~3 min | Simple fixes — rename, CSS tweak |
| Medium (5–10 min) | #150, #145, #142, #158/#159 | ~7 min | Required DP cycle or combining issues |
| Slow (> 10 min) | #153, #161, #147 | 11–25 min | Bloated context, complex scope, or multi-round review |

**Key facts:**
- **~9 min gap** between DP approval and PR appearing on GitHub. No visibility to Ahmed during agent implementation phase. This was the biggest user-facing pain point.
- **287 KB total context** agents read at spawn: `decisions.md` = 90 KB, `fry/history.md` = 42 KB, `bender/history.md` = 42 KB. This is 3–4× the recommended ceiling.
- **#161 (dark mode CSS)** — a CSS-only fix took ~11 min from DP approval to PR. Root cause: agent spent most of that time reading bloated history before writing 20 lines of CSS.
- **#153 (prompt injection)** — slowest issue. Multiple review rounds, Zapp requested changes, `Buffer→TextEncoder` browser compat fix discovered during review. Correct outcome, but costly.
- **#147 (IndexedDB filesystem)** — 25 min, justified by complexity (security controls, quota management, encryption-at-rest considerations).
- **PRs #158/#159 combined** into PR #162. Good instinct — related fixes shipped together.
- **Agents skipped DP step** early in the sprint until a directive was captured enforcing it.
- **Agent lockout protocol fired incorrectly** — Ahmed explicitly overrode it ("didn't I say not to do so?").
- **Identity token path was wrong** at sprint start — manually fixed, then corrected by Squad upgrade.
- **Parallel agent work** on the same repo checkout caused git conflicts (shared working tree).

**What went well:**
- Bot identity system working — reviews posted as `sabbour-squad-lead[bot]`.
- Parallel reviewer spawning effective — reviewers + implementation ran simultaneously.
- 10 issues closed in one session — highest throughput sprint to date.
- Security gate caught real issues: `Buffer` usage in browser (Node-only API), path traversal risks.

---

## 2. Root Cause Analysis

### RCA-1: Agent spawn time dominated by context reading
- **Symptom:** 9 min gap between DP approval and PR.
- **Root cause:** Agents read 287 KB of history/decisions at spawn. At ~500 tokens/KB, that's ~143K tokens of context before a single line of code. LLM inference on that volume is slow and expensive.
- **Why it grew:** Scribe summarization threshold is 15 KB, but files grew past 40 KB. Compaction runs after sprints, not before. Agents start with accumulated cruft from previous sprints.

### RCA-2: Process ceremony too heavy for trivial fixes
- **Symptom:** CSS-only change (#161) went through full DP → architecture review → security review → code → PR review pipeline.
- **Root cause:** No fast-track path for changes below a complexity threshold. Every issue got the same ceremony regardless of risk or size.

### RCA-3: No progress visibility during implementation
- **Symptom:** Ahmed frustrated by silence between DP approval and PR appearing.
- **Root cause:** Agents create branch + commits + PR as a batch at the end. No draft PR or branch push happens early. GitHub shows nothing until the agent is completely done.

### RCA-4: Shared working tree causes git conflicts
- **Symptom:** Parallel agents stepping on each other's git state.
- **Root cause:** All agents share the same `main` checkout. No worktree isolation between parallel agent runs.

### RCA-5: Stale directives not loaded at sprint start
- **Symptom:** Agents skipped DP step; lockout protocol fired incorrectly.
- **Root cause:** Directives captured mid-sprint aren't retroactively applied to already-running agents. New agents pick them up, but running ones don't re-read context.

---

## 3. What Should Change

### C1: Pre-sprint context compaction ("the nap")
Run aggressive history compaction BEFORE sprints, not just after. Target: each history file ≤ 10 KB, decisions.md ≤ 30 KB. Agents should start clean.

**Rule:** Before any sprint, Scribe runs compaction. If total context > 50 KB, sprint does not start.

### C2: Fast-track path for trivial changes
Define a "trivial change" gate: CSS-only, typo fix, config change, rename, or single-file change with no logic. Trivial changes skip DP architecture review and security review. They still need code review (one reviewer, not two).

**Threshold:** ≤ 1 file changed, no new dependencies, no API surface change, no security-relevant code.

### C3: Draft PR within 30 seconds
Agents must create branch + draft PR immediately after DP approval, BEFORE writing code. This gives Ahmed a GitHub URL to watch within 30 seconds. Commits are pushed incrementally as work progresses.

**Sequence:** DP approved → create branch → push empty commit → open draft PR → implement → push commits → mark PR ready for review.
