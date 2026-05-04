### 2026-05-01T12:41:57-07:00 — Review/CI gate cleanup (batch validation)

- **CI fast-path validation**: Reviewed `ci.yml` `changes` job that partitions docs-only vs. code-impacting PRs. Confirmed `skipped` state is correctly treated as success in `ci-gate` aggregator. Verified error-path logic: `changes.result != 'success'` explicitly fails the required check.
- **Approval preservation**: Tested base-sync detection (Compare API file-signature comparison in `squad-review-gate.yml`) — approvals preserved on "Update branch" / no-content-change rebase; ordinary new commits still clear stale approvals.
- **Branch protection semantics**: Validated that the two required status checks (`CI Gate` and `squad/review-gate`) will enforce gates correctly when `lint-build` is skipped on docs-only PRs.
- **Edge cases tested**: 
  - Mixed docs + code changes (all jobs run) ✅
  - Markdown-only changes (skips lint-build/e2e) ✅
  - Push to main (always runs all) ✅
  - Base-sync with no content change (preserves approvals) ✅

### 2026-05-01T13:27:17-07:00 — Corrected gate policy validation (BLOCKED)

Validated the corrected docs-required / security+architecture-conditional policy after Kif/Amy work. Result: **inconsistent**.

- **Amy (ceremonies.md):** ✅ Updated. Docs is now described as a **required** signal (`docs:approved` / `docs:not-applicable` / `skip-docs`); security and architecture are explicitly **conditional** (waived for doc-only / doc-owned PRs lacking sensitive surfaces, security label, or architecture label). Phase-1 docs pass is required and runs in parallel with CI.
- **Kif (squad-review-gate.yml):** ⚠️ Comment block (lines 53–57) was updated to *describe* the corrected policy ("Security is conditional: waived when the PR is docs-only…") but the runtime config was **not** changed: `gateRules` still has `security: { required: "always" }` and `botLoginMap` still omits `docs`. No path-conditional logic, no doc-only branch, no docs label signal check. Comment ↔ behavior drift.
- **Kif (squad-auto-merge.yml):** ⚠️ Standard path (lines 165–169) still requires `security:approved` unconditionally; only `LOW_RISK_LABEL` opt-in path makes security conditional on sensitive paths/labels. `getDocsBlocker` (181–189) still treats docs as advisory and only blocks on `docs:rejected` — does **not** require a docs signal as Amy's ceremony now mandates.
- **CI fast-path (ci.yml):** ✅ Confirmed working. `changes` job classifies docs-only PRs (md/mdx, docs/, docs-site/, .squad/, .changeset/), `lint-build` is skipped, `ci-gate` aggregator treats `skipped` as success. Push-to-main with docs-only changes is excluded via `paths-ignore`. No regression.
- **YAML/JSON parse:** ✅ All five workflow files + `config.json` parse cleanly.
- **Scoped `git diff --check`:** Trailing-whitespace warnings on Amy's ceremonies.md edits (lines 22, 161, 169–173, 176, 208, 354, 383–386). Cosmetic; not a gate failure.

**Validation matrix vs. corrected policy:**

| # | Scenario | Desired | ci.yml | review-gate | auto-merge | Verdict |
|---|---|---|---|---|---|---|
| 1 | Docs-only PR | docs required; security/arch waived | ✅ skip lint-build | ❌ security still always | ❌ security still always | FAIL |
| 2 | Docs+code PR | normal gates + docs signal | ✅ runs full | ⚠️ docs not signaled | ⚠️ docs not signaled (advisory) | PARTIAL |
| 3 | Workflow/security-docs PR | security still required | ✅ md still skips lint but `.github/workflows/` paths trigger full pipeline | ✅ accidentally — security is `always` | ✅ accidentally | PASS-by-accident |
| 4 | Architecture-labeled docs PR | architecture required | ✅ | ❌ no `architecture` role wired | ✅ requires `architecture:approved` when labeled | PARTIAL |
| 5 | Markdown/docs-only fast-path | CI Gate green; push-to-main fine | ✅ | n/a | n/a | PASS |
| 6 | YAML/JSON parse + diff --check | clean | ✅ | ✅ | ✅ (whitespace nits in ceremonies) | PASS |

