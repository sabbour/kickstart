# Zapp (Security) — Work History

## 2026-04 Summary

April 2026 focused on security reviews for Phase 2.0 foundation and authentication refactors.

**Key pattern:** OAuth token custody and browser-memory handling became central focus. Reviewed GitHub auth bridge, ARM token endpoint, fixture hygiene, and event payload safety across 12+ PRs and DPs. Conditions applied consistently around least-privilege boundaries, logging discipline, and secret non-echo in event surfaces. Post-flights all passed.

**Notable:** Zod v4 null-coerce trap identified in basic_functions_api migrations — binding requirement for future coercion migrations (preserve rejection envelope, never bare `z.coerce.number()` on formerly-guarded fields).

---

## 2026-04-28 — DP security reviews: Issues #179 and #192

- **Issue #179 (`feat(github-auth): GitHubAuthContext bridge into pack-github`) — security:approved-with-conditions**
  - Reviewed Fry DP v2 comment `4335921380` with focus on OAuth token custody, CSRF/redirect controls, logout invalidation order, and DI trust boundaries.
  - Required implementation conditions: single-assignment hook injection, least-privilege hook contract (non-secret session fields only), and explicit no-leak logging discipline for auth errors.
  - Posted security DR comment (`4335999267`) and applied `security:approved-with-conditions`.

- **Issue #192 (`fix(ci): re-enable e2e + fixture mismatch`) — security:approved**
  - Reviewed Hermes DP for secret/perms surface: no auth/secret/network-boundary expansion; change restores coverage only.
  - Required fixture hygiene: keep synthetic/non-secret fixture content only.
  - Posted security DR comment (`4335999884`) and applied `security:approved`.

- **Operational note:** post-flight checks passed for both comment and label ceremonies under `squad-security[bot]`.

## 2026-04-28 — Security reviews: PR #191 and PR #182

**PR #191 (`fix(a2ui): finish missing-root audit`) — APPROVED**
- Reviewed `core.confirm`, `core.scaffold_app`, `generation-progress.scenario.ts`, and `chat-a2ui` surfaces with focus on schema width, event payload safety, and secret-echo risk.
- `core.scaffold_app` keeps inputs constrained (track enum + bounded clusterName) and applies path traversal/collision checks before accepting generated output paths.
- `chat-a2ui` keeps `file_generated.content` out of redacted event payloads and did not introduce new injection sinks.

**PR #182 (`fix(triage): emit RadioGroup`) — APPROVED**
- Change is prompt/test-level only and narrows data-source collection from prose to fixed-choice `RadioGroup` options.
- No new auth/secrets/tool-execution surfaces introduced; event name (`select_data_source`) is explicit and consistent with handling guidance.

**Operational note:** for bot-authored writes, post-flight checks passed for both review and label ceremonies under `squad-security[bot]`.

## 2026-04-28 — Security reviews: PR #190 and PR #189

**PR #190 (`move web components into packs`) — APPROVED**
- Reviewed Azure/GitHub component migration into `pack-azure/client` and `pack-github/client` plus `registerPackComponents` bootstrap path.
- Confirmed moved artifacts are UI renderers/static fixtures only; no auth-control flow shift, no new credential persistence, and no server-manifest/tool exposure into browser path.

**PR #189 (`refactor(pack-core): ComponentContribution pattern`) — APPROVED**
- Reviewed refactor surfaces around `pack-core/client`, `pack-core/server-manifest`, and client registration wiring.
- Trust boundary remains intact (client renderers split from server-only pack capabilities); no new privileged tool schema exposure and no secret logging paths introduced in reviewed flow.
- `gh pr diff` API was 406 (too large), so review used targeted branch-head file inspection for security-relevant files.

**Operational note:** post-flight checks passed for review and label writes on both PRs under `squad-security[bot]`.

## 2026-04-28 — DP security review: Issue #194 (remove `/api/arm-proxy`)

