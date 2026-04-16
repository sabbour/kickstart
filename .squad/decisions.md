### 2026-04-15: Removed paths-ignore from CI workflow
**By:** Bender (Backend Dev)
**What:** Removed paths-ignore from .github/workflows/ci.yml so all PRs trigger CI checks, preventing merge deadlocks on docs-only PRs.
**Why:** The protect-main ruleset requires 'Lint, Build & Unit Tests' and 'Playwright E2E Tests', but paths-ignore excluded docs files. Docs-only PRs could never merge.

# Decision: Keep non-runtime files and `bicep-node` out of SWA function startup

**Date:** 2026-04-15T16:06:15Z  
**Author:** Bender (Backend Dev)  
**Status:** Implemented

## Context

The live Static Web App was returning 404 for anonymous API routes like `/api/health` and `/api/github-auth/callback` even though the latest `deploy-swa.yml` run succeeded and the frontend auth layer was still active.

The deploy log for commit `d936a67` showed the API build bundling **18 function entrypoints**. One of those files was `packages/web/api/src/functions/converse.test.ts`, and importing the built `dist/functions/converse.test.js` outside Vitest immediately threw `Vitest mocker was not initialized in this environment`. The same startup sweep also failed when `bicep-node` was inlined into `azure-deployments.js`, throwing `Dynamic require of "os" is not supported`.

## Decision

1. **Exclude test/spec files from API entrypoints** — `packages/web/api/esbuild.config.mjs` must not bundle `*.test.ts` or `*.spec.ts` from `src/functions/`.
2. **Keep `bicep-node` external** — the API bundle must leave `bicep-node` in `node_modules` instead of inlining it into the ESM function entrypoints.

## Why

Azure Functions v4 loads every file matched by the `package.json` `main` glob at startup. Any bundled file that throws during import prevents handler registration for the whole managed API, which shows up at the edge as repo-correct routes returning 404.

## Evidence

- Latest SWA deploy log: `✅ Bundled 18 function(s) to dist/functions/`
- `git ls-tree origin/main packages/web/api/src/functions` included `converse.test.ts`
- Reproduced crash by importing the built test bundle:
  - `Vitest mocker was not initialized in this environment. vi.queueMock() is forbidden.`
- Reproduced crash by importing the bundled Azure deployment entrypoint before externalizing `bicep-node`:
  - `Dynamic require of "os" is not supported`

## Consequences

- Managed Functions startup now only imports real runtime entrypoints.
- Azure deployment routes can still use `bicep-node`, but only through the runtime dependency in `node_modules`.
- Future API tests can stay near the functions code, but the build must continue filtering non-runtime files out of the startup glob.
---

# Decision: Secure ELK ArchitectureDiagram contract

**Date:** 2026-04-15T15:20:24Z
**Author:** Fry (Frontend Dev)
**Status:** Implemented

## Context

Issue #273 needed the real try-aks architecture diagram path: ELK layout, Azure/Kubernetes icons, nested group boundaries, and multiline subtitles. The existing renderer already had safe Mermaid handling, so the key trade-off was how to add the richer visuals without weakening the security posture or shipping fake icon heuristics.

## Decision

1. **`diagram` is the v1 contract.** `ArchitectureDiagram` should prefer raw Mermaid text with nested subgraphs, while `nodes`/`edges` remain a legacy fallback for simple graphs.
2. **Renderer posture stays strict.** Keep `securityLevel: 'antiscript'`, preserve `sanitizeDiagramInput()`, and expand `%%icon:name%%` placeholders only after render with a strict allowlist.
3. **Registry-backed icons or plain text — never fake guesses.** Use the shared adaptive-ui icon registry for supported keys; if a shared icon is missing, render the label without an icon instead of mapping to a local keyword-based placeholder.

## Consequences

- Prompt, schema, catalog, and demo updates should emit `diagram`, `title`, and `description` so the model and demos use the grouped architecture path consistently.
- Reusable renderer helpers live in `packages/web/src/catalog/components/architectureDiagramUtils.ts`.
- Web-only type shims in `packages/web/src/types/` are acceptable when source-published packages expose more TypeScript surface area than the renderer actually needs.

# Hermes Decision — Issue #326 Revision 4 QA Gate

- **Date:** 2026-04-15
- **Issue:** #326
- **Revision Reviewed:** 4 (`#4255575488`)
- **Decision:** APPROVE

## Context
Revision 4 was reviewed specifically against the previously blocked QA concerns: batch validation semantics, mandatory-step failure handling, deterministic rehydration, and the accessibility/regression contract for workspace-only live file streaming.

## QA Decision
Revision 4 makes validation all-or-nothing per step, keeps mandatory-step failures from silently advancing, persists explicit per-step run outcomes for deterministic resume behavior, and keeps accessibility plus regression requirements explicit on the FileManager-first stream.

## Outcome
QA gate is clear for implementation issues #327 and #328 from the testing side.
---

# Decision: Issue #271 — Real flow termination with project download

**Date:** 2026-04-15T08:39:29.427Z
**Author:** Leela (Lead)
**Issue:** #271 — Deployment flow is blocked
**Status:** Proposed
**Supersedes:** `leela-271-deployment-flow.md` (demo-only stopgap)

## Problem

The onboarding flow enters HANDOFF (Step 5) and DEPLOY (Step 6) phases
that have no working backend. Users see fake "repo created" cards, "Deploy
now" buttons, and sign-in prompts that lead nowhere. The flow is a dead end.

**Corrected root cause:** The issue claims AuthCard is unregistered. That is
wrong — AuthCard is fully registered in the React catalog, component-catalog,
and a2ui-schema. The real problem is the flow reaches phases that pretend
work is happening when there is no backend to execute it.

## What Actually Exists (Infrastructure Audit)

| Capability | Status | Evidence |
|------------|--------|----------|
| Phase engine (state machine) | ✅ Real | `engine/machine.ts` — `transition()` handles ADVANCE, SKIP, PHASE_COMPLETE |
| LLM conversation | ✅ Real | `/api/converse` → Azure OpenAI, phase-aware prompt injection |
| File generation | ✅ Real | LLM generates files → VirtualFS (IndexedDB) + VirtualFileSystem (memory) |
| ZIP export | ✅ Real | `VirtualFS.exportZip()` via JSZip, buttons in FileTreePanel + FileManagerSidebar |
| SWA AAD auth | ✅ Real | `/.auth/me`, `/.auth/login/aad` — fully functional |
| AuthCard component | ✅ Real | Renders, handles sign-in/sign-out, falls back to stub mode gracefully |
| DeploymentProgress component | ✅ Real | Renders step tracker with status icons |
| GitHub connector | ⚠️ Scaffolded | `createRepo()`, `listUserRepos()` exist but no token provider is wired |
| GitHub OAuth proxy | ⚠️ Scaffolded | `/api/github-oauth` Azure Function exists, proxies device flow to github.com |
| GitHub OAuth App | ❌ Missing | No `GITHUB_CLIENT_ID` in any config, env, or secret reference |
| GitHub file push | ❌ Missing | `GitHubConnector` has no `pushTree()`/`createCommit()` method |
| Azure ARM connector | ⚠️ Scaffolded | Real ARM methods exist but no MSAL token provider is wired |
| Azure deployment | ❌ Missing | No resource provisioning logic anywhere |

## Options Evaluated

### Option A: Wire GitHub OAuth + create repo + push files
- Wire `/api/github-oauth` to GitHubLoginCard (real device codes)
- Add `setTokenProvider()` in web layer after token acquisition
- Add `pushTree()` to GitHubConnector (GitHub Trees/Blobs API)
- Make HANDOFF real, remove DEPLOY

**Verdict: BLOCKED.** No GitHub OAuth App is registered — no `GITHUB_CLIENT_ID`
exists in any config or secret. The device flow proxy exists but has no app to
authenticate against. This is infrastructure work (register OAuth App, store
secrets in SWA, configure scopes) that must happen before code changes.

### Option B: End at REVIEW with real project download
- Make REVIEW the terminal phase in the engine (`nextPhase: null`)
- System prompt ends with "Your project is ready — download your files"
- LLM shows completion summary with download CTA
- Users get their actual LLM-generated files as a ZIP
- Remove HANDOFF + DEPLOY from prompt and demo scenarios

**Verdict: SHIP THIS.** Every piece is real and working. No fake data, no stubs.
The user walks away with actual deployment artifacts generated by the LLM.

### Option C: Full Azure deployment
**Verdict: WAY TOO BIG.** ARM provisioning = resource groups, ACR, AKS, networking,
OIDC federation. Not an issue-271 fix.

