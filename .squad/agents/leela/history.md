## Summary (Rolled Up 2026-04-21)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For full learnings, refer to the git history or archived history files.

**Agent:** history.md  
**File rolled at:** 2026-04-21T21:36:58.305220Z  
**Remaining details:** See `.squad/agents/history.md/history-archive.md` for prior entries.

---

# Leela — Lead

## Team Updates

### 2026-04-22 — DP #1041 (OTel Revert) All Approvals Passed; Implementation Dispatched

**Milestone:** Production 404 root-cause diagnosed (Bender-15 forensics) and architectural fix approved by full DP-stage review. Leela authored DP, Zapp approved security conditions, Nibbler approved test-plan conditions.

**DP details:** `.squad/decisions/inbox/leela-1030-externalization-rollback.md` (decision file merged into decisions.md)

**Approvals:**
- ✅ Zapp-13 security review: APPROVED WITH CONDITIONS (C1: init first in handlers, C2: sanitizeError in logs)
- ✅ Nibbler-17 test-plan review: APPROVED WITH CONDITIONS (N1–N7: test inversion, lazy-init tests, handler assertions, evidence gates)
- ✅ Leela: Applied `leela:approved-dp` label to #1041

**Dispatcher:** Bender (implementation PR ownership)

**Status:** Leela locked out per Reviewer Rejection Protocol (residual lock from earlier MCP-DP session); implementation proceeds under Bender with Zapp/Nibbler oversight.

**Reference logs:** 
- Session log: `.squad/log/2026-04-22T04:40:00Z-1041-dp-approved.md`
- Orchestration logs: `.squad/orchestration-log/2026-04-22T04:40:00Z-leela-19.md`

---

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.


## Status (Summarized 2026-04-21)

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.


## Key Process Learnings (rolled)

- DP 3-step gate required before code: Issue → DP comment → Leela/Zapp approval → code
- Sprint planning gates feature work; ceremony gaps erode when not in coordinator logic
- Four-way review gate (Leela/Zapp/Nibbler/Docs) now enforced; all four labels required for merge
- PR comment resolution is non-optional; reply + resolve thread before merge
- v2 blocking chain: #474 → #475 → #476 (Step 1-3 gates); Step 4+ frozen until complete

## Recent Activity

- v2 sprint planning + #474 DP review: #474 → #475 → #476 blocking chain; APPROVE_WITH_CONDITIONS on #474
- DP #329 (MCP App IDE) APPROVED WITH CONDITIONS; DP #330 (Agents SDK) APPROVED + closed out
- PR #383 engineering docs rewrite (7 files); label-based review gate; comment-resolution process fix
- v0.6.1 deployment prep: vendor diagram assets, CI hardening, stepwise generation default


## 2026-04-21 — Four-way Review Gate + Ceremony Enforcement

Four-way PR Review Gate now live (Leela/Zapp/Nibbler/Docs). Merge blocked until all four approval labels present. Ceremony enforcement tightened with pre-dispatch blocking checkpoint. Docs gate added to DP + PR Review.

## 2026-04-21 — 6h Sprint Cadence Calibration (PR #993 pre-review amend)

Ahmed corrected post-merge that the squad runs **6-hour sprints**, not weekly. Recalibrated the just-shipped Sprint Planning + Cadence Retrospective ceremonies in PR #993 before flipping ready-for-review.

Anchor times set to **00:00 / 06:00 / 12:00 / 18:00 UTC** (Ahmed may override by editing the ceremony row directly). Sprint notes are timestamped per anchor: `.squad/sprints/{YYYY-MM-DDThh}Z.md` (e.g. `2026-04-21T12Z.md`).

**Estimate band recalibration (for 6h sprint):**
- `estimate:S` ~15 min (1 pt)
- `estimate:M` ~1 hour (3 pt)
- `estimate:L` ~3 hours (8 pt) — at most one per sprint
- `estimate:XL` >3 hours (20 pt) — **does not enter a sprint**

**XL-split rule (rationale):** the old weekly bands (2h / 8h / 24h / 80h) encoded "XL = big epic, stretches across sprints." In a 6h cadence, an XL by definition cannot fit, so the only honest way to preserve the "one PR maps to one issue, one sprint completes its scope" invariant is to refuse XL into planning and split it during triage. Keeps velocity math consistent and prevents a single item from eating an entire sprint plus silent carry-over.

