# Decision: DP Reviews — April 17, 2026

**Date:** 2026-04-17T03:30:17Z
**Author:** Leela (Lead)
**Status:** Proposed

---

## DP #329 — MCP App IDE Surface (A2UI + ext-apps)

**Verdict:** APPROVED WITH CONDITIONS

### Architecture decisions recorded

1. **Resource registration approach is canonical.** `ui://kickstart/wizard.html` via `registerAppResource` + `registerAppTool` with `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server` is the correct pattern per MCP Apps Quickstart §2. No bespoke protocol. This is the standard for all future MCP App registrations in this repo.

2. **Single-file bundle (vite-plugin-singlefile) is required for MCP App surfaces.** `script-src 'unsafe-inline'` + `style-src 'unsafe-inline'` in the CSP meta tag is unavoidable with this bundling strategy. `connect-src 'none'` is mandatory — all communication must go through `postMessage`.

3. **`event.source === window.parent` guard is required.** Under the null-origin sandbox (`allow-scripts` only, no `allow-same-origin`), `event.source` validation is the primary incoming-message check. `"*"` as targetOrigin is acceptable in the null-origin context. If any host grants `allow-same-origin`, we must switch to explicit origin checking.

4. **Runtime duplication is a blocking risk.** The PoC adds `runtime/conversation.ts`, `runtime/openai-client.ts`, `runtime/session-store.ts` inside `packages/mcp-server`. These parallel the existing `packages/web/api/src/lib/openai-client.ts` and `session-store.ts`. Combined with the Agents SDK migration (#330), we could have three LLM runtime forks. The implementation issue must define the canonical client before any code lands.

5. **Bundle size validation is a Slice 1 ship requirement.** `vite-plugin-singlefile` output must be measured with full React + Fluent 2 + A2UI before the PR merges. Any known host size limits must be documented.

### Conditions on implementation issue
- Define canonical LLM client / session infrastructure (no third fork)
- Bundle size validation added to acceptance criteria
- A2UI surface disabled (or host serialization documented) while tool call is in flight
- Error state defined and rendered when `tools/call` fails
- S7 text-only fallback covered by tests

---

## DP #330 — OpenAI Agents SDK Migration

**Verdict:** APPROVED (architecture, 2026-04-17T01:53Z) + CLOSED OUT this session

### Closeout decisions recorded

1. **Option B (hybrid route planner + manager agent) is the adopted migration shape.** Not a loop-only swap (Option A — rejected) and not a full handoff-first rewrite (Option C — deferred). The SDK handles run/tool/session/streaming/tracing; product code handles route policy, generation sequencing, and A2UI output.

2. **`phaseComplete`/`filesComplete` model flags are retired.** Server-authored route state replaces them. Model-emitted booleans are no longer the main control plane. This is a hard contract change — backends must emit explicit route metadata.

3. **Generate step orchestration stays custom.** The SDK does not get to invent artifact routing. Workspace-first generation (#326/#327/#328) is a constraint, not an option.

4. **Implementation sequence is locked.** Gate (DP #330) → arch spike + Azure compat → backend runtime (#445, Bender) → chat/workspace UI (#446, Fry) → cleanup. UI work cannot start until backend contract is stable.

5. **Follow-on issues created:**
   - **#445** — Backend SDK adapter (Bender), v1.0.0. Includes all Zapp security conditions as acceptance criteria.
   - **#446** — Chat/workspace UI adaptation (Fry), v1.0.0. Depends on #445.

---

# Zapp Decision — DP #329 MCP App IDE Surface Security Review

**Date:** 2026-04-17
**Author:** Zapp (Security Architect)
**Issue:** #329
**Status:** APPROVE WITH CONDITIONS

## Decision

DP #329 is approved to proceed **only with mandatory implementation-time controls**. The architecture is directionally sound, but its current trust model is too dependent on host behavior and must be hardened with explicit server-side authorization, message validation, and payload safety limits.

## Findings by Severity

1. **🔴 High — MCP tool exposure from iframe runtime**
   - The app runtime uses `app.callServerTool()` and the server exposes multiple tools; without server-side allowlisting for app-originated calls, a compromised iframe can attempt broader tool access.

2. **🟠 Major — postMessage trust model under host variance**
   - `"*"` target origin in null-origin sandbox can be acceptable, but only with strict message/source/session validation. If any host enables `allow-same-origin`, explicit `event.origin` allowlisting becomes mandatory.

3. **🟠 Major — CSP missing in PoC; must be required in production**
   - Security posture relies on sandbox + renderer discipline. CSP must be baked into shipped app as defense-in-depth, not optional documentation.

4. **🟠 Major — A2UI payload parsing lacks strict bounds**
   - Unbounded payload/component processing can enable UI tampering or render-path DoS.

5. **🟡 Minor — Session ownership/replay protections not explicit**
   - Session-bound authz checks and replay-resistant message semantics should be explicitly required.

6. **🟢 Low — Credential handling generally sound**
   - API keys stay server-side; retain strict no-token-in-iframe invariant and redaction guarantees.

## Required Security Conditions (Implementation Acceptance Criteria)

1. Server-enforced allowlist of app-callable MCP tools with default-deny behavior.
2. Mode-aware message verification:
   - null-origin sandbox: strict source + schema + nonce/session binding.
   - same-origin sandbox: strict origin allowlist + source validation.
3. Mandatory restrictive CSP in bundled app, verified in CI.
4. Strict A2UI validation: schema checks, payload size limits, component count/depth limits, fail-closed fallback.
5. Per-session principal/channel ownership checks and replay/audit protections on every app tool call.
6. Security compatibility matrix across VS Code, Claude Code, and ChatGPT hosts.

## Outcome

Security gate for the **design proposal** is conditionally clear. Final implementation PR(s) must demonstrate all conditions with tests/evidence before receiving Zapp implementation sign-off.

---

### 2026-04-17: Review gate via labels, not GitHub reviews
**By:** Ahmed Sabbour (via Leela)
**What:** Squad PRs use leela:approved + zapp:approved labels as the merge gate, enforced by squad/review-gate status check (squad-review-gate.yml). Required GitHub review approvals removed — authors cannot approve their own PRs.
**Why:** The 1-required-approval branch protection permanently blocked squad agent PRs because agents push as the same GitHub user who owns the repo.

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


---

# Directive: Worktree-per-session isolation

**Date:** 2026-04-16T17:52:34Z
**Source:** Copilot directive (user asabbour)

## Context

Concurrent sessions were mixing unrelated files into the same PR when sharing a working directory. Need isolation to prevent cross-session contamination.

## Decision

Every session starts in its own git worktree. Configuration:
- `.squad/config.json`: `worktrees: true`
- Coordinator agent sets up worktrees on session start
- Main session uses a unique branch `chore/squad-worktree-isolation`

## Benefits

- Zero cross-session file mixing
- PRs contain only work from one session
- Concurrent work becomes deterministic and traceable
- Clean separation of concerns

---

# Decision: Ideas Tab Audit — Aggressive Cleanup

**Date:** 2026-04-16
**Author:** Leela (Lead)
**Status:** Proposed → Implemented (Fry assigned)

## Context

Ahmed requested decisive simplification: "I don't want distractions." The Ideas tab had **36 scenarios across 9 groups**. Most are noise — trivial exercises, redundant compositions, kitchen-sink tests.

## Decision

**Cut to 16 scenarios across 6 groups** (56% reduction). Extract 3 real components to Custom Controls.

### Remove (17 scenarios)

**Entire groups:**
- Multi-Phase Demo (5 scenarios): redundant with Kickstart Scenarios
- Integration Kits (4 scenarios): AuthCard recipes, redundant with existing demos
- Individual removals (8): data-basic, data-sequence, event-form, life-update, life-delete, dyn-nested, dyn-conditional, file-edit-delete

### Keep (16 scenarios)

| Group | Count | Why |
|---|---|---|
| Kickstart Scenarios | 9 | Core product — workflow demonstrations |
| Data Binding | 2 | data-form (composition), data-jsonptr (B-22 regression guard) |
| Events & Actions | 2 | event-buttons (emitter pattern), event-func (functionCall action) |
| Surface Lifecycle | 1 | life-multi (unique multi-surface capability) |
| Dynamic Patterns | 1 | dyn-dashboard (capstone composition example) |
| File Operations | 1 | file-create (workflow: ProgressSteps + FileEditor) |

### Extract to Components (3 components)

1. **FileEditor** → Custom Controls: file-single, file-multi
2. **CostEstimate** → Custom Controls: cost-estimate
3. **GenerationProgress** → Custom Controls: new demo gap-fill

## Implementation

- Update GALLERY_GROUPS in Playground.tsx (line 178): remove 3 group labels
- Delete 17 scenario entries + their generators from playground-scenarios.ts
- Move 3 scenarios to Custom Controls (rename IDs: ctrl-file-single, ctrl-file-multi, ctrl-cost-estimate)
- Create new customGenerationProgress() generator function
- Verify: npm run build passes, both tabs load

## Status

Assigned to Fry (Frontend Dev). Estimated 2-3 hours. Depends on .squad/config.json worktree setup.

---

# Decision: PR #383 Documentation Rewrite — Complete

**Date:** 2026-04-16
**Author:** Leela (Lead)
**Status:** Implemented

## What

Engineering docs rewrite for **Issue #271 — Deployment Flow is Blocked**. Rewrote 7 core files with code health analysis, decision preservation, and FSM deletion documentation.

## Files Updated

1. `docs/ARCHITECTURE.md` → Comprehensive system architecture with VSCode type hints
2. `docs/PHASES.md` → Phase definitions (no FSM references after machine.ts removal)
3. `docs/CONVERSATION-ENGINE.md` → Engine internals with advancePhase() pattern
4. `docs/AUTHENTICATION.md` → New auth security model (no localStorage secrets)
5. `docs/PERSISTENCE.md` → virtual-fs.ts (client-side IndexedDB) + server backup
6. `docs/INTEGRATION.md` → Kit pattern + lifecycle management
7. `docs/TESTING.md` → Snapshot + E2E test patterns

## Code Health Notes

- **virtual-fs.ts:** Client-side VirtualFileSystem (IndexedDB). NO server-side TTL.
- **Splice vs push:** Used splice(0,1) for immutable ops vs push (mutable). Clarified pattern.
- **Resolver ordering:** Scoped → base → global. Documented dependency resolution chain.
- **IntegrationKit:** Interface defined in `@kickstart/core`, exposed via catalog plugin system.

## Verification

- npm run build passes
- All internal doc links validated
- Code examples execute without errors
- Review comments from PR #383 addressed (Copilot, Fry)

## Status

Completed. Awaiting merge of PR #383.

---

# Decision: PR #383 Accuracy Fixes

**Date:** 2026-04-16T17:44:57Z
**Author:** Leela (Lead)
**Fixes:** PR #383 review feedback

## What

Corrected factual errors in engineering documentation based on Copilot's PR review:

1. **virtual-fs.ts is client-side** — Not backed by server TTL. Browser-side IndexedDB persistence only. Affects data durability understanding.

2. **Splice vs Push semantics** — Clarified immutable array operations in reducer examples. Splice uses (0,1) for safe mutation-free operations.

3. **Resolver ordering** — System walks scoped → base → global. Made dependency resolution chain explicit in docs.

4. **IntegrationKit interface** — Defined in @kickstart/core, published through catalog schema. Corrected component availability model.

## Status

Incorporated into PR #383 revision. All 12 review comments addressed.

# Decision: Approve DP #330 — Hybrid OpenAI Agents SDK Runtime

**Date:** 2026-04-17T01:53:59Z
**Author:** Leela (Lead)
**Issue:** #330 — spike: design OpenAI Agents SDK migration for less-rigid chat flow
**Status:** Approved (architecture gate cleared; awaiting Zapp security review)

## Context

Issue #330 is the design gate for migrating Kickstart's conversation engine from a hand-rolled FSM + tool loop to an OpenAI Agents SDK runtime. The DP proposes Option B: a hybrid route planner + manager agent architecture.

## Decision

**Architecture approved.** The DP correctly frames this as a control-plane redesign, not a package swap.

Key alignment points verified:
1. **FSM removal (#400/#412):** Already merged. The DP's code-owned route planner fills the vacated control plane without conflict.
2. **Workspace-first generation (#326/#327/#328):** Treated as constraints. Generate sequencing stays server-owned and workspace-first.
3. **Custom/SDK boundary:** SDK handles loop/retry/session/streaming/tracing. Product code keeps A2UI, IntegrationKit, workspace semantics, generate sequencing, rate limiting, auth, route policy.
4. **Agents-as-tools over handoffs:** Pragmatic starting position. Preserves single user-facing voice. Handoffs deferred.
5. **Server-authored route state replaces model-authored flags:** Correct architectural fix for the rigidity problem.

## Additions Requested

Two explicit checkpoints should be added to the architecture spike:
1. Validate `RunResult`/`StreamedRunResult` → typed SSE adaptation without losing A2UI structure.
2. Validate session hydration cold-start round-trip from existing session store without losing artifact summaries or phase context.

## Consequences

- Implementation is unblocked pending Zapp's security review.
- The architecture spike is the next deliverable; it must prove Azure model-provider compatibility, SSE adaptation, and session hydration before any runtime cutover.
- All implementation issues in the Agents SDK lane remain blocked on this DP until both Leela (done) and Zapp approve.

---

### 2026-04-17: Security decision for DP #330 (OpenAI Agents SDK migration)

**By:** Zapp (Security Architect)  
**Issue:** #330  
**Decision:** APPROVE WITH CONDITIONS

**Summary:** The hybrid boundary is acceptable if Kickstart remains the security control-plane and the SDK is constrained to orchestration mechanics. Main risks are raw SDK/tracing leakage, resume-state hijacking, and supply-chain exposure from the new dependency.

#### Required security conditions

1. **Allowlist response adapter only**: never expose raw SDK run items, traces, or unfiltered tool outputs to the browser.
2. **Principal-bound resume/session ownership**: enforce `(sessionId, runId, principalId)` authorization on interruption/resume paths with fail-closed behavior and audit logging.
3. **Preserve session semantics**: keep current TTL/expiry and ownership behavior in the session adapter; expired sessions/runs cannot be resumed.
4. **Guardrails are additive only**: server-side controls (rate limiting, content safety, auth/ownership, sanitization, workspace validation) remain authoritative.
5. **Dependency governance**: pin Agents SDK version, maintain lockfile integrity, run dependency/security scans, and define upgrade/rollback procedure.

**Consequence:** Security gate for DP #330 is clear only when these conditions are added as implementation acceptance criteria and verified by tests.

---

### 2026-04-17: CRITICAL — Never use `--admin` flag to bypass merge protection

**By:** Ahmed Sabbour (flagged critical security violation)

**What:** Ralph-merge agent used `gh pr merge --admin` to bypass branch protection on PRs #418 and #426. The `--admin` flag is now **absolutely prohibited** on all merge operations.

**Why:** Branch protection was put in place to enforce human review before code enters main. Using `--admin` to bypass it defeats the entire review gate. This is a security and governance failure.

**Rule:** No agent may ever use `--admin`, `--force`, or any flag that circumvents branch protection rules. If protection blocks a merge, that is correct behavior — request review from Leela or Zapp, do not force.

**Enforcement:** Merge Gate section in pr-workflow/SKILL.md explicitly prohibits `--admin`. Ralph must be updated to never attempt admin bypass.

**Consequence:** Any future `--admin` merge is a critical incident requiring immediate investigation and remediation.

---

### 2026-04-17: PR feedback must be explicitly acknowledged and threads resolved
**By:** Ahmed Sabbour (process fix after #405 audit)
**What:** When any agent addresses PR review feedback (from Copilot, Leela, Zapp, or any reviewer), they MUST:
  1. Reply to the specific comment explaining what was done
  2. Resolve the review thread via the GitHub GraphQL resolveReviewThread mutation
  3. Verify 0 unresolved threads before attempting merge
Silently fixing code without acknowledging the comment is a process violation. Unresolved threads will block the branch protection gate (require_conversation_resolution: true).
**Why:** #407–#426 were merged without addressing Copilot review comments. The branch protection's require_conversation_resolution was not enforced at the time but is now. This prevents that class of merge-blocking from recurring.

---

# Decision: Retroactive Audit Findings for PRs #407–#426

**Author:** Hermes (Tester)
**Date:** 2026-04-17
**Context:** 11 PRs merged without human review during #405 audit session

## Summary

Audited all 11 PRs. Found 52 unresolved Copilot review threads. Created 8 follow-up issues:

### P1 — Runtime Risk
- **#428** — `advancePhase()` throws on invalid phase strings (PRs #412, #418)
- **#429** — System prompt context variables not injected (PR #412)

### P2 — Quality / Correctness
- **#430** — API reference docs: 19 inaccuracies vs implementation (PR #424)
- **#431** — Skill vocabulary: mutable shared arrays + missing public export (PR #416)
- **#432** — Deployment docs: hardcoded subscription/tenant/resource group (PR #408)
- **#435** — Phase docs: deleted test refs, wrong code examples (PRs #421, #426)

### P3 — Tech Debt
- **#433** — Custom component count hardcoded without automated assertion (PR #422)
- **#434** — Cross-doc inconsistency: stale "both kits use legacy" claims (PRs #415, #420, #426)

## Decision

P1 issues (#428, #429) should be prioritized immediately. All merged code PRs had substantive unaddressed review comments — merging without review should not be repeated.

## Tracking Issue

**#436** — Full summary with per-PR breakdown table.

---

# Decision: advancePhase() must be crash-safe at all call sites

**Date:** 2026-04-17
**Author:** Bender
**Issue:** #428

## Decision

`advancePhase()` in `packages/core/src/engine/phases.ts` now accepts `Phase | string` and falls back to `Phase.Discover` for any unrecognised input. It must never throw because it is called on every LLM turn, and client rehydration can restore stale phase strings that no longer exist in the current enum.

All API boundary callers (converse, action) must validate phase strings with `isPhase()` before trusting them as `Phase` enum values. Do not cast raw strings to `Phase` without guarding first.

## Rationale

A single unrecognised phase string from a rehydrated session caused `getPhaseDefinition()` to throw, crashing the entire turn. The fix is fail-closed-but-safe: fall back to `Phase.Discover` (first phase) rather than propagating an error.

## Affected files

- `packages/core/src/engine/phases.ts` — implementation
- `packages/web/api/src/functions/action.ts` — caller updated
- `packages/web/api/src/functions/converse.ts` — already guarded via `normalizeConversePhase`

---

# Decision: Vocabulary arrays — readonly but not public API

**Issue:** #431
**PR:** #438
**Date:** 2026-04-17

## Decision

`*_PATTERNS` arrays in `skill-vocabulary.ts` are typed `readonly RegExp[]`.
`*_KEYWORDS` were already readonly via `as const`.

Vocabulary symbols are **not** added to the public `src/index.ts`.
They remain in `engine/index.ts` (internal barrel only).

## Rationale

No consumers outside `packages/core` import these symbols (grep confirmed).
They are an implementation detail of the skill-injection mechanism (Mechanism A + B).
Exposing them as public API would create a contract with no real consumers and require
semver bumps for any future vocab changes.

## Type fix

`DOMAIN_PATTERNS` in `resolveConversationSkills.ts` widened its `patterns` field from
`RegExp[]` to `readonly RegExp[]` so the narrower vocabulary types assign cleanly.

---

# Decision: Explicit Parts Injection for System Prompt Context Vars

**Date:** 2026-04-17
**Author:** Fry
**Issue:** #429
**PR:** #437

## Decision

In `buildSystemPrompt()`, every runtime context variable that the LLM narrative references as "injected" MUST be explicitly pushed as a `## Section` block into the `parts` array. Storing a value in `vars` and relying on `interpolate()` is not sufficient unless the narrative template contains a matching `{{placeholder}}` token.

## Rationale

The `interpolate()` call only substitutes `{{token}}` markers in the narrative string. If no such marker exists for a variable, the computed value is silently dropped. The narrative text "Read appDefinition (injected)" is an LLM instruction, not an automatic injection mechanism. The three context vars (`appDefinition`, `azureContext`, `repoInfo`) were built but never reached the LLM.

## Pattern Going Forward

When adding new runtime context (e.g., pricing data, deployment state), always do both:
1. Assign to `vars["myKey"]` for use in any narrative `{{myKey}}` placeholders.
2. Push an explicit section: `parts.push(\`\n## My Section\n\n${vars["myKey"]}\`)` so the LLM reliably receives it.

## Affected Files

- `packages/core/src/prompts/system-prompt.ts` — `buildSystemPrompt()` parts composition

---

# Decision: azure-kit.ts uses the typed skill path — docs must reflect this

**Date:** 2026-04-17
**Author:** Fry
**Issue:** #434
**PR:** #440

## Decision

The typed `kit.skills[]` (Path 1) in `skill-resolver.ts` is **active in production**.
`azure-kit.ts` registers `skills: azureIacSkills` at line 573.
`github-kit.ts` uses the legacy `kit.prompts[]` / `kit.phasePrompts{}` path.

Both paths are valid and both are used. "Both existing kits use legacy" is incorrect.

## Impact on Docs

Any architecture doc that claims the typed skill path is "dormant", "unused", or "no production kit uses it" is incorrect and must be updated. The canonical truth is:

| Kit | Resolution Path |
|-----|----------------|
| `azure-kit.ts` | Typed `kit.skills[]` (Path 1) |
| `github-kit.ts` | Legacy `kit.prompts[]` / `kit.phasePrompts{}` (Path 2) |

## Files Updated

- `docs-site/docs/architecture/overview.md` — corrected cleanup item 2 and the exported-but-uncalled warning (done in #402)
- `docs-site/docs/architecture/prompt-pipeline.md` — corrected dormant warning and cleanup item 3; marked item 1 done (#402)
- `docs-site/docs/architecture/skill-injection.md` — corrected cleanup item 3 description

---

# Decision: Custom Component Count Contract Test (Issue #433)

**Date:** 2026-04-17
**Author:** Hermes (Tester)
**Issue:** #433
**PR:** #443

## Decision

Chose **Option A** (contract test) over Option B (remove hardcoded count from docs).

## Rationale

The `.tsx` file extension in `packages/web/src/catalog/components/` is a reliable source of truth: every component implementation is a `.tsx` file, and every non-component file in that directory (test files, utilities, registry, setup) uses `.ts`. This makes a filesystem count unambiguous and maintenance-free.

## Test Location

`packages/core/src/__tests__/custom-component-count.test.ts` — consistent with where `catalog.test.ts` enforces the base-33 count.

## Change Protocol

When a new custom component is added:
1. Bump `CUSTOM_COMPONENT_COUNT` in the test file
2. Add the component name to `EXPECTED_CUSTOM_COMPONENTS`
3. Update `docs-site/docs/architecture/overview.md`
4. Update `docs-site/docs/components/custom-catalog.md`

The failing test acts as the reminder.

---

# Decision: PR Batch Review #437–#443

**Date:** 2026-04-17
**Author:** Leela (Lead)
**Status:** All approved

## Summary

Reviewed 7 PRs from the retroactive audit follow-up (issues #428–#435). All approved via `leela:approved` label.

## PR Decisions

| PR | Verdict | Notes |
|----|---------|-------|
| #437 | ✅ Approved | `buildSystemPrompt()` vars (`azureContext`, `repoInfo`, `appDefinition`) are properly built before injection; tests added for all 3 sections. |
| #438 | ✅ Approved | `readonly RegExp[]` is a correct type safety improvement; `DOMAIN_PATTERNS` consumer updated consistently. |
| #439 | ✅ Approved | Core fix (non-throwing `advancePhase`, `isPhase()` export) is complete. Copilot thread about partial `action.ts` propagation addressed: `safePhase` improves the phase-indicator index; full propagation through A2UI payload is a follow-up. Thread resolved. |
| #440 | ✅ Approved | Doc fixes accurate — azure-kit typed path marked active, github-kit legacy description corrected, stale cleanup items struck through. |
| #441 | ✅ Approved | 3 Copilot threads resolved: (1) jq `contains` is order-insensitive for arrays — existing command correct; (2) wide scope accepted given cohesive audit context; (3) Phase enum gap acknowledged, follow-up logged. |
| #442 | ✅ Approved | Hardcoded subscription ID and tenant domain replaced with placeholders + `:::info` callout. Clean. |
| #443 | ✅ Approved | Contract test count (22) verified against live file system. `import.meta.url` path resolution is correct across workspaces. Both count and exact-set assertions provide good coverage. |

## Follow-Up Items Logged

1. **Full `safePhase` propagation in `action.ts`** — `currentPhase` (original string) still flows into the A2UI payload and response phase field when it's invalid. A follow-up issue should propagate `safePhase` end-to-end through the `callLLM` return and the A2UI `ConversationPhase` component payload.

2. **`contributing.md` Phase enum step** — Adding a phase requires updating `Phase` enum in `packages/core/src/engine/types.ts` in addition to `PHASE_DEFINITIONS`. A follow-up should add step "Add the new phase as a member of the `Phase` enum in `packages/core/src/engine/types.ts`" to the contributing guide.

3. **Process:** Future squad PRs should separate process/workflow changes from documentation fixes — opening separate PRs per concern area.

---

# Zapp Decision — PR Security Gate Batch (#437–#443)

**Date:** 2026-04-17
**Author:** Zapp (Security Architect)
**Status:** Approved (all 7 PRs)

## Scope
Security review of PRs **#437, #438, #439, #440, #441, #442, #443**.

## Findings Summary
- **#437** (`buildSystemPrompt` context injection): reviewed prompt-injection boundary handling. `appDefinition`, `azureContext`, and `githubContext` are sanitized (`sanitizePromptValue`), delimiter-neutralized, JSON-encoded, and wrapped with context boundaries before prompt insertion. **No exploitable injection path found in this delta.**
- **#438** (`readonly RegExp[]` typing): type-only hardening; no runtime security impact.
- **#439** (`advancePhase` fallback): no auth/authz bypass introduced by fallback behavior; change is state-guard behavior.
- **#440** docs-only updates; no security risk introduced.
- **#441** docs/workflow accuracy updates; no security vulnerability introduced.
- **#442** deployment docs placeholders: verified removal of hardcoded real subscription/tenant values; retained values are placeholders/examples.
- **#443** test/docs-only updates; no security risk introduced.

## Review Feedback Loop Compliance
- Replied to and resolved all open review threads found during this batch (PRs #439, #441).
- Verified unresolved thread count is **0** on all seven PRs before applying Zapp gate label.

## Gate Action
Applied label **`zapp:approved`** to PRs: #437, #438, #439, #440, #441, #442, #443.

---

# Zapp Decision — PR #444 API Auth Docs Accuracy

**Date:** 2026-04-17
**Author:** Zapp (Security Architect)
**Status:** Approved

## Scope
Security review of PR #444 (`squad/430-api-docs-accuracy`) updating API endpoint reference docs.

## Security Validation
- Verified Azure-sensitive endpoint auth docs now match implementation:
  - `azure-target`, `azure-deployments-start`, `azure-deployments-status`, `deploy-cost-gate` all require SWA principal via `x-ms-client-principal-id` (`getPrincipalId` / `requireAzureAccessToken`) plus ownership checks.
- Verified `arm-proxy` method list includes `HEAD` and `OPTIONS`, matching handler registration.
- Verified `converse` and `generate` are anonymous with rate limiting; no misleading "session required" claim remains for those endpoints.
- Verified inspirations endpoint behavior docs align with runtime behavior (`/inspirations` 503 when OpenAI unconfigured; `/inspirations/widgets` fallback behavior).

## Outcome
No new security risk introduced and no misleading auth guidance detected. Applied `zapp:approved` label to PR #444.

---

## Decision: Frontend UI Adaptation for Agents SDK (#446)

**Date:** 2026-04-17T06:28:51Z
**Author:** Fry (Frontend Dev)
**Issue:** #446 | **PR:** #455

### 1. 406 fallback in useStreaming.ts is the canonical SDK bridge pattern

When `KICKSTART_AGENTS_SDK=true`, the backend returns HTTP 406 for streaming requests. The correct frontend pattern is an inline fallback in `useStreaming.ts`'s `send()` function: detect 406, retry as non-streaming JSON (`ConverseResponse`), and fire the same callbacks (`onPhase`, `onA2UI`, `onComplete`). Progressive text reveal is preserved.

**Rejected alternatives:**
- Separate `useNonStreamingConverse` hook — breaks caller API, two entry points
- Backend streaming support for SDK path — out of scope; deferred

### 2. No new frontend phase routing logic — server is the sole authority

The frontend trusts the `phase` field from the SSE `done` event (or the JSON `ConverseResponse.phase` in the non-streaming fallback) as the sole authoritative phase source. `phaseComplete`/`filesComplete` model flags are backend-advisory-only. No frontend-side phase advancement or skip/revisit logic.

**Implication:** Any future behavior changes (multi-hop skip, conditional revisit, dynamic lane switching) are backend route planner changes, not frontend changes.

### 3. E2E route-state tests use page.route() interception, not ?mock mode

Playwright tests for skip-ahead and revisit scenarios intercept `/api/converse` directly with crafted SSE responses. This exercises the real `useStreaming.ts` SSE parser path. Mock mode (`?mock`) uses `useMockStreaming`, which bypasses `useStreaming.ts` and cannot test the 406 fallback or SSE phase parsing.

**Test pattern:** Register `/api/health` → 200 and `/api/converse` → SSE in test body before `page.goto()`. Use `page.waitForResponse('**/api/health')` to ensure `isApiAvailable` resolves before auto-send. **CRITICAL:** `waitForResponse` must be registered BEFORE `page.goto()` to avoid a race condition.

### 4. addMessage placement in converse.ts

`addMessage` must be called inside each processing branch in `converse.ts`, not before the branch. This ensures the 406 early-return path is fully side-effect free — session state remains unmutated on 406.

### 5. Session cold-start unchanged

`hydrateSession()` + `getLatestConversationPhase(messages)` correctly restores phase for the SDK-backed session. The `agents-session-adapter.ts` wraps the same session store. No frontend changes needed for cold-start.

---

# Decision: Dependabot PR Policy for Major Version Bumps

**Date:** 2026-04-17  
**Author:** Leela (Lead)  
**Status:** Accepted

## Context

Dependabot automatically opens PRs for dependency updates, including major version bumps that may contain breaking changes. During triage of PRs #448–#452, a clear split emerged between safe minor/patch bumps and breaking major bumps.

## Decision

**Minor and patch version bumps** that pass CI are approved and merged without manual compatibility review.

**Major version bumps** that fail CI are **closed immediately** and tracked as explicit upgrade tasks. They are not left open as stale Dependabot PRs. The rationale:

- Failing CI on a major bump indicates breaking changes that require deliberate migration work (API changes, config updates, type fixes, etc.).
- Auto-bumping major versions without green CI risks landing broken builds on the main branch.
- Explicit upgrade issues ensure the work is scoped, planned, and reviewed intentionally rather than sneaking in via an auto-merge.

## Rule Summary

| Bump type | CI status | Action |
|-----------|-----------|--------|
| patch / minor | ✅ pass | Approve and merge |
| patch / minor | ❌ fail | Investigate; fix or close |
| major | ✅ pass | Review diff carefully; approve if safe |
| major | ❌ fail | Close PR; open a planned upgrade task |

## Applied To

- **#448** (non-breaking group, 10 minor/patch updates) → `leela:approved`
- **#449** (vite 6→8) → `leela:approved` (CI green, lock-file only changes verified)
- **#450** (typescript 5→6) → Closed; needs compatibility work
- **#451** (@vitejs/plugin-react 4→6) → Closed; needs compatibility work (lint + E2E failures)
- **#452** (zod 3→4) → Closed; needs API migration work

---

### 2026-04-17: Connector execution model — client vs proxy

**By:** Hermes (via research), Leela (architecture review)
**What:** AzureARMConnector always proxies through /api/arm-proxy (CORS constraint). GitHubConnector splits: reads direct, writes proxied for token security. Exception: createPullRequest() calls api.github.com directly — flagged as technical debt.
**Why:** ARM management API does not allow browser CORS; GitHub reads are public/CORS-enabled; GitHub writes need token isolation. createPullRequest() direct call is a known inconsistency to be addressed.
**Impact:** Any new connector methods that write data MUST use the server proxy pattern.

---

### 2026-04-17: v2 Architecture DP — Lead Review
**Author:** Leela
**Master Issue:** #473
**Status:** APPROVED (pending Zapp security review)

**Architecture verdict:** The harness + packs model is sound. The harness is correctly domain-agnostic — it will compile standalone with only `pack-core` registered, and all product knowledge flows through the pack boundary. The `PackRegistry` seal-at-startup invariant is the right enforcement mechanism; it prevents dynamic injection and makes pack composition statically verifiable. The `@openai/agents` SDK is used as intended: Runner handles orchestration, product code handles routing policy and A2UI output. No deviations from the decisions recorded in DP #330.

**Pack boundaries:** Boundaries are clear and enforced by the dependency graph (`core ← azure ← aks-automatic`, `core ← github`). Sigil conventions (`.` tools, `:` user-actions, `/` components, `/` skill ids) are globally unique by kind and will prevent naming collisions across packs. The one area to watch is `pack-core` scope creep — the 39-component load in Step 4 is large; if any of those components carry Azure or AKS knowledge they must move to the correct domain pack before Step 4 lands.

**Implementation order:** The §14 ordering is correct. The dependency chain (types → registry → pack-core → playground validation → runner → skill resolver → domain packs → web client → guardrails → MCP → docs) is the right sequence. Step 4a (playground on registry) is correctly placed before Step 5 (runner) as an early validation of the registry shape. Steps 7, 8, and 9 can proceed in parallel after Step 6 if team capacity allows — they have no cross-pack dependencies. Steps 10 and 11 correctly block on all domain packs being present.

**Concerns:**
- **Guardrail enforcement semantics** — The brief specifies `block` halts execution, but does not specify whether the Runner surfaces a `block` as an `error` SSE event or as a structured `AgentOutput`. This must be pinned before Step 11. Recommend: `error` SSE event with `{ message, code: "guardrail_block" }` so the browser can distinguish it from model errors.
- **UserAction resume authz** — The brief acknowledges session-ownership checks as open (§15 open items, and DP #329 §5). Step 5 must include explicit `sessionId` + `runId` ownership validation on the resume endpoint — this should be a done criterion, not an open item. Flagging for Zapp's attention.
- **`core.emit_ui` tagged-union vs. per-type tools** — The brief defaults to tagged union; this is the right starting point. If the model struggles, the split to per-type tools is a localized change to pack-core only (Step 4 / Step 4a), not a harness change. Low risk.
- **Step 4 size** — Step 4 (pack-core) includes 3 agents, 5 skills, 6 tools, and 39 components in one PR. Consider splitting off the component port into a Step 4b if the PR becomes unwieldy. This does not affect the overall ordering.

---

### 2026-04-17: v2 Security Architecture Review

**Author:** Zapp (Security Architect)
**Status:** APPROVED WITH CONDITIONS
**Master Issue:** #473

**Conditions:**

1. `core.fetch_webpage` — URL allowlist/denylist with IMDS and RFC1918 blocks, implemented with tests (Critical — before Step 5)
2. `core.write_file` / `read_file` / `list_files` — workspace-prefix path validation, no `../`, implemented with tests (Critical — before Step 5)
3. Resume handler — per-session OID ownership check before any `runner.resume()` call (Critical — before Step 5)
4. Resume handler — `resultSchema.parse()` validation of incoming resume payload, 400 on failure (Critical — before Step 5)
5. Playground stubs — explicit `KICKSTART_PLAYGROUND` gate with fail-closed throw in the dispatcher; stubs excluded from production builds (Critical — before Step 5)
6. MCP server — `mcpExposed` defaults to `false`; file system tools explicitly unexposed; auth mechanism documented before Step 12 (High — before Step 12)
7. MCP UserActions — resolved by architectural separation: UserActions are NOT in the MCP tool schema; MCP client detects `user_action_required` notifications and POSTs results to `/api/converse/resume` directly. Residual condition: resume handler must enforce `resultSchema` validation (already Critical #4) and OID session-ownership check (already Critical #3) for MCP-originated resume calls. (High — before Step 12)
8. `azure.arm_get` — path parameter Zod regex constraint (`/^\/subscriptions\//`), `../` rejection (High — before Step 7)
9. `core.token_budget` — hard ceiling values (tokens/turn, tokens/session) documented and configurable (Medium)
10. `no-secrets-in-artifacts` — detection approach (entropy threshold + regex patterns for known formats) specified in guardrail design doc (Medium)

**Summary of findings:**
- 5 Critical: SSRF (fetch_webpage), path traversal (write_file), resume ownership, resultSchema enforcement, playground stub gate
- 3 High: ARM path injection, MCP auth, MCP UserAction consent bypass
- 6 Medium: secrets detection, PII detection, A2UI guardrail scope, token budget ceiling, CSP/component renderer audit, CSRF
- 4 Low/Informational: billing account ID format, SSE arg exposure, skill context leakage, pack trust-on-declaration

---

### 2026-04-17T10:21:36Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Design proposals (DPs) must not be skipped — even when the brief says "design locked." DP review gates apply to all implementation steps.
**Why:** User request — captured for team memory

---

### 2026-04-17T11:42: Design clarification — UserActions are NOT MCP tools
**By:** Ahmed Sabbour (via Copilot)
**What:** UserActions in the MCP path are NOT surfaced as MCP tool schema items. They are direct API calls executed by the MCP client. The MCP server (harness) exposes the conversation/agent surface; UserActions are a client-side responsibility — the MCP client implements them as direct calls against the web API (e.g. POST /api/converse/resume or pack-registered proxy endpoints).
**Why:** UserActions require a human interaction loop (consent, credentials, UI confirmation). The MCP client — not the MCP server — owns that loop. Surfacing them as MCP tools would push that responsibility into the wrong layer.
**Implication for Step 12 (#487):**
- MCP server exposes: agents (as conversation turns), tools marked `mcpExposed: true`, A2UI as embedded resources.
- MCP server does NOT expose: UserActions as MCP tools.
- MCP client responsibility: detect `user_action_required` SSE events (or equivalent MCP notification), execute the UserAction as a direct API call against the harness, POST result to /api/converse/resume.
**Note:** Supersedes earlier directive (copilot-directive-20260417T1140) on two-phase MCP consent, which assumed MCP-tool exposure. That design is rejected.

---

# Decision: v2 sprint planning — foundation first

**Date:** 2026-04-17T12:06:45.293Z
**Author:** Leela

## Context

The active focus file blocked feature-code work until sprint planning completed. The open squad backlog is now almost entirely the v2 harness + packs rewrite lane (#473 onward). Every open v2 issue lacked a milestone, 32 open v2 issues still carried `go:needs-research`, and 29 of 33 v2 issues were routed to Fry even when the work is runtime-heavy.

## Decision

Run the next sprint as a strict dependency-compression sprint:

1. **#474 — Step 1: Nuke v1**
2. **#475 — Step 2: Harness types**
3. **#476 — Step 3: Registry + loaders**

No Step 4+ implementation starts before #476 merges.

After #476, the next executable batch is:

- **#542 + #503 + #504 + #505 + #506 + #478** — pack-core authoring, component ports, manifest, and playground validation
- then **#479 + #480** — runner/SSE and skill resolver
- then domain packs and downstream surfaces: **#482 → #483 / #484 → #485 → #486 → #487 → #488**

## Why

This is the shortest path to production. The brief is explicit: the harness owns primitives and runtime; packs consume that contract. Starting domain packs, web-client rewrite, or MCP before the harness/registry spine exists just manufactures churn across pack boundaries.

## Hard gates

- `#474 → #475 → #476` is the blocking chain for the whole v2 lane.
- Milestone hygiene was missing; all open v2 issues should sit on milestone **v2**.
- Historical timing data is currently absent from `.squad/retro-log.md`, so this sprint uses dependency-driven sequencing rather than calibrated duration estimates.

---

# Fry handoff — #474 frontend cut line

**Date:** 2026-04-17T12:06:45.293Z
**Author:** Fry (Frontend Dev)
**Issue:** #474

## Summary

Step 1 should preserve the web shell and only delete the obviously v1-only demo/mock surfaces. The risky part is not the deleted files themselves; it is the number of live imports that still flow from `@kickstart/core`, `packages/web/src/types.ts`, and the old catalog bootstrap.

## Preserve now

- `packages/web/src/components/` shell UI
- `packages/web/src/contexts/`
- `packages/web/src/hooks/useStreaming.ts`, `useA2UI.ts`, `useProgressiveQueue.ts`, `useSessions.ts`, `useNavigation.ts`
- `packages/web/src/services/api-client.ts`, `virtual-fs.ts`
- `packages/web/src/utils/chat-a2ui.ts` and related chat/session utilities
- `packages/web/src/catalog/components/`, `fluent-components/`, `icons/`
- `packages/web/src/pages/Playground.tsx`, `PlaygroundWorkspace.tsx`, `playground-icons.ts`

## Delete or replace in Step 1

- Delete outright: `demo-scenarios.ts`, `mock-streaming.ts`, `playground-auth-stub.ts`, `playground-scenarios.ts`, `useMockStreaming.ts`
- Delete after consumer cleanup: `useWidgets.tsx`
- Replace with registry-driven source: `kickstart-catalog.ts`
- Replace with new shared contracts before full removal: `packages/web/src/types.ts`

## Compile blockers to plan around

1. `main.tsx`, `APIConnectorContext.tsx`, `ArtifactContext.tsx`, `useActionDispatch.ts`, `DebugA2UITree.tsx`, multiple catalog components, and service helpers still import `@kickstart/core`.
2. `App.tsx`, chat components, session/debug contexts, `useStreaming.ts`, `Playground.tsx`, and chat utilities still import from `packages/web/src/types.ts`.
3. `Playground.tsx` currently depends on all three deleted playground sources (`useWidgets`, `demo-scenarios`, `playground-scenarios`).

## Recommendation for Bender + Leela

Treat Step 1 frontend work as a seam-cutting pass: remove mock/demo imports, park Playground on empty registry-backed data, introduce temporary replacement exports for type/core contracts the shell still needs, then hard-delete legacy files and point the web app at `packages/harness`/future packs.

---

# Decision: DP Review — #475 v2 Step 2 Harness Types

**Date:** 2026-05-28
**Author:** Leela (Lead)
**Issue:** #475 — v2 Step 2: Harness types — all primitives + Zod schemas
**Status:** APPROVE_WITH_CONDITIONS
**GitHub comment:** https://github.com/sabbour/kickstart/issues/475#issuecomment-4268063788

## Architecture decisions recorded

1. **A2UI Zod schemas must be discriminated unions, not all-optional transcription.** The v1 `A2uiMsg` all-optional-keys pattern does not enforce v2's "exactly one operation per emit_ui call" semantics. `a2ui.ts` Zod schemas must use `z.discriminatedUnion` (or per-shape `z.object` with a required operation key). Every shape must include `version: z.literal("v0.9")`.

2. **`ComponentContribution.renderer` is typed as `unknown` in the harness.** The harness is a server-side package with no DOM/JSX context. `ComponentContribution` in `packages/harness/src/types/component.ts` must type `renderer` as `unknown`. The React-aware narrowed type (`ComponentContributionWithRenderer<P>`) is deferred to `pack-core`.

3. **`SessionCtx` forward refs must be resolved in Step 2.** `AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, and `AzureCredential` are referenced in `SessionCtx` but not defined in any Step 2 file. Author must define minimal versions or stub as `unknown` with `// TODO(Step 3)` annotations.

4. **`zod` and `@openai/agents` are runtime dependencies of `@kickstart/harness`.** Both must appear in `dependencies`, not `devDependencies`. Zod schemas run in production; `ToolContribution` imports `Tool as SDKTool` from `@openai/agents`.

5. **`chat-a2ui.ts` port must drop all v1 phase-model code.** `ConversationPhaseId`, `SetupGenerationEvent`, `PHASE_ALIASES`, `PHASE_COMPONENT_NAME`, and ConversationPhase surface helpers are v1 concepts. The PR must include an explicit keep/drop function inventory.

## Conditions

All five conditions are blocking on the Step 2 PR before it merges. Step 3 is gated on this step compiling standalone with no errors.

---

# Decision: Architecture review — #476 v2 Step 3 (registry + loaders)

**Date:** 2026-05-28
**Author:** Leela (Lead)
**Issue:** #476 — v2 Step 3: Registry + loaders
**Status:** APPROVE_WITH_CONDITIONS
**GitHub comment:** https://github.com/sabbour/kickstart/issues/476#issuecomment-4268074355

## What's approved

- `seal()` lifecycle model: post-startup, pre-runner. `register()` after seal throws.
- Sigil-based tool-reference resolution: `.` → Tool, `:` → UserAction. Fail-fast at registration.
- Per-namespace collision detection: correct.
- Circular dependency detection: sufficient for Hermes to test.
- Catalog skeleton scope: typed registry data assembly only, no UI renderer.

## Conditions

### C1 — YAML parser array support (BLOCKER)

The existing `packages/core/src/skills/frontmatter-parser.ts` mini-parser does not support arrays. Both `.agent.md` and `SKILL.md` frontmatter require arrays (`tools:`, `handoffs:`, `appliesTo:`, `keywords:`).

**Decision:** Drop the custom mini-parser. Use the `yaml` npm package in `packages/harness`. Harness is a server package; a YAML dependency is not a concern.

### C2 — Registry read accessor surface (BLOCKER)

The following read surface must be included in Step 3 done criteria (stubs acceptable if full impl is deferred):

```ts
registry.getAgent(name: string): AgentContribution
registry.getSkillsForAgent(agent: string): Skill[]
registry.getToolsForAgent(agent: string): ToolContribution[]
registry.getUserAction(name: string): UserActionContribution
registry.getGuardrailsByStage(stage: 'input'|'output'|'tool'): GuardrailContribution[]
registry.components: ComponentContribution[]
```

### C3 — Wire transliteration for UserAction names (BLOCKER)

UserAction canonical name uses `:` sigil (`azure:login`); OpenAI SDK disallows `:` in tool names. Wire name is `azure__login`.

**Decision:** `UserActionContribution` must carry both:
- `.name` = canonical (`azure:login`) — registry lookup key
- `.wireName` = transliterated (`azure__login`) — SDK agent tool list construction

Loader-agent.ts must produce both on load.

## Minor clarifications (non-blocking)

- `enable(["B"])` where B depends on A but A is not enabled → should throw.
- `enable()` after `seal()` → should throw, same as `register()` after `seal()`.

## Impact on downstream steps

- Step 4 (pack-core) depends on stable registry API. C1–C3 must be resolved before Step 4 starts.
- Step 5 (Runner + SSE) depends on C2 (guardrail/tool enumeration) and C3 (wire name).
- Step 6 (skill resolver) depends on C2 (`getSkillsForAgent`).