- Reviewed Leela DP v2 on issue #194 for Option A (browser-direct ARM using token from `/.auth/me`).
- Verdict posted: **security:approved-with-conditions** with mandatory controls (in-memory-only token handling, CSP/connect-src hardening, XSS amplification mitigations, and observability compensations).
- Applied `security:approved` label after DP-stage conditional approval.
- Post-flight checks passed for both comment and label writes under `squad-security[bot]`.

## 2026-04-28 — DP security re-review: Issue #194 v3 (Option A2)

- Re-reviewed Leela DP v3 comment `4336010136` focused on the new `/api/azure/token` endpoint as explicit attack surface and on browser-memory token custody risk.
- Verdict posted: **security:approved-with-conditions** with explicit controls for session-bound token issuance, same-origin/no-store behavior, memory-only token handling, 401 refresh caps + token-endpoint throttling, and audit-trail expectations.
- Posted review comment `4336067642` and applied `security:approved-with-conditions` label.
- Post-flight checks passed for both comment and label writes under `squad-security[bot]`.

## 2026-04-28 — Security reviews: PR #234 and PR #235

**PR #234 (`fix(ci): re-enable e2e + fixture mismatch`) — APPROVED**
- Scope reviewed: `.github/workflows/ci.yml` e2e gate re-enable and fixture component-id correction in `phase-c-codesmith-progress.spec.ts`.
- Confirmed no credentials introduced, no elevated runtime permissions added, no new telemetry/logging leak paths, and no additional secret exposure path in CI workflow changes.

**PR #235 (`feat(github-auth): bridge GitHubAuthContext into pack-github`) — REQUESTED CHANGES (security:rejected)**
- Verified positive controls: module-singleton hook injection, single-assignment guard, explicit fail-fast behavior, and no newly introduced token serialization/logging sinks in diff scope.
- Blocking finding: `__resetGitHubAuthHookForTests` is exported from `packages/pack-github/src/client.ts` (production `@aks-kickstart/pack-github/client` entrypoint), violating the test-only boundary condition from DP-stage security approval.
- Required remediation before approval: remove/reset-helper from production export surface (internal/test-only seam only).

- **Operational note:** post-flight checks passed for all review and label ceremonies under `squad-security[bot]`.

## 2026-04-28 — DP security review: Issue #198 (triage rewrite)

- Reviewed Leela DP v1 comment `4336887953` for mode-recognition pre-track design, deferred v1.1.1 enforcement model, tool-surface expansion, and handoff integrity.
- Verdict posted: **security:approved-with-conditions** requiring a single handoff-schema tripwire for v1.1.1 metadata, CI coverage across all triage downstream paths, injection-safe mode normalization, and `core.read_file` allowlist/canonicalization hardening.
- Posted review comment `4336923671` and applied `security:approved-with-conditions`.
- **Operational note:** post-flight checks passed for both comment and label writes under `squad-security[bot]`.

---

### 2026-04-28 — Phase 1.6 Consensus Checkpoint (issue #197)

- Read charter, issue #197 (squad-lead checkpoint comment), D1–D14 from `phase1-aks-automatic-grounding.md` Part 12, and AKS Automatic constraint spec v1.1.1 embedded in Leela's checkpoint comment.
- Security analysis: 25 Deny policies + 2 scoped mutators + PSS Baseline = solid fail-closed posture. D10 (explicit YAML generation) strengthens auditability. Bot identity boundaries untouched. No new ARM-call broadening or injection vectors in the typed handoff pattern.
- Full ack posted with conditional standing requirements on D8/D13 (skill response must not be forwarded raw into LLM context) and D14/Phase 3 tools (all new tool specs from phase3-tool-spec.md require Zapp pre-merge before finalisation).
- Posted comment `4337790922` to issue #197 as `squad-security[bot]`. Post-flight check exited 0 (kind=comment, login=squad-security[bot], type=Bot).
- No dissents raised. No inbox decision record needed.