**Cadence Retro output change:** instead of a new `Weekly Retro` issue, retros are appended as comments to a **rolling daily issue** `Cadence Retro · {YYYY-MM-DD}` (up to 4 comments/day, one per closed 6h sprint). Avoids 4 issues/day of noise while keeping an auditable record.

**Coordinator enforcement (`.github/agents/squad.agent.md`):** no text changes needed — the file never hardcoded "weekly," only referenced `.squad/ceremonies.md` as the source of truth. The pre-dispatch checkpoint is cadence-agnostic and still correct.

**Deferred:** did NOT retime `squad-weekly-pulse.yml` / `squad-velocity-report.yml` / `squad-daily-pulse.yml` crons — they're independent reporting workflows, not Sprint Planning inputs. Flagged in PR description as a follow-up for #992 (possible rename to `squad-sprint-pulse.yml` at 6h cadence).

### 2026-04-21 — PR #988 architecture re-review (post-nit push)
- **Outcome:** APPROVED (`leela:approved` applied).
- **Rationale:** Commit dd1e6c6 is strictly the requested nit sweep — JSDoc refresh, stale helper comment, `GalleryCardErrorBoundary`→`ComponentCardErrorBoundary` rename (def + both call sites), orphan CSS (`.playground-gallery` + breakpoints + `.playground-widget-card`) removed; `.playground-gallery-scroll` correctly retained. No layout/registry/behaviour drift.
Key findings:
- Primitive coverage complete (all 12 type files match brief). ✅
- AgentOutput Zod contract correct. ✅
- A2UI schemas must be discriminated unions with `version: 'v0.9'` literal — not v1 all-optional transcription. (C1)
- `SessionCtx` forward refs (`AppIntent`, `Artifact`, `A2UICatalog`, `Turn`, `PendingUserAction`, `AzureCredential`) must be resolved. (C2)
- `ComponentContribution.renderer` typed as `unknown` in harness — React-aware narrowing deferred to pack-core. (C3)
- `package.json` missing `zod` and `@openai/agents` as runtime dependencies. (C4)

## Archived History Note

For comprehensive work history prior to 2026-04-20, see git log and .squad/orchestration-log/. Recent sessions tracked above.

### Work queue unblocked

**Immediate (no dependencies):**
- **#998** (Bender) — Chat regression fix (S)
- **#995** (Fry) — Core tab rendering (M)
- **#997** (Fry) — Workspace layout (S)
- **#1001** (automated) — Merge ready

**Blocked on #991 merge:**
- **#987** (Fry) — Ideas tab restoration (M)

**Blocked on #998 resolution:**
- **#996** (Bender) — AKS inspiration prompt audit (M) [loose dependency; can start earlier if needed]

**Waiting on gate closure:**
- **#1000** — Pack rendering engine (Zapp + Nibbler approvals required)

---

**Decision closure:** Appended to `.squad/decisions/inbox/leela-round3-2026-04-21.md`

## 2026-04-21 — Round 3 Ceremony Closure + Post-Gate Decisions

**Five DPs Approved (2026-04-21T04:30Z):**
- #998 (chat regression, Bender, S, HIGH) → APPROVED + READY FOR IMPLEMENTATION
- #995 (Core rendering, Fry, M) → APPROVED + READY FOR IMPLEMENTATION
- #996 (AKS brittleness, Bender, M) → APPROVED but depends on #1000
- #997 (workspace black void, Fry, S) → APPROVED + READY FOR IMPLEMENTATION
- #987 (Ideas tab, Fry, M) → APPROVED but depends on #991 merge

**Two PRs Under Review:**
- **PR #1000** (pack rendering, #991) → **REJECTED** by Zapp + Nibbler. Red CI (TS2307/TS2352) + missing CI grep rule. Fry locked out; bender-1000-revise assigned to add CI step + allow-list comment.
- **PR #1001** (emit_ui fixture, #980) → ✅ **MERGED.** All gates green. Shipped explicit-op discriminator coverage.