**Blockers for Kif:**
1. `squad-review-gate.yml` `gateRules` must add a `security` conditional branch keyed off doc-only diff + sensitive-path detection + `architecture`/`security` label absence (mirror auto-merge's `isSensitivePath` / `isSecurityPatch`). Add `docs` to `botLoginMap` *or* read the docs label as a non-bot signal.
2. `squad-auto-merge.yml` standard path (`getRequiredApprovals`) must apply the same doc-only relaxation outside the `LOW_RISK_LABEL` opt-in. `getDocsBlocker` must be promoted from advisory to required (missing docs label → block, matching Amy's ceremony language).
3. Stale comment in `squad-review-gate.yml` lines 52–57 should match whichever direction is shipped.

Once Kif's edits land I'll re-run the matrix and flip `validate-corrected-gates` to done.

### 2026-05-01T13:27:17-07:00 — Re-validation after Kif edits visible (PASS)

User clarified policy: **docs-only PRs do NOT require `docs:approved`** (only `docs:rejected` blocks). Kif's working-tree edits are now visible in `squad-review-gate.yml` and `squad-auto-merge.yml`. Re-ran the matrix:

- **`squad-review-gate.yml`:** `gateRules` now codes `security` as `conditional` with `bypassWhen: { docsOnly, noArchitectureLabel, noSensitivePaths }`; new `isDocsOnlyPR` / `hasSensitivePath` / `hasArchitectureLabel` precomputation drives the bypass; `docs` role removed from gate (signal handled by auto-merge); patterns kept in sync with auto-merge (`DOCS_LIKE_PATTERN`, `SENSITIVE_PATH_PATTERNS`).
- **`squad-auto-merge.yml`:** `getRequiredApprovals` short-circuits to `['codereview:approved']` when `docsOnly && !sensitive && !architecture`; standard path otherwise (codereview+security, +architecture if labeled); `getDocsSignalBlocker` satisfies docs signal by **content** (PR ships `*.md*` / `docs/` / `docs-site/` / `.changeset/`) OR by an explicit waiver label (`docs:approved` / `docs:not-applicable` / `skip-docs`); `docs:rejected` remains a hard block. `isPureBaseSync` preserves approvals on Update-branch syncs.
- **`ci.yml`:** Docs-only fast-path unchanged and correct (`changes` job + `lint-build` skip + `ci-gate` aggregator treating `skipped` as success).
- **YAML/JSON parse:** ✅ All 5 workflows + `config.json` clean.
- **Scoped `git diff --check`** on Kif's files: clean (no whitespace nits introduced).

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| 1 | Docs-only PR | ✅ PASS | review-gate waives security via `docsOnly` bypass; auto-merge requires only codereview; docs signal auto-satisfied by content; `docs:rejected` still blocks |
| 2 | Product/code PR | ✅ PASS | review-gate requires codereview+security; auto-merge standard path; docs signal required (content or label) |
| 3 | Docs+code PR | ✅ PASS | not docsOnly → security required; docs content present in diff satisfies signal |
| 4 | Sensitive (workflows/auth/guardrails) docs PR | ✅ PASS | `hasSensitivePath` blocks docsOnly bypass in both workflows → security required |
| 5 | Architecture-labeled docs PR | ✅ PASS | `hasArchitectureLabel` blocks docsOnly bypass; auto-merge `getRequiredApprovals` adds `architecture:approved` |
| 6 | CI docs-only fast-path | ✅ PASS | lint-build skipped; CI Gate aggregator returns success; push-to-main untouched |

**Minor edge (non-blocking):** A `.squad/`-only PR containing no `*.md*` would be treated as docsOnly by review-gate (matches `DOCS_LIKE_PATTERN`) but auto-merge's `getDocsSignalBlocker` content check uses the narrower `DOCS_CONTENT_PATTERN` (excludes `.squad/`), so such a PR would still need an explicit docs label. Acceptable — internal squad state isn't user-facing docs. Flagged for Kif's awareness, not a blocker.

**Verdict:** ✅ All six rows pass. Kif's edits implement the corrected policy; Amy's ceremony language is consistent with the implementation. Marking `validate-corrected-gates` → **done**. Caveat: edits are uncommitted working-tree changes; re-confirm after the PR merges to `dev`.

### 2026-05-01T13:27:17-07:00 — `remove-skip-docs` directive validation (BLOCKED)

User added directive: `skip-docs` must be removed entirely as a docs satisfier. Product/code docs signal must be `docs:approved` OR `docs:not-applicable` only. Docs-only PRs need no docs approval. Ran scoped grep — `skip-docs` is still actively wired in 6 surfaces:

**Active gate behavior (must be removed for `remove-skip-docs` to pass):**
1. `.github/workflows/ci.yml:221–222` — `const skipDocs = labels.includes('skip-docs'); … requireChangeset = userFacing && !hasDocsSite && !skipDocs;` actively bypasses the changeset gate.
2. `.github/workflows/squad-auto-merge.yml:92, 245, 256` — `SKIP_DOCS_LABEL` constant + acceptance branch in `getDocsSignalBlocker` + user-facing error message recommending `skip-docs`. Also rationale comments at L83 and L532.
3. `.github/workflows/squad-project-board-automate.yml:67` — workflow trigger condition fires on `skip-docs` label add/remove.
4. `.github/workflows/sync-squad-custom-labels.yml:38` — provisions the label itself with description "Explicitly bypass docs and changeset gate for this PR".
5. `.squad/reviews/config.json:86` — `bypassLabels: ["skip-docs", "docs:not-applicable", "docs:approved"]` declares it as a valid docs bypass.
6. `.squad/ceremonies.md:171, 208, 212, 346, 354` and `.squad/skills/squad-reviews/SKILL.md:224` and `.squad/agents/nibbler/charter.md:94` and `.squad/decisions.md:113, 130, 723, 2409` — current (non-archive) docs all describe `skip-docs` as an accepted docs satisfier; ceremonies.md L2409 even says "**Cannot be removed** without also reworking `ci.yml`."

**Stale comment (low-priority):** `.github/workflows/squad-review-gate.yml:218` — comment example mentions `skip-docs`; harmless since gate-rule logic doesn't reference it.

**Historical / archive (OK to keep):** `.squad/agents/bender/history-archive.md:1095`, `.squad/decisions-archive/decisions-2026-04-24T07:46:08Z.md`, `.squad/decisions-archive/decisions-20260427-233336.md`. Consistent with directive's "historical-only or label-cleanup rationale" allowance.

**Updated matrix (post-directive):**

| # | Scenario | Verdict | Notes |
|---|---|---|---|
| 1 | Docs-only PR | ✅ PASS | docsOnly bypass already requires no docs label; `skip-docs` not on the satisfier path here |
| 2 | Product/code PR docs signal | ⚠️ REGRESSION | `getDocsSignalBlocker` still accepts `SKIP_DOCS_LABEL`; must restrict to `docs:approved` ∪ `docs:not-applicable` |
| 3 | Docs+code PR | ⚠️ REGRESSION | same `SKIP_DOCS_LABEL` acceptance as row 2 |
| 4 | Sensitive paths | ✅ PASS | unchanged |
| 5 | Architecture-labeled docs | ✅ PASS | unchanged |
| 6 | CI docs-only fast-path | ✅ PASS | docs-only branch unaffected; but `Detect docs-gate scope` step in `lint-build` still consumes `skip-docs` to bypass changeset → directive violation, separate from fast-path correctness |

**Blockers for `remove-skip-docs` (owner: Kif primary, Amy + Nibbler for prose):**
- Code: drop `SKIP_DOCS_LABEL` from `squad-auto-merge.yml` (constant, satisfier branch, error message, comments). Drop `skipDocs` consumption from `ci.yml` `Detect docs-gate scope`. Drop label trigger from `squad-project-board-automate.yml`. Remove provisioning entry from `sync-squad-custom-labels.yml`. Remove `skip-docs` from `bypassLabels` in `.squad/reviews/config.json`.
- Docs: update `ceremonies.md`, `skills/squad-reviews/SKILL.md`, `agents/nibbler/charter.md`, `decisions.md` (lines 113/130/723/2409) to drop `skip-docs` from the live signal list (keep only as historical citation if needed). Update `decisions.md:2409` claim that ci.yml cannot be reworked.
- Stale comment cleanup (cosmetic): `squad-review-gate.yml:218`.

**Combined fleet status:**
- `validate-corrected-gates` → **done** (matrix rows 1, 4, 5, 6 all PASS; rows 2 and 3 PASS for the gate-conditional logic — the new regression is specifically the `skip-docs` satisfier still being live).
- `remove-skip-docs` → **blocked** until the 6 active surfaces above are scrubbed.

YAML/JSON parse: ✅. Scoped `git diff --check`: clean on Kif's workflow files.

### 2026-05-01T13:27:17-07:00 — Final `remove-skip-docs` re-validation (PARTIAL PASS)

User issued final directive: full migration to `docs:not-applicable`; CI changeset heuristic must use `docs:not-applicable` (not `skip-docs`); product/code satisfiers exactly `docs:approved` ∪ `docs:not-applicable`; docs-only PRs need no docs label; permit historical/rationale mentions only.

**Workflow + config layer (Kif's domain): ✅ COMPLETE**
- `ci.yml:225–228` — `Detect docs-gate scope` now reads `docsWaived = labels.includes('docs:not-applicable') || labels.includes('docs:approved')`. `skipDocs` constant removed; lines 221–223 are tombstone comment citing DP `kif-remove-skip-docs`. ✅
- `squad-auto-merge.yml` `getDocsSignalBlocker` (verified at L240+): satisfiers are exactly `DOCS_APPROVED_LABEL`, `DOCS_NOT_APPLICABLE_LABEL`, or content (`isDocsContentPath`). `SKIP_DOCS_LABEL` constant + check + error-message reference all removed; remaining hits at L82, 85, 534, 535 are rationale tombstones. ✅
- `squad-auto-merge.yml` docs-only fast path returns `null` *before* the satisfier check, so docs-only PRs need no docs label at all. ✅
- `squad-project-board-automate.yml` — no active `skip-docs` consumer remains (label-event short-circuit dropped). ✅
- `squad-review-gate.yml` — no active reference (prior cosmetic comment was inside removed lines). ✅
- `sync-squad-custom-labels.yml:38–39` — label provisioning entry deleted; tombstone comment retained per directive. ✅
- `.squad/reviews/config.json:86` — `bypassLabels: ["docs:not-applicable", "docs:approved"]`. `skip-docs` removed. ✅
- YAML/JSON parse on all 6 affected workflows + `config.json`: ✅

**Guidance + prose layer (Amy + Nibbler + Scribe): ❌ NOT YET MIGRATED**
- `.squad/ceremonies.md:171, 176, 211, 216, 217, 353, 361` — Amy's prose still lists `skip-docs` as an active docs satisfier. Owner: Amy.
- `.squad/skills/squad-reviews/SKILL.md:225` — guidance still says "one of `docs:approved`, `docs:not-applicable`, or `skip-docs` must be present". Owner: Amy.
- `.squad/agents/nibbler/charter.md:94` — charter still lists `skip-docs` as docs-impact signal. Owner: Nibbler (or Amy by delegation).
- `.squad/decisions.md:113, 130, 723, 2409` — live ledger entries still describe `skip-docs` as accepted; L2409 still asserts "**Cannot be removed** without also reworking `ci.yml`" — flatly contradicted by Kif's commit. Owner: Scribe.

**Historical-only (permitted by directive — no action):**
- Agent history files (`amy/history.md:12`, `kif/history.md:43–47`, `leela/history.md:21–28`, `bender/history-archive.md:1095`, prior entries in this very file)
- `.squad/decisions-archive/*` (archived ledger snapshots)
- Tombstone rationale comments in `ci.yml`, `squad-auto-merge.yml`, `sync-squad-custom-labels.yml` (explicitly cite DP `kif-remove-skip-docs`)

**Final matrix:**

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| 1 | Docs-only PR — no docs label needed | ✅ PASS | `getDocsSignalBlocker` returns `null` early on `docsOnly && !sensitive && !architecture`; review-gate `bypassWhen.docsOnly` waives security |
| 2 | Product/code PR — only `docs:approved` ∪ `docs:not-applicable` satisfy | ✅ PASS | satisfier branch reduced to those two labels (or content); `SKIP_DOCS_LABEL` removed; error message updated |
| 3 | Docs+code PR | ✅ PASS | same satisfier logic; content-shipping path satisfies automatically |
| 4 | Sensitive (workflows/auth/guardrails) docs PR | ✅ PASS | `hasSensitivePaths` cancels docsOnly bypass → docs signal + security required; `skip-docs` no longer accepted |
| 5 | Architecture-labeled docs PR | ✅ PASS | `hasArchitectureLabel` cancels docsOnly bypass; auto-merge adds `architecture:approved` |
| 6 | CI changeset/docs-gate heuristic | ⚠️ workflow ✅ / prose ❌ | `ci.yml` uses `docs:not-applicable` ∪ `docs:approved`; `ceremonies.md` / `SKILL.md` / `nibbler/charter.md` / `decisions.md` prose still describe `skip-docs` as live |

**Combined fleet status:**
- `validate-corrected-gates` → 🟢 **done** — all six gate-behavior rows pass.
- `remove-skip-docs` → 🟡 **partial** — workflow/config layer ✅; prose layer ❌. Will flip to 🟢 when Amy/Nibbler/Scribe scrub the four prose surfaces above.

**Re-validation contract:** rerun `grep -rnE "skip-docs|SKIP_DOCS|skipDocs"` excluding `*-archive*`, `audit.jsonl`, `*/inbox/*`, and `*/agents/*/history.md`. Directive PASSES when the only remaining hits are rationale tombstones inside `.github/workflows/`.

## Spawn: ralph-wave-2 (2026-05-01T12:13:25)
- **Issue #312**: Serial test validation ✅
  - PR #342 opened
  - 3 serial test runs: all passing ✅
  - Issue marked done


### 2026-05-01T20:38:03Z — Validated corrected docs-gate matrix (DP hermes-corrected-gate-validation)
- **What**: ran validation matrix over Kif's working-tree edits to `.github/workflows/` files and `.squad/reviews/config.json` to confirm six gate-behavior scenarios pass against corrected policy.
- **Matrix status**: ✅ all six rows pass (docs-only + no sensitive/arch triggers, product/code, docs+code, sensitive-paths override, architecture-labeled, CI docs-only fast-path).
- **`skip-docs` removal directive**: workflow + config layer **complete** (active code paths reference `docs:not-applicable` / `docs:approved` only; remaining refs are tombstone comments); prose layer **outstanding** in `.squad/ceremonies.md`, `.squad/skills/squad-reviews/SKILL.md`, `.squad/agents/nibbler/charter.md`, `.squad/decisions.md` (delegated to Amy/Scribe).
- **Validation commands**: YAML/JSON parse ✅; scoped `git diff --check` ✅; workflow logic spot-checks ✅; CI fast-path confirmed orthogonal to gate changes ✅.
- **Re-validation contract**: will spot-check after implementing PRs merge to confirm no rebase drift.
- **Coordination note**: Updated `.squad/decisions/inbox/hermes-corrected-gate-validation.md` flagging that prose cleanup is the critical path to "PASS" — workflow code is already compliant with the directive.

### 2026-05-01T13:46:56.014-07:00 — Upstream docs-gate validation (BLOCKED)

Validated Kif's uncommitted docs-gate changes in `/home/asabbour/GitWSL/squad-reviews` and `/home/asabbour/GitWSL/squad-workflows`.

- `squad-reviews`: source extension and generated review-gate policy match the target model: docs-only non-sensitive/non-architecture PRs skip docs/security/architecture gates; code PRs require docs signal (`docs:approved` or `docs:not-applicable`); `docs:rejected` hard-blocks; synchronize preserves labels on pure base-sync and clears role approval labels on real content changes. `skip-docs` only appears in `CHANGELOG.md` historical text.
- `squad-workflows`: packaged source under `extensions/squad-workflows` matches the target merge-check policy and CI fast-path. However the tracked installed copy under `.github/extensions/squad-workflows/lib/` is stale: `merge-check.mjs` still requires architecture unconditionally, lacks docs-impact signal enforcement, and only exempts security for docs-only; `workflow-config.mjs` still lacks `reviewSignals` and only skips `security:approved` for docs-only. Treat this as an active-surface blocker unless `.github/extensions/` is explicitly non-authoritative in this repo.
- CI fast-path in both repos classifies docs-like PR changes and skips the heavy test job while `CI Gate` accepts `skipped`; non-PR push paths force `docs_only=false` and run full CI.
- Validation run: `npm test`, `git diff --check`, scoped `node --check`, PyYAML workflow parsing, and GitHub-script syntax checks all pass in both repos after rerunning with repo-local `TMPDIR`.
- `skip-docs` grep: `squad-reviews` has one historical/tombstone `CHANGELOG.md` hit only; `squad-workflows` has no hits.

### 2026-05-01T13:46:56.014-07:00 — Base-sync approval preservation validation

Validated `squad-reviews` for the specific stale-approval optimization. The generated review gate only clears legacy `{role}:approved` labels on `pull_request.synchronize` when the PR-vs-base file signature changes; pure base catch-up / update-branch syncs log preservation and skip label removal. Native PR review approvals are also evaluated by latest reviewer state and are not stripped by this logic. Focused validation run: `TMPDIR=$PWD/.copilot-test-tmp node --test test/scaffold-gate.test.mjs` plus inline assertions over `generateReusableWorkflow` for `synchronize`, `compareCommitsWithBasehead`, `isPureBaseSync`, preservation logging, content-change logging, and `removeLabel`.

For `squad-workflows`, I only inspected Kif's visible WIP as requested. The working tree now shows a `stale-approvals` synchronize job in both `squad-ci.yml` surfaces and an untracked focused test file that preserves labels for pure base-sync and clears approvals for real content syncs, but final assurance remains pending Kif completing that fix and post-fix revalidation.

### 2026-05-01T13:46:56.014-07:00 — Role-scoped reapproval validation update

User clarified that real-content synchronize events must not force arbitrary blanket reapproval: only reviewer domains affected by changed paths/labels/config triggers should be invalidated (e.g., a security-review response should not force architecture reapproval unless architecture triggers are touched).

- **squad-reviews:** Initial inspection found the generated review gate still blanket-cleared `{role}:approved` labels for every configured role on real content synchronize. Fixed surgically in `/home/asabbour/GitWSL/squad-reviews` so base-sync still preserves all labels, and real content synchronize computes changed paths between before/after PR-vs-base comparisons and clears only `rolesToClear = allRoles.filter(roleAffectedBySync)`. Label-only conditional roles such as architecture are not invalidated by unrelated security/code response paths; always-required roles and conditional path/domain-triggered roles are invalidated when their domain is touched. Updated the stale-approval README text and scaffold tests.
- **Validation:** `node --check extensions/squad-reviews/lib/scaffold-gate.mjs`; `TMPDIR=$PWD/.copilot-test-tmp node --test test/scaffold-gate.test.mjs`; full `TMPDIR=$PWD/.copilot-test-tmp npm test -- --test-reporter=dot` passed (87/87).
- **squad-workflows:** Kif's WIP currently preserves pure base-sync, but the visible `stale-approvals` job/test still blanket-clears `codereview:approved`, `architecture:approved`, `security:approved`, `docs:approved`, and `docs:not-applicable` for real content syncs. Did not modify Kif's active fix. Final assurance is pending post-fix revalidation and must include: base-sync preserves all; real content does not blanket-clear; security-only response does not clear architecture; architecture clears only when architecture label/path/config triggers are touched.

### 2026-05-01T13:46:56.014-07:00 — Local/upstream role-scoped approval implementation verification

User clarified the role-scoped reapproval behavior must be implemented and verified in local `kickstart`, upstream `squad-reviews`, and upstream `squad-workflows`, not only recorded as a decision.

- **Local `/home/asabbour/GitWSL/EMU/kickstart`:** Verified actual `squad-review-gate.yml` and installed `squad-reviews` extension include pure base-sync preservation and `rolesToClear = allRoles.filter(roleAffectedBySync)`, with docs `satisfiedByContent` and no blanket `allRoles` clearing. Verified `skip-docs` is not active in `ci.yml`, custom label provisioning, or `.squad/reviews/config.json`; docs policy uses `docs:approved` / `docs:not-applicable` and hard-blocks `docs:rejected`.
- **Upstream `/home/asabbour/GitWSL/squad-reviews`:** Fixed and verified generated gate behavior: base-sync preserves all approvals; real content sync invalidates only affected role domains using changed-path deltas, `requiredWhen.paths`, `invalidationPaths`, and `satisfiedByContent`; label-only architecture is not cleared by unrelated security/code responses.
- **Upstream `/home/asabbour/GitWSL/squad-workflows`:** Kif's WIP now includes role-scoped stale-approval clearing in both `squad-ci.yml` surfaces. I tightened architecture invalidation so a security-only response does not clear `architecture:approved` merely because the PR has an `architecture` label; architecture clears only on architecture-like paths.
- **Validation:** local node syntax/policy assertions passed; `squad-reviews` `node --check`, focused scaffold-gate test, and full `npm test -- --test-reporter=dot` passed (89/89); `squad-workflows` stale approval + workflow/merge-check tests passed (19/19), plus policy assertions for no `skip-docs` labels and role-scoped invalidation.

### 2026-05-01T13:46:56.014-07:00 — Batching + role-scoped gate validation

User added a batching requirement: feedback-addressing must not loop one feedback item → one implementation/commit/comment. It should batch related review fixes into one implementation pass, one validation run, one commit, and one consolidated PR update where possible, then resolve individual threads with concise references to that batch.

- **Local `kickstart`:** Updated installed `squad-workflows` address-feedback source, installed `squad-reviews` acknowledge-feedback source, workflow tool descriptions, `.copilot/skills/pr-feedback-loop/SKILL.md`, and `.squad/skills/squad-reviews/SKILL.md` to return/use batched instructions and remove active one-thread-one-commit guidance. Local assertions confirm batching guidance/source, role-scoped review-gate invalidation, and active docs gate migration off `skip-docs`.
- **Upstream `squad-reviews`:** Verified source/tests/guidance now return `batchPlan` and explicit one-pass/one-commit/consolidated-comment instructions; full test suite still passes. Role-scoped stale approval clearing and docs policy still pass.
- **Upstream `squad-workflows`:** Verified Kif's batching implementation in source/installed extension/tool descriptions/README/SKILL plus focused `address-feedback-batching` test. Role-scoped synchronize invalidation tests still pass, including security-only changes preserving architecture approval and base-sync preserving all approvals.
- **Validation:** Local `node --check` + policy assertions passed. Upstream `squad-reviews`: `npm test -- --test-reporter=dot` passed (89/89). Upstream `squad-workflows`: `node --test test/address-feedback-batching.test.mjs test/ci-stale-approvals.test.mjs test/workflow-config.test.mjs test/merge-check-branch-freshness.test.mjs` passed (20/20). Scoped grep found remaining per-thread/one-commit mentions only as anti-pattern/prohibition or post-batch thread-resolution instructions.

### 2026-05-01T13:46:56.014-07:00 — Final cross-repo batching + approval-gate validation

Waited for stable final diffs after Kif-5 coordination; local `kickstart`, upstream `squad-reviews`, and upstream `squad-workflows` diffs stayed stable across a 90s poll before final validation.

Validated all requested final criteria across all three repos:

- **Role-scoped reapproval invalidation:** `squad-reviews` gate uses `rolesToClear = allRoles.filter(roleAffectedBySync)`; `squad-workflows` stale-approval workflows compute affected labels from changed paths/domains. Security-only changes preserve architecture approval; architecture clears only on architecture-domain paths/triggers.
- **Base-sync preservation:** pure base-sync / update-branch / merge-base-only synchronize events preserve all approval labels in both review-gate and workflow stale-approval surfaces.
- **Feedback batching:** local/upstream `squad-reviews` now exposes `squad_reviews_post_feedback_batch` and batching instructions; local/upstream `squad-workflows` address-feedback returns batched per-PR plans. Active one-feedback-one-commit/comment loop guidance is absent; remaining per-thread handling is only post-batch reply/resolve.
- **Docs gate / skip-docs:** active docs policy uses `docs:approved`, `docs:not-applicable`, and `docs:rejected`; cross-repo assertions found no active `skip-docs` bypass/label provisioning or one-feedback-one loop patterns.

Validation runs:

- `/home/asabbour/GitWSL/squad-reviews`: `TMPDIR=$PWD/.copilot-test-tmp npm test -- --test-reporter=dot` → 92/92 passed.
- `/home/asabbour/GitWSL/squad-workflows`: `TMPDIR=$PWD/.copilot-test-tmp npm test -- --test-reporter=dot` → 30/30 passed.
- `/home/asabbour/GitWSL/EMU/kickstart`: syntax checks for installed review/workflow extensions plus cross-repo Node policy assertions → passed.

### 2026-05-01T13:46:56.014-07:00 — Final local/upstream gate validation (PASS)

Performed independent final validation across local `/home/asabbour/GitWSL/EMU/kickstart`, upstream `/home/asabbour/GitWSL/squad-reviews`, and upstream `/home/asabbour/GitWSL/squad-workflows` after Kif-4/Kif-5 completion.

Verdict: **PASS**.

Validated criteria:
- Base-sync / merge-base-only `pull_request.synchronize` preserves all approval labels.
- Real content synchronizes invalidate only affected reviewer domains; unrelated approvals are preserved (including security-only changes not forcing architecture reapproval).
- Feedback addressing batches related fixes into one implementation pass, one validation run, one commit, and one consolidated PR comment/update where possible; individual thread replies happen after the batch.
- Docs policy remains correct: docs-only no docs gate; code-bearing docs signal is `docs:approved` or `docs:not-applicable`; `docs:rejected` blocks.
- No active `skip-docs` behavior/guidance or label provisioning remains.

Validation evidence:
- `squad-reviews`: `npm test -- --test-reporter=dot` passed 92/92.
- `squad-workflows`: `npm test -- --test-reporter=dot` passed 30/30.
- Local Kickstart: installed extension JS syntax checks passed; all workflow YAML parsed; embedded GitHub scripts syntax-checked after GitHub expression normalization; cross-repo policy assertions passed; scoped `git diff --check` passed.
- Active-pattern grep found no active `skip-docs` bypass/label provisioning and no one-feedback-one implementation loop; remaining per-thread mentions are anti-pattern prohibitions or post-batch reply/resolve instructions.

### 2026-05-02T23:04:32-07:00 — Wave 2 agent prompt audits (Issues #206, #228)

**Issue #206 — reviewer.agent.md scope audit:**
- Audited `packages/pack-core/src/agents/reviewer.agent.md` against Phase 2.0 acceptance criteria.
- Verdict: scope is sound, no rewrite needed.
- Findings: All 4 acceptance criteria already met in base agent + prior branch work:
  - Terminal review scope ✅, D8 Microsoft skills cited ✅, codesmith→reviewer wiring documented ✅, R9 review-pack composition present ✅
- Fixes applied (PR #379): explicit `aks.reviewer` domain distinction in scope boundary; `## Review-pack composition (R9)` heading with structured list; `core.search_components` in tools.
- Resolved rebase conflicts between two prior branch commits (a1e34860 and 28659c54) by merging best of both sides.

**Issue #228 — Full prompt drift audit:**
- Audited all 9 `*.agent.md` files against D1-D14 decisions, constraint-spec v1.1.1, and tool registration state.
- Drift found:
  - HIGH: `azure-architect.agent.md` ArchitectureDiagram `"Ingress Controller"` node → deferred, tracked in open PR #375. Not re-fixed to avoid merge conflict.
  - MEDIUM: `github.publisher.agent.md` — `github:update_pr_description` listed as "planned/not available" but tool shipped in PR #364. Fixed: uncommented `userActions` entry; updated prose to use tool directly.
  - LOW (informational): `aks-manifests-author.agent.md` uses "nginx" for container image — not ingress-nginx drift, no action.
  - All other 6 files: clean.
- arm_proxy tombstone verified: no agent files reference deprecated `/api/arm-proxy`.
- Created `docs/audit/phase2-prompt-drift-audit.md` with per-file severity table.
- PR #380 created; comment posted on issue #228.
- Decisions written to `.squad/decisions/inbox/hermes-wave2.md`.
### 2026-05-02T23:04:32-07:00 — Issue #201: aks-reviewer readiness assessment extension

- **Task:** Extended `packages/pack-aks-automatic/src/agents/aks-reviewer.agent.md` with structured readiness assessment capability per D7 and Sims #2/#7.
- **Branch:** `squad/201-aks-reviewer-readiness`
- **Changes made:**
  - Updated frontmatter: added `core.helm_template` and `core.show_card` to tools array; updated description.
  - Added "When loaded with the readiness skill" section: skill activation gating on `azure-kubernetes-automatic-readiness` v1.0.0; 10-check structured checklist (resource requests/limits, anti-affinity, probes, securityContext, host namespaces, image pull policy, PDB, NetworkPolicy); ReviewCard output contract via `core.show_card`.
  - Added raw manifest review path (Sim #2): per-workload ReviewCards, session summary, FAIL remediation offer with handoff to `aks.manifests_author`.
  - Added Helm chart review path (Sim #7): render-first via `core.helm_template`, same checklist on rendered output, Helm-specific pattern flags (missing resources, mutable tags, absent anti-affinity).
- **Changeset:** `.changeset/201-aks-reviewer-readiness.md` (patch on `@aks-kickstart/pack-aks-automatic`)
- **Decisions:** `.squad/decisions/inbox/hermes-wave4-201.md` (gitignored inbox, local only for Scribe)
- **PR:** Created via `gh pr create` targeting `dev` — flagged 🟡 needs review.
- **Validation:** Markdown structure verified; no build/test scripts affect agent .md files; existing tests unaffected.
- **Decisions:** `.squad/decisions/inbox/hermes-wave4-201.md`
- **PR:** Created via `gh pr create` targeting `dev` — 🟡 needs review flagged.
- **Validation:** Markdown structure verified; no tests exist for agent .md files; existing tests unaffected.
