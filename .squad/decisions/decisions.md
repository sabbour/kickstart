# Team Decisions & Plans

## Indexed Decisions

---

### Sprint Plan: v0.5.7 Bug-Fix Sprint

**Date:** 2026-04-14T10:49:56Z  
**Facilitator:** Leela (Lead)  
**Sprint Goal:** Fix critical A2UI rendering blocker and resolve P1 UI/UX bugs to stabilize the app before next feature wave.

---

## Issue Prioritization & Complexity

| Issue | Type | Title | Complexity | Fast-Track | Route |
|-------|------|-------|-----------|-----------|-------|
| #166 | P0 Bug | A2UI components parsed but not rendered | M | — | Fry |
| #167 | P1 Bug | CodeBlock no syntax highlighting in prod | S | ✅ | Fry |
| #168 | P1 Bug | SteppedCarousel no panel transition animation | S | ✅ | Fry |
| #169 | P1 Bug | Sign-in button shows "Sign in with Microsoft" after login | M | — | Fry |
| #170 | P1 Bug | Integration Kit scenarios not visible in sidebar | S | ✅ | Fry |
| #171 | P1 Bug | Files/Folder icon in header does nothing | S | ✅ | Fry |
| #172 | P1 Bug | "Clear All" needs confirmation dialog | M | — | Fry |
| #173 | P2 Enh | Add Home button for landing page navigation | S | ✅ | Fry |
| #174 | P2 Enh | File operations scenarios in Playground | M | — | Fry |

**Complexity Key:**
- **S (Small):** CSS-only, config/array update, single-line fixes. ~1–2 hours, single file.
- **M (Medium):** Single-file logic, state management, component wiring. ~4–6 hours.
- **L (Large):** Multi-file refactoring, cross-system integration. ~1–2 days.

---

## Dependencies & Blocking Relationships

```
#166 (P0 blocker)
  ↓
#169, #170, #171, #172, #173 (all P1+ depend on #166 completing)
  ↓
#174 (lowest priority, can start in parallel with Wave 3)

#167, #168 (independent CSS fixes — can ship anytime)
```

**Key insight:** #166 is a **critical blocker** preventing the entire app from rendering rich components. All other work is lower priority but independent.

---

## Sprint Waves

### **Wave 1: Critical Blocker (Day 1)**
Unblock the app. All further work depends on this.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #166 | Fry | 4–6 hours | Fix SSE parser in `useStreaming.ts` to accumulate JSON envelope for `a2ui` array. Backend confirmed working — frontend-only fix. This unblocks all component rendering. |

---

### **Wave 2: P1 Quick Fixes (Day 1–2, parallel with Wave 1 start)**
Low-risk CSS and config updates. Ship these ASAP after #166 lands.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #167 | Fry | 1–2 hours | **Fast-track:** Verify `highlight.js` CSS bundle inclusion in prod build (likely vite/rollup config). May need CSS import or plugin adjustment. |
| #168 | Fry | 1–2 hours | **Fast-track:** Add CSS transitions to `SteppedCarousel` panel container. Simple animation rule, no JS. |
| #170 | Fry | 30 min | **Fast-track:** Add `'Integration Kits'` entry to `GALLERY_GROUPS` array in Playground sidebar. Config-only. |
| #171 | Fry | 1 hour | **Fast-track:** Wire up Files/Folder button click to toggle FileTreePanel visibility. Single handler, existing component. |

---

### **Wave 3: P1 Logic Fixes (Day 2–3, start after Wave 1)**
Medium complexity state/component work.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #169 | Fry | 4–6 hours | Auth state not propagating to sign-in button after login. Likely context or hook issue in AuthContext or useAuth. Check token refresh flow. |
| #172 | Fry | 3–4 hours | Add Fluent Dialog component for "Clear All" confirmation. Wire to existing clear action. Needs state + UX testing. |

---

### **Wave 4: P2 Enhancements (Day 3–4, lower priority)**
Nice-to-have features, can slip if time constrained.