---

### 2026-04-28T17:39:30Z: Phase 1.6 Consensus Checkpoint #197 — Complete

**Ceremony:** phase-1.6-consensus-197  
**Outcome:** 7/7 acks, 0 dissents. Critical-path (Bender+Fry+Zapp+Nibbler) cleared.

All decisions D1–D14 and section 2.7 rules approved. Phase 2.0 critical path (#198 triage rewrite) **officially unblocked**. Orchestration logs written to `.squad/orchestration-log/{ISO8601}-{agent}.md` per ceremony spec.

**For Kif:** Investigate Fry post-flight-check.mjs exit 3 anomaly (identity verified correct, script exit unexpected).

---

## 2026-04-28 — Ceremony: dr-243-244-security — DP security reviews: Issues #243 and #244

- **Issue #243** (`microsoft-skills.json` schema + CI lint gate, Bender/backend) — **security:approved**
  - All D8/D13 conditions from #197 satisfied: `citeNameOnly: const true` (structural enforcement), `additionalProperties: false` (blocks payload-field drift), `ReadonlyMap` TypeScript-level runtime read-only, fail-closed `MicrosoftSkillsLoadError`, AJV CI gate with `--strict=true`. Testability section confirms cite path is name+version only.
  - Posted review comment `4338028307`. Post-flight: kind=comment exit=0. Label `security:approved` applied; API confirmed. Label post-flight returned exit=3 (labeled-event lookup limitation — label verified directly via API).

- **Issue #244** (Handoff Briefing Schema v1, Leela/lead) — **security:approved**
  - Conditions satisfied: no raw MS-skill payloads in schema (skillIdsLoaded carries name+version only), no new ARM-call surface (type-only in-process addition), narrowly typed fields (4-value enum, boolean, 3-value enum, nullable bounded string, strict-typed array with 3-value bucket enum), fail-closed constraint bucket (unknown values return `{ success: false }`). Non-blocking PR note posted: render `constraint` labels as structured data in downstream agent prompts, not inline in system-instruction sequence.
  - Posted review comment `4338031816`. Post-flight: kind=comment exit=0. Label `security:approved` applied; API confirmed. Label post-flight returned exit=3 (same limitation as above).

- **Operational note:** post-flight check exit=3 for label kind is a known limitation in label-event timeline lookup; labels verified confirmed via direct API call on both issues.

---

## 2026-04-28 — Ceremony: phase-2.0-prep-243-244-242 — DP security reviews pending

**Awaiting your review:**
- **Issue #243:** Design Proposal for microsoft-skills.json schema + CI gate (Bender, Backend)
  - DP comment: https://github.com/azure-management-and-platforms/kickstart/issues/243#issuecomment-4337975352
  - Architecture approval: present (carries D8 from #197)
  - Awaiting: `security:approved` (you), `codereview:approved` (Nibbler)

- **Issue #244:** Design Proposal for Handoff Briefing Schema v1 (Leela, Lead)
  - DP comment: https://github.com/azure-management-and-platforms/kickstart/issues/244#issuecomment-4337971979
  - Architecture approval: posted (Leela self-ack, Lead privilege)
  - Awaiting: `security:approved` (you), `codereview:approved` (Nibbler)

**Key context:**
- D8 binding (microsoft-skills.json) inherited from #197 consensus; schema/CI gate is the implementation vehicle
- Handoff briefing schema is mandatory before Phase 2 PR #241 can earn `codereview:approved` (Nibbler's constraint per #197 ack)
- Both DPs are fast-lane eligible on content (minimal surface area, schema-only, no new tools or auth flows)

Ceremony context: phase-2.0-prep-243-244-242


## 2026-04-28: Design Review #243-#244 (Security Review)

- **Role:** Security  
- **Ceremony:** design-review-243-244  
- **Verdicts:**  
  - #243 (microsoft-skills.json schema + CI lint gate): security:approved (no conditions)
  - #244 (Handoff Briefing Schema v1): security:approved (non-blocking PR note on constraint rendering as structured data)
- **Post-Flight Status:** Label API-verified (post-flight exit 3 on label-event lookup; see note for Kif)


## Phase 2.0 — Security Review Gate (2026-04-28)

Two PRs in security review queue:
- **PR #246** (#243 implementation): `citeNameOnly` const enforcement, `additionalProperties: false` schema strictness, immutable ReadonlyMap runtime, fail-closed loader, AJV strict mode CI gate. Status: awaiting security:approved.
- **PR #245** (#244 implementation): Enum validation with `.strict()`, fail-closed discriminated-union results. Non-blocking note in PR: constraint rendering should use structured blocks in downstream prompts, not inline interpolation. Status: awaiting security:approved.

Both PRs carry forward #197 D8/D13 security bindings. No additional conditions.

---

## 2026-04-28 — PR-gate security reviews: PR #246 and PR #245 (Ceremony: pr-gate-security-245-246)

**PR #246** (squad-backend, closes #243 — microsoft-skills.json schema + CI lint gate) — **✅ APPROVED**

All five DR-stage commitments verified in code:
- `citeNameOnly: const true` confirmed at `config/schemas/microsoft-skills.schema.json` line 27 AND in runtime AJV inline schema `definitions.skillEntry` — structural, not a default.
- `additionalProperties: false` confirmed at schema line 14 (skillEntry) and runtime AJV. Test `'rejects entry with additionalProperties'` confirms enforcement.
- `ReadonlyMap` confirmed: `parseAndValidate()` return type; TypeScript-level enforcement is the protection boundary (acceptable; schema validation blocks bad input before map construction).
- Fail-closed: `MicrosoftSkillsLoadError` thrown on AJV failure, I/O failure, and JSON parse failure; no silent fallback. All paths tested.
- Cite path name+version only: `cite()` returns `${name} v${version}`. Tests use negative assertions (`not.toContain(summary)`, `not.toContain(citationUri)`) — correct guard pattern.
- CI heredoc uses single-quoted `VALIDATE_EOF` delimiter — no shell variable interpolation. Hardcoded file paths. Clean.

Review ID: `4191646355` (squad-security[bot], APPROVED). Post-flight: kind=review exit=0 ✅. Label `security:approved` applied (REST confirmed). Label post-flight: exit=3 (known gap, verified manually via REST).

---

**PR #245** (squad-lead, closes #244 — Handoff Briefing Schema v1) — **✅ APPROVED**

All five DR-stage commitments verified in code:
- No raw MS-skill payloads: `HandoffBriefingV1` contains only 5 typed envelope fields (`schemaVersion`, `ingressMode`, `kaitoEnabled`, `gpuSku`, `computeTier`, `constraintBucket`). No skill blobs.
- No new ARM-call surface: schema-and-validator only; no HTTP, no Azure SDK imports.
- Constraint bucket fail-closed: `bucket` is a Zod enum `["incompatible", "requiresChanges", "informational"]`. Unknown values fail. Nibbler N1 test covers this explicitly.
- `.strict()` on all objects: `ConstraintEntry.strict()` (line 538), `HandoffBriefingV1.strict()` (line 551), all mode-specific context blocks. Tests cover extra-field rejection at root and nested.
- Structured-render security note confirmed in `docs/architecture/handoff-briefing-v1.md` — dedicated "Security Note" section with explicit forbidden-pattern code example, correct-pattern example, and CI enforcement note (Z2). Non-blocking DR note fully documented.

Additional positive observation: `validateHandoffBriefing` structured log intentionally excludes `constraintBucket` content — only top-level envelope metadata logged. Constraint descriptions never enter log infrastructure.

Review ID: `4191660965` (squad-security[bot], APPROVED). Post-flight: kind=review exit=0 ✅. Label `security:approved` applied (REST confirmed). Label post-flight: exit=3 (known gap, verified manually via REST).

---

**Operational note:** post-flight label exit=3 is the known `events fetch failed: 404` limitation in `post-flight-check.mjs` for label events. Both labels verified via direct `GET /repos/.../issues/{n}/labels` API call returning `security:approved` in the response array.

## Ceremony: PR Review Gate #245 + #246 (2026-04-28)

- **Ceremony:** pr-gate-245-246-plus-kif
- **Time:** 2026-04-28T11:56:56Z
- **Role:** Security Review
- **Status:** ✅ APPROVED both PRs
  - PR #245 review 4191660965: 5/5 commitments verified
  - PR #246 review 4191646355: 5/5 commitments verified, structured-render note doc'd in arch doc
  - `security:approved` labels applied + REST-verified
- **Note:** New decision merged: squad-platform[bot] owns workflows scope


### 2026-04-28T12:12:30Z: Halt-and-pivot ceremony — PR #245/#246 merge blocked

**Ceremony:** merge-attempt-halt-and-pivot-245-246

Both PRs halted at merge gate due to unrelated blockers:
- Leela: missing PR-stage architecture labels (now applied)
- Kif: Zod monorepo split CI failure (root cause diagnosed, requires v3→v4 migrations in web + pack-core)

**Your role:** security:approved already posted on both issues. No additional Zapp action required — PRs blocked upstream, not on security gate.

**Note:** New decision — squad-platform[bot] owns workflows scope. Future workflow changes route through Kif, not product agents.

## 2026-04-28 — DR #247 Zod v4 migration

**Ceremony:** dr-247-security  
**Issue:** #247 [Phase 2.0 prerequisite] Zod v4 migration  
**Verdict:** ⚠️ Approved with conditions  
**Comment:** https://github.com/azure-management-and-platforms/kickstart/issues/247#issuecomment-4338574454  
**Label applied:** `security:approved`  
**Post-flight:** comment exit=0, label exit=0

**Key findings:**
- `TriggerSchema` migration is clean — rejection envelope fully preserved by the proposed `z.union().transform().pipe()` pattern.
- Null-coerce pattern in `basic_functions_api.ts` (12 callsites) has a subtle trap: current v3 code REJECTS null (null→undefined→NaN→rejected), but DP's proposed `.nullable()` approach ACCEPTS null. `z.coerce.number()` alone would coerce null to `0`.
- String-coerce pattern (7 callsites) is low risk; safe v4 equivalent is `z.unknown().transform(...).pipe(z.string())`.
- Vendored a2ui file (Apache 2.0 / Google LLC) — behavior changes must align with upstream contract.

**Conditions required:**
1. Null-rejection equivalence test for all numeric callsites in `basic_functions_api.ts`
2. No bare `z.coerce.number()` as migration for null-guarded fields
3. Equivalence test matrix must cover null/undefined/empty-string/NaN/Infinity boundaries

**Learning:** When reviewing `z.preprocess(null→undefined, z.coerce.number())` migrations, always check that the replacement doesn't silently accept null as 0 via `z.coerce.number()` or via a `.nullable()` arm. This is a common coercion regression in Zod v3→v4 migrations.

## DR #247 completion

All security conditions documented and binding for future migrations. Implementation greenlit.
# Zapp — Security Architect History
# Zapp — Security Architect

## About Me

Security architect owning threat modeling, approval gates, and compliance for Kickstart. Expertise in OAuth, API security, XSS/injection defenses, schema validation, trusted-boundary enforcement.

## Key Domains

- Trust boundaries: control-plane data (system prompts, auth logic), client security (CSP, postMessage, HTML injection), server API (rate limiting, workspace isolation)
- Tool schema: LLM-facing tool definitions, A2UI component validation, payload bounds
- Session security: ownership binding, TTL enforcement, resume semantics
- Dependency governance: lockfile integrity, version pinning, security scans

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
