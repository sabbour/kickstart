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
- v2 DPs authored: #477 (pack-core), #478 (Playground), #479 (Runner+SSE), #480 (Skill resolver), #482 (pack-azure)
- #474 Step 1 web-shell cleanup: 16 `@kickstart/core` imports → `@kickstart/harness`, build green
- #474 cut line analysis filed; seam-cutting approach confirmed

## Active Sprint: v2 (harness + packs)

Steps 1–4a merged. Current chain: **#477** (PR #548, Leela✅/Zapp blocked) → #479 → #480 → domain packs (#482–#488).
Fry's next role: implement #479 (Runner + SSE) once #477/#478 are fully merged.

## Learnings

- (2026-04-17T12:06:45Z) For #474 Step 1, safe frontend cut line: "preserve the shell, delete the fixtures." Treat `kickstart-catalog.ts`, playground demo/stub sources, and `types.ts` as replace-in-place seams.
- (2026-04-17T06:28:51Z) **Playwright race condition:** `waitForResponse` MUST be registered before `page.goto()` — registering after creates race where response arrives before listener.
- (2026-04-17T06:28:51Z) **Auth E2E tests:** Must use `request.post()` (real HTTP) not `page.route()` mock interception.
- (2026-04-17T06:28:51Z) **`addMessage` placement in `converse.ts`:** Must be inside each processing branch, not before — placing before means 406 early-return path mutates session state.
- (2026-04-17T06:28:51Z) **Phase allowlist** should delegate to `normalizeConversationPhase()` from `chat-a2ui.ts`, not maintain a separate set.
- (2026-04-17T03:30:17Z) When `KICKSTART_AGENTS_SDK=true`, backend returns HTTP 406. Correct pattern: inline 406 fallback in `useStreaming.ts`.
- (2026-04-17T03:30:17Z) Playwright SSE route interception: register `**/api/health` and `**/api/converse` BEFORE `page.goto()`.
- (2026-04-17T03:01:07Z) `buildSystemPrompt()` context vars must be explicitly pushed to `parts` as `## Section` blocks — `interpolate()` only substitutes `{{placeholder}}` tokens.
- (2026-04-17T03:01:07Z) `auto-continue.ts` only triggers on `complete:` and `continue:` prefixes; `navigate:` is secondary.
- (2026-04-16T06:38:32Z) New K8s icons: create static SVGs under `packages/web/public/assets/icons/k8s/`, register via `registerDiagramIcons()`, update `ALLOWED_ICON_KEYS`.
- (2026-04-15T15:20:24Z) `ArchitectureDiagram` uses diagram-first contract: raw Mermaid in `diagram`, sanitize before Mermaid render, `%%icon:name%%` expansion after.

## 2026-04-17 — DPs for #477–#480, #482