## Decision: Ship Option B, file follow-up for Option A

### What #271 delivers (real, functioning)

The onboarding flow completes at REVIEW with a **"Your Project Is Ready"**
experience. The user downloads their generated files as a ZIP. Every step in
the flow (discover → design → generate → review → download) is backed by real
code — no fake data, no placeholder URLs, no pretend deployments.

### Changes required (5 files, ordered)

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `packages/core/src/engine/phases.ts` | Set Review `nextPhase: null` (was `Phase.Handoff`). | Engine formally ends at REVIEW. Machine sets `isComplete: true`. |
| 2 | `packages/core/src/prompts/system-prompt.ts` | **Remove** STEP 5 (HANDOFF) and STEP 6 (DEPLOY). **Rewrite** STEP 4 (REVIEW) as terminal: after approval, show "Your Project Is Ready" Card with Markdown summary of generated files + a primary Button labeled "Download project" with action `{"event":{"name":"download-project"}}`. **Remove** Example 6 (handoff). **Update** Example 5: replace "Approve and continue to handoff" with completion summary + download CTA. **Add guardrail** in section 2: "The flow ends at REVIEW. Do not enter handoff or deploy phases — they are not yet implemented. After the user approves the review, show a session-complete summary and direct them to download their project files." |
| 3 | `packages/web/src/services/demo-scenarios.ts` | **Replace** `HANDOFF` const with a `SESSION_COMPLETE` response: success Badge, file-count summary, "Download project" Button (action: `download-project`), Accordion with next-steps (clone, customize, deploy later). **Remove** `DEPLOY_PROGRESS` const. **Update** `scenarioFlow` array: end at `SESSION_COMPLETE` (drop DEPLOY_PROGRESS). **Update** SCENARIOS keyword routing: remove deploy/handoff matchers, add `complete\|done\|finish\|download` → SESSION_COMPLETE. **Update** CONFIGURE_FORM: ProgressSteps "Deploy" label → "Review". |
| 4 | `packages/web/src/App.tsx` | Wire the `download-project` A2UI action event to the existing `handleDownloadZip` callback. When the chat receives a button click with event name `download-project`, call `handleDownloadZip()`. |
| 5 | `packages/core/src/engine/types.ts` | No code change needed — `Phase.Handoff` and `Phase.Deploy` enum values stay (they may be referenced in tests/playground). Add a TSDoc comment: `/** @deprecated Not yet implemented — flow ends at Review. */` to Handoff and Deploy. |

### Follow-up issue (file after #271 ships)