**Process Milestone:**
- PR #993 (ceremony enforcement) merged (commit c90f5da). Mechanical 4-way gate + docs gate now active on all future PRs.
- All future PRs require: `leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` ∨ `docs:not-applicable`) + green CI.
- No override path; gate is blocking at merge time.

**In-flight Dispatches:**
- bender-998 (chat fix, HIGH) — unblocked, implementation ready
- bender-1000-revise (pack rendering fix) — Reviewer Rejection Protocol applies; Fry locked out
- fry-995 (density bugs) — ready, unblocked
- fry-997 (black void) — ready, unblocked

**Key DP-Time Security Decisions:**
1. Structural invariant test for strict-mode schema compliance (Object.keys(properties) ⊆ required)
2. Ideas-tab curated-only model; future user-supplied inspirations will reopen threat
3. Composition-reliability harness constraints: fail-loud, ≤2 retries, redacted logs
4. DP-time conditions enforce at PR time non-negotiable (Reviewer Rejection Protocol on #1000 sets precedent)

## 2026-04-21 — PR #1046 Post-Mortem: OTel Deploy Hotfix Triage

### Context
PR #1046 (commit ef4d8f0f) merged, deploying DP Amendment #1 / Option B:
- `.funcignore` created at `packages/web/api/.funcignore` — does NOT list `node_modules/`
- `materialize-api-externals.mjs` postbuild copies 152 OTel/AppInsights packages to `packages/web/api/node_modules/`
- CI verify step PASSED: packages confirmed present on disk in `packages/web/api/node_modules/`
- SWA deploy completed ("Status: Succeeded")
- Smoke check: IDENTICAL 8× HTTP 404 empty body failure

### Key Evidence (run 24755110357, job 72426556545)

**Zip timing analysis (definitive):**
- Web app zip (27MB): 0.87 seconds → ~31 MB/s effective throughput
- API zip: **5.52 seconds** → at same rate = **~171MB** of content
- API without node_modules: only ~29MB → expected zip time ~0.94s → DOES NOT EXPLAIN 5.52s
- API with node_modules (223MB total, ~143MB after .funcignore exclusions): ~171MB → matches 5.52s
- **Conclusion: StaticSitesClient IS including node_modules in the API zip. `.funcignore` IS being respected.**

**Critical structural issue found:**
- `packages/web/api/package.json` lists `"@aks-kickstart/harness": "*"` as a runtime dependency
- `@aks-kickstart/harness` is a private workspace-only package — NOT published to npm
- The Azure SWA platform processing window is ~30 seconds ("Status: InProgress")
- If the platform runs `npm install` on the deployed API (server-side), it FAILS on `@aks-kickstart/harness` → broken/empty node_modules → MODULE_NOT_FOUND → 404

**`appinsights.ts` module-level side-effect confirmed:**
- Static ESM imports from `@azure/monitor-opentelemetry`, `@opentelemetry/sdk-trace-base`, etc. at top of module
- Module-level IIFE `{ initializeAppInsights(); }` runs at load time
- If ANY static import fails → module fails to load → all functions never register → 404

**`.funcignore` mechanism scope confirmed wrong in Option B theory:**
- `.funcignore` was designed for `func pack` (Azure Functions Core Tools CLI)
- `entrypoint.sh` just runs `./StaticSitesClient $INPUT_ACTION` — no `.funcignore` reading visible
- However, timing evidence suggests StaticSitesClient DOES either (a) respect `.funcignore` OR (b) always includes node_modules with `skip_api_build: true`

### Learnings

1. **Zip timing is a reliable proxy for zip content**: app(27MB)/0.87s ratio establishes per-step compression throughput; API's 5.52s implies ~171MB, consistent with node_modules included.

2. **The verify CI step is necessary but NOT sufficient**: it confirms packages are on disk in CI runner at step time, but says nothing about what the SWA platform does AFTER upload.

3. **`@aks-kickstart/harness: "*"` in API package.json is a deployment landmine**: Any server-side `npm install` attempt will fail because this workspace package is not on the public npm registry.

4. **The root 404 cause is ambiguous between two scenarios**:
   - (A) Packages ARE in zip but Azure SWA platform reinstalls node_modules server-side → workspace dep failure → broken node_modules → 404
   - (B) Packages ARE in zip and deployed, but OTel static ESM imports fail at Azure Functions v4 worker startup → uncaught module-load error → all routes 404

5. **Option B (`.funcignore`) theory was based on wrong model**: the mechanism works but was solving the wrong problem. The packages ship, but something post-deploy breaks them.

6. **The definitive bifurcation test**: deploy a minimal `/api/ping` function with ZERO external/OTel imports. If ping→200 but health→404, the cause is OTel-specific. If ping→404, cause is deployment infrastructure.

## 2026-04-21 — DP: #1030 Externalization Rollback (Issue #1041)

### Context
Coordinator forensic analysis identified `17b2fbd9` as the breaking commit (PR #1030/#1034). Last green: `60f6420b`. DP posted to #1041 as authoritative fix proposal.

### Verified Regressions (two independent, stacking)

1. **Esbuild externalization** (`esbuild.config.mjs:86–100`): Changed from `external: ["@azure/functions-core"]` to externalizing 10 OTel packages. The `materialize-api-externals.mjs` script fails to produce the complete transitive closure (misses peerDependencies). Missing deps → ESM import fails at module load → worker crash → 404.

2. **Eager module-load IIFE** (`appinsights.ts:267–269`): Changed from conditional `startAzureMonitor(connString)` (env-var gated) to unconditional `initializeAppInsights()` at module load. Any throw kills function registration → 404.

### Key Architectural Insight: globalThis Singleton

The externalization rationale ("multiple bundled copies wipe each other's OTel providers") was overcorrection. `@opentelemetry/api` uses `globalThis[Symbol.for('opentelemetry.js.api.1')]` — a process-global singleton via `Symbol.for()`. Bundling multiple copies into different function bundles still yields ONE provider registry per worker process. The `Symbol.for('kickstart.azmon.started')` guard adds a second layer of idempotency.

### DP Outcome
- **Fix:** Restore bundle-everything, delete materialize script, make init lazy (handler-level), keep verify script with inverted assertions, keep all #1030 redaction/pipeline work.
- **Assigned:** Bender (backend), with fabrication guard (must paste build + grep evidence).
- **Reviewers:** Leela (arch), Zapp (security), Nibbler (tests, sonnet model).
- **Decision file:** `.squad/decisions/inbox/leela-1030-externalization-rollback.md`

### Learnings

1. **`globalThis` + `Symbol.for()` is the correct singleton mechanism for OTel in per-function esbuild bundles.** Externalizing to "share module identity" is unnecessary when the library already uses process-global singletons.

2. **Module-load side effects are deployment landmines.** An unconditional IIFE that calls into an external dependency at import time has zero fault isolation — any throw kills the entire function registration chain.

3. **Transitive closure of peerDependencies is structurally unreliable.** The materialize script only walked `dependencies` and `optionalDependencies`. `@azure/monitor-opentelemetry`'s peerDeps include most `@opentelemetry/*` packages. This is a fundamental design flaw in the externalization approach.

4. **DP #1046 Option B (`.funcignore`) was disproved empirically.** Merged, zero impact. Validates the "try, measure, learn" approach but underscores the need for root-cause analysis before shotgun fixes.

5. **Preview envs as regression canaries:** Builds predating the breaking change (April 10–14) still serve 200, providing a reliable baseline comparison for deploy-infrastructure vs. code regressions.

6. **SWA server-side `npm install` is a platform-level mutation point outside our control.** `skip_api_build: true` only disables client-side Oryx — the SWA service still runs `npm install --production` during the ~30s post-upload window. This can overwrite any `node_modules/` materialized client-side. Before #1030, bundles were self-contained and indifferent to `node_modules/` state (the server-side install was harmless). After #1030, bundles critically depend on `node_modules/`, turning the latent hazard into the production outage. Documented by Ahmed on unmerged `swa-pkg-fix` branch (`68e5f875`). Confirmed empirically by Bender-15: `request-context` header on 404s proves HOST up, WORKER crashed. Bundling is the only strategy that makes function bundles immune to this deploy-infra mutation.

7. **DP addendum posted** to #1041 incorporating Bender-15's deploy-infra findings. Adds: server-side `npm install` as pre-existing hazard in §2, bundling-as-immunization in §4, `node_modules/` mutation risk in §5, and metafile-based external verification in §9.