| Issue | DP | Comment | Status |
|-------|----|---------|--------|
| #477 pack-core | Phases A→H; 40 components; emit_ui via Zod + a2uiEmissions | #issuecomment-4268128132 | APPROVED (Leela+Zapp A/C) |
| #478 Playground | 4-phase; registry-driven gallery; usePlaygroundDispatch | #issuecomment-4268166333 | APPROVED; PR #547 ✅ merged |
| #479 Runner+SSE | 9 SSE events; writeSSE; useStreaming rewrite | #issuecomment-4268255972 | APPROVED (Leela+Zapp A/C) |
| #480 Skill resolver | 4-stage pipeline; estimateTokens; Skill[] | #issuecomment-4268290735 | APPROVED (Leela+Zapp A/C) |
| #482 pack-azure | 6 phases; azureKit port; Zapp C1 pre-addressed | #issuecomment-4268944331 | Leela APPROVE_WITH_CONDITIONS; Zapp BLOCKED |
| #482 DP Revision | Addressed Zapp B1–B5: managed identity model, azureToken storage boundary, arm_get exact regex+denylist, AzurePackDTO redaction contract, KICKSTART_PLAYGROUND gate | #issuecomment-4269070199 | Awaiting Zapp re-review |
| #482 DP Revision B3 | Posted exact anchored ARM_PATH_RE regex + ARM_PATH_DENY denylist + validateArmPath() in response to Zapp B3 re-check failure | https://github.com/sabbour/kickstart/issues/482#issuecomment-4269105863 | Awaiting Zapp B3 sign-off |
| #483 pack-aks-automatic | Phases A→G; 3 agents, 7 skills, safeguards.json (single source of truth), 2 tools, 1 user action, 4 components (ArchitectureDiagram port), 3 guardrails; 5 open questions for Leela+Zapp | https://github.com/sabbour/kickstart/issues/483#issuecomment-4269179983 | Proposed — awaiting Leela + Zapp approval |
| #484 pack-github | Phases A→G; 1 agent (github.publisher), 3 skills, 1 tool (github.api_get + GITHUB_PATH_ALLOWLIST), 6 user actions (login/pick_org/pick_repo/create_repo/create_pr/set_secret), 7 components (port GitHubLoginCard/RepoPicker/Commit/Action + new OrgPicker/RepoInfo/SecretSetter), github-handoff.ts port, 5 open questions for Leela+Zapp | https://github.com/sabbour/kickstart/issues/484#issuecomment-4269229222 | Proposed — awaiting Leela + Zapp approval |
| #484 DP Revision (Leela only) | Addressed Leela C1–C4 | https://github.com/sabbour/kickstart/issues/484#issuecomment-4269290534 | Superseded by combined revision |
| #484 DP Revision (Leela + Zapp) | Combined revision addressing Leela C1 (4 GITHUB_PATH_ALLOWLIST patterns), C2 (github-handoff.browser.ts + github-api.ts split), C3 (create_pr LLM-restricted params schema; server-side prBody), C4 (tokens: Record<string,string>); Zapp B1 (decodeURIComponent + FORBIDDEN seq check before allowlist), B2 (tokens redaction contract — never in DTO/SSE/LLM), B3 (HTTPS-only endpoints, Secure+HttpOnly cookies, no secrets in logs), B4 (githubPlaygroundStubs fail-closed behind KICKSTART_PLAYGROUND, all 6 stubs enumerated); documented Zapp Major (stricter branch denylist, sanitize.ts scope note) | https://github.com/sabbour/kickstart/issues/484#issuecomment-4269301253 | Awaiting Leela + Zapp re-check |
| #483 DP Revision | Addressed Leela C1 (inline skills micro-fix note), C2 (ArchitectureDiagram is a move not a port, Phase E updated), C3 (DeploymentConfirm added to Phase E); Zapp B1 (workload identity / DefaultAzureCredential credential scope), B2 (block > rewrite guardrail precedence rule), B3 (aksPlaygroundStubs fail-closed gate) | https://github.com/sabbour/kickstart/issues/483#issuecomment-4269273327 | Awaiting Leela + Zapp re-review |
| #485 web client — A2UI renderer | 6 phases (A2UIRegistry hook, A2UIRenderer, useActionDispatch rewrite, UserActionPanel, ConversationThread rewrite, migration cleanup); registry Map lookup; FIFO cancellation queue; loud fallbacks; 5 open questions (client registry boundary, /api/packs authority, UserActionPanel portal, APIConnectorContext deletion, Zapp credential flow review) | https://github.com/sabbour/kickstart/issues/485#issuecomment-4269276012 | Proposed — awaiting Leela + Zapp approval |
| #486 Guardrails Engine | Phases A→H: GuardrailContribution interface (`pass|block|redact`), `runGuardrails()` engine with sequential evaluation + fail-closed, Runner 3-stage hooks (`input`/`output`/`tool`), 3 pack-core guardrails (token-budget/no-pii-in-logs/no-secrets-in-artifacts), 2 pack-azure guardrails, aks wiring, validate_artifacts deferred stub decision; 4 open questions for Leela+Zapp | https://github.com/sabbour/kickstart/issues/486#issuecomment-4269313578 | Proposed — awaiting Leela + Zapp approval |
| #485 DP Revision (Leela + Zapp) | Combined revision addressing Leela C1 (bootstrap ordering: corePack.register → seal → ReactDOM.render; useA2UIRegistry throws if unsealed), C2 (Zapp gate satisfied — Phase C can proceed); Zapp Crit1 (pre-render schema.parse via propertySchema, URL allowlist, unknown-component → MessageBar), B1 (missing confirmComponent → fail-closed: MessageBar + no resume POST + console.error), B2 (resume boundary inherits #479 Step 5 contract; no tool metadata/scope/credential echo), B3 (registry.seal → ReadonlyMap + deep-freeze + MessageBar fallback unoverridable), B4 (schema-projected merge; strip __proto__/prototype/constructor/__* keys; 64KB size limit; 5-level depth limit) | https://github.com/sabbour/kickstart/issues/485#issuecomment-4269339391 | Awaiting Leela + Zapp re-check |
| #486 DP Revision (Leela + Zapp) | Combined revision addressing Leela C1 (interface contract authoritative: `evaluate(input): Promise<GuardrailResult>` flat shape supersedes brief discriminated union; migrate 3 guardrails; `redact` not `rewrite`), C2 (`applyRedact()` spec: input/output/tool stage field assignments, `redactedArgs?: Record<string,unknown>` for tool stage); Zapp Crit1 (opaque SSE: only `{code:'GUARDRAIL_BLOCK', message:'Request could not be completed'}`, never guardrail name/reason/pattern/stage), Crit2 (`core/no-credential-leak` input+output+tool stages, always `block`), B1 (tool-stage block aborts ALL remaining tool calls immediately), B2 (core guardrails first, non-overridable short-circuit), B3 (redact chaining: evaluate both original+redacted; sentinel `\x00REDACTED:{uuid}\x00`), B4 (`validate_artifacts` @internal, fail-closed `{valid:false}`), B5 (registry duplicate rejection + `core/` namespace reserved at registration time), B6 (fail-closed on evaluate throw, applyRedact throw, coercion error, registration timeout; 4 required test paths) | https://github.com/sabbour/kickstart/issues/486#issuecomment-4269366453 | Awaiting Leela + Zapp re-check |