**Title:** "feat: Wire real GitHub OAuth handoff — device flow + repo creation + file push"
**Scope:**
1. Register a GitHub OAuth App, store `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in SWA app settings
2. Wire `GitHubLoginCard` to call `/api/github-oauth/login/device/code` for real device codes
3. Add `setTokenProvider()` integration: after token exchange, inject token into GitHubConnector
4. Add `pushTree(owner, repo, files)` to `GitHubConnector` using GitHub Git Trees/Blobs API
5. Re-enable HANDOFF phase in system prompt with real capabilities
6. Consider: should HANDOFF become a second terminal phase (Review OR Handoff), or always flow through?
**Blocked by:** GitHub OAuth App registration (infra/ops task for Ahmed)

### Defer (do NOT touch in #271)

- **AuthCard / GitHubLoginCard** — work correctly, keep for future OAuth.
- **DeploymentProgress** — works correctly, reusable for future deploy phase.
- **a2ui-schema.ts / component-catalog.ts** — no changes needed.
- **playground-scenarios.ts** — separate component showcase, not user-facing flow.
- **Phase enum values** (Handoff, Deploy) — keep in enum, mark deprecated.

## Acceptance Bar

1. **End-to-end flow works:** Discover → Design → Generate → Review → "Your Project Is Ready" → Download ZIP.
2. **ZIP contains real files:** Generated by the LLM (not placeholder content). In demo mode, contains the demo file set.
3. **No dead ends:** Every screen has an action the user can take.
4. **No fake data:** No "github.example.com", no "7 resources provisioned", no "Created repo" badges for repos that don't exist.
5. **Engine state:** After review approval, `isComplete === true`.
6. **Tests pass:** `npm run build && npm test` green.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `download-project` event not caught by existing action handler | Medium | Medium — button click does nothing | Wire explicitly in App.tsx; fall back to opening FileTreePanel if VFS is empty |
| LLM still tries to enter handoff despite guardrail | Low | Low — user sees unrendered phase | Engine `nextPhase: null` prevents machine from advancing past review regardless of LLM output |
| Demo scenarios reference removed constants | Low | High — build break | Search for all HANDOFF/DEPLOY_PROGRESS references before removing |

## Needs Sign-Off

- **Ahmed Sabbour** — confirm "download project" is acceptable as #271 scope; confirm GitHub OAuth App registration goes into a follow-up issue.
---

# Decision: Issue #271 — Ship complete flow with real project delivery

**Date:** 2026-04-15T08:39:29.427Z
**Author:** Leela (Lead)
**Issue:** #271 — Deployment flow is blocked
**Status:** Proposed
**Supersedes:** `leela-271-deployment-flow.md` (v1), `leela-271-deployment-flow-v2.md` (v2)

---

## 1. Why v1 and v2 Were Insufficient

v1 proposed removing fake screens. v2 proposed ending at Review with ZIP
download. Both are defensible but fall short of "fully functional, ship-ready."
They treat #271 as damage control. This v3 treats it as a product release.

## 2. Functional Scope #271 Must Deliver

**A complete, working Kickstart flow where every step produces real output
and the user walks away with a real deliverable.**

```
DISCOVER → DESIGN → GENERATE → REVIEW → PROJECT DELIVERY
```

| Step | What Happens | Real? |
|------|-------------|-------|
| DISCOVER | LLM asks about app type, runtime, existing code | ✅ Real (Azure OpenAI) |
| DESIGN | LLM proposes architecture, cost estimate | ✅ Real (Pricing API for costs) |
| GENERATE | LLM generates Dockerfile, manifests, CI/CD, app code | ✅ Real (stored in VirtualFS/IndexedDB) |
| REVIEW | Architecture recap, cost recap, best-practice audit | ✅ Real |
| PROJECT DELIVERY | User downloads ZIP of generated files | ✅ Real (JSZip exportZip()) |

**What gets removed:** HANDOFF (Step 5) and DEPLOY (Step 6) — the two phases
with zero working backend.

**Why this is not a stopgap:** This is the product. A guided project generator
that gives you deployment-ready files. The same model as `create-react-app`,
`yo`, Spring Initializr. The flow is complete, every step is backed by real
infrastructure, and the user gets a real deliverable.

## 3. What Exists vs. What's Missing

### Already built and working

| Capability | Location | Status |
|------------|----------|--------|
| Phase state machine | `core/engine/machine.ts` | ✅ `transition()` handles ADVANCE, sets `isComplete` when `nextPhase === null` |
| LLM conversation backend | `web/api/functions/converse.ts` | ✅ Azure OpenAI with phase-aware prompt |
| File generation + storage | `web/services/virtual-fs.ts` | ✅ VirtualFS (IndexedDB) + VirtualFileSystem (memory) |
| ZIP export | `VirtualFS.exportZip()` + JSZip | ✅ Used by FileTreePanel + FileManagerSidebar |
| Download handler | `App.tsx:386-398` (`handleDownloadZip`) | ✅ Creates blob URL, triggers download |
| Action dispatch system | `hooks/useActionDispatch.ts` | ✅ Prefix-based routing: reply, navigate, auto-continue, api |
| A2UI component catalog (28 components) | `core/prompts/component-catalog.ts` | ✅ All registered, including AuthCard + DeploymentProgress |
| Phase indicator UI | `converse.ts:237-248` | ✅ Shows all phases with status |
| Demo scenario engine | `web/services/demo-scenarios.ts` | ✅ Keyword matching + sequential flow |

### Missing (must build in #271)

| Gap | What to Build | Effort |
|-----|--------------|--------|
| Review is not terminal | Set `Review.nextPhase = null` in `phases.ts` | 1 line |
| System prompt goes past Review | Remove STEP 5/6, add completion CTA to STEP 4 | Medium (prompt editing) |
| No `client:` action prefix | Add `client:` category to `useActionDispatch.ts` for client-side actions (download, open panel) | ~15 lines |
| App.tsx not wired for client actions | Add `onClientAction` callback to useActionDispatch options | ~10 lines |
| Demo scenarios show fake handoff/deploy | Replace HANDOFF + DEPLOY_PROGRESS with SESSION_COMPLETE | Medium |
| Tests assert 6-phase chain | Update to 4-phase chain (Discover→Design→Generate→Review) | 3 test files |
| Review example button says "continue to handoff" | Change to "Download your project" with `client:download-project` action | 1 change in prompt |

### Not in #271 (follow-up issues)

| Feature | Blocker | Follow-Up |
|---------|---------|-----------|
| GitHub OAuth handoff | No `GITHUB_CLIENT_ID` registered anywhere. `/api/github-oauth` proxy exists but has no OAuth App to authenticate against. GitHubConnector has `createRepo()` but no `pushTree()` for multi-file commits. | New issue: register OAuth App (infra), implement pushTree, wire device flow |
| Azure ARM deployment | No MSAL token provider wired. AzureARMConnector methods exist but return stubs. No resource provisioning logic. | Future milestone |

## 4. Implementation Sequence

### Bender (backend + engine): Changes 1-3

**Change 1: `packages/core/src/engine/phases.ts`**
- Line 80: Change `nextPhase: Phase.Handoff` → `nextPhase: null`
- This makes Review the terminal phase. When the engine ADVANCEs from Review,
  `machine.ts:49-53` sets `isComplete = true`.
- Keep Handoff and Deploy phase definitions in the array (tests/playground
  reference them, and they'll be re-enabled when infra is ready).

**Change 2: `packages/core/src/prompts/system-prompt.ts`**
- Remove STEP 5 (HANDOFF, ~lines 147-150) and STEP 6 (DEPLOY, ~lines 152-156).
- Rewrite STEP 4 (REVIEW) as the terminal step. After the user approves:
  - Show "Your Project Is Ready" Card with:
    - Success Badge
    - Markdown summary of generated files
    - Primary Button: "Download project" with action
      `{"event":{"name":"client:download-project","context":{"label":"Download project"}}}`
    - Accordion with next steps: "Run locally", "Push to GitHub manually", "Deploy later"
  - Set `phaseComplete: true` so the engine marks the conversation complete.
- Add guardrail in section 2 (conversation flow): "The flow ends at REVIEW.
  After the user approves, show a project-complete summary with a download
  action. Do not enter handoff or deploy phases."
- Remove Example 6 (handoff repo picker, ~line 290-291).
- Update Example 5 (review): Replace "Approve and continue to handoff" button
  with completion summary + download CTA using `client:download-project`.
- In section 2a (ARCHITECT MINDSET, line 167): soften "MUST include a GitHub
  Actions workflow" to "SHOULD include a CI/CD workflow" since we're not
  pushing to GitHub yet.

**Change 3: `packages/core/src/engine/types.ts`**
- Add TSDoc deprecation markers to Handoff and Deploy enum members:
  ```typescript
  /** @deprecated Not yet implemented — flow currently ends at Review. */
  Handoff = "handoff",
  /** @deprecated Not yet implemented — flow currently ends at Review. */
  Deploy = "deploy",
  ```

### Fry (frontend): Changes 4-6

**Change 4: `packages/web/src/hooks/useActionDispatch.ts`**
- Add `client:` prefix to PREFIX_MAP (line 26-31):
  ```typescript
  'client:': 'client',
  ```
- Add `'client'` to ActionCategory type (line 23).
- Add `onClientAction` to ActionDispatchOptions (line 115-135):
  ```typescript
  /** Callback for client-side actions (download, open panel, etc.). */
  onClientAction?: (operation: string, context: Record<string, unknown>) => void;
  ```
- Add case in switch (after line 325):
  ```typescript
  case 'client': {
    consecutiveRef.current = 0;
    setConsecutiveAutoContinueCount(0);
    const operation = action.name.replace(/^client:/, '');
    const safeContext = sanitizeActionContext(action.context);
    logDebug(operation);
    optionsRef.current.onClientAction?.(operation, safeContext);
    break;
  }
  ```

**Change 5: `packages/web/src/App.tsx`**
- Wire `onClientAction` in the `useActionDispatch` call (~line 53-58):
  ```typescript
  onClientAction: (operation) => {
    if (operation === 'download-project') {
      handleDownloadZip();
    }
  },
  ```
- This connects the LLM's "Download project" button directly to the existing
  `handleDownloadZip()` (line 386-398) which calls `vfs.exportZip()`.

**Change 6: `packages/web/src/services/demo-scenarios.ts`**
- Replace `HANDOFF` const (line 225-264) with `SESSION_COMPLETE`:
  ```typescript
  const SESSION_COMPLETE: DemoResponse = {
    text: "Your project is ready! All files have been generated...",
    phase: 'review',
    model: 'gpt-5.3-chat',
    typingDelay: 1400,
    a2uiMessages: surface('complete-surface', [
      // Success card with Badge, file summary, download button, next-steps accordion
    ]),
  };
  ```
- Remove `DEPLOY_PROGRESS` const (line 266-312).
- Update `scenarioFlow` (line 442): Replace `HANDOFF, DEPLOY_PROGRESS` with
  `SESSION_COMPLETE`. Final array:
  `[ARCHITECTURE, DESIGN_DETAIL, CONFIGURE_FORM, CODE_PREVIEW, FILE_GENERATION, REVIEW_EXPANDED, SESSION_COMPLETE]`
- Update SCENARIOS keyword routing (line 404-413):
  - Remove: `{ match: /deploy|ship|launch|go live/i, response: DEPLOY_PROGRESS }`
  - Remove: `{ match: /handoff|github|repo|push|codespace/i, response: HANDOFF }`
  - Add: `{ match: /complete|done|finish|download|ready/i, response: SESSION_COMPLETE }`
- Update CONFIGURE_FORM ProgressSteps (line 325): "Deploy" → "Review".

### Bender or Fry: Change 7

**Change 7: Update tests (3 files)**

a) `packages/core/src/__tests__/machine.test.ts`
- Lines 41-56: Update ADVANCE chain test. After Review ADVANCE, expect
  `isComplete === true` (not transition to Handoff).
- Lines 150-176: Update full journey test. Chain is now 4 phases:
  Discover → Design → Generate → Review → isComplete.

b) `packages/core/src/__tests__/phases.test.ts`
- Lines 52-63: Update phase chain test. Review should have
  `nextPhase === null`. Handoff/Deploy still exist in definitions but are
  no longer in the active chain.
- Line 60: "last phase (Deploy) has nextPhase = null" → update assertion
  to also verify Review has nextPhase = null.

c) `packages/mcp-server/src/__tests__/action.test.ts`
- Lines 156-171: Update full journey test. Advance through 4 phases
  (Discover → Design → Generate → Review), verify isComplete after Review.

## 5. Risks and Blockers

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | LLM ignores guardrail and tries to enter Handoff despite prompt changes | Low | Low | Engine enforces: Review.nextPhase=null means machine cannot advance past Review regardless of LLM output. Defense in depth. |
| R2 | `client:download-project` action not fired because Button schema doesn't support `client:` prefix | Low | High | Verify A2UI action schema accepts any string for event name (it does — ActionSchema uses z.string()). Test E2E. |
| R3 | VirtualFS empty when user clicks download (no files generated in demo mode) | Medium | Medium | Check `vfs.list().length > 0` before triggering download. If empty, show toast/message "No files to download." |
| R4 | Existing test suites fail after phase chain change | Certain | Low | Changes 7a-7c update all affected tests. No E2E tests walk past Review (confirmed by audit). |
| R5 | Playground scenarios (`playground-scenarios.ts`) reference Deploy | Low | None | Playground is a component showcase, not the user flow. Deploy references there are fine — they demo the DeploymentProgress component. |
| R6 | `phaseComplete: true` from LLM after Review triggers unexpected UI behavior | Low | Medium | Verify client handles `isComplete` gracefully. Phase indicator should show "Complete" state. |

**Hard blocker: None.** All infrastructure exists. This is a wiring + prompt task.

## 6. Acceptance Bar

1. **Complete flow E2E**: Discover → Design → Generate → Review → "Your Project Is Ready" → click "Download project" → ZIP downloads with generated files.
2. **Demo mode works**: Sequential scenario flow reaches SESSION_COMPLETE, download button fires.
3. **No dead ends**: Every screen has an actionable next step.
4. **No fake data**: Zero instances of "github.example.com", "7 resources provisioned", "my-awesome-app" fake repo URLs, or "Deploy now" buttons.
5. **Engine state correct**: After Review approval, `engineState.isComplete === true`.
6. **All tests green**: `npm run build && npm test` pass, including updated phase chain tests.
7. **Guardrail holds**: LLM prompt explicitly prevents entering Handoff/Deploy; engine enforces mechanically via `nextPhase: null`.
---

# Decision: Stop the flow before handoff/deploy — Issue #271

**Date:** 2026-04-15T08:39:29.427Z
**Author:** Leela (Lead)
**Issue:** #271 — Deployment flow is blocked
**Status:** Proposed

## Problem

The onboarding flow enters HANDOFF (STEP 5) and DEPLOY (STEP 6) phases
that have **no backend implementation**. Users see fake "repo created" cards,
"Deploy now" buttons, and AuthCard sign-in prompts that lead nowhere.
This is a dead end — the demo cannot proceed past file generation.

The issue text claims AuthCard is unregistered. **That is wrong.** AuthCard
exists in the React catalog, component-catalog, and a2ui-schema. It renders
fine. The problem is the flow reaches phases that pretend real work is
happening when it is not.

## Root Causes

1. **System prompt instructs LLM to enter unimplemented phases.**
   STEP 5 (HANDOFF) and STEP 6 (DEPLOY) describe GitHub repo creation
   and Azure deployment flows backed by no real service.
2. **Demo scenarios include HANDOFF and DEPLOY_PROGRESS responses.**
   Fake repo URLs, fake "7 resources provisioned" progress, and "Deploy now"
   buttons that fire events no handler catches.
3. **Review example ends with "Approve and continue to handoff"**
   leading directly into the dead end.
4. **CONFIGURE_FORM ProgressSteps** includes a "Deploy" step label
   that implies deployment exists.

## Decision: End the flow at REVIEW

### Ship now (3 changes)

| # | File | Change |
|---|------|--------|
| 1 | `packages/core/src/prompts/system-prompt.ts` | Remove STEP 5 (HANDOFF) and STEP 6 (DEPLOY) from the conversation flow. Make REVIEW the terminal step. Replace the "Approve and continue to handoff" button in Example 5 with a "Session complete" summary. Remove Example 6 (handoff). Add an explicit guardrail: the LLM must NOT enter handoff or deploy phases. |
| 2 | `packages/web/src/services/demo-scenarios.ts` | Replace HANDOFF with a "Session Complete" summary (no fake repo/deployment). Remove DEPLOY_PROGRESS. Update `scenarioFlow` to end at REVIEW_EXPANDED. Remove keyword routing for deploy/handoff to fake screens. Remove the "Deploy" step from CONFIGURE_FORM ProgressSteps. |
| 3 | `packages/web/src/services/demo-scenarios.ts` | In CONFIGURE_FORM, change ProgressSteps "Deploy" to "Review" so the step tracker does not promise deployment. |

### Defer (do NOT touch)

- **AuthCard component** — works correctly, keep for future Azure auth.
- **DeploymentProgress component** — works correctly, keep for future use.
- **a2ui-schema.ts / component-catalog.ts** — no changes needed.
- **playground-scenarios.ts** — separate concern; many deploy references,
  but it's a component playground, not the user-facing onboarding flow.

## Acceptance Bar

1. Walk through the demo flow end-to-end. After REVIEW, the user sees a
   "session complete" summary with next steps (not handoff/deploy).
2. No "Deploy now", "Open in Codespaces", or fake repo cards appear.
3. The LLM never enters handoff/deploy phases (verified by prompt guardrail).
4. All existing tests pass (`npm run build && npm test`).

## Consequences

- Users can complete the demo without hitting a dead end.
- Deployment/handoff features can be re-added when backend support exists
  (AuthCard, DeploymentProgress, and schema entries remain intact).
- The system prompt shrinks slightly, reducing token spend per request.

## Needs Sign-Off

- **Ahmed Sabbour** — product scope confirmation (ending at review is acceptable).
---

# Decision: E2E Demo Sprint Plan — No Faking, No Mocking

**Date:** 2026-04-15T09:34:03.404Z
**Updated:** 2026-04-15T09:34:03.404Z
**Author:** Leela (Lead)
**Status:** Active (v3 — scope expanded per Ahmed directive)
**Scope:** Sprint plan for making Kickstart end-to-end demo ready with real integrations

---

## Goal

A user walks through Kickstart from "describe your app" through file generation, GitHub repo creation, and Azure deployment — **zero fakes, zero mocks, zero dead ends.** Full pipeline, all real.

## Scope (Revised)

~~**v1 scope trade:** Demo ended at PR creation. Azure bits deferred.~~

**v3 scope (current):** Full E2E including Azure auth and deployment. Ahmed's directive: "include the Azure bits too." The GitHub OAuth App now exists — #274 is unblocked. No more external blockers.

**Demo flow target:**
```
DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF (GitHub) → DEPLOY (Azure)
```

Every phase backed by real infrastructure. Handoff/Deploy re-enabled conditionally (only when auth tokens are present).

---

## What Already Shipped / Ships Now

### PR #297 — Ship Immediately (Option A)

| Closes | What it does |
|--------|-------------|
| **#271** | Makes Review terminal (`nextPhase = null`), adds `client:download-project` action routing, wires ZIP download. No more dead-end screens. |
| **#269** | Prompt guardrail: LLM cannot hallucinate "repo created" cards. Engine prevents reaching Handoff/Deploy. |

**Action:** Merge PR #297 now. It's the safety net — users get a clean flow even before GitHub/Azure integration lands. Handoff/Deploy phases are deprecated but retained in code, ready for conditional re-enablement.

---

## Priority Tiers

### TIER 1 — Foundation (blocks everything else)

| # | Issue | Type | Why it's first |
|---|-------|------|----------------|
| 1 | **PR #297** | Fix (critical) | Merge now. Stops the dead-end flow. Closes #271, #269. Foundation for everything below. |
| 2 | **#298** — Chat surface ownership + phase bar regression | Bug (critical) | Surfaces mutate earlier turns, phase bar doesn't render. Every other issue touches chat rendering. |

### TIER 2 — Demo Spine (the real flow)

| # | Issue | Type | Depends on | Why this order |
|---|-------|------|------------|----------------|
| 3 | **#275** — Progressive conversation flow | Feature (critical) | #298 | The wizard skeleton. One-step-at-a-time pacing, phase state tracking. Must work for both current 4-phase flow AND future 6-phase flow when Handoff/Deploy re-activate. |
| 4 | **#274** — GitHub OAuth + real repo flow | Feature (high) | #298 | **UNBLOCKED — OAuth App exists.** Real sign-in, org selection, repo creation, file commit, PR. Re-enables Handoff phase conditionally. Needs Zapp security review. |
| 5 | **NEW** — Azure MSAL auth + AKS deployment flow | Feature (high) | #274 | Azure device-code/browser auth via MSAL. ARM API calls for AKS Automatic provisioning. Re-enables Deploy phase conditionally. **Needs issue creation.** Needs Zapp security review. |

**The #269/#271/#274 cluster is now resolved:** #269 and #271 closed by PR #297. #274 stands alone as real GitHub integration (unblocked).

### TIER 3 — Demo Polish (parallel track)

| # | Issue | Type | Depends on | Notes |
|---|-------|------|------------|-------|
| 6 | **#265** — File manager experience | Feature | #298 | Wire generated files into FileManagerSidebar, compact file list in chat. |
| 7 | **#300** — Architecture diagram prompt-layer depth | Feature | none | Prompt-only fix: AKS subgraphs, ACR, Key Vault, Gateway. Quick win, ships before #273. |
| 8 | **#273** — Architecture diagram (ELK + icons) | Feature | none | ELK layout engine, Azure icons, zoom. Benefits from #300 landing first. |
| 9 | **#299** — Debug action-event placement | Bug | none | Move debug output to separate panel. Quick fix. |
| 10 | **#296** — Subtitle 1 title sweep | Bug | none | Typography normalization across 11 components. Quick fix. |

### TIER 4 — Deferred (after E2E works)

| # | Issue | Type | Why defer |
|---|-------|------|-----------|
| 11 | **#272** — Live Azure pricing | Feature | "Not a demo blocker" per issue. Estimated pricing acceptable for demo. |
| 12 | **#277** — Session token/cost tracker | Feature | "Not a blocker" per issue. Nice-to-have for cost demos. |

---

## Dependency Graph

```
PR #297 (merge now) ─── closes #271, #269
  │
