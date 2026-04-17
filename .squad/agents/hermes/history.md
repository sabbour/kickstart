# Hermes — Tester

## About Me
QA engineer and test infrastructure owner. Expertise in Playwright E2E testing, validation engine architecture, Kubernetes deployment safeguards, and accessibility compliance. Responsible for test coverage, regression detection, and quality gates on all releases.

## Key Files
- `packages/core/src/validation/` — ValidationEngine, 23 validators (DS001-DS020), auto-fix system
- `packages/core/src/__tests__/` — 600+ unit tests for validation, action loop, tool system
- `packages/web/src/__tests__/` — 70+ Playwright E2E tests for full user flows
- `.playwright/` — Playwright config, webServer, browser setup
- `packages/core/src/rules/` — RulesEngine metadata layer for categorized validation reports

## Patterns
- **Validator interface:** execute(content) → ValidationResult, optional autoFix(content) for chainable fixes
- **E2E test helpers:** enterChatViaTrack(), sendMessage(), verifyPhase(), mockApi() for reusable flow setup
- **Accessibility compliance:** WCAG 2.1 AA — roving tabIndex, aria-live, label association, keyboard navigation
- **Kubernetes safeguards:** DS001-DS020 span security/reliability/networking; category-grouped reports; AKS constraint mapping
- **Playwright strict mode:** Use exact getByText strings, scope with containers, avoid ambiguous selectors

## Recent Work
- v0.5.6 validation audit: DS001-DS020 comprehensive coverage, auto-fix testing, cross-validator interaction
- v0.5.0 a11y fixes: roving tabIndex RadioGroup, aria-live regions, external link icons, label association
- v0.4.0 E2E suite: 27+ accessibility tests, keyboard nav testing, live region verification
- v0.3.0 test expansion: tool system TDD, validation engine, action loop verification

