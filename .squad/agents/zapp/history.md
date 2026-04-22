## Summary (Rolled Up 2026-04-21)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For full learnings, refer to the git history or archived history files.

**Agent:** history.md  
**File rolled at:** 2026-04-21T21:36:58.305760Z  
**Remaining details:** See `.squad/agents/history.md/history-archive.md` for prior entries.

---

# Zapp — Security Architect

## Team Updates

### 2026-04-22 — DP #1041 Approval Passed; Conditions Recorded for Bender Implementation

**Status:** ✅ APPROVED WITH CONDITIONS (security review complete)

**Conditions for merge:**
- **C1:** `initializeAppInsights()` must be first statement in each handler function body
- **C2:** Error logging in `catch` block must use `sanitizeError(err)` — no raw error output

**Verification plan:** Code review of implementation PR (Bender) will verify both C1 and C2 are satisfied. C1 enforcement via visual inspection of handler bodies; C2 enforcement via grep + code context.

**Reference logs:**
- DP security review: `.squad/decisions/inbox/zapp-1041-dp-review.md` (merged into decisions.md)
- Orchestration log: `.squad/orchestration-log/2026-04-22T04:40:00Z-zapp-13.md`

---

## About Me

Security architect owning threat modeling, approval gates, and compliance for Kickstart. Expertise in OAuth, API security, XSS/injection defenses, schema validation, trusted-boundary enforcement.

## Key Domains

- Trust boundaries: control-plane data (system prompts, auth logic), client security (CSP, postMessage, HTML injection), server API (rate limiting, workspace isolation)
- Tool schema: LLM-facing tool definitions, A2UI component validation, payload bounds
- Session security: ownership binding, TTL enforcement, resume semantics
- Dependency governance: lockfile integrity, version pinning, security scans

## 2026-04-21 — DP Security Review: #1041 Revert OTel Externalization

**Verdict:** ✅ APPROVED WITH CONDITIONS

**Scope:** Leela's DP proposes reverting #1030's esbuild externalization (restore bundle-everything) and changing `initializeAppInsights()` from eager module-load IIFE to lazy handler-level call. All #1030 redaction work preserved.

**Findings (all clear):**
- Redaction pipeline integrity: ✅ OTel API defaults to no-op providers pre-init — zero egress before redactors installed.
- globalThis singleton guard: ✅ `Symbol.for('kickstart.azmon.started')` check→set is synchronous; JS event loop prevents interleaving.
- Connection-string handling: ✅ Never logged or echoed; init-failure path uses `sanitizeError()`.
- Supply-chain surface: ✅ Bundling eliminates 152 runtime-resolvable packages from deploy artifact.
- Bundle information leak: ✅ Only public npm packages bundled; no dev/test/internal code paths.
- Redactor wiring: ✅ Lazy init changes timing only; `RedactingSpanExporter` + `RedactingLogRecordProcessor` remain wired.

**Conditions:**
- C1: `initializeAppInsights()` must be first statement in each handler body.
- C2: `sanitizeError(err)` in catch block must remain unchanged.

**Label:** `zapp:approved-dp` applied. Decision filed: `zapp-1041-dp-review.md`.

## Learnings

- **OTel no-op provider is a security safety net.** Before any real provider is registered via `useAzureMonitor()`, the OTel API returns no-op tracers/loggers that accept calls but export nothing. This makes eager→lazy init transitions safe from a data-egress perspective — you lose telemetry coverage, but you cannot leak unredacted data.
- **`Symbol.for()` + single-threaded JS = effectively atomic guards.** The `globalThis[Symbol.for(...)]` pattern for cross-bundle singleton flags is safe without locks as long as the check→set path has no `await`. This is a recurring pattern in OTel and can be trusted for init-once semantics in the Functions worker model.
- **Bundling is strictly better than externalizing for supply-chain security in SWA.** SWA's uncontrolled server-side `npm install` creates a mutation window where `node_modules/` can be tampered. Self-contained bundles are immune. This is a durable architectural principle for any Azure SWA deployment.
- **Redaction-layer wiring survives lazy init because the provider config is declarative.** The `spanProcessors` and `logRecordProcessors` arrays passed to `useAzureMonitor()` are part of the function's internal logic, not the call timing. Lazy vs. eager changes when the pipeline is built, not what is built.