#298 (surface ownership)
  ├── #275 (progressive flow) ──────────────────┐
  ├── #274 (GitHub OAuth — UNBLOCKED) ──────────┤── re-enable Handoff
  ├── #265 (file manager)                       │
  │                                             ├── NEW: Azure MSAL + AKS deploy
  │                                             │        ── re-enable Deploy
  #300 (arch diagram prompt) ── lands before ── #273 (arch diagram ELK)
  #299 (debug placement) ──────(independent)
  #296 (subtitle sweep) ───────(independent)
```

## Parallel Tracks

After #297 merges and #298 lands:

- **Track A (Wizard Flow):** #275 — Bender (prompt/backend) + Fry (frontend). Must design phase state to support conditional 4-phase or 6-phase flow.
- **Track B (GitHub):** #274 — Bender (OAuth service, device flow, pushTree, GitHubConnector) + Fry (A2UI components: GitHubLoginCard, AccountSelector, RepoForm, CommitCard, PRCard) + Zapp (security review). Re-enables Handoff phase.
- **Track C (Azure):** NEW — Bender (MSAL auth, ARM provisioning API, AKS Automatic resource creation) + Fry (AuthCard for Azure, DeploymentProgress with real status) + Zapp (security review). Re-enables Deploy phase.
- **Track D (Polish):** #300, #265, #273, #296, #299 — interleaved with Tracks A–C.

Tracks B and C can run in parallel once #298 and #275 are stable. Track C depends on Track B patterns (auth flow established by GitHub OAuth informs Azure auth structure).

---

## Execution Plan — Squad Assignment

### Phase 0: Ship Now

| Item | Assignee | Work |
|------|----------|------|
| **Merge PR #297** | **Leela** (approve) | Merge Option A. Review terminal, download action, prompt guardrails. Closes #271, #269. |

### Phase 1: Foundation (Day 1)

| Issue | Assignee | Work |
|-------|----------|------|
| **#298** | **Fry** | Fix surface ownership in useA2UI/useStreaming, restore phase bar rendering, turn-scoped surface IDs |
| **#300** | **Bender** | Prompt-layer depth fix: system-prompt.ts, component-catalog.ts, demo-scenarios.ts. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui` |
| **#296** | **@copilot** (Fry reviews) | Subtitle 1 sweep — 11 files, mechanical. |
| **#299** | **@copilot** (Fry reviews) | Debug panel extraction — small, well-scoped. |

