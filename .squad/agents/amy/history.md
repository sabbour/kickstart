# Amy — History

## Project Context
**Project:** Kickstart — AI-powered project scaffolding tool
**Stack:** TypeScript, Node.js, React, Docusaurus
**User:** Ahmed Sabbour
**Joined:** 2026-04-24

## Learnings

- **2026-05-02 10:53 — PR #358 "Fixing" Docs Review (Infrastructure/Framework):** Reviewed PR #358 (50 files, +1050/-835) targeting internal Squad framework refactoring: `.github/extensions/squad-*`, `.github/workflows/squad-*`, `.squad/agents/*/charter.md`, `.squad/templates/`, and governance documentation. **Verdict: APPROVED (review ID 4215340888).** Zero product-user-facing docs impact (docs-site/, README.md, API refs, guides untouched). Changesets gate passed (SUCCESS). Coherence checks on `.github/copilot-instructions.md` (squad-identity/reviews/workflows blocks, lines 48–131) and `.squad/skills/squad-identity/SKILL.md` (role config + GIT IDENTITY steps + anti-patterns, lines 37–190) confirmed alignment with current agent tooling signatures. Framework infrastructure properly documented. No user-facing blockers.

- Reviewed `.changeset/237-arm-direct.md` and `docs-site/` impact for PR #239 (issue #237).
- **Verdict: docs:approved.** Posted approving review (id 4190482122) and applied `docs:approved` label as `squad-docs[bot]`. Both writes verified by post-flight identity check.
- Changeset is correct: `@aks-kickstart/web: minor`, user-voice body covers the direct browser→ARM path, the new `GET /api/azure/token` endpoint, memory-only token guarantee, 401 retry semantics, CSP update, and the one-week proxy rollback safety net.
- Public docs (`docs-site/docs/extending/api-endpoints.md`) still describes `/api/arm-proxy` and does not yet mention `/api/azure/token`. Deferred the rewrite to PR-2: the proxy is still live this week (rollback safety net), so removing it from docs now would make them less true; PR-2's atomic delete-and-document is the cleanest moment. Will hold PR-2 to a strict bar on this.
- Flagged ADR gap (non-blocking): the ARM trust-boundary move (server-side proxy → direct browser call with SWA token) deserves an ADR. Decision is Leela's; suggested ADR-0004. Filed a decision-inbox entry recommending this.

## 2026-04-28 17:44 — Phase 1.6 Consensus Checkpoint Ack (Issue #197)

**Task:** Acknowledge Phase 1.6 consensus checkpoint from Leela with squad-level ratification of D1–D14 + AKS Automatic constraint spec v1.1.1 §2.7.

**Evaluation (docs perspective):**
- ✅ **D1 (HTTP scale-to-zero honesty)**: DOCUMENTABLE. KEDA HTTP add-on is NOT managed. Requires careful caveat docs so users understand boundary between event-triggered (managed ✅) and HTTP (not managed). Changeset story clear.
- ✅ **D2 (Default ingress)**: DOCUMENTABLE. App Routing + Gateway API is clean and user-facing.
- ✅ **D3 (Enterprise ingress)**: DOCUMENTABLE. RadioGroup with cost + capability comparison. User-facing choice.
- ✅ **D4 (RAG default)**: DOCUMENTABLE. Match inference choice (Foundry + Azure AI Search vs KAITO RAG). Coherent user story.
- ⚠️ **D5 (Postgres tier + upgrade trigger)**: DOCUMENTABLE. Needs changelog: users may see tier recommendations shift from baseline. Upgrade-signal framing is feature-worthy.
- ✅ **D6 (KAITO auto-enable)**: DOCUMENTABLE. Opt-in, auto-included per track. Clear.
- ✅ **D7 (Readiness agent home)**: INTERNAL (no user docs needed).
- ✅ **D8 (Microsoft skills verbatim integration)**: DOCUMENTABLE. Requires citation rules in docs.
- 🔴 **D9 (Observability explicit in Bicep, NOT auto-attach)**: CRITICAL CAVEAT. "Observability is NOT auto-attach for Bicep-generated clusters — you must enable it explicitly." This is a user-surprise boundary. Docs must surface this loudly.
- ✅ **D10 (Resource requests + anti-affinity explicit)**: DOCUMENTABLE. Generated YAML is readable and safeguard-compliant.
- ✅ **D11 (KEDA default-on)**: DOCUMENTABLE.
- ✅ **D12 (KAITO NOT default-on)**: DOCUMENTABLE.
- ⚠️ **D13 (GPU quota preflight required)**: DOCUMENTABLE. User-facing gating. Changelog story for "GPU plans now gate on quota availability".
- ⚠️ **D14 (Pricing finalization)**: DOCUMENTABLE. Cost cards via tools + honest exclusion-line-items caveat. Changelog story for "pricing transparency on every plan".

