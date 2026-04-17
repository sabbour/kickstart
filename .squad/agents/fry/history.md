# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns. Shipped full Vite+React stack migration, Playground interface, dark mode, accessibility audit, and 20+ fat A2UI components.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/catalog/fluent-components/` — Fluent UI overrides and custom components
- `packages/web/src/pages/` — Landing, Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system, layout classes
- `packages/web/src/components/` — FileEditor, FileTreePanel, DebugPanel, Widgets

## Patterns
- **Fat A2UI components:** Use createReactComponent factory + useState for auth/API state, useAPIConnector hook, context.dispatchAction for actions
- **Streaming UI:** useProgressiveQueue hook for 150ms stagger reveal, progressive bubble state + ref tracking for stale closures
- **Theme system:** ThemeContext with three-state mode (light/dark/system), resolvedTheme pattern for rendering, useSyncExternalStore for matchMedia
- **Validation safeguards:** DS001-DS020 validators with auto-fix capability, badge/severity display in UI, RegexError handling
- **Accessibility:** WCAG 2.1 AA — aria-label on all A2UI components, roving tabIndex for RadioGroup, live regions on dynamic content

## Recent Work
- v0.5.6 A11y fixes: roving tabIndex, aria-live regions, external link icons
- v0.5.0 component streaming: progressive queue, --enter-index CSS stagger, layout shift prevention
- v0.4.0 theme system: dark mode toggle, system preference detection, CSS variable overrides
- v0.3.0 fat components: Azure/GitHub packs, auth flows, picker patterns, action dispatching

## Current Sprint: v0.5.7