---

## 2026-04-21 — Four-way review gate structural shift

**Event:** Ceremony enforcement PR #993 shipped. PR Review Gate is now 4-way: Leela (architecture) + Zapp (security) + Nibbler (code-quality) + Docs reviewer (interim: Scribe).

**Impact on zapp:**
- 🔐 Security review now explicitly gated alongside architecture + code-quality + docs
- 📋 Merge blocked until all four approval labels present + CI green
- 🎯 Review protocol unchanged (post via `gh pr review` under lead bot identity)
- ✅ Completed security batch on v0.9 foundation: #989/#986 approved, #988/#990 comment-only (drafts, no blockers)

**Directive:** Ceremony enforcement tightened; coordinator will enforce blocking checkpoint before dispatch.

---

## 2026-04-21 · PR Batch (#989, #986, #988, #990)

**Verdicts:** #989 ✅ approve · #986 ✅ approve · #988 🟡 comment (draft) · #990 🟡 comment (draft)

**Patterns observed:**
- **Tool-schema narrowing is the strongest security win in this batch.** #989 cuts `core.emit_ui`'s per-component field set from seven loose optionals (`label` / `placeholder` / `value` / `disabled` / `items` / `onClick` / `onChange`) to a v0.9 shape (`id`, `component`, `child`, `children`, `text`, `action.event.{name, payload}`). `payload` is constrained to `record<string, scalar>` — no nested structures reach downstream handlers.
- **Clean-break > silent translation.** #989 chooses `_ErrorComponent` + named `[A2UIRegistry]` `console.error` over any back-compat shim. This "fail loud at the trust boundary" posture is the right default for tool schemas and is worth enforcing on future LLM-facing tools.
- **`.strict()` is only applied to interactive leaves (Button).** Containers (Row/Column/List) stay non-strict so mid-stream empty containers don't trip schema failure. This is acceptable — Zod drops unknown keys by default — but future interactive leaves (inputs, toggles with action bindings) should default to `.strict()`.
- **Prompt allow-lists are defense-in-depth, NOT trust boundaries.** #990's "banned component types" list in the system prompt is fine as a content-quality rail, but the actual enforcement lives in `validateAndSanitizeComponents` (strengthened by #989). Record in future reviews so no one assumes the prompt is the gate.
- **Process-local mutable state for variety (#990).** `focusCursor` + `lastFallbackIdx` carry no PII/auth state and leak nothing meaningful. Flag if the file ever adds tenant- or user-scoped counters.
- **CSS-only PRs (#986) still warrant a trust-boundary check.** Even pure-style PRs can regress CSP or swap in new asset loaders; confirmed `script-src 'self'` stays clean here (Fluent icon replaces local SVG asset — reduces surface).
- **Deletion PRs (#988) reduce surface but require follow-up on orphaned server payloads.** `/api/packs` still ships `playgroundScenarios` with no consumer — worth a follow-up to either stop shipping or document the contract so it doesn't silently become a new client surface later.

**Label applied:** `zapp:approved` on #989 and #986. Drafts (#988, #990) untagged per comment-only policy.

---

## 2026-04-21 — PR #988 security re-review (post-rebase 6ac15d9)

**Context:** Fry rebased #988 onto main + updated Playwright selectors; resolved Playground.tsx conflict by keeping upstream compact-grid from #986 and re-applying the `GalleryCardErrorBoundary` → `ComponentCardErrorBoundary` rename on top.

**Gate run:**
- `gh pr diff 988` — 4 files: changeset, `packages/web/css/playground.css`, `packages/web/e2e/playground.spec.ts`, `packages/web/src/pages/Playground.tsx`.
- Scanned diff for: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `Function(`, `document.write`, `window.open`, template-literal `href`, `localStorage`, `sessionStorage`, `fetch(`, `axios`, `process.env`, token/secret/api_key/password strings. **No hits** that represent real risk — only Fluent UI design `tokens.*` references (colors/spacing/radius), which are not credentials.
- E2E changes are selector/label renames (Ideas → Components, grid role/aria, `.playground-gallery-scroll` locator). Tests do not ship to production and contain no new injection sinks.
- Net effect of PR: removes Ideas tab, scenario detail dialog, and associated JSON-render paths → **attack surface decreases**.

**Conflict resolution verification (Playground.tsx):**
- Upstream compact-grid from #986 preserved: `className={allEmpty ? classes.componentCompactGrid : classes.componentGrid}` + `<ComponentCard ... compact={allEmpty} />` intact.
- Rename cleanly layered on top — both opening and closing `ComponentCardErrorBoundary` tags swapped in the same hunk; no orphan `GalleryCardErrorBoundary` references remain.
- No stray `PlaygroundScenario`, `Lightbulb24Regular`, scenario state, or Ideas tab entries leaking through after rebase.

**Decision:** ✅ CLEAN — no production code change vs prior approval.

---

## 2026-04-21 — PR #990 security review — APPROVED ✅

**Scope:** fix(web): vary Create-tab inspirations and constrain to core components (commit be16989, author Bender).

**Changes reviewed:**
- Moved `FALLBACK_IDEAS` / `ALLOWED_A2UI_COMPONENTS` / rotation helpers into server-owned `packages/web/api/src/lib/widget-inspirations-data.ts`.
- Tightened both Azure OpenAI system prompts (JSON + streaming) with an explicit allow-list of component type names and an explicit ban on namespaced/pack components.
- Added `packages/web/src/__tests__/a2ui-allow-list-registry.test.ts` — CI guard that the allow-list is a subset of `ClientComponentRegistry` registrations.
- Added `packages/web/api/src/lib/fallback-ideas-sync.test.ts` — byte-for-byte equality between server `FALLBACK_IDEAS` and client `FALLBACK_WIDGET_IDEAS`.
- Added `widget-inspirations-data.test.ts` covering `pickFallbackIdea` and `nextFocusDomain`.
- Playground client now avoids repeating the last fallback idea.

**Threat analysis:**
- **Prompt-injection vector:** None. The only dynamic interpolations into the LLM system prompts (`ALLOWED_LIST`, `focus`) are derived from developer-authored static constants (`ALLOWED_A2UI_COMPONENTS`, `FOCUS_DOMAINS`). No untrusted input reaches the prompt string.
- **Idea-text exfil / XSS vector:** Idea prompts are authored in-repo, not derived from request input; they are consumed by a JSON API and ultimately rendered by existing A2UI/Markdown renderers whose sanitization is unchanged.
- **Auth / secrets:** No new env vars, no new auth paths, no secret echoed in responses. `isOpenAIConfigured` and `chatCompletion*` wiring unchanged.
- **Allow-list drift (silent bypass):** Mitigated by the new vitest CI guard — a future PR that adds an allow-list entry without registering a renderer (which would surface as `_ErrorComponent`) fails CI. This is a genuine security property, not just hygiene: allow-list changes *are* the render-surface.
- **Client/server fallback drift:** Mitigated by the new sync test — client mirror pinned to server canonical list.
- **Process-local counters (`focusCursor`, `lastFallbackIdx`):** Variety hints only; `Math.random` seeding is appropriate, no security claim made on unpredictability.

**Decision:** `zapp:approved` (applied via REST after GraphQL label drop on initial `gh pr edit`).

**Security Verdict:** ✅ **APPROVED WITH CONDITIONS** (applied `zapp:approved` label)
- All 4 blocking conditions satisfied with test evidence
- Dependencies pinned in package-lock.json (no floating semver)
- Dependency scans passed
- Integration with DP #329 + #330 security review validated

**Consequence:** Unblocks merge when Leela approval also present (verified as received).

## 2026-04-17T12:06:45Z — #474 DP Review + v2 Security Architecture Review

- **#474 DP review:** APPROVE_WITH_CONDITIONS. Standard seam-cutting conditions; playground stubs must be gated behind `KICKSTART_PLAYGROUND`.
- **v2 security architecture review (#473):** APPROVED WITH CONDITIONS. 10 conditions total.
  - 5 Critical (before Step 5): SSRF/fetch_webpage URL denylist, path traversal/write_file workspace prefix, resume handler OID ownership, resume resultSchema validation, playground stub fail-closed gate.
  - 3 High (before Step 7/12): ARM path injection Zod regex, MCP auth documented, MCP UserAction architectural separation confirmed.
  - 6 Medium: secrets detection, PII detection, A2UI guardrail scope, token budget ceiling, CSP audit, CSRF.
- **MCP UserAction resolution:** UserActions are NOT MCP tools. MCP client detects `user_action_required` and POSTs directly to `/api/converse/resume`. Residual conditions #3 and #4 (OID ownership + resultSchema) cover MCP-originated resume calls equally.
- **Decision filed:** `zapp-v2-security-review.md` merged to decisions.md.

## Wave 3 — 2026-04-17 Security Reviews Filed

### #474 Step 1 Shim Security (APPROVE_WITH_CONDITIONS)
- Seam is compile-only and time-bounded; no new exports/fallback logic.
- Delete v1 helpers fail-closed — no silent fallback to demo, mock, or legacy paths.
- All v1 feature flags removed entirely.
- Secret/auth trust boundaries must not move client-side during preservation work.
- Step 1 merge requires proof: deleted imports gone, preserved packages did not gain broader runtime access.

### Kickstart App Hotspot Hardening
- Resolve parent target origin before messaging; reject messages unless `event.source === window.parent` and `event.origin` matches trusted parent.
- Replace schema-driven `innerHTML` rendering with explicit DOM construction + URL allowlisting.
- Dynamic renderer dispatch validated with allowlisted own-property check before invocation.
- Decision filed as `zapp-kickstart-app-hotspot-hardening.md`.

### #475 Harness Types (APPROVE_WITH_CONDITIONS)
- `AgentOutput` must reject unknown fields; `intent` is closed enum.
- A2UI union enforces one-and-only-one operation key; hybrid messages fail outright.
- `SessionCtx` narrowed/redacted; credential access capability-scoped.
- CI/static checks enforce compile-only boundary; dynamic code-loading primitives rejected.
- Catalog validation remains a mandatory second gate at runtime.

### #476 Registry + Loaders (APPROVE_WITH_CONDITIONS)
- Pack-owned names only; namespace squatting prevented by name validation at index time.
- Dependency-scoped reference resolution; only canonical `:` names valid in frontmatter.
- Frontmatter parser: safe YAML only, no custom tags/functions, bounded aliases/size.
- Loader path confinement: `realpath` canonicalization, symlink escape rejected.
- Registry sealed after `seal()` — exported views frozen; concurrent lifecycle misuse fails closed.
- Cycle detection: bounded iterative DFS or Kahn algorithm.

## 2026-04-21 · PR Batch (#989, #986, #988, #990)

**Verdicts:** #989 ✅ approve · #986 ✅ approve · #988 🟡 comment (draft) · #990 🟡 comment (draft)

**Patterns observed:**
- **Tool-schema narrowing is the strongest security win in this batch.** #989 cuts `core.emit_ui`'s per-component field set from seven loose optionals (`label` / `placeholder` / `value` / `disabled` / `items` / `onClick` / `onChange`) to a v0.9 shape (`id`, `component`, `child`, `children`, `text`, `action.event.{name, payload}`). `payload` is constrained to `record<string, scalar>` — no nested structures reach downstream handlers.
- **Clean-break > silent translation.** #989 chooses `_ErrorComponent` + named `[A2UIRegistry]` `console.error` over any back-compat shim. This "fail loud at the trust boundary" posture is the right default for tool schemas and is worth enforcing on future LLM-facing tools.
- **`.strict()` is only applied to interactive leaves (Button).** Containers (Row/Column/List) stay non-strict so mid-stream empty containers don't trip schema failure. This is acceptable — Zod drops unknown keys by default — but future interactive leaves (inputs, toggles with action bindings) should default to `.strict()`.
- **Prompt allow-lists are defense-in-depth, NOT trust boundaries.** #990's "banned component types" list in the system prompt is fine as a content-quality rail, but the actual enforcement lives in `validateAndSanitizeComponents` (strengthened by #989). Record in future reviews so no one assumes the prompt is the gate.
- **Process-local mutable state for variety (#990).** `focusCursor` + `lastFallbackIdx` carry no PII/auth state and leak nothing meaningful. Flag if the file ever adds tenant- or user-scoped counters.
- **CSS-only PRs (#986) still warrant a trust-boundary check.** Even pure-style PRs can regress CSP or swap in new asset loaders; confirmed `script-src 'self'` stays clean here (Fluent icon replaces local SVG asset — reduces surface).
- **Deletion PRs (#988) reduce surface but require follow-up on orphaned server payloads.** `/api/packs` still ships `playgroundScenarios` with no consumer — worth a follow-up to either stop shipping or document the contract so it doesn't silently become a new client surface later.

**Label applied:** `zapp:approved` on #989 and #986. Drafts (#988, #990) untagged per comment-only policy.

---

## 2026-04-21T10:15:00Z — Four-way review gate structural shift

**Event:** Ceremony enforcement PR #993 shipped. PR Review Gate is now 4-way: Leela (architecture) + Zapp (security) + Nibbler (code-quality) + Docs reviewer (interim: Scribe).

**Impact on zapp:**
- 🔐 Security review now explicitly gated alongside architecture + code-quality + docs
- 📋 Merge blocked until all four approval labels present + CI green
- 🎯 Review protocol unchanged (post via `gh pr review` under lead bot identity)
- ✅ Completed security batch on v0.9 foundation: #989/#986 approved, #988/#990 comment-only (drafts, no blockers)

**Directive:** Ceremony enforcement tightened; coordinator will enforce blocking checkpoint before dispatch.

**Review posted:** `gh pr review 990 --approve`.

---

## 2026-04-21/22 — Incident #1041 Production 404: Security Review (zapp-14, zapp-15)

**Sessions:** zapp-14 (PR #1051 review), zapp-15 (PR #1052 expedited review, role directive)
**PRs approved:** #1051, #1052
**Directives:** Lead-tier role classification

### PR #1051 Security Review (zapp-14)

**Reviewed:** OTel externalization revert
**Concerns addressed:**
- No introduction of new attack surface via bundling
- Bundling inline keeps OTel initialization under local control (not dependent on server-side install)
- CSP (`script-src 'self'`) alignment maintained
- No third-party registry dependencies in runtime path

**Approval:** `zapp:approved` on #1051 (2026-04-21)

### PR #1052 Expedited Review (zapp-15)

**Reviewed:** Workflow guard inversion (hotfix)
**Context:** PR #1051 regression guard needed inversion; expedited review gate applied
**Gate status:** All four reviewers approved (Leela, Zapp, Nibbler, Docs)

**Approval:** `zapp:approved` on #1052 (2026-04-22 05:35 UTC)

### User Directive: Zapp is a Lead-tier Role (2026-04-21T22:38 PT)

**From:** Ahmed Sabbour
**Directive:** "zapp is also a lead, should be the same treatment as nibbler."

**Implications:**
- Token resolution: Zapp's identity must route through `lead` app (`sabbour-squad-lead`), not fail closed
- Alias update required: `.squad/scripts/resolve-token.mjs` line `zapp: ['zapp']` → `zapp: ['lead']`
- Rationale: No standalone `zapp.pem` exists; per-role tier requires explicit alias to provisioned app
- Matches Nibbler lead-role directive from earlier session

**Implementation:** Follow-up PR after #1048 (pending coordinator assignment)

### Incident Assessment

- No security surface regression introduced by revert
- Bundling actually reduces attack surface (server-side install hazard removed)
- Incident root cause confirmed non-security (architectural deploy hazard, not code flaw)

