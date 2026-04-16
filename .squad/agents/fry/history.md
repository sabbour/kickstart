# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, streaming UX patterns, and architecture diagram rendering.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/catalog/` — A2UI component catalog, diagram utilities
- `packages/web/src/pages/` — Landing, Chat, Playground, Create
- `packages/web/css/` — Design tokens, theme system

## Patterns
- **Fat A2UI components:** `createReactComponent` factory + `useState`, `useAPIConnector`, `context.dispatchAction`
- **Streaming UI:** `useProgressiveQueue` for 150ms stagger, progressive bubble state + ref tracking
- **Theme system:** `ThemeContext` (light/dark/system), `resolvedTheme`, `useSyncExternalStore` for matchMedia
- **A2UI actions:** `DataContext.resolveAction()` enriches action context with user selections
- **Accessibility:** WCAG 2.1 AA — aria-labels, roving tabIndex, live regions

## Recent Work Summary (v0.6.0 → v0.6.2)

**CSS & Styling (2026-04-14)** — Removed 600 lines `!important` overrides blocking Fluent v9 Griffel. Fixed visual bugs, unified button styling.

**A2UI Streaming (2026-04-14)** — Fixed #166 SSE parser (JSON envelope accumulation). Fixed #192 ActionSchema support for ChoicePicker/CheckBox/Toggle/ComboBox.

**Navigation (2026-04-14)** — Hash-based routing (#session/{id}), browser back button, 5 new demo scenarios with interactive patterns.

**ArchitectureDiagram (2026-04-15)** — Diagram-first contract: raw Mermaid text + ELK layout. Registry-backed icons, secure post-render `%%icon:%%` expansion. Local assets in `architectureDiagramUtils.ts`.

**K8s Icons (2026-04-16)** — 7 SVGs added (gateway, httproute, pdb, vpa, cronjob, role, rb). Naming: `k8s/<lowercase-kind>`, full names, no abbreviations. DRA + Gateway API conventions locked.

**Playground Connectors (2026-04-16)** — Tab grouping (GitHub/Azure Components → Components tab). Stub guard removed; AzureARMConnector + GitHubConnector always registered. Real auth + API calls. 1504 tests passing.

## Icon Conventions (Locked)
- `k8s/<lowercase-kind>` — full resource names unless established `kubectl` short names exist
- `k8s/resourceslice` (SVG label: `rslice`) — avoids RS/ReplicaSet collision
- `k8s/endpointpicker` (SVG: `epp`) — full name for consistency
- NetworkPolicy stays in azure-pack; never in K8S_EXTRA_ICONS
- DRA resources: `deviceclass`, `resourceclaim`, `resourceclaimtemplate`, `resourceslice`

## Learnings (Active)
- **ArchitectureDiagram:** Raw Mermaid + nested subgraphs; registry-backed icons with post-render expansion
- **A2UI actions:** `DataContext.resolveAction()` is the official enrichment API; don't duplicate GenericBinder logic
- **SSE streaming:** Typed events (`event: a2ui\ndata:`) AND JSON envelope post-parse both route to `callbacks.onA2UI()`
- **Icon registration:** `registerDiagramIcons()` is additive; local icons merge with pack without conflict
- **K8s naming:** Use full names for unknown CRDs; abbreviations only for established kubectl conventions

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
## Decision References
- `.squad/decisions.md`: `fry-playground-component-grouping.md`, `fry-k8s-icons.md`
- `packages/web/src/catalog/components/architectureDiagramUtils.ts` — master reference for diagram rendering
