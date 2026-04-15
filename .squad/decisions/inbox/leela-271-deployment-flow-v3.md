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