### Phase 2: Core Flow (Day 1–2, starts when #298 merges)

| Issue | Assignee | Work |
|-------|----------|------|
| **#275** | **Bender** (prompt + backend phase state) + **Fry** (frontend phase UI) | Progressive flow with phase state machine that supports conditional 4→6 phase expansion. Design phase transitions so Handoff/Deploy activate when auth tokens are present. |
| **#274** | **Bender** (OAuth device flow, GitHub API service, GitHubConnector.pushTree) + **Fry** (GitHubLoginCard, AccountSelector, RepoForm, CommitCard, PRCard) | Full GitHub OAuth integration. Wire real device codes. Create repos, commit files, open PRs. Re-enable Handoff phase conditionally. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui`. **Zapp must review before merge.** |
| **#265** | **Fry** | Wire VirtualFS → FileManagerSidebar, compact file cards in chat, progress card rename |

### Phase 3: Azure Integration (Day 2–3, starts when #274 patterns are established)

| Issue | Assignee | Work |
|-------|----------|------|
| **NEW: Azure auth + deploy** | **Bender** (MSAL device-code auth, ARM REST API for AKS Automatic, deployment status polling) + **Fry** (AuthCard Azure rendering, DeploymentProgress real status) | Azure MSAL auth flow. AKS Automatic cluster + ACR provisioning via ARM. Re-enable Deploy phase conditionally. Follow auth patterns from #274. **Zapp must review before merge.** |
| **#273** | **Fry** (continued) | Finish ELK diagram. #300 should be merged by now. Ref: `/mnt/c/Users/asabbour/Git/adaptive-ui` |

### Phase 4: Convergence + Ship (Day 3–4)

| Task | Assignee |
|------|----------|
| E2E test: full 6-phase flow (Discover → Deploy) | **Hermes** |
| Security review: #274 OAuth + Azure MSAL + ARM calls | **Zapp** |
| Conditional flow test: 4-phase (no auth) vs 6-phase (auth present) | **Hermes** |
| Final architecture review | **Leela** |
| Release cut | **Bender** |

---

## Key Decisions

1. **PR #297 ships now** — immediate safety net, closes #271 and #269.
2. **Full E2E through Azure deployment is IN SCOPE** — scope trade reversed per Ahmed directive.
3. **GitHub OAuth App exists** — #274 has no external blockers. Remove registration risk.
4. **Azure auth/deploy needs a new issue** — Leela or Ahmed should create it, scoped to: MSAL auth, ARM provisioning, Deploy phase re-enablement.
5. **Handoff/Deploy re-enabled conditionally** — phases activate only when auth tokens are present. 4-phase flow remains the default for unauthenticated users.
6. **#275 must design for 6 phases** — progressive flow should account for the full pipeline, not just 4 phases.
7. **#274 patterns inform Azure auth** — GitHub OAuth device flow establishes the auth UX pattern; Azure MSAL follows the same structure.
8. **#272 and #277 remain deferred** — not demo blockers.
9. **#296 and #299 are coding agent candidates** — mechanical, well-scoped, Fry reviews.
10. **Zapp mandatory on #274 AND Azure auth** — both are security boundary crossings.
11. **Try-AKS reference:** `/mnt/c/Users/asabbour/Git/adaptive-ui` for #273, #274, #275, #300, and Azure auth reference.

---

## Issue Hygiene — Action Items