**AKS v1.1.1 §2.7 (10 binding rules):**
- Rules 1, 2, 3, 9: Observable in user-facing docs + plan cards (observability enablement, policy compliance, probes-as-advisory, skill citation). Constraint-clear.
- Rules 4–8, 10: Implementation rules (Gateway API only, Workload Identity 4-resource pattern, Karpenter framing, constraint-bucket typing, GPU gating). All integrable into plan-card payloads and docs surfaces.

**Ack Posted:** `✅ Acked: D1–D14, AKS Automatic constraint spec v1.1.1 §2.7` (comment IC_kwDOSKrIb88AAAABAo01Ng, 2026-04-28T17:44:32Z, posted as `squad-docs[bot]`).

**Key docs dependencies for Phase 2.0:**
- #219–#222: Framework docs updates (D1 caveat, D9 Bicep observability, D13 GPU quota, D14 pricing clarity)
- #223: Recipe documentation pass (update all 12 recipe cards with D1/D9/D13 caveats + changeset hooks)
- Phase 2.0 PR changesets: each carry D5/D14 cost-frame justifications for Postgres tier + pricing transparency

**Docs review gate ready:** Will enforce §2.7 rules 1, 2, 9 (observable compliance) on all Phase 2.0 PRs.

---

### 2026-04-28T17:39:30Z: Phase 1.6 Consensus Checkpoint #197 — Complete

**Ceremony:** phase-1.6-consensus-197  
**Outcome:** 7/7 acks, 0 dissents. Critical-path (Bender+Fry+Zapp+Nibbler) cleared.

