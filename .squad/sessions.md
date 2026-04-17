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