| Action | Owner |
|--------|-------|
| Merge PR #297 | Ahmed / Leela |
| Create issue: "Azure MSAL auth + AKS Automatic deployment flow" | Leela (recommend) |
| Update #274 description: remove "blocked by OAuth App registration" note | Leela |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ~~GitHub OAuth App registration missing~~ | ~~N/A~~ | ~~N/A~~ | **RESOLVED — App exists.** |
| SWA auth proxy needs config for GitHub OAuth callback | Medium | High — blocks #274 | Bender investigates SWA auth config in Phase 2 day 1. Fallback: SWA built-in GitHub auth provider. |
| Azure MSAL + ARM provisioning is larger than 1 sprint | Medium | Medium | Scope to AKS Automatic only (no custom clusters). Use ARM REST directly (no Terraform/Bicep in-app). Provisioning can be fire-and-forget with status polling. |
| Progressive flow prompt changes break existing scenarios | Medium | Medium | Hermes runs regression tests after #275. Iterative prompt changes. |
| ELK layout engine (#273) larger than estimated | Low | Low — not on critical path | Ship without ELK; Mermaid is functional. |
| Surface ownership fix (#298) has deeper root cause | Low | High — blocks everything | Fry has context from #182. Escalate to pair debugging if stuck > 1 session. |
| Conditional phase activation adds state complexity | Medium | Medium | Keep it simple: check for auth token presence at phase boundary. No complex feature flags. |

---

## Success Criteria

A human can:
1. Open Kickstart, describe an app
2. See progressive guided conversation (one step at a time)
3. See generated files in file manager sidebar (not dumped as code blocks)
4. See architecture diagram with AKS subgraphs, ACR, Key Vault, Gateway
5. Sign in to GitHub with real OAuth
6. Select a real org, create a real repo, commit files, create a PR
7. Sign in to Azure with real MSAL auth
8. Provision AKS Automatic cluster + ACR via ARM
9. See real deployment status (not fake progress cards)
10. **Without auth:** Flow ends at Review with project download (PR #297 baseline)
11. **With auth:** Full 6-phase flow through deployment
12. Zero fake cards, zero dead ends, zero hallucinated success messages
---

# Sprint Planning Ceremony — v0.6.1 (E2E Demo Ready)

**Date:** 2026-04-15T10:11:35.848Z
**Facilitator:** Leela (Lead)
**Trigger:** Manual — Ahmed flagged overdue sprint-start ceremony
**Sprint goal:** Burn down all 15 open issues. Ship Kickstart E2E demo with no faking or mocking.

---

## 1. Board Drift — Where Process Broke Down

| Gap | Impact |
|-----|--------|
| **12 of 15 issues had no milestone** | Ralph can't burn down what isn't assigned to a sprint. No velocity tracking possible. |
| **All issues had `go:needs-research` label** | Even in-flight work (#298, #299, #274) was still flagged as needing research. Label is meaningless if never cleared. |
| **No priority labels on 11 of 15 issues** | Only #298, #299, #296, #301 had priority labels. Everyone guessed what was important. |
| **#271 and #269 still open** | PR #297 closes both but wasn't merged. Two issues sitting open that have a ready fix. |
| **No time estimates** | Ceremony requires calibrated estimates. We have none. Accepting this gap for now — estimate by T-shirt size below. |
| **v0.6.0 milestone stale** | Only #46 (multi-week MCP epic) open on it. 2 issues closed. Milestone is functionally dead for this sprint. |

**Fixes applied during this ceremony:**
- ✅ All 13 demo-critical issues → v0.6.1 milestone
- ✅ 2 deferred issues (#272, #277) → v0.7.0 milestone (created)
- ✅ `go:needs-research` cleared on in-flight issues (#298, #299, #274, #296)
- ✅ #46 stays on v0.6.0 (out of sprint scope)

---

## 2. Burndown — Full Issue Board

### 🔥 BURN NOW — In Flight (do not interrupt)

| # | Issue | Owner | Size | Status | Notes |
|---|-------|-------|------|--------|-------|
| PR #297 | **Leela** approve, **Ahmed** merge | — | Ready to merge | Closes #271 + #269. Merge immediately. |
| #298 | **Fry** | M | Active (main worktree) | Surface ownership + phase bar. Foundational — blocks #275, #265. |
| #299 | **Fry** or **@copilot** | S | Active (main worktree) | Debug panel extraction. Ship alongside #298. |
| #274 | **Bender** (backend) + **Fry** (frontend) | L | Active (worktree) | GitHub OAuth. Unblocked — app exists. Zapp reviews before merge. |

**Directive:** Let these 4 lanes finish. No context switches.

### ⏭️ BURN NEXT — Queue when active lanes land

| # | Issue | Owner | Size | Depends on | Sequence |
|---|-------|-------|------|------------|----------|
| #300 | **Bender** | S | None | Can start immediately — prompt-only fix, no frontend. |
| #296 | **@copilot** (Fry reviews) | S | None | Mechanical sweep of 11 files. Fire-and-forget. |
| #275 | **Bender** (prompt/state) + **Fry** (phase UI) | L | #298 merged | Design for conditional 4→6 phase flow. The wizard skeleton. |
| #265 | **Fry** | M | #298 merged | File manager wiring. Can run parallel with #275. |
| #266 | **Bender** | M | None | Phase-based model routing. Backend-only. Can run parallel with #275. |

### 🔒 BLOCKED — Waiting on dependencies

| # | Issue | Owner | Size | Blocked by | When it unblocks |
|---|-------|-------|------|------------|------------------|
| #301 | **Bender** (MSAL/ARM) + **Fry** (AuthCard/DeployProgress) | XL | #274 (auth patterns) + #275 (phase flow) | After GitHub OAuth patterns are proven. Zapp mandatory review. |
| #273 | **Fry** | L | #300 (prompt depth) | After #300 lands. ELK engine swap benefits from richer diagram input. |

### ✅ CLOSE — Resolved by in-flight work

| # | Issue | Closed by |
|---|-------|-----------|
| #271 | PR #297 (merge now) |
| #269 | PR #297 (merge now) |

### 📦 DEFER — v0.7.0 (not demo-critical)

| # | Issue | Why defer |
|---|-------|-----------|
| #272 | Live Azure pricing | Issue says "not a demo blocker." Estimated prices acceptable. |
| #277 | Session token/cost tracker | Issue says "not a blocker." Nice-to-have. |
| #46 | Multi-surface MCP | 3-4 week architecture epic. Wrong sprint for this. Stays on v0.6.0. |

---

## 3. Dependency Graph

```
PR #297 (MERGE NOW) ──── closes #271, #269

#298 (surface fix) ─────┬── #275 (progressive flow) ─── #301 (Azure deploy)
                        ├── #265 (file manager)
                        │
#274 (GitHub OAuth) ────┘── #301 (Azure deploy)
                             │
#300 (diagram prompt) ────── #273 (diagram ELK)

#296 (subtitle sweep) ────── independent
#299 (debug panel) ────────── independent
#266 (model router) ────────── independent
```

## 4. Parallel Tracks (post BURN NOW completion)

| Track | Issues | Lead | Fry | Bender | Zapp |
|-------|--------|------|-----|--------|------|
| **A: Wizard Flow** | #275, then #301 | Review | Phase UI | Prompt + state machine | Review #301 |
| **B: GitHub** | #274 (finishing) | — | A2UI components | OAuth service | Review before merge |
| **C: Azure** | #301 | — | AuthCard, DeployProgress | MSAL, ARM API | Mandatory review |
| **D: Polish** | #265, #266, #273, #300, #296, #299 | — | #265, #273 | #266, #300 | — |
| **E: Test** | All | — | — | — | — |

Hermes enters after Track A + B land for E2E test pass.

---

## 5. Sprint Capacity (T-shirt estimates)

| Agent | Burn Now | Burn Next | Blocked | Total |
|-------|----------|-----------|---------|-------|
| **Fry** | #298 (M), #299 (S), #274-frontend (L) | #275-frontend (L), #265 (M) | #301-frontend (L), #273 (L) | 3S + 3M + 3L |
| **Bender** | #274-backend (L) | #300 (S), #275-backend (L), #266 (M) | #301-backend (XL) | 1S + 1M + 3L + 1XL |
| **@copilot** | — | #296 (S) | — | 1S |
| **Hermes** | — | — | E2E test pass (M) | 1M |
| **Zapp** | — | — | #274 review (S), #301 review (M) | 1S + 1M |
| **Leela** | PR #297 approval | Architecture reviews | Final review | Reviews only |

**Fry is the bottleneck.** Almost every issue has frontend work. Mitigation: @copilot handles #296, #299 is a quick fix, #273 is back-loaded.

---

## 6. Next Wave for Ralph

**Once current agents report back (PR #297 merged, #298/#299 done, #274 in progress):**

```
Wave 1: #300 (Bender), #296 (@copilot), #275 (Bender+Fry), #265 (Fry), #266 (Bender)
         — all can start in parallel, no cross-dependencies
Wave 2: #274 finishes → #301 (Bender+Fry), #300 finishes → #273 (Fry)
         — blocked items unblock
Wave 3: Hermes E2E test, Zapp security review of #274 + #301
Wave 4: Leela final review → Bender release cut
```

**Ralph's immediate action list:**
1. Monitor PR #297 merge → auto-close #271, #269
2. Monitor #298, #299 completion → trigger Wave 1
3. Fire Wave 1 items as parallel lanes: #300, #296, #275, #265, #266
4. Monitor #274 completion → trigger #301
5. Monitor #300 completion → trigger #273
6. After Waves 1-2 complete → trigger Hermes + Zapp

# Zapp Decision — Issue #326 Revision 4 Security Gate

- **Date:** 2026-04-15
- **Issue:** #326
- **Revision Reviewed:** 4 (`#4255575488`)
- **Decision:** APPROVE

## Context
Revision 4 was reviewed specifically against previously identified security blockers on sequencing trust boundaries, fail-closed validation/quotas, and SSE privacy/schema controls.

## Security Decision
Revision 4 keeps security ownership on the server for step progression, enforces fail-closed validation and bounded quotas before file streaming, and defines explicit SSE schema/privacy constraints with non-leaky error semantics.

## Outcome
Security gate is clear for implementation issues #327 and #328 from the security side.

---

# Decision: Fix Azure Auth A2UI Action Handler and Playground ARM 401 Loop

**Author:** Bender (Backend Dev)  
**Date:** 2026-04-16  
**Status:** Implemented  
**PR:** #345

## Context

Two browser console bugs were found in the Playground / Auth flow:

1. `[A2UI] action (no handler): continue:azure-auth-complete` — fired whenever the Azure auth
   flow completed inside a Playground Gallery or Widget card. Every `useA2UI()` call in
   `Playground.tsx` lacked an `actionHandler`, so `continue:` actions were silently swallowed
   and the wizard got stuck.

2. Repeated ARM proxy 401 errors (`/api/arm/subscriptions?api-version=…`) in playground/mock
   mode. `AzureResourceForm` guards its fetch with `connector.isAuthenticated()`, but for
   `auth: { kind: 'none' }` connectors `isAuthenticated()` always returns `true`, so the form
   hit the real ARM proxy even when running offline.

## Decisions

- **Playground A2UI handlers**: Add a no-op `ActionHandler` to every `useA2UI()` call in
  `Playground.tsx` that previously passed no handler. The handler is intentionally empty — the
  Playground has no real wizard state to advance. This silences the console warning and
  unblocks the auth card UI transition.

- **`SKIP_LIVE_ARM_CALLS` guard**: Evaluate `isMockMode() || isPlaygroundMode()` once at
  module load time in `AzureResourceForm.tsx` (same pattern as `ALLOW_FALLBACK_DATA` in
  `AzureResourcePicker.tsx`) and bail out of the live ARM subscription fetch when the flag is
  set. This is correct because the Playground uses stub subscription IDs that the real ARM
  proxy rejects.

- **`isAuthenticated()` contract is unchanged**: `BaseConnector.isAuthenticated()` returning
  `true` for `auth: { kind: 'none' }` is correct behaviour for SWA cookie-based auth — the
  connector does not manage tokens. The fix belongs in the caller (`AzureResourceForm`), not
  in the connector.

## Stepwise Setup Streaming (unblocking existing App.tsx diff)

The branch `squad/333-stabilize-file-surfaces` already had 344 lines of uncommitted changes in
`App.tsx` wiring stepwise file-generation streaming. Those changes referenced several missing
exports. The following were implemented to unblock the build:

- `SetupGenerationEvent` discriminated union and `ChatMessage.setupEvents` field added to
  `types.ts`.
- `StepwiseSetupState` / `SetupStep` types and six exported functions
  (`createStepwiseSetupState`, `applyStepwiseSetupEvent`, `buildStepwiseSetupMessages`,
  `getSetupEventKey`, `getStepwiseSetupSurfaceId`, `redactSetupEvent`) added to
  `utils/chat-a2ui.ts`.
- `VirtualFS` workspace snapshot methods (`saveWorkspaceSnapshot`, `loadWorkspaceSnapshot`,
  `deleteWorkspaceSnapshot`, `clearWorkspaceSnapshots`) and new `workspace-snapshots`
  IndexedDB object store added to `services/virtual-fs.ts` (IDB version bumped 2 → 3).

---

### 2026-04-16T06:00:45.448Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Do not take a dependency on `@sabbour/adaptive-ui-core`; vendor whatever is needed into this app natively instead.
**Why:** User request — captured for team memory

---

### 2026-04-16T06:21:46.299Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Recreating the local icon registry binding code in-repo is allowed for the hotfix.
**Why:** User request — captured for team memory

---

### 2026-04-16T06:50:36.209Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Pause for a bit after merged work so the team can catch up before starting new work.
**Why:** User request — captured for team memory

---

# Fry decision — #328 recovery

## Context
Issue #328 needs a focused frontend recovery slice against the approved stepwise generation contract without reintroducing duplicate file surfaces in chat.

## Decision
Represent approved `step_start` / `file_generated` / `step_complete` / `step_error` events as a synthetic `DeploymentProgress` A2UI surface during Generate, and store `file_generated` payloads as hidden `FileEditor` updates on that same surface.

## Why
This keeps Generate chat progress/status only while preserving existing workspace rehydration, because the stored `FileEditor` payloads still rebuild files into the workspace on session resume without rendering duplicate chat artifacts.

## Follow-up notes
- Screen reader announcements now come from the FileManager sidebar live region (`aria-live="polite"`).
- Replay dedupe is client-side on `stepId + path + sha256` for this slice.

---

# K8s icon registration pattern for new resources

## Decision

New Kubernetes resource icons that don't ship with `@sabbour/adaptive-ui-azure-pack` are created as static SVGs under `packages/web/public/assets/icons/k8s/` and registered via `registerDiagramIcons()` in the `ensureDiagramIconsRegistered()` function in `ArchitectureDiagram.tsx`. This supplements (not replaces) the existing pack registration flow. The `ALLOWED_ICON_KEYS` allowlist in `architectureDiagramUtils.ts` must be updated in tandem.

## Rationale

- The azure-pack is an npm dependency we don't modify directly; local static SVGs in `public/` give us fast iteration on new K8s resources without a package release cycle.
- The `registerDiagramIcons()` call is idempotent and additive, so local icons merge cleanly with pack icons.
- The allowlist + registry two-layer check keeps untrusted LLM output from injecting arbitrary icon paths.

## Impact

- **Bender**: The system prompt (`system-prompt.ts`) and component catalog (`component-catalog.ts`) list available icon keys for the LLM. New icons (gateway, httproute, pdb, vpa, cronjob, role, rb) should be added to those lists so the LLM uses them in generated diagrams.
- **Hermes**: The sanitizer test in `architectureDiagramUtils.test.ts` now expects `k8s/gateway` to be allowlisted (previously it asserted the opposite). Test was already updated by the test suite (not by this change).

---

# Decision: TDD contract tests for new k8s icon allowlist entries

## Context

Fry is adding `k8s/gateway`, `k8s/httproute`, `k8s/pdb`, and `k8s/vpa` to the `ALLOWED_ICON_KEYS` allowlist in `architectureDiagramUtils.ts`. Tests need to validate these additions.

## Decision

Wrote 18 tests (up from 3) in `architectureDiagramUtils.test.ts`. Four tests are intentionally TDD-red — they assert the new icon keys are allowlisted and rendered. They will go green when Fry adds the four keys to `ALLOWED_ICON_KEYS`. No other code change is needed to satisfy them.

The canonical icon key names are: `k8s/gateway`, `k8s/httproute`, `k8s/pdb`, `k8s/vpa`. If Fry uses different names, the test expectations must be updated to match.

## Impact

- **Fry**: Adding the 4 keys to `ALLOWED_ICON_KEYS` will turn all 18 tests green.
- **All agents**: The test file now covers path-traversal rejection, case sensitivity, structural validation, duplicate detection, a11y attributes, and null-resolver handling. Future allowlist additions should follow the same pattern.

---

# Decision: Post-v0.7.0 Priority Lane

**Date:** 2026-04-16T05:51:43.085Z
**Author:** Leela (Lead)
**Status:** Active

## Context

v0.7.0 shipped. All burndown lanes complete (297, 298, 299, 274, 301, 265, 300, 331, 338). The team committed to a process reset after burndown. #332 is blocked on external dependencies (live credentials). Two design spikes (#329, #330) are open and assigned to Leela. PR #341 (DOMPurify security bump) is waiting for merge.

## Decision

### Priority order:

1. **PR #341 — merge immediately.** DOMPurify 3.4.0 fixes mXSS, prototype pollution, and FORBID_TAGS bypass. Security dependency bumps don't wait for ceremonies.

2. **Sprint planning ceremony — run next.** The team committed to this after burndown. It's overdue. No feature code starts until the ceremony scopes the next sprint and resets the board.

3. **#330 (Agents SDK design, P1) — in parallel with ceremony.** This is a Leela-only architecture spike. It produces a DP, not code. Design proposals are process-compatible with a reset — they ARE the gate that the process requires before implementation.

4. **#329 (MCP App IDE design, important) — after #330 or in parallel.** Lower priority than the P1 Agents SDK lane. Also a Leela-only DP.

5. **#332 — stays blocked.** P2, v1.0.0. No action until live Azure/GitHub credentials are available.

### What this means for the team:

- **Fry, Bender, Hermes:** No new feature code until sprint planning completes. Available for ceremony participation and PR #341 review/merge.
- **Zapp:** Standby for security review on #330 and #329 DPs when posted.
- **Leela:** Facilitates ceremony, writes DPs for #330 and #329.

## Why design spikes proceed during reset

The process reset prevents premature implementation without proper DP gates. Writing DPs is literally building those gates. Blocking architecture planning on a ceremony that plans the architecture is circular. The ceremony will consume the DPs as input for sprint scoping.

## Consequences

- `now.md` updated to reflect new mode and active issues.
- Session plan updated if stale.
- Sprint planning ceremony should be requested as the next coordinator action.

---

# Decision: Vendor Diagram Assets to Remove Adaptive-UI Dependency

**Date:** 2026-04-16T06:00:45.448Z  
**Decision:** Remove \`@sabbour/adaptive-ui-core\` and \`@sabbour/adaptive-ui-azure-pack\` from web app dependencies by vendoring required assets natively into the repo.

## Context

User directive: Do not take a dependency on `@sabbour/adaptive-ui-core`; vendor needed functionality instead.

The web app currently depends on two private packages that require GitHub Packages authentication:
- `@sabbour/adaptive-ui-core@1.2.2`
- `@sabbour/adaptive-ui-azure-pack@0.4.0`

This blocks deployment and creates friction for the team.

## Scope

**Only ArchitectureDiagram.tsx uses these packages:**
1. `getDiagramIconRegistry()` from `@sabbour/adaptive-ui-core`
2. `registerAzureDiagramIcons()` from `@sabbour/adaptive-ui-azure-pack/diagram-icons`
3. Two SVG icons: `building-cloud.svg`, `design-ideas.svg` from `@sabbour/adaptive-ui-core/icons/fluent/`

## Action

- Issue #342 created, routed to **Fry** (Frontend Dev)
- Scope: Extract icon registry logic natively, move SVG icons to repo, update imports, remove packages, remove type shims
- Acceptance: Builds without auth, component renders, icons display, tests pass
- Milestone: v0.6.1 (deployment-critical hotfix)

## Rationale

Single-component dependency is a smell. Vendor the minimal surface (two functions + two icons) rather than carry the external package. This restores deployability and removes a blocker.

## Impact

- Frontend: ArchitectureDiagram refactor (small, isolated)
- DevOps: Eliminates GitHub Packages auth requirement
- No impact on architecture or other components

---

## Sprint: 2026-04-16 Security + Generation Sprint

### 2026-04-16: Security sprint — sanitization, ReDoS, insecure randomness, CI permissions, dep upgrades
**By:** Bender (Backend Dev / Security)

**Decisions shipped:**
1. **Sanitization rewrites** — Use environment-agnostic regex approach (not DOMPurify) for Node.js API/core packages since jsdom is absent. DOMPurify is correct for browser-only packages. Replaced ad-hoc regex HTML sanitizers in `in-memory.ts`, `skill-policy.ts`, `fetch-webpage.ts`, and `sanitize-tool-output.ts`. (PRs #373)
2. **ReDoS** — Regexes with catastrophic backtracking in `data-binding.ts`, `skill-policy.ts`, and `in-memory.ts` rewritten to linear-time patterns. (PR #373)
3. **Transitive dependency pinning** — Use npm `overrides` in `package.json` to pin vulnerable transitive deps when a direct upgrade is unavailable (e.g. `serialize-javascript` inside Docusaurus). Update lock with `--package-lock-only`. (PR #369)
4. **CI workflow permissions** — All `.github/workflows/*.yml` must declare explicit `permissions:` blocks. Default: `contents: read` at workflow level. Jobs needing more (e.g. `pull-requests: write`) declare at job level. (PR #368)
5. **Insecure randomness** — Any code generating security-sensitive values (IDs, tokens, nonces) must use `crypto.randomUUID()` or `crypto.getRandomValues()`. `Math.random()` is prohibited for these use cases. (PR #371)

**Related issues:** #359 (multi-char sanitization), #360 (bad HTML regexp), #361 (ReDoS), #362 (insecure randomness), #364 (CI permissions) ✅, #365 (serialize-javascript RCE) ✅, #366 (hono upgrade) ✅, #367 (follow-redirects upgrade) ✅

---

### 2026-04-16: Canonical K8s icon keys — DRA and Gateway API Inference Extension
**By:** Bender, Fry, Hermes

Seven new Kubernetes icon keys added across `system-prompt.ts`, `component-catalog.ts`, and `architectureDiagramUtils.ts`:

| Key | Resource | SVG label |
|-----|----------|-----------|
| `k8s/deviceclass` | DeviceClass | `dc` |
| `k8s/resourceclaim` | ResourceClaim | `rc` |
| `k8s/resourceclaimtemplate` | ResourceClaimTemplate | `rct` |
| `k8s/resourceslice` | ResourceSlice | `rslice` |
| `k8s/inferencepool` | InferencePool | `pool` |
| `k8s/inferenceobjective` | InferenceObjective | `obj` |
| `k8s/endpointpicker` | Endpoint Picker (EPP) | `epp` |

**Conventions:** Full-word lowercase keys matching `k8s/<lowercase-kind>` pattern. No abbreviated keys unless the resource has an established kubectl short name. `resourceslice` uses `rslice` SVG label to avoid collision with ReplicaSet (`rs`). `endpointpicker` uses full name (not `epp`) for consistency; SVG label retains `epp` abbreviation. NetworkPolicy (`k8s/netpol`) already registered by azure-pack — never add to `K8S_EXTRA_ICONS`. EndpointSlice was removed from this batch per user direction.

**Test contract (Hermes):** TDD tests in `architectureDiagramUtils.test.ts` lock all new keys via `isAllowedIconKey`, `ALLOWED_ICON_KEYS`, `expandIconPlaceholders`, and `renderArchitectureDiagramSvg` assertions. Adding keys to `ALLOWED_ICON_KEYS` turns tests green without further changes.

---

### 2026-04-16: `next-card` is a phantom reference — use `Card`
**By:** Fry, via PR #372

Full codebase search returned zero matches for `next-card`, `NextCard`, or `nextCard`. The component does not exist in catalog, schema, kickstart-catalog.ts, or any demo scenario. Decided **not to implement** — `Card` already covers all "what's next" UX patterns. A2UI graceful fallback handles any LLM emission silently. Also cleaned up stale `DeploymentProgress` holdover in `system-prompt.ts` example list (PR #356 rename leftover).

---

### 2026-04-16: A2UI action handlers and ARM guard in Playground
**By:** Bender

1. **`useA2UI()` must always supply an `actionHandler`** — even a no-op — if the component may host surfaces that fire `continue:` or other actions. Omitting the handler silently swallows actions and stalls wizard flows. Fixed in Playground.tsx.
2. **`SKIP_LIVE_ARM_CALLS` guard** — `AzureResourceForm.tsx` must check `isMockMode() || isPlaygroundMode()` before hitting the live ARM subscription endpoint. `BaseConnector.isAuthenticated()` returns `true` for `auth: { kind: 'none' }` (SWA cookie auth) — the fix belongs in the caller, not the connector.
3. **Stepwise setup streaming** — `SetupGenerationEvent` discriminated union, `StepwiseSetupState` types, and six exported functions added to `utils/chat-a2ui.ts`; `VirtualFS` workspace snapshot methods and `workspace-snapshots` IDB object store added (IDB version 2→3).

---

### 2026-04-16: DeploymentProgress → GenerationProgress rename
**By:** Leela (PR #356)

When renaming an A2UI component, every surface must be updated together:
- Component file + TypeScript interfaces
- `a2ui-schema.ts`
- `kickstart-catalog.ts`
- `system-prompt.ts` — all occurrences, section text, and example JSON payloads
- `component-catalog.ts`
- Demo/playground scenario files
- Test fixtures
- Public exports in `index.ts`

Missed surfaces from a partial rename leave orphan phantom references in LLM-facing text and break prompt-catalog contract tests.

---

### 2026-04-16: Stepwise generation enabled by default in production
**By:** Leela (PR #354)

`STEPWISE_GENERATION_V1=true` is now the default in `infra/main.bicep`. All new environments pick it up automatically; no manual flag override needed.

---

### 2026-04-16: Prompt-catalog contract tests guard against phantom components
**By:** Hermes (PR #374)

15 contract tests in the prompt-catalog suite automatically detect any system-prompt reference to a component that is not registered in the catalog. CI will catch regressions from partial renames or phantom additions without manual review.

---

### 2026-04-16: Overnight backlog audit — triage and routing outcomes
**By:** Leela

Triaged 11 backlog items against GitHub. Outcome:
- 5 items already covered by merged PRs (model router, cost estimate, token tracker, missing components, ARM 401)
- 1 item partially covered (#332 — Azure login, blocked on live credentials, P2)
- 3 new issues created: #349 (file editor A2UI coupling — architecture clarity), #350 (deployment vs. generation wording), #351 (custom components audit) — all assigned Leela, type:spike

Future spikes #329 (MCP App IDE + A2UI) and #330 (Agents SDK migration) verified adequate — no follow-up issues needed.

---

### 2026-04-16: Frontend architecture audit findings
**By:** Fry

Key findings from the overnight audit:
- **FileEditor coupling** is intentional: it acts as an LLM-declaration vehicle that the pipeline extracts to the workspace, not a rendered component. Three separate functions in `chat-a2ui.ts` handle it. The coupling works but is opaque (no first-class `FilePayload` type). Decision deferred to Leela (#349).
- **`root`** is a reserved A2UI surface ID, not a missing component. Working as designed.
- **`picker` naming**: `ChoicePicker` is the correct component name. System prompt should reference it explicitly, not generic `picker`.
- **`DeploymentProgress` title** is hardcoded to `'Project Setup'` via `GENERATE_PROGRESS_TITLE` in `chat-a2ui.ts`. Dynamic per-step title is a low-impact cosmetic improvement (tracked in #350).
- **Custom component strategy** is sound — 20 registered components covering auth, GitHub, Azure, cost, and primitives. FileEditor is the only legacy fat component needing a refactor decision.

---

### 2026-04-16: User directives — K8s icon batch scope changes
**By:** Ahmed Sabbour (via Copilot)

- **07:04Z** — Skip NetworkPolicy in the current icon batch; it already exists in azure-pack. Continue with remaining DRA resources and inference extensions.
- **07:08Z** — Remove EndpointSlice from current batch; add InferencePool, InferenceObjective, and EndPointPicker instead.