**Sprint Goal:** Fix critical A2UI rendering blocker (#166) + 8 P1/P2 UI/UX bugs.

**Wave 1 (Critical Blocker):**
- #166: Fix SSE parser in `useStreaming.ts` to accumulate JSON envelope for `a2ui` array (4–6 hrs). Backend confirmed working; frontend-only fix.

**Wave 2 (P1 Quick Fixes, parallel):**
- #167: Verify `highlight.js` CSS bundling in prod (1–2 hrs, fast-track).
- #168: Add CSS transitions to `SteppedCarousel` panel (1–2 hrs, fast-track).
- #170: Add `'Integration Kits'` to sidebar config (30 min, fast-track).
- #171: Wire Files/Folder button toggle (1 hr, fast-track).

**Wave 3 (P1 Logic Fixes, after Wave 1):**
- #169: Fix auth state propagation to sign-in button (4–6 hrs).
- #172: Add "Clear All" confirmation dialog (3–4 hrs).

**Wave 4 (P2 Enhancements, lower priority):**
- #173: Add Home button to header (1–2 hrs, fast-track).
- #174: File operations scenarios in Playground (4–6 hrs).

**Key Notes:** #166 is a critical blocker preventing rich component rendering. All other work is independent. Fast-track approved for 5 CSS/config items (skip DP ceremony). Success = all P0 + P1 closed; P2 best-effort.

## Learnings
- (2026-04-14) SSE parsing in `useStreaming.ts` must handle both `event:` type lines and `data:` lines. The backend sends A2UI via typed SSE events (`event: a2ui\ndata: {...}`) AND inside a JSON envelope in the accumulated chunk content. Both paths must route to `callbacks.onA2UI()`.
- (2026-04-14) The accumulated stream content can be either plain text OR a JSON envelope `{message, a2ui, actions}`. After stream completion, always try parsing as JSON to extract structured data before passing to `onComplete`.
- (2026-04-14) LLM acknowledgment behavior (Badge "Got it" cards) is driven entirely by phase prompt text in `packages/core/src/engine/phases.ts`. To add or remove conversational behaviors, edit `promptTemplate` strings — no TypeScript logic changes needed. The system-prompt.ts few-shot examples did NOT contain this pattern.
- (2026-04-14) Navigation uses hash-based routing via `useNavigation` hook in `packages/web/src/hooks/useNavigation.ts`. URL pattern: `#session/{id}` for chat, `#` for landing. All nav actions in App.tsx go through `nav.pushSession()`, `nav.pushLanding()`, or `nav.replaceCurrent()`. Deep links are restored via `pendingDeepLink` state on mount.
- (2026-04-14) A2UI action closures created by GenericBinder (`generic-binder.ts` ACTION case) only resolve DataBindings that exist in the raw action JSON. If the LLM defines static context (e.g. `{ label: "Runtime" }`) without DataBindings for the selected value, the user's actual selection won't be in the action context. Components must enrich the context themselves using `context.componentModel.properties.action` (raw def) + `context.dataContext.resolveAction()` + manual value injection.
- (2026-04-14) `DataContext.resolveAction()` in `data-context.ts:283` is the official API for resolving an Action's DataBindings. It resolves each value in `event.context` one level deep via `resolveDynamicValue`. Use it instead of duplicating the GenericBinder's `resolveDeepSync` logic.
- (2026-04-14) `a2ui-overrides.css` generic element-level CSS with `!important` was the root cause of Playground components rendering as plain HTML. All catalog components are Fluent UI v9 React with Griffel — never add `!important` element-level overrides inside `.a2ui-surface-wrapper`. Target component-specific classes or use Griffel `makeStyles` instead.
- (2026-04-14) DebugMetadata.rawContent captures the accumulated SSE text, NOT the full structured response. A2UI messages arrive via separate SSE events and must be collected separately into a `fullEnvelope` for debugging. Three A2UI sources: typed SSE events, inline `event.a2ui`, and JSON envelope post-parse.
- (2026-04-14) Action dispatch observability uses an `onDebugAction` callback on `useActionDispatch` that feeds into DebugContext's `actionLog`. This avoids coupling the vendor A2UI layer to debug concerns.
- (2026-04-15T15:20:24Z) `packages/web/src/catalog/components/ArchitectureDiagram.tsx` already ships Mermaid sanitization plus zoom/reset/percentage UI, but the honest gap to try-aks is ELK layout, registry-backed `%%icon:...%%` placeholders, and nested subgraph/grouping support. The core contract is currently behind the renderer: `packages/core/src/catalog/index.ts`, `packages/core/src/services/a2ui-schema.ts`, and related tests still model `ArchitectureDiagram` as `nodes`/`edges` only, while the web path already relies on `diagram`, `title`, and `description`.
- (2026-04-15T15:20:24Z) `ArchitectureDiagram` now uses a diagram-first contract for grouped AKS visuals: keep raw Mermaid in `diagram`, preserve `nodes`/`edges` only as a legacy fallback, and route all render prep through `packages/web/src/catalog/components/architectureDiagramUtils.ts` so ELK layout, `\\n`→`<br/>`, and try-aks SVG styling stay in one place.
- (2026-04-15T15:20:24Z) Secure diagram icons should stay registry-backed and allowlisted. The safe path is `sanitizeDiagramInput()` before Mermaid render plus strict `%%icon:name%%` expansion after render, with missing icons rendered as plain text instead of local keyword guesses. Key files: `packages/web/src/catalog/components/ArchitectureDiagram.tsx`, `packages/web/src/catalog/components/architectureDiagramUtils.ts`, `packages/core/src/prompts/system-prompt.ts`, and `packages/core/src/prompts/component-catalog.ts`.
- (2026-04-15T15:20:24Z) Source-published packages can break web-only type-checking even when runtime is fine. For `@sabbour/adaptive-ui-core` and `@sabbour/adaptive-ui-azure-pack/diagram-icons`, narrow web shims in `packages/web/src/types/` plus `packages/web/tsconfig.json` keep TypeScript focused on the exact APIs the renderer needs without dragging the full package surface into `npx tsc --noEmit`.
- (2026-04-16T06:00:45.448Z) For this repo’s current ArchitectureDiagram flows, the minimal private-package replacement is a local registry for `azure/aks`, `azure/acr`, `azure/postgresql`, `azure/sql`, `azure/cosmos-db`, `azure/redis`, `azure/storage`, `azure/key-vault`, and `k8s/{ns,svc,deploy,sa,hpa}`, plus the two Fluent chrome SVGs. Vendor only those exact assets into `packages/web/public/assets/architecture-diagram/` to keep the secure post-render `%%icon:...%%` flow intact while letting `npm install` stay public-only.

## Work Log
- (2026-04-14 14:35) CSS override bug: Removed ~600 lines of `!important` element-level overrides from `a2ui-overrides.css` that were fighting Fluent UI v9 Griffel styles. Switched CodeBlock highlight.js theme to `github.css`. → PR #242 opened.
- (2026-04-14 11:02) Wave 1: Fixed #166 A2UI rendering blocker → PR #179 opened. SSE parser fixes in useStreaming.ts complete.
- (2026-04-14 12:30) P0 fix: #192 A2UI component interactivity broken — ChoicePicker/CheckBox/Toggle/ComboBox/MultiSelect lacked ActionSchema in schemas, so LLM-provided actions were treated as static objects instead of callable closures. Added FlexibleApis with action support + onAction callback on A2UISurfaceWrapper → PR #195 opened.
- (2026-04-14 16:42) Prompt fix: Removed "Got it" acknowledgment cards from DISCOVER and DESIGN phase prompts. Prompt-only change in `packages/core/src/engine/phases.ts`.
- (2026-04-14 17:01) Browser back button: Added `useNavigation` hook with hash-based History API routing (`#session/{id}`). Wired into App.tsx for all nav paths. Deep link support included. → PR #211 opened.
- (2026-04-14 17:32) Action display bug: ChoicePicker/RadioGroup actions only sent LLM's static context (e.g. `{ label: "Runtime" }`), not the user's actual selection. Enriched both components to inject `value` + `selectedLabel` into action context via `context.dataContext.resolveAction()`. Fixed `actionToMessage` to show "I chose Java / Spring" instead of `[Action: pick-runtime] label: Runtime`. → PR #214 opened.

## Round 6: Bug Fixes & Styling Consistency (2026-04-15)

**Round 1 — TypeScript & E2E Fixes**
- Fixed PR #247: 3 TypeScript errors
  - Missing module import
  - Null type assertion
  - Wrong variable reference
  - Outcome: Fixes pushed, CI green
- Fixed PR #248: E2E test for browser navigation
  - Added `exact:true` to getByRole query for robustness
  - Outcome: Fixes pushed, CI green

**Round 2 — Visual Bug Fixes & Styling**
- Fixed issue #253: Gray rectangle visual bug in Playground
  - Identified and removed errant CSS box artifact
- Fixed issue #254: Button consistency across A2UI components
  - Buttons affected: "Continue →", "Save Changes", "Revert", "Approve and continue", "Change something", "Deploy Now", "Preview", "Cancel"
  - Target: Unified Fluent UI button styling (primary, outlined, text variants)
  - User directive captured: All action buttons must use consistent Fluent UI styling
  - Outcome: PR #256 created, pending review

**Round 3 — Related Issue #255**
- Issue #255 created: ArchitectureDiagram alignment with try-aks reference implementation
  - User directive: ArchitectureDiagram A2UI component should match try-aks styling (not custom)
  - Status: In queue for next sprint

**Summary:** 2 PRs fixed and merged, 2 visual consistency issues addressed in PR #256, styling directives documented for team
**2026-04-14**
- Expanded demo scenarios DP for issue #188 with interactive patterns
- Post-approval, implemented #188 scenarios in PR #219
- PR #219 merged to main
- Total scope: 5 new demo scenarios, updated UI components, test coverage added
- (2026-04-14 17:44) Debug panel fix: Full A2UI JSON envelope + action context logging. 7-file change across types, useStreaming, DebugContext, useActionDispatch, App, ChatMessage, DebugPanel. Collapsible sections + JSON syntax highlighting. → PR #216 opened.

## 2026-04-14 Round 2: Frontend Fixes + Navigation

- **PR #214**: Fixed A2UI action display bug. ChoicePicker/RadioGroup now inject selectedLabel into action context.
- **Hash-based navigation**: Implemented History API support for browser back button (#169). Uses `#session/{id}` pattern.
- **Footer update**: Coordinated with Bender on version-SHA display.
- **Team status**: Awaiting review on PR #214; navigation feature documented in decisions.md.
- (2026-04-15 22:40Z) Recovery lane for #328 on `squad/328-setup-frontend-recovery`: wired `step_start`/`file_generated`/`step_complete`/`step_error` streaming into a synthetic DeploymentProgress surface, kept generate chat progress-only, routed streamed files into the workspace/FileManager, added a polite live-region announcement, and covered the slice with targeted frontend regressions.

## Learnings
- (2026-04-17T03:01:07Z) For `/api/inspirations` (non-streaming), the handler returns 503 if Azure OpenAI is not configured — there is NO hardcoded fallback in the non-streaming path. The fallback ideas are only used in `/api/inspirations/widgets` and in the streaming path of `/api/inspirations`.
- (2026-04-17T03:01:07Z) The `/api/action` endpoint uses `action: { name: string, context?: Record<string, unknown> }` in the body (not `actionId`). Action routing is by name prefix: `navigate:`/`nav:` = navigate, `api:` = stubbed, default = reply.
- (2026-04-17T03:01:07Z) The `/api/generate` endpoint is fully stateless — no sessionId, no session store. Auth is rate-limit-only. Streaming is opt-in via `Accept: text/event-stream` header (same pattern as `/api/converse`).
- (2026-04-17T03:01:07Z) All Azure-facing session endpoints (azure-target, azure-deployments-start, azure-deployments-status, deploy-cost-gate) require `x-ms-client-principal-id` header (SWA sign-in), not just an Azure access token. Docs must reflect this separately from the Azure access token requirement.
- (2026-04-16T06:38:32Z) New K8s resource icons that don't exist in the azure-pack should be created as static SVGs under `packages/web/public/assets/icons/k8s/` and registered via `registerDiagramIcons()` in `ensureDiagramIconsRegistered()`. The registration call is additive and idempotent — local icons merge with pack-provided ones without conflict. Always update `ALLOWED_ICON_KEYS` in `architectureDiagramUtils.ts` in tandem.
- (2026-04-16T06:38:32Z) K8s icon SVGs follow the community convention: blue hexagonal shield (#326ce5) with white glyph and abbreviated label. At 20×20 rendered size in Mermaid diagrams, simple Fluent-inspired glyphs (geometric shapes, arrows) are more readable than detailed illustrations. Match the existing viewBox ratio (≈18×17.5) and keep file sizes minimal.

---

**2026-04-16T06:52:50Z — Scribe**: K8s icons session complete. Added 7 SVG icons (gateway, httproute, pdb, vpa, cronjob, role, rb) to `packages/web/public/assets/icons/k8s/`, wired frontend registration, updated allowlist. Lint clean, tests passing. Decision `fry-k8s-icons.md` merged to decisions.md.

## Learnings
- (2026-04-16T07:01:08Z) DRA (Dynamic Resource Allocation) K8s resources — DeviceClass, ResourceClaim, ResourceClaimTemplate, ResourceSlice — don't have official `kubectl` short names yet. Use lowercase full resource names as icon keys (`k8s/deviceclass`, `k8s/resourceclaim`, etc.) to stay unambiguous. Avoid `rs` as a label for ResourceSlice since it's the established ReplicaSet abbreviation — use `rslice` instead.
- (2026-04-16T07:01:08Z) NetworkPolicy (`k8s/netpol`) is registered by the azure-pack at `@sabbour/adaptive-ui-azure-pack/src/diagram-icons.ts:145`. It doesn't need an entry in `K8S_EXTRA_ICONS` — only icons missing from the pack go there. Always check the pack first before adding local overrides.
- (2026-04-16T07:01:08Z) EndpointSlice (`k8s/endpointslice`) follows the `*slice` naming pattern established for `resourceslice`. Existing Endpoints uses `ep` (from the azure-pack), so `endpointslice` (full name, no hyphen) avoids ambiguity. SVG label `epslice` distinguishes from `ep` at small render sizes.
- (2026-04-16T07:01:08Z) Gateway API Inference Extension CRDs (InferencePool, InferenceObjective) and the Endpoint Picker (EPP) component use full lowercase names as icon keys (`k8s/inferencepool`, `k8s/inferenceobjective`, `k8s/endpointpicker`) for consistency with DRA keys in the same batch. `endpointpicker` was chosen over `epp` to stay consistent with the full-name convention; the SVG label still shows `epp` since that's the well-known project abbreviation. Hermes had pre-written tests expecting these exact keys.

## Work Log (continued)

- (2026-04-16T09:32:00Z) Issue #352: Investigated `next-card` phantom reference. Zero matches anywhere in codebase. Chose Option B (don't implement). Also fixed holdover `DeploymentProgress` reference in system-prompt.ts example list (PR #356 rename leftover). → PR #372 opened (draft).
- (2026-04-17T03:01Z) Issue #432 (P2 Security): Removed hardcoded Azure subscription ID, resource group, and tenant domain from `docs-site/docs/getting-started/deployment.md`. Replaced with `<subscription-id>`, `<resource-group>`, `<your-tenant-id-or-domain>` placeholders. Added Docusaurus `:::info` callout listing all three placeholders with descriptions. squad-sdk dist was absent; generated GitHub App installation token directly via Node.js crypto + HTTPS from the PEM key. → PR #442 opened and marked ready.

---

## 2026-04-16 System Prompt Restructuring + Ideas Cleanup Assignment

**System Prompt Restructuring (Commit 8d3ed53)**
- **Format:** Restructured system-prompt.ts into ═══ STEP N ═══ narrative blocks
- **Integration:** Aligns with Bender's FSM removal (PR #385) for streamlined phase flow documentation
- **Status:** Committed on squad/384-fsm-removal-cleanup, awaiting FSM PR merge

**Ideas Tab Cleanup — Assigned**
- **From:** leela-ideas-audit.md (2026-04-16)
- **Scope:** Cut Ideas tab 36 → 16 scenarios (56% reduction), extract 3 components to Custom Controls
- **Changes:**
  - Remove 3 GALLERY_GROUPS: 'Multi-Phase Demo', 'Cost Estimate', 'Integration Kits'
  - Delete 17 scenario entries + generators (phase-discover/design/generate/review/deploy, kit-*, data-basic, etc.)
  - Move 3 components to Custom Controls: FileEditor (file-single/multi), CostEstimate, GenerationProgress (new demo)
  - Update playground-scenarios.ts (line 178 GALLERY_GROUPS), CONTROL_SCENARIOS array
  - Create customGenerationProgress() generator function
  - Verify npm run build passes
- **File:** packages/web/src/pages/playground-scenarios.ts, Playground.tsx (line 178)
- **Est. duration:** 2–3 hours
- **Dependency:** .squad/config.json worktree setup (Coordinator PR #386)
- **Status:** Assigned, awaiting start

---

## 2026-04-16 Sprint Retro — Security + Generation Sprint

**PRs merged this sprint:**
- #370 Playground surfaceIds fix (useCallback → useMemo)
- Icon batch: 7 new K8s SVG icons (DRA + Inference Extension) added to `packages/web/public/assets/icons/k8s/`, frontend registration updated, ALLOWED_ICON_KEYS updated, 27/27 tests passing
- #372 (co-authored) next-card phantom cleanup

**Frontend audit delivered:**
- Confirmed FileEditor coupling is intentional (workspace extraction, not chat render)
- Identified `root` as reserved surface ID, not missing component
- Surfaced ChoicePicker naming confusion (LLM uses generic "picker")
- Custom component strategy assessed: 20 components, sound architecture, FileEditor is only legacy fat component needing a decision

**Icon key conventions locked:**
- `k8s/<lowercase-kind>` pattern, full-word keys, no abbreviations unless established kubectl short names
- `endpointpicker` (not `epp`) for EndPointPicker; `rslice` SVG label for ResourceSlice to avoid RS collision
- NetworkPolicy stays in azure-pack, never in K8S_EXTRA_ICONS

**Next:** Unblock #349 FileEditor decision; address ChoicePicker naming in system prompt.

## Learnings (continued)

- (2026-04-17T03:01Z) `packages/squad-sdk` is not always present as a compiled package in the worktree. When `resolveToken()` is unavailable, generate a GitHub App installation token directly: sign a JWT (RS256) from the PEM in `.squad/identity/keys/{role}.pem` with `appId` + `installationId` from `.squad/identity/config.json`, then POST to `/app/installations/{id}/access_tokens`. Use `iss: String(appId)` (string, not number) and `exp: now + 540` (9 min) to avoid GitHub's clock-skew rejection.

## Learnings
- (2026-04-17T03:01:07Z) `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes (`AUTO_CONTINUE_PREFIXES`). The `navigate:`/`nav:` pattern is a *secondary* prefix checked after stripping the outer `complete:`/`continue:` — the full action name looks like `complete:navigate:design`. Docs that say `navigate:` alone triggers auto-continue are wrong.
- (2026-04-17T03:01:07Z) `skill-resolver.ts` phase group constants (`DISCOVERY_PHASES`, `DESIGN_PHASES`, etc.) are module-private `const Set<Phase>` values — not exported, not arrays. Docs or code examples showing `export const DISCOVERY_PHASES = [Phase.Discover]` are incorrect on both counts.
- (2026-04-17T03:01:07Z) `packages/core/src/__tests__/phases.test.ts` does not exist in this repo. The closest existing test for phase behavior is `skill-resolver.test.ts`, which exercises phase-based filtering via `resolveSkills()`. Always verify test file names against the actual `__tests__/` listing before referencing them in docs.


## Learnings
- (2026-04-17) `buildSystemPrompt()` builds `vars["appDefinition"]`, `vars["azureContext"]`, `vars["repoInfo"]` but previously only `vars["knownInfo"]` was pushed to `parts`. The `interpolate()` call only substitutes `{{placeholder}}` tokens — if the narrative has no such token, the var is silently lost. Always explicitly push context vars as `## Section` blocks in `parts`.
- (2026-04-17) The system-prompt narrative text "Read X (injected)" is LLM instruction to reference a section of that name. The section must be added as an explicit `parts.push()` block to actually reach the LLM. Narrative text alone does not inject context.

## Work Log (continued)
- (2026-04-17) Issue #429: Fixed `buildSystemPrompt()` to inject `appDefinition` (full JSON), `azureContext`, and `repoInfo` as explicit prompt sections. 3 new test assertions. → PR #437 opened.

## 2026-04-17T03:30:17Z — Issue #446: Agents SDK UI Adaptation

**Goal:** Adapt the web frontend to consume server-authored route state from the Agents SDK backend (PR #447, merged).

**Analysis:** Frontend already trusted `phase` from the SSE `done` event and `setConversationPhase()` already allowed non-monotonic transitions. The four less-rigid behaviors were architecturally sound. The only gap was the SDK streaming gate: when `KICKSTART_AGENTS_SDK=true`, the backend returns HTTP 406 for streaming, which `useStreaming.ts` had no fallback for.

**Changes shipped (PR #455):**
- `useStreaming.ts`: Added 406 fallback — retries as non-streaming JSON (`ConverseResponse`), routes `phase`/`a2ui`/`complete` callbacks through the same pipeline. Progressive text reveal preserved.
- `route-state.spec.ts` (new): Playwright E2E — skip-ahead (phase jumps to `deploy`) and revisit (phase steps back to `design`) scenarios using `page.route()` API interception.

**Board:** Issue moved to "In review".

## Learnings
- (2026-04-17T03:30:17Z) The `done` SSE event's `phase` field is already the server-authoritative phase post-route-planner in both the legacy streaming path and the SDK non-streaming path. The frontend never needs to infer phase from model output flags — it only reads from `onPhase()` callback sourced from `done.phase`.
- (2026-04-17T03:30:17Z) When `KICKSTART_AGENTS_SDK=true`, the backend returns HTTP 406 for streaming requests. The 406 fallback in `useStreaming.ts` (non-streaming JSON retry) is the correct frontend pattern — not a separate hook, not a separate code path in App.tsx.
- (2026-04-17T03:30:17Z) Playwright E2E tests for SSE route interception: register `**/api/health` → 200 and `**/api/converse` → SSE in the test body BEFORE `page.goto()`. Since Playwright matches routes LIFO, test registrations take precedence over the auto-fixture's `**/api/**` → 503. Use `page.waitForResponse('**/api/health')` to ensure `isApiAvailable` resolves before the auto-send fires.
- (2026-04-17T03:30:17Z) For revisit tests with multiple SSE turns, use a closure counter (`let callCount = 0`) inside `page.route()` to return different responses on different calls. Playwright's route handler is stateful per test.

## Learnings
- (2026-04-17T03:01:07Z) When docs mention "no production kit uses the typed skill path" or "both kits use legacy," always verify against the actual kit files. `azure-kit.ts` registers `skills: azureIacSkills` (typed path), while `github-kit.ts` uses legacy. This split is intentional and both paths are live in production.
- (2026-04-17T03:01:07Z) "What Should Be Cleaned Up" sections in architecture docs can drift from reality after PRs merge. Always strike through or update completed cleanup items (e.g., #402 removed resolveSkillsAsync/resolveSkillsFromList) to prevent future contributors from doing redundant work.

## Round 4 Learnings (2026-04-17T06:28:51Z — Issue #446, PR #455)

- (2026-04-17T06:28:51Z) **Playwright race condition:** `waitForResponse` MUST be registered before `page.goto()`. Registering it after `goto()` creates a race — the response may arrive before the listener is attached. This was the root cause of the CI failure in PR #455 (fixed in `c34b3b5`).
- (2026-04-17T06:28:51Z) **Auth E2E tests must use real `request` fixture:** Authentication boundary tests must use Playwright's `request.post()` (real HTTP, no browser context) rather than `page.route()` mock interception. `page.route()` short-circuits the network stack before auth headers are evaluated, making the test assert nothing meaningful about auth enforcement.
- (2026-04-17T06:28:51Z) **`addMessage` placement in `converse.ts`:** `addMessage` must be called inside each processing branch, not before the branch. Placing it before means the 406 early-return path mutates session state even when no message is processed — leaves the session in an inconsistent state. Side-effect-free 406 path requires `addMessage` to be gated behind the non-406 branch.
- (2026-04-17T06:28:51Z) **Phase allowlist must delegate to `normalizeConversationPhase()`:** `KNOWN_SERVER_PHASES` allowlist and `guardServerPhase()` should be a wrapper around `normalizeConversationPhase()` from `chat-a2ui.ts`, not a separate maintained set. Maintaining a separate list creates drift when `PHASE_ALIASES` in `chat-a2ui.ts` is updated — any new alias or canonical phase must be added in two places instead of one.

## Round 5 Learnings (2026-04-17 — Issues #454 and #453 frontend)

### Issue #454 — A2UI Debug Visualization (PR #457)

- (2026-04-17) **`DebugA2UITree.tsx` version discriminant:** Use `version === 'v0.9'` (or the current canonical version string) as the primary discriminant when filtering A2UI messages from a mixed event stream. Do not rely on structural duck-typing alone — the version field is the correct type-narrowing key.
- (2026-04-17) **`KNOWN_COMPONENT_TYPES` usage:** Lookup against `KNOWN_COMPONENT_TYPES` (the registry of valid A2UI component names) must happen at the leaf-render level, not at the tree root. Unknown types should render as a labelled fallback, not silently drop — this preserves debuggability when new components are in-flight.
- (2026-04-17) **Debug-only component isolation:** Debug visualization components (`DebugA2UITree.tsx`) must be guarded behind the debug flag and never imported in the production bundle path. Co-locate them in a `debug/` subdirectory or equivalent to make the isolation explicit to future readers.

### Issue #453 — System Prompt Debug View, frontend (PR #461)

- (2026-04-17) **Collapsible sections in `DebugPanel.tsx`:** New debug sections must be opt-in collapsed by default to avoid overwhelming the panel on first open. Use the existing `<details>`/`<summary>` (or Fluent `Accordion`) pattern already established in the panel.
- (2026-04-17) **System prompt display:** The system prompt string from `DebugMetadata.systemPrompt` is already 8KB-capped by the backend before it arrives on the wire; the frontend does not need to truncate it again. Display it verbatim in a `<pre>` block for readability.
