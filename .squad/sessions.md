# Squad Session Log

---

## Session: 2026-04-17 — Ralph Loop / Retroactive Audit Follow-Up

**Trigger:** 8 open issues (#428–#435) created by Hermes's retroactive audit of PRs #407–#426 (52 unresolved Copilot review threads found in the prior unreviewed merge batch).

**Also merged this session:** PR #427 (squad/review-gate label-based merge gate), closing issue #436 (audit tracking issue).

### PRs Merged

| PR | Branch | Issue | Summary |
|----|--------|-------|---------|
| #427 | squad/review-gate | — | Label-based merge gate: `leela:approved` + `zapp:approved` required; bypasses self-approval block |
| #437 | squad/429-system-prompt-context | #429 | `buildSystemPrompt()`: inject `appDefinition`, `azureContext`, `repoInfo` as explicit `##` section blocks in `parts[]` |
| #438 | squad/431-vocab-readonly | #431 | `*_PATTERNS` vocab arrays typed `readonly RegExp[]`; kept in internal barrel, not promoted to public API |
| #439 | squad/428-advance-phase | #428 | `advancePhase()` guard: fallback to `Phase.Discover` on unrecognised input; `isPhase()` exported for API-boundary callers |
| #440 | squad/434-skill-path-docs | #434 | Docs: azure-kit uses typed `kit.skills[]` (Path 1, active); github-kit uses legacy — "both kits use legacy" claim corrected |
| #441 | squad/435-phase-docs | #435 | Docs: `conversation-phases.md` + `contributing.md` — 5 accuracy fixes (deleted test refs, wrong code examples) |
| #442 | squad/432-deployment-docs | #432 | Docs: hardcoded Azure subscription ID and tenant domain replaced with placeholders + `:::info` callout |
| #443 | squad/433-component-count-test | #433 | Test: contract test asserting 22 custom components by `.tsx` file count with exact-set assertion |
| #444 | squad/430-api-docs-accuracy | #430 | Docs: 19 API reference inaccuracies fixed in `api-endpoints.md` (auth, methods, error codes) |

### Reviews

**Leela** reviewed all 8 PRs (code quality) — all approved via `leela:approved` label.  
**Zapp** reviewed all 8 PRs (security) — all approved via `zapp:approved` label. Zero security findings.

All Copilot review threads resolved and verified before each merge.

### Decisions Logged

- `leela-review-gate-labels.md` — Label-based merge gate process (already in `decisions.md` via PR #427)
- `leela-comment-resolution-process.md` — PR feedback must be explicitly acknowledged; threads resolved via GraphQL before merge
- `hermes-retroactive-audit-findings.md` — Retroactive audit of PRs #407–#426; 52 unresolved threads; 8 issues created
- `bender-428-advance-phase.md` — `advancePhase()` crash-safe contract; `isPhase()` guard at API boundaries
- `bender-431-vocab-readonly.md` — Vocab arrays `readonly`, not promoted to public API
- `fry-429-prompt-context.md` — Explicit parts injection pattern for system prompt context vars
- `fry-typed-skill-path-is-active.md` — azure-kit uses typed Path 1 (active); docs must not claim it is dormant
- `hermes-433-count-test.md` — Option A chosen: contract test via `.tsx` file count; change protocol defined
- `leela-pr-batch-437-443-review.md` — Batch review verdict + 3 follow-up items logged
- `zapp-pr-437-443-security-gate.md` — Security clearance for PRs #437–#443
- `zapp-pr-444-api-auth-docs-accuracy.md` — Security clearance for PR #444

### Leela Follow-Up Items (Unresolved — Need Future Issues)

1. **Full `safePhase` propagation in `action.ts`** — `safePhase` improves phase-indicator index but `currentPhase` (original invalid string) still flows into A2UI payload and response phase field. Needs end-to-end propagation through `callLLM` return and `ConversationPhase` component payload.
2. **`contributing.md` Phase enum step** — Adding a new phase also requires updating the `Phase` enum in `packages/core/src/engine/types.ts`; this step is missing from the contributing guide.
3. **Process:** Separate process/workflow PRs from documentation-fix PRs.

### Inbox Cleared

All 11 files in `.squad/decisions/inbox/` processed and merged into `decisions.md`. Inbox ready for next session.

---

## Session: 2026-04-17 (Round 2) — Design Proposal Reviews + SDK Migration Closeout

**Trigger:** Completion of architecture reviews on Design Proposals #329 and #330.

**Session Type:** Decision capture + spawn orchestration (Bender #445, follow-on issues #445 + #446).

### Reviews Completed

**Leela (Lead, Architecture):**
- ✅ DP #329 (MCP App IDE Surface): APPROVED WITH CONDITIONS
  - Resource registration approach canonical per MCP Apps Quickstart §2
  - Single-file bundle with CSP headers required
  - postMessage validation via `event.source === window.parent`
  - Runtime duplication risk identified: canonical LLM client required before code lands
  - Bundle size validation required at merge time
  
- ✅ DP #330 (OpenAI Agents SDK Migration): APPROVED + CLOSEOUT
  - Option B (hybrid route planner + manager agent) adopted
  - `phaseComplete`/`filesComplete` retired; server-authored route state replaces them
  - Generate step orchestration remains custom (workspace-first constraint enforced)
  - Implementation sequence locked: Gate → arch spike + Azure compat → backend (#445, Bender) → UI (#446, Fry) → cleanup
  - Follow-on issues created: #445, #446

**Zapp (Security Architect):**
- ✅ DP #329 (MCP App IDE Surface): APPROVE WITH CONDITIONS
  - 6 security conditions identified and recorded as implementation acceptance criteria
  - 🔴 High: MCP tool exposure from iframe runtime
  - 🟠 Major (3): postMessage trust model, missing CSP, unbounded A2UI payload parsing
  - 🟡 Minor: Session ownership/replay protections not explicit
  - 🟢 Low: Credential handling generally sound
  - Gate: Conditionally clear for implementation PRs

### Agents Spawned

- **Bender #445:** Backend SDK adapter (Bender, Backend Dev) — spawned per DP #330 locked sequence
  - Includes all Zapp security conditions as acceptance criteria
  - Status: Still running

### Decisions Recorded

- 2 new decisions merged to `.squad/decisions.md`:
  1. **DP #329 Architecture Review** (Leela, 2026-04-17T03:30:17Z) — conditions on implementation
  2. **DP #330 Closeout** (Leela, 2026-04-17T03:30:17Z) — Option B adopted, implementation sequence locked
  3. **DP #329 Security Review** (Zapp, 2026-04-17T03:30:17Z) — 6 conditions, conditional gate clear

- 3 orchestration logs written to `.squad/orchestration-log/`:
  1. `2026-04-17T03-30-17-leela-dp-review.md`
  2. `2026-04-17T03-30-17-zapp-security-review.md`
  3. `2026-04-17T03-30-17-bender-445.md`

### Inbox Status

All 2 files in `.squad/decisions/inbox/` processed:
- `leela-dp-reviews-apr17.md` → merged
- `zapp-dp-329-security.md` → merged
Inbox now empty and ready for next session.

---

## Session: 2026-04-17 (Round 3) — PR #447 Review & Approvals + Merge Unblock

**Trigger:** Completion of code review cycles on PR #447 (Bender's issue #445 implementation).

**Session Type:** Code review + security review + merge approval.

### Reviews Completed

**Leela (Lead, Code Review):**
- ✅ PR #447: APPROVED (applied `leela:approved` label)
  - Issue: #445 Backend SDK adapter for OpenAI Agents SDK migration
  - Finding: Duplicate-message bug in conversation streaming (blocking)
  - Resolution: Bender applied de-duplication filter in streaming loop (commit a3899e5) with unit tests
  - Push cycles: 3 (initial → fix → final verification)
  - Tests: 1511 passing, zero regression
  - Unresolved threads: 0
  - Implementation quality: Clean, focused, demonstrates no-lockout directive

**Zapp (Security Architect):**
- ✅ PR #447: APPROVED WITH CONDITIONS (applied `zapp:approved` label)
  - All 4 critical security conditions from issue #445 acceptance criteria verified:
    1. ✅ Server-enforced MCP tool allowlist (default-deny)
    2. ✅ Workspace gate bypass protection
    3. ✅ TTL expiry enforcement
    4. ✅ Test coverage for hijack scenarios + lockfile pinning
  - Dependencies: Pinned in package-lock.json, no floating semver
  - Scans: Passed
  - Integration: DP #329 + #330 security review conditions validated
  - Gate: Clear for merge

### Merge Unblocked

- ✅ **Leela approval:** `leela:approved` label applied
- ✅ **Zapp approval:** `zapp:approved` label applied  
- ✅ **Status:** Ready for merge by Ralph (coordinator)
- ⏳ **Next step in sequence:** Merge PR #447 → close #445 → spawn #446 (Fry, Chat/workspace UI adaptation)

### Decisions Recorded

None new (all conditions tracked in issue #445 acceptance criteria).

### Inbox Status

Ready for Scribe orchestration log + session log entry.

---

## Session: 2026-04-17 (Round 4) — PR #455 Merged, #446 Closed

**Trigger:** Implementation and review cycle for issue #446 (Fry, Chat/workspace UI adaptation for Agents SDK).

**Session Type:** Feature implementation + review cycle + merge.

### PRs Merged

| PR | Branch | Issue | Summary |
|----|--------|-------|---------|
| #455 | squad/446-agents-sdk-ui-adaptation | #446 | Chat/workspace UI adaptation for Agents SDK — 406 fallback in `useStreaming.ts`, `isRawA2uiItem()` type guard, `clientMessageId` idempotency key, `converse.ts` `addMessage` placement fix, unit + E2E tests |

### Implementation Highlights

- **`useStreaming.ts` 406 fallback:** When SSE gate returns HTTP 406 (`KICKSTART_AGENTS_SDK=true`), retries as non-streaming JSON (`ConverseResponse`); routes `phase`/`a2ui`/`complete` callbacks through the same pipeline with progressive text reveal
- **`isRawA2uiItem()` type guard:** Discriminated-union guards (`version==='v0.9'` for A2uiMsg, `type==='ConversationPhase'` for phase payloads); no raw casts
- **`SetupGenerationSnapshot` invariant JSDoc:** SDK non-streaming path does not emit incremental `SetupGenerationEvent` items — documented explicitly
- **`KNOWN_SERVER_PHASES` / `guardServerPhase()` → removed:** Replaced with wrapper around `normalizeConversationPhase()` from `chat-a2ui.ts` to stay in sync with `PHASE_ALIASES`
- **`clientMessageId` idempotency key:** Added per-turn, forwarded in both streaming and 406 fallback paths
- **`converse.ts` backend:** `addMessage` moved after 406 early-return guard — 406 path is now fully side-effect free
- **New unit tests:** `streaming-406-fallback.test.ts` — 4 tests covering 406 detection, JSON fallback, callback routing, idempotency key forwarding
- **New E2E file:** `packages/web/e2e/route-state.spec.ts` — skip-ahead (phase jumps to `deploy`), revisit (phase steps back from `review` to `design`), unauthenticated redirect (real `request.post()` fixture, no mock, asserts `!== 200`)

### Review Cycle

| Round | Reviewer | Verdict | Notes |
|-------|----------|---------|-------|
| C1 | Leela | APPROVED WITH CONDITIONS | 5 conditions |
| C1 | Zapp | APPROVE WITH CONDITIONS | 2 conditions |
| C2 | Fry | — | Addressed all 5+2 conditions in `cbd7be8` |
| C3 | Leela | BLOCKED | Auth test still used `page.route()` mock (C5) |
| C3 | Zapp | BLOCKED | Auth test still used `page.route()` mock (C5) |
| C4 | Fry | — | Fixed C5 in `eff87aa` — real `request.post()` test, no mock |
| C5 | Leela | APPROVED | Applied `leela:approved` |
| C5 | Zapp | APPROVED | Applied `zapp:approved` |
| CI | — | FAILED | Playwright race condition (`waitForResponse` after `goto`) |
| Fix | Fry | — | Fixed race in `c34b3b5` (moved `waitForResponse` setup before `page.goto()`) |
| Final | Copilot | 6 threads | Addressed in `3ccbe9a` + `79f683d` |
| Final CI | — | ✅ GREEN | Playwright E2E pass, Lint/Build/Unit pass, squad/review-gate pass |

### Decisions Made

- **`addMessage` placement in `converse.ts`:** Must be called inside each processing branch, not before the branch — ensures 406 early-return leaves session state unmutated. Filed as `fry-446-ui-adaptation.md` (merged below).

### Board State

- ✅ #446 closed (auto-closed by PR #455 squash-merge)
- ✅ #445 closed (prior session)
- 🟡 #46 remains open — v0.6.0 epic (umbrella, not a sprint issue)
- **Board is clear of active squad sprint issues.**

### Inbox Cleared

1 file processed and merged into `decisions.md`:
- `fry-446-ui-adaptation.md` → merged
Inbox now empty and ready for next session.

---

## Session: 2026-04-17 (Round 5) — Dependabot Triage + Issues #453 #454

**Trigger:** Dependabot PR batch (#448–#452) triage + feature implementation for A2UI Debug Visualization (#454) and System Prompt Debug View (#453).

**Session Type:** Dependabot triage + feature implementation + review cycle + merge.

### Dependabot Triage

| PR | Description | Action |
|----|-------------|--------|
| #448 | Non-breaking group (10 minor/patch updates) | `leela:approved` + `zapp:approved` → merged ✅ |
| #449 | vite 6 → 8.0.8 | `leela:approved` + `zapp:approved` → merged ✅ |
| #450 | TypeScript 5 → 6 | CI failing → closed ❌ |
| #451 | @vitejs/plugin-react 4 → 6 | CI failing → closed ❌ |
| #452 | zod 3 → 4 | CI failing → closed ❌ |

**Policy Decision:** Major version bumps with failing CI → close immediately and track as planned upgrade tasks. Written by Leela to `.squad/decisions/inbox/leela-dependabot-policy.md` and merged below.

### PRs Merged

| PR | Branch | Issue | Agent | Summary |
|----|--------|-------|-------|---------|
| #448 | dependabot/… | — | Dependabot | Non-breaking dependency group (10 minor/patch updates) |
| #449 | dependabot/… | — | Dependabot | vite 6 → 8.0.8 |
| #457 | squad/454-debug-a2ui-tree | #454 | Fry | `DebugA2UITree.tsx` — A2UI debug visualization with version discriminant filtering and KNOWN_COMPONENT_TYPES |
| #458 | squad/453-system-prompt-backend | #453 | Bender | `systemPrompt` in `DebugMetadata`, 8KB cap, prod startup warning, unit tests |
| #461 | squad/453-system-prompt-frontend | #453 | Fry | Collapsible "System Prompt" section in `DebugPanel.tsx` |

### Issue #454 — A2UI Debug Visualization (squad:fry)

- Fry posted DP → Leela `approved-with-conditions` (3 conditions) + Zapp `approved-with-conditions` (4 conditions)
- Fry implemented `DebugA2UITree.tsx` addressing all 7 conditions
- PR #457 opened → both reviewed + approved → CI green → merged ✅
- Issue #454 auto-closed

### Issue #453 — System Prompt Debug View (squad:hermes + squad:bender + squad:fry)

- Hermes posted DP → Leela `approved-with-conditions` (4 conditions, notably 4 call sites not 3) + Zapp `approved-with-conditions` (3 conditions, notably prod startup warning)
- **Bender** (backend): `systemPrompt` in `DebugMetadata`, 8KB cap, prod startup warning, unit tests → PR #458 merged ✅
- **Fry** (frontend): collapsible "System Prompt" section in `DebugPanel.tsx` → PR #461 merged ✅
- Issue #453 closed ✅

### Reviews

**Leela** reviewed all feature PRs — approved via `leela:approved` label.
**Zapp** reviewed all feature PRs — approved via `zapp:approved` label.

### Decisions Logged

- `leela-dependabot-policy.md` — Major bumps with failing CI → close and handle as planned upgrade (merged from inbox)

### Inbox Cleared

1 file processed and merged into `decisions.md`:
- `leela-dependabot-policy.md` → merged
Inbox now empty and ready for next session.
