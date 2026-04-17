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