| Issue | Assignee | Estimate | Notes |
|-------|----------|----------|-------|
| #173 | Fry | 1–2 hours | **Fast-track:** Add Home button to header. Wire to landing page route. Small UX addition. |
| #174 | Fry | 4–6 hours | Add file operations scenario mockups to Playground. New scenario data + gallery entry. Depends on Fry's familiarity with Playground data structures. |

---

## Fast-Track Approval (Skip Full DP Gate)

Per v0.5.6 retro: CSS-only fixes and config updates fast-track directly to code review.

**Fast-track candidates:**
- ✅ #167 (highlight.js CSS bundling)
- ✅ #168 (CSS transitions)
- ✅ #170 (array entry)
- ✅ #171 (button wiring)
- ✅ #173 (Home button)

**Standard DP gate required:**
- ❌ #166 (M complexity, needs spec confirmation on parser fix)
- ❌ #169 (M complexity, auth logic, needs review)
- ❌ #172 (M complexity, dialog component + state)
- ❌ #174 (M complexity, new scenario data structure)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| #166 fix incomplete (SSE parser still not accumulating) | CRITICAL — blocks entire sprint | Fry to validate with backend (already confirmed working); add test case for A2UI envelope parsing. |
| #169 requires deeper auth refactor than expected | HIGH — slips to next sprint | Root-cause analysis first (30 min). If >2 hours, defer to v0.5.8. |
| #172 UX scope creeps (animated dialog, etc.) | MEDIUM — scope creep | Define UX spec before code. Simple Fluent Dialog, no animations. |
| CSS bundling issue (#167) is vite/rollup config | MEDIUM — may need build tooling changes | Test prod build locally first. If vite config needed, pair with Bender. |

---

## Success Criteria

**Sprint completion = all P0 + P1 issues resolved. P2 is best-effort.**

- [ ] #166 ships and A2UI components render in UI
- [ ] #167–#172 all closed with passing tests
- [ ] v0.5.6 history compaction applied (baseline established)
- [ ] All code follows DP gate discipline
- [ ] Zero regressions in smoke tests

---

## Retrospective Hooks

- **v0.5.6 learning applied:** Pre-sprint history compaction already done ✅. CSS fast-track policy in place ✅.
- **Track:** SSE parser complexity (did fix require extra debugging?). Auth state propagation (recurring issue?).
- **Next sprint:** Consider pre-built test cases for streaming A2UI to prevent similar regressions.

---

## Author Notes (Leela)

This is a focused bug-fix sprint with a single critical blocker (#166). Wave 1 must complete before teams can fully validate the rest. The P1 bugs are independent — parallelization here is high. P2 features are defensive against scope creep; ship if time permits, defer if needed. All work routes to Fry; no backend changes expected (backend SSE confirmed working). Fast-track policy reduces DP ceremony on 5 low-risk items, keeping the team agile.

---

### SWA Continuous Deploy & Version Footer

**Date:** 2026-04-14T10:54:58Z  
**By:** Ahmed Sabbour (via Copilot)  
**Decision:** SWA should always run the latest version on "main" — no more waiting for release tags to see changes. The version shown in the footer should be something meaningful (e.g., git SHA, build date, or "dev-{sha}") rather than requiring a semver bump.  
**Rationale:** User request — the current release-then-deploy cycle is too slow for iterating and testing. Continuous deployment from main is needed for demo readiness.

**Implementation details:**
1. **Push-to-main trigger** — `deploy-swa.yml` now triggers on `push → branches: [main]` with path filters (`packages/**`, `package.json`, `package-lock.json`, `tsconfig.json`). Tag-based releases still trigger deployment as before.
2. **Unified version string** — `__BUILD_VERSION__` is now `{semver}-{shortSHA}` (e.g. `0.5.6-abc1234`). Git SHA is resolved via `git rev-parse --short HEAD` at build time, falling back to `GITHUB_SHA` env var, then `dev`.
3. **Footer simplification** — Landing and Playground footers show the unified version string instead of version + SHA separately. Every build is uniquely identifiable.

**Impact:** Every push to `main` that touches package code auto-deploys to SWA. Release workflow unchanged — tag pushes still work. Fry: footer components (`Landing.tsx`, `Playground.tsx`) now use `__BUILD_VERSION__` only (SHA embedded).

---

### Agent time tracking per issue

**Date:** 2026-04-14T12:56:33Z  
**By:** Ahmed Sabbour (via Copilot)  
**Directive:** Agents must track how much time they spent working on each issue — total time, and time spent addressing feedback separately. This data should surface in Sprint Retro ceremonies and feed into Sprint Planning for estimation calibration. The goal is to correlate feature size with implementation time.

**Rationale:** User request — captured for team memory and process improvement.

---

### Issue comment + board state on work start

**Date:** 2026-04-14T12:58:00Z  
**By:** Ahmed Sabbour (via Copilot)  
**Directive:** When an agent starts working on an issue, it must immediately post a comment on the issue and move it to "In Progress" on the project board. Use the GitHub App identity (bot token) for these API calls so the comment appears as the agent's bot identity, not the human user.

**Rationale:** User request — captured for team memory.

---

## 2026-04-17 v2 Rewrite Merge & 1.0.0 Release Milestone

### v2 Step 8: pack-aks-automatic DP Review

**Date:** 2026-04-17  
**Issue:** #483  
**Verdict:** ✅ APPROVE_WITH_CONDITIONS

**Conditions Satisfied:**
| Check | Status | Notes |
|-------|--------|-------|
| C1 — harness micro-fix | ✅ Resolved | `skills?: Skill[]` tracked as separate harness micro-fix (Bender PR); `deployment-safeguards` registers inline once patch lands |
| C2 — ArchitectureDiagram move | ✅ Resolved | Correctly framed as cross-pack move from `packages/pack-core/src/components/rich/` → `packages/pack-aks-automatic/src/components/`; both manifests updated; ownership assigned to #525 |
| C3 — DeploymentConfirm in Phase E | ✅ Confirmed | `aks/DeploymentConfirm` explicitly added to Phase E scope |

**Comment:** https://github.com/azure-management-and-platforms/kickstart/issues/483#issuecomment-4269284877  
**Label Applied:** `leela:approved-dp`

---

### v2 Step 9: pack-github DP Review

**Date:** 2026-04-17  
**Issue:** #484  
**Verdict:** ✅ APPROVE_WITH_CONDITIONS

**Blocking Conditions Before Merge:**

1. **Expand `GITHUB_PATH_ALLOWLIST`** (required before merge)
   - Add `/user/repos(\?.*)?` — list user's personal repos
   - Add `/repos/[^/]+/[^/]+/pulls/[0-9]+` — check PR status after creation
   - Add `/repos/[^/]+/[^/]+/actions/runs/[0-9]+` — individual run status
   - Add `/repos/[^/]+/[^/]+/branches(\?.*)?` — check branch existence

2. **Split `github-handoff.ts` into browser and server modules** (required before merge)
   - `services/github-handoff.browser.ts` — `signInWithGitHubPopup`, `buildGitHubLoginUrl`, `signOutGitHub` (browser only)
   - `services/github-api.ts` — `listGitHubRepos`, `createGitHubRepo`, `getGitHubRepo` (Node.js-safe)
   - No browser module imports allowed from `execute()` functions

3. **Specify `github:create_pr` parameter schema** (required before merge)
   - `files: z.array(z.string())` — list of generated artifact paths
   - `branch: z.string().regex(BRANCH_NAME_RE)` — pre-validated
   - `title: z.string().max(255)` — reasonable length
   - PR body generated server-side from `files` list template, not free-form LLM string

4. **Use `tokens: Record<string, string>` on `SessionCtx`** (coordinate with Bender/#479)
   - Prevents scaling issues with multiple provider-specific fields
   - Access as `ctx.session.tokens["github"]`
   - If #479 already merged with `azureToken` flat, file follow-up refactor issue

5. **Agent name confirmation** — DP correctly uses `github.publisher` (matches v2 brief)

**Architecture Notes:** Token isolation design solid (three-layer defence: no-param token, allowlist, GET-only). Skill decomposition clean. Matches pack-azure pattern.

---

### v2 Step 10: Web client A2UI renderer DP Review

**Date:** 2026-04-17  
**Issue:** #485  
**Verdict:** ✅ APPROVE_WITH_CONDITIONS (Leela); 🔴 BLOCKED (Zapp security review)

**Leela Conditions for Implementation:**

1. **Web bootstrap registration ordering is a hard invariant** — pack `register()` calls must run synchronously in `main.tsx` before `ReactDOM.createRoot().render()`. The `useA2UIRegistry()` hook captures registry state at first render via `useMemo([], [])`. Async registration produces empty Map and silent failures.

2. **Bundle-registry is authoritative** — client bundle's sealed registry is the rendering source of truth. `GET /api/packs` response is validation-only, cross-checked at startup to warn (not block) on any unrenderable components.

3. **Fluent `<Dialog>` is correct portal** — `UserActionPanel` uses Fluent's Dialog for portal management, focus trap, and `aria-modal`. No custom `ReactDOM.createPortal` needed.

4. **`APIConnectorContext` NOT deleted** — Grep audit shows 9 active consumers in `catalog/components/`. Annotate `// TODO: remove when last catalog/component/ migrates to a pack`. Deletion deferred to last pack-component migration.

5. **Zapp review of Phase C is mandatory hard gate** — Phase C passes MSAL tokens and GitHub OAuth results through `UserActionPanel.onResolve → POST /api/converse/resume`. Must not merge without Zapp sign-off. Add `needs-zapp-review` label when Phase C PR opens.

6. **Component namespace collision-free** — `pack/PascalName` format with unique pack IDs is the full Map key. No additional namespace protection needed.

**Zapp Critical Blocking Issues:**

| Issue | Requirement |
|-------|------------|
| **Crit1** | Pre-render schema validation required. `propertySchema` must enforce validation before component render; unknown keys stripped; depth ceilings; URL-scheme allowlist for URL props |
| **B1** | `UserActionPanel` confirm must fail closed (visible error + explicit retry/cancel), not synthesize success-like resume on missing renderer |
| **B2** | Credential/resume boundary explicit: browser POST only `{ sessionId, actionId, result }`; result validated server-side against stored schema |
| **B3** | Registry must be immutable startup snapshot (`ReadonlyMap`); exact string lookup only; no dynamic import/eval; fallback visible, not `null` |
| **B4** | Phase D merge must use schema-projected data only; strip dangerous keys (`__proto__`, `prototype`, `constructor`); depth/size limits |

**Outcome:** Requires DP amendment to address Zapp security conditions before re-review.

---

### v2 Step 11: Guardrails Engine DP Review

**Date:** 2026-04-17  
**Issue:** #486  
**Verdict:** ✅ APPROVE_WITH_CONDITIONS

**Architectural Decision:** Test-scaffolded interface supersedes brief. `GuardrailContribution` interface and `GuardrailVerdict` type in test scaffolding are authoritative.

**Superseded (brief):**
```ts
type GuardrailVerdict = { kind: "pass" } | { kind: "block"; reason: string } | { kind: "rewrite"; payload: unknown };
interface GuardrailContribution { check(ctx, payload): Promise<GuardrailVerdict>; }
```

**Adopted (Step 11 + tests):**
```ts
type GuardrailVerdict = 'pass' | 'block' | 'redact';
interface GuardrailResult { verdict: GuardrailVerdict; reason?: string; redacted?: unknown; }
interface GuardrailContribution { name: string; stage: GuardrailStage | GuardrailStage[]; appliesTo?: string | string[]; evaluate(input: GuardrailInput): Promise<GuardrailResult>; }
```

**Merge Conditions:**

1. Brief §Guardrail updated to `evaluate()` shape in same commit
2. 3 existing pack-core guardrails migrated: `pii-filter`, `no-credential-leak`, `validate-artifacts` from `check()` → `evaluate()`
3. `applyRedact()` explicitly defined in `guardrails.ts` for all 3 stages (input, output, tool)

**Rationale:** Test scaffolding already codified `redact` + `evaluate`. Diverging at this stage creates compile-time break.

---

### v2 Step 12: MCP Adapter DP Review

**Date:** 2026-04-17  
**Issue:** #487  
**Verdict (Leela):** ✅ APPROVE_WITH_CONDITIONS  
**Verdict (Zapp):** ✅ APPROVE_WITH_CONDITIONS (follow-up re-check)

**Leela Blocking Conditions:**

1. VS Code `clientInfo` detection before A2UI embedding with plain-text fallback required in code
2. Sticky routing documented in deployment guide (not just DP)
3. `requiresSession` flag added to `ToolContribution` type before Step 12 PR opens
4. Interrupt block format is structured JSON (not human-readable text)

**Zapp Conditions for Step 12 PR Merge:**

1. UserActions never in MCP manifest; MCP returns only structured interrupt (`resumeUrl`, `actionId`, `sessionId`)
2. `connectionId` server-assigned during MCP initialize, bound to session lifetime
3. `mcpExposed` defaults to `false`; explicit allowlist only; FS, credential, `requiresSession` tools permanently excluded
4. MCP inputs use same Zod schemas as web path; buffered output passes output-stage guardrail chain before return
5. Resume single-use, action-bound with CAS clearing, 5-minute TTL/410 expiry, preemptive 409 on no pending interrupt, replay protection enabled
6. Session and interrupt state in-memory only, per-session mutex protection; process restart → 404 on stale resume attempts

**Outcome:** Both security and architecture gates clear with implementation conditions preserved in PR and validated in code/tests.

---

### Step 5 Runner + SSE (PR #550) DP Review

**Date:** 2026-04-17  
**Issue:** #479  
**PR:** #550  
**Verdict:** ✅ APPROVE_WITH_CONDITIONS

**Blocking Condition:**
- `_lastActiveAt` must be first-class `Session` field (not side-channel property). Add `lastActiveAt: number` initialized in constructor, updated by `getOrCreateSession`.

**Architectural Decisions Locked for Steps 6–9:**

1. **Runner/SSE contract:** `Runner` stateless; `Session` carries all mutable state; `SSEWriter` opaque boundary
2. **UserAction interrupt pattern canonical:** `AbortController.abort()` from inside tool's `execute()` handler, with `user_action_req` SSE event emitted first
3. **Resume creates new continuation turn** (not replay): `Runner.resume()` calls `this.run()` with synthetic `[UserAction xxx result]: ...` message. History accumulates in 50-turn sliding window.
4. **HTTP 200 for resume auth failures acknowledged debt:** Pre-stream auth check in `functions/resume.ts` correct shape; defer to Step 6 auth hardening pass
5. **`z.unknown()` stubs in `server-manifest.ts` explicitly temporary:** 18 stubs (5 Fluent + 13 rich) marked TODO; acceptable for this step

---

### Ceremony Workflows Authentication — GitHub App Pattern

**Date:** 2026-04-17  
**Author:** Leela (Lead)  
**Status:** Accepted

**Decision:** Ceremony workflows (`squad-pr-retro.yml`, `squad-release-cadence.yml`) authenticate for `git push` via the `sabbour-squad-lead` GitHub App (appId `3340358`) using `actions/create-github-app-token@v1` with repository secrets `SQUAD_LEAD_APP_ID` and `SQUAD_LEAD_PRIVATE_KEY`.

**Rationale:** `github-actions[bot]` cannot be added as bypass actor in GitHub branch protection rulesets. GitHub Apps can be registered as bypass actors.

**Consequences:**
- Ceremony workflows require `SQUAD_LEAD_APP_ID` and `SQUAD_LEAD_PRIVATE_KEY` repository secrets to be set
- `sabbour-squad-lead` must remain registered as bypass actor in branch protection ruleset
- Future ceremony workflows follow same pattern

---

### Connector Execution Model — Client vs Proxy

**Date:** 2026-04-17  
**Author:** Hermes (via research), Leela (architecture review)

**Decision:** AzureARMConnector always proxies through `/api/arm-proxy` (CORS constraint). GitHubConnector splits: reads direct, writes proxied for token security. Exception: `createPullRequest()` calls `api.github.com` directly — flagged as technical debt.

**Rationale:** 
- ARM management API does not allow browser CORS
- GitHub reads are public/CORS-enabled
- GitHub writes need token isolation
- `createPullRequest()` direct call is known inconsistency to be addressed

**Impact:** Any new connector methods that write data MUST use the server proxy pattern.