All decisions D1–D14 and section 2.7 rules approved. Phase 2.0 critical path (#198 triage rewrite) **officially unblocked**. Orchestration logs written to `.squad/orchestration-log/{ISO8601}-{agent}.md` per ceremony spec.

**For Kif:** Investigate Fry post-flight-check.mjs exit 3 anomaly (identity verified correct, script exit unexpected).


## Phase 2.0 — PR Review Gate / Docs Review (2026-04-28)

Two PRs awaiting docs review and full PR Review Gate:
- **PR #246** (#243): Includes `docs/skills/microsoft-skills-format.md` user-facing doc, changeset, all tests passing.
- **PR #245** (#244): Includes `docs/architecture/handoff-briefing-v1.md` architecture doc with structured-render guidance, changeset, all tests passing.

Both changesets authored by implementing agents (Bender, Leela). Amy reviews changeset quality and curates CHANGELOG on release.

**Downstream context:** PR #241 (`squad/198-triage-rewrite`) will unblock for rebase after #245 merges; can then import typed `HandoffBriefingV1` / `ConstraintEntry` and reference architecture doc.
(new agent — no learnings yet)
### 2026-04-27 — Docs Scope Audit (docs:not-applicable overuse)

**Task:** Ahmed flagged that `docs:not-applicable` had been applied too broadly across 10 open PRs. Conducted a full audit and corrected 9 of them.

**Decisions Made:**
- `docs:not-applicable` was incorrectly applied to PRs introducing new public interfaces, new APIs, new environment variables, new SSE event types, architecture changes, user-facing behavior changes, and developer tooling changes.
- Only PR #144 (triage prompt slim — pure internal token-count optimization, no new interfaces or behaviors) correctly carried `docs:not-applicable`.

**Documentation Written:**
- `docs-site/docs/extending/session-store.md` — ISessionStore interface, InMemorySessionStore, createSessionStore factory, custom adapter guide (PR #139)
- `docs-site/docs/extending/agent-as-tool.md` — asTool() API reference and specialist consultation patterns (PR #142)
- `docs-site/docs/extending/guardrails.md` — guardrail rules, SSE events, KICKSTART_GUARDRAILS_DISABLED kill-switch, custom guardrail authoring (PR #145)
- `docs-site/docs/extending/runner-chain.md` — runChain/runWithGate/ChainDepthExceeded API reference and migration guide (PR #147)
- `docs-site/docs/architecture/decisions/ADR-0003-sdk-native-parallel-guardrails.md` — ADR for SDK-native parallel guardrail pipeline decision and tradeoffs (PR #149)
- `docs-site/docs/getting-started/environment-variables.md` — KICKSTART_USE_RESPONSES flag (PR #154) and KICKSTART_GUARDRAILS_DISABLED (PR #145)
- `docs-site/docs/getting-started/local-setup.md` — Authentication States section for graceful auth UX (PR #122)
- `docs-site/docs/guides/conversation-limits.md` — MaxTurns recovery card and token budget trimming guide (PR #134)
- `docs-site/docs/contributing.md` — Strict Zod schema requirements for tool/schema files (PR #137)
- `.squad/skills/pr-workflow/SKILL.md` — Expanded docs scope definition and mandatory Amy sign-off for `docs:not-applicable`

**Process Change:**
- Updated the PR workflow skill so implementing agents (Bender/Fry/Hermes/@copilot) can no longer self-apply `docs:not-applicable`. Only Amy can apply it after explicit review.
- Created `squad/amy-docs-scope-audit` branch with the SKILL.md change.
- Written directive summary to `.squad/decisions/inbox/amy-docs-scope-audit.md`.

**Bot Identity:** `squad-docs[bot]` (app slug: `squad-docs`, app ID 3492820)
- Initial post-flight runs used wrong expected-login `sabbour-squad-docs[bot]` (should be `squad-docs[bot]`) — caught by post-flight check on PR #139, revoked, re-applied correctly.
- All 9 × comments + 9 × labels verified OK with correct expected-login.

## 2026-05-01 12:30 — Issue #322: ARM call-flow doc for browser-direct (Option A2)

**Task:** Carved-out docs follow-up from #237 PR-1 (which I had explicitly deferred — see 2026-04-24 entry). Wave 1/2/3 of Option A2 has now landed (#317, #318, #319, #320), so the proxy is in its zero-traffic observation window and the docs can finally tell the truth.

**What shipped (PR #338):**
- New `docs-site/docs/architecture/arm-call-flow.md` (sidebar 6) — full architecture doc covering both call paths, trust boundaries, memory-only token contract, ArmFetchError discriminated union, CSP requirement, tombstone status of `/api/arm-proxy`. Two ASCII flow diagrams (Mermaid not enabled in Docusaurus config; matches existing `overview.md`/`prompt-pipeline.md` style).
- Updated `docs-site/docs/extending/api-endpoints.md`: `/api/arm-proxy` row marked **Retiring** with link to the new doc; `/api/azure/token` row links to it; added Status line to the proxy reference entry.

**Learnings:**
- The doc is deliberately split: the *architecture* doc owns the **why** and the **call flow** narrative; the *api-endpoints* doc owns the **HTTP-surface reference table**. Cross-link, don't duplicate. This is the right shape — each doc has one job.
- Verified `docs-site/docs/architecture/v2-implementation-brief.md` is about **browser telemetry**, not ARM, despite the issue's wording. The "v2 brief" name in older issues meant something else. **Don't auto-trust acceptance-criteria filenames** — grep the actual doc tree.
- Mermaid is not enabled in this Docusaurus config (no `@docusaurus/theme-mermaid` in `docusaurus.config.ts`). ASCII diagrams in fenced blocks are the prevailing pattern. If a future doc *needs* a real sequence diagram, that's a separate enablement step (decision for Leela / infra owner).
- The split between **browser-direct ARM (read-heavy SPA picker traffic)** and **server-side ARM via `getAzureToken(session)` (tool/deployment workflows)** is intentional and worth surfacing prominently — server-side needs session context (cost gates, deployment state machine, polling URL allow-list); browser-direct only needs the user's own AAD token. Future contributors will be tempted to "unify" these and shouldn't.
- Tombstone handling: I labelled `/api/arm-proxy` **Retiring** rather than **Deprecated (410 Gone)** because it's still deployed during the rollback safety window. When #321 lands, move it into the existing 410 table — that's a one-line table edit.
- `npm run build` in `docs-site/` is the right validation command for docs-only PRs (12s, no install side effects in worktree once `node_modules` exists). All internal `[link](path)` references must resolve or build fails.
- Identity: `node /home/asabbour/GitWSL/EMU/kickstart/.github/extensions/squad-identity/lib/resolve-token.mjs docs` works from a worktree (the `squad_identity_resolve_token` MCP tool errored under this Copilot CLI version). PR #338 successfully attributed to `squad-docs[bot]`.

## 2026-05-01 12:15 — PR #338 follow-up: Nibbler request-changes (dismissed)

**Trigger:** squad-backend dispatched Amy to address Nibbler's `CHANGES_REQUESTED` review on PR #338 (PRR_kwDOSKrIb877Hcwp). Reviewer claimed the doc references nonexistent files (`packages/web/src/lib/arm/armFetch.ts`, its tests) and incorrect API shape (`thrown ArmFetchError`), and asked me to substitute `services/arm-client.ts` / `ArmResult<T>` / `ArmClientError`.

**Outcome:** Dismissed under docs-authority bypass — Nibbler was factually wrong. Verified at HEAD `13bd659a`:
- `packages/web/src/lib/arm/armFetch.ts` exists, exports `ArmFetchError` (class at :91), throws it 5× (:153, :165, :173, :184, :342, :386, :393).
- `packages/web/src/lib/arm/__tests__/armFetch.test.ts` exists.
- `packages/web/src/services/arm-client.ts` does **not** exist; `ArmClientError` / `ArmResult<T>` zero matches in `packages/web/src`.
- Only `arm-client.ts` in tree is `packages/web/api/src/lib/arm-client.ts` — server-side legacy proxy (different layer entirely).

**Learnings:**
- **The `services/arm-client.ts` string in code comments is a landmine.** It appears in `packages/web/src/lib/arm/armFetch.ts:30` and `packages/web/src/contexts/APIConnectorContext.tsx:195,249` as historical commentary about a now-deleted Wave 1→2 interim shim. Future code-shape reviewers (human or bot) will keep tripping over this. Worth filing a tiny code-cleanup issue to scrub those stale comments — out of scope for this docs PR but a real papercut.
- **Pushing back on a request-changes is the right move when evidence is on your side.** I held the line, replied with file:line citations, dismissed the thread under the docs-authority bypass, and re-requested review. Capitulating would have regressed doc accuracy and propagated the wrong names into the docs site.
- **The `squad_identity_resolve_token` MCP tool errors out under Copilot CLI 1.0.2** ("Invalid command format" — it's invoking `copilot` as a wrapper instead of `node`). Workaround: `squad_workflows_*` and `squad_reviews_*` tools resolve their own tokens internally and worked fine. Direct-call workaround for future Amy: `node /home/asabbour/GitWSL/EMU/kickstart/.github/extensions/squad-identity/lib/resolve-token.mjs docs`.
- Validation: `docs-site npm run build` re-ran cleanly (`[SUCCESS] Generated static files in "build"`). No file changes shipped, no commit, no push — this was purely a review-thread rebuttal.

**Gate state:** docs-authority bypass label remains applied; review re-requested from `codereview` (Nibbler) to confirm against the actual source tree.