## Learnings
- 2026-04-15: For stepwise live artifact streaming reviews, I only clear the QA gate when validation is batch-atomic per step, mandatory-step failures pause instead of auto-skipping, and resume state persists explicit per-step outcomes (#326 Rev 4).
- 2026-04-16: When feature code (allowlist additions) is developed in parallel by another agent, write TDD-red tests that define the exact contract — 4 tests for `k8s/gateway`, `k8s/httproute`, `k8s/pdb`, `k8s/vpa` fail until Fry adds the keys to `ALLOWED_ICON_KEYS`. Also added 14 green tests covering path-traversal safety, case sensitivity, structural validation, a11y (alt=""), null-resolver handling, and consecutive/mixed-case placeholders.
- 2026-04-16: Expanded DRA icon test coverage — added 4 TDD-red tests for `k8s/deviceclass`, `k8s/resourceclaim`, `k8s/resourceclaimtemplate`, `k8s/resourceslice` across isAllowedIconKey, ALLOWED_ICON_KEYS membership, expandIconPlaceholders, and full renderArchitectureDiagramSvg pipeline. Also added 2 green tests for `k8s/cronjob`, `k8s/role`, `k8s/rb` which were in the allowlist but missing from test assertions. Confirmed `k8s/netpol` already has full green coverage. Total: 23 tests (19 green, 4 red awaiting Fry).
- 2026-04-16: Added `k8s/endpointslice` to the same 4 TDD-red tests (isAllowedIconKey, ALLOWED_ICON_KEYS, expandIconPlaceholders, full pipeline). Key name confirmed via Bender's decision (`bender-dra-icon-keys.md`). Same 23-test total (19 green, 4 red) — EndpointSlice grouped with DRA keys since all await Fry's allowlist batch.
- 2026-04-16: Scope change — removed EndpointSlice, replaced with InferencePool/InferenceObjective/EndPointPicker. Fry landed DRA + endpointslice in `ALLOWED_ICON_KEYS`, so DRA tests turned green and were split into their own `it` blocks. 4 new TDD-red tests target `k8s/inferencepool`, `k8s/inferenceobjective`, `k8s/endpointpicker`. Total: 27 tests (23 green, 4 red awaiting Fry).
- 2026-04-16: Final reviewer pass — APPROVED. Fry landed all 7 keys (4 DRA + 3 inference/picker) in ALLOWED_ICON_KEYS, K8S_EXTRA_ICONS, and SVG assets. Bender aligned both prompt surfaces. All 27 tests green, lint clean, zero stale endpointslice references. Cleaned up stale "Fry needs to add it" assertion message. Icon batch ready for commit/push.
- 2026-04-16: Wrote Fluent 2 restyle TDD-red tests for issue #347. Added `describe('Fluent 2 diagram CSS contract')` with 9 tests: 2 green structural (style block present, selectors exist) + 7 red value-level (cluster rx:4, fill:#f5f5f5, stroke:#e0e0e0; edge stroke-width:1, stroke:#d1d1d1; edgeLabel border-radius:4px; nodeLabel font-weight:600). Tests exercise `renderArchitectureDiagramSvg` public API to avoid breakage from `injectTryAksDiagramStyles→injectDiagramStyles` rename. Total: 36 tests (29 green, 7 red awaiting Fry).

---

**2026-04-15T22:40:15Z — Scribe**: Issue #326 Revision 4 approved. QA gate post on #326#issuecomment-4256166025 logged. Ready for closure.

---

**2026-04-16T06:52:50Z — Scribe**: K8s icons test session complete. Expanded `architectureDiagramUtils.test.ts` from 3 to 18 tests covering new k8s icon keys, path-traversal rejection, case sensitivity, structural validation, a11y, and null-resolver handling. Decision `hermes-k8s-icons.md` merged to decisions.md.
- 2026-04-16: Investigated issue #388 (15 reported failing Playwright E2E tests). Deep-dived CI failure logs to find only 3 actual failures — all in "Fat component slices" describe block, caused by bugs in `docs/engineering-accuracy-rewrite` branch (`shouldUsePlaygroundAuthStub()` hardcoded false, `GALLERY_GROUPS` missing 'Integration Kits'). All 4 spec files already matched the current main UI. Made two robustness improvements: added `**/.auth/**` route abort in shared fixture (prevents accidental auth navigation) and added explicit Ideas tab click in `openScenario()` helper (ensures gallery context). PR #391.
- 2026-04-17: Retroactive audit of 11 PRs merged without review (#405 audit session). Audited PRs #407, #408, #412, #415, #416, #418, #420, #421, #422, #424, #426. Found 52 unresolved Copilot review threads across all PRs — zero had any human review. Two P1 runtime risks: `advancePhase()` throws on invalid phase strings (#428), and system prompt context variables not injected (#429). PR #424 (API reference rewrite) had 19 inaccuracies (#430). PR #408 leaked internal Azure env details (#432). Created 8 follow-up issues (#428–#435). Summary in #436.
- 2026-04-17: Custom component count contract test for issue #433. Source of truth for the "22 custom components" count is the `.tsx` files in `packages/web/src/catalog/components/` — non-component `.ts` files (tests, utilities) use a different extension and are excluded automatically. Test added to `packages/core/src/__tests__/custom-component-count.test.ts` with two assertions: exact count (22) and explicit component name set. Squad-sdk not installed in this environment; used raw node crypto to generate GitHub App JWT and exchange for installation token. PR #443.

## Round 5 Learnings (2026-04-17 — Issue #453 Design Proposal)

- (2026-04-17) **`systemPrompt` call sites — 4, not 3:** When auditing call sites for `buildSystemPrompt()` (or any system-prompt builder), count them from `git grep` output before writing the DP. The actual count in this repo was **4** call sites (`agents-runner.ts`, `action.ts`, `chat-action.ts`, and one more). Stating an incorrect count in a DP causes a blocking condition from Leela.
- (2026-04-17) **`agents-runner.ts` descope pattern:** When a backend file is being migrated or replaced (e.g., `agents-runner.ts` under the Agents SDK migration), explicitly note in the DP that it is a descope target and will not need the new feature wired in. Leela's condition was specifically that the DP must account for this call site even if only to document that it's intentionally excluded.
- (2026-04-17) **DP approval-with-conditions blocking merge gate:** Both Leela and Zapp `approved-with-conditions` verdicts on a DP are blocking — implementation must address all listed conditions before opening the first implementation PR. Do not open PRs against a conditionally-approved DP without confirming condition closure.

## 2026-04-17T12:06:45Z — Connector Execution Model ADR

- **Connector execution research completed:** AzureARMConnector always proxies through `/api/arm-proxy` (CORS constraint). GitHubConnector splits: reads direct, writes proxied for token security.
- **Known technical debt flagged:** `createPullRequest()` calls `api.github.com` directly — inconsistency to be addressed.
- **Standing rule established:** Any new connector methods that write data MUST use the server proxy pattern.
- **Decision filed:** `hermes-connector-execution-adr.md` merged to decisions.md.
