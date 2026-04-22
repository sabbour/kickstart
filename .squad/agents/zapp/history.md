# Zapp — Security Reviewer (Lead)

## Summary (Rolled Up 2026-04-22)

This agent's history file exceeded 15360 bytes. A summary will be written here.
For detailed learnings, refer to the git history or contact Leela.

**Agent:** Zapp  
**File rolled at:** 2026-04-22T02:40:00-07:00  
**Role:** Security Reviewer (Lead tier), threat modeling, trust-boundary enforcement, schema narrowing

---

## Responsibilities
- Security review gate enforcement (merge blocker)
- Schema design for LLM-facing tools (narrowing attack surface)
- Trust-boundary identification and enforcement
- Threat modeling for new features (DPs)
- DP-stage security reviews (tool schemas, guard rails, secrets handling)

## Recent Milestones (2026-04-21 to 2026-04-22)

### Elevated to Full Structured-Reviewer Parity (2026-04-21)
- **Change:** PR #993 ceremony enforcement shipped; Zapp now full 4-way gate blocker
- **Authority:** `zapp:approved` / `zapp:rejected` are now merge-blocking labels
- **Protocol:** Reviews posted via `gh pr review` under lead bot identity (sabbour-squad-lead)
- **Role designation:** Lead (same tier as Nibbler + Leela)
- **Status:** Operating with full merge-blocking authority ✅

### DP-Stage Security Reviews (Round 3 Batch)
Five DPs reviewed at security layer:

- **#998 (Chat regression, Bender, HIGH)** — APPROVED (nullable-required schema fix for strict-mode compliance)
- **#987 (Ideas tab curated-only model, Fry)** — APPROVED + threat model confirmed (user-supplied inspirations deferred as future risk)
- **#995, #996, #997** — APPROVED (AKS brittle tests, workspace void fix, core rendering regressions: security impact minimal)

### PR Batch Security Reviews (2026-04-21)
Four PRs reviewed under new 4-way gate:

- **PR #989** (core_emit_ui schema narrowing, Bender) — ✅ **APPROVED** (`zapp:approved`)
  - Tool-schema narrowing: 7 loose optional fields → 5 typed constraints on v0.9 shape
  - Payload constraint: `record<string, scalar>` (no nested objects to downstream handlers)
  - Verdict: **Strongest security win in this batch** — reduces attack surface on LLM-facing tool
  - Trust boundary: `_ErrorComponent` + named `console.error` is fail-loud (correct posture)

- **PR #986** (CSS/theme only, Fry) — ✅ **APPROVED** (`zapp:approved`)
  - Pure styling: icon asset swap (local SVG → Fluent icon), no runtime code changes
  - CSP verification: `script-src 'self'` remains clean
  - Surface reduction: CSS-only changes pose minimal trust-boundary risk

- **PR #988** (Delete Ideas tab + refactor, Fry) — 🟡 **COMMENT-ONLY** (draft, no blocker)
  - Post-rebase re-review (commit 6ac15d9): no dangerouslySetInnerHTML, localStorage, eval detected
  - Conflict resolution clean: `ComponentCardErrorBoundary` rename layered correctly, no orphans
  - Net effect: attack surface **decreases** (Ideas removal)

- **PR #990** (System prompt + config, Fry) — 🟡 **COMMENT-ONLY** (draft, no blocker)
  - Prompt allow-lists for banned component types observed as **defense-in-depth, not trust boundary**
  - Actual enforcement lives in `validateAndSanitizeComponents` (strengthened by #989)
  - Mutable state review: `focusCursor` + `lastFallbackIdx` carry no PII/auth; acceptable

### DP #1050 Security Review (emit_ui strict-mode)
- **Issue:** #1050 — emit_ui schema invalid for OpenAI strict mode
- **Review:** Schema narrowing (`$ref` removal via `.describe()` cleanup) + strict-mode conformance test
- **Verdict:** ✅ APPROVED — no trust-boundary regression; LLM still receives guidance via `event.name` leaf

## Key Learnings
1. **Tool-schema narrowing is the strongest security win.** #989's reduction from 7 loose optional fields → 5 typed constraints on v0.9 shape directly reduces the LLM attack surface.
2. **Strict-mode schema compliance is a table-stakes trust boundary.** OpenAI strict mode rejects `$ref` with siblings; this is not a stylistic choice — it's an enforced JSON-Schema validation gate.
3. **Fail-loud > silent translation.** `_ErrorComponent` + named console errors (not back-compat shims) is the correct posture at trust boundaries for LLM-facing tools.
4. **Prompt allow-lists are not trust boundaries.** System prompt "banned component list" is content-quality defense-in-depth; actual enforcement must live in code (validateAndSanitizeComponents).
5. **CSS-only PRs still warrant CSP + asset-loader checks.** Even pure styling can regress security if new asset sources are introduced.
6. **Orphaned server payloads are debt.** `/api/packs` still ships `playgroundScenarios` with no consumer — creates implicit contract drift risk.
7. **Lead role authority:** As a Lead, Zapp's security review outcomes are merge-blocking. No negotiation override path.

## Security Track (4-Way Gate)
- 5 DPs reviewed at security layer
- 2 PRs approved (✅ #989, #986)
- 2 PRs comment-only drafts (🟡 #988, #990)
- 1 DP-stage threat model (✅ #987 Ideas tab curated-only)

## Merge Gate Status
All PRs now subject to 4-way approval (Leela + Zapp + Nibbler + Docs). Zapp approval is merge blocker.

## Current Threat Model Tracking
- #987 Ideas tab: Curated-only model approved; user-supplied inspirations deferred as future risk
- #998 Chat regression: Strict-mode conformance as structural test (parametrized across tools)
- #1050 emit_ui: Schema narrowing via `.describe()` removal
- #1035/#1036 RedactingSpanExporter: Double-export Critical PII leak confirmed, approved with hard CI-guard + single-path test requirements
- #1040 AgentSpanError stack trace: Changes requested — stack first-line sanitization blocker (High severity)
- #1037/#1038 OTel cleanup: Approved — dead dep removal is supply-chain win
- #1042 Browser telemetry: Approved with constraints — 6 hard gates + all 5 open questions answered

## DP Review Batch — Observability (2026-04-22)

Four DPs reviewed for observability hardening sprint:

### DP-A — #1035 + #1036 (RedactingSpanExporter) — ✅ APPROVED (`zapp:approved-dp`)
- **Critical PII leak confirmed** in `appinsights.ts:129–141`: `useAzureMonitor` with both `azureMonitorExporterOptions` + `spanProcessors` registers two BatchSpanProcessors → every span ships unredacted on raw path
- Required: single exporter path enforced by test (no raw `AzureMonitorTraceExporter` outside wrapper) + CI grep guard in same PR
- Required: Option A needs API validation from Bender; Option B fallback if not feasible
- Required: T9 extended with `links` + `resource.attributes` PII test cases

### DP-B — #1040 (AgentSpanError stack trace) — ⛔ CHANGES REQUESTED (`zapp:requested-changes-dp`)
- **Blocker (High):** `errToRecord.stack = sdkSpan.error.stack` copies the original unsanitized message as line 1 of the stack string, bypassing `sanitizeText()`. V8 `Error.stack` format: first line is `"ErrorName: <message>"`.
- Required fix: split stack on `\n`, replace `stackLines[0]` with sanitized version before assigning to `errToRecord.stack`
- No re-review cycle needed; fix is small and unambiguous; Bender to address in implementation

### DP-C — #1037 + #1038 (cleanup) — ✅ APPROVED (`zapp:approved-dp`)
- Dead `applicationinsights` dep confirmed at `package.json:24`. Removal is supply-chain positive: eliminates latent risk of double-OTel-init if accidentally imported
- T9 fixture upgrade to real `BasicTracerProvider` improves redaction coverage against real SDK prototype chain
- Required: `npm ls applicationinsights` shows no active dependents after prune; CI guard mandatory same PR

### DP-D — #1042 (Browser telemetry) — ✅ APPROVED WITH CONSTRAINTS (`zapp:approved-dp-with-constraints`)
- **6 hard gates** before any browser telemetry code merges (BrowserRedactingSpanExporter, CSP review, fetch scope, same-connection-string doc, tracestate disabled, IP anonymization verified)
- **Decision 1:** Option B only (`@opentelemetry/sdk-trace-web` stack). `@microsoft/applicationinsights-web` DISQUALIFIED (eval/inline-script CSP risk)
- **Decision 2:** Connection string in bundle acceptable — telemetry-only credential by design. `/api/config` proxy path also required as rotation escape hatch. 10% sampling default.
- **Decision 3:** `BrowserRedactingSpanExporter` mandatory. `http.url` path-only, `http.user_agent` scrubbed, pattern-matched secrets redacted. No CSP widening needed for OTel SDK.
- **Decision 4:** Option (b) approved — browser root span + `traceparent` injected in API request. `tracestate` NOT propagated. SSE reading deferred.
- **Decision 5:** Same connection string = same workspace. Fetch instrumentation MUST be scoped to `/api/*` paths only (no CDN/auth endpoint leakage). IP anonymization required on App Insights resource.
- DP-D blocked on DP-A + DP-B merging first


---

## 2026-04-22T10:36:52-07:00 — DP review #1062 (Triage loop / conversation history threading)

**Verdict:** ✅ `zapp:approved-dp` applied + `zapp:approved` label on issue.
**Comment URL:** https://github.com/sabbour/kickstart/issues/1062#issuecomment-4298661068
**DP:** Leela v2 (2026-04-22T15:50:56Z) — Layer 0 harness history threading (Bender) + Layers 1–3 payload/prompt/UI (Fry).

### Gate criteria (all satisfied)
- **PII in history:** DP filters `recentTurns` to role∈{user,assistant}; tool results not replayed into SDK input. No new SSE/log surface.
- **IDOR on sessionId:** `getOrCreateSession` already throws `SESSION_OID_MISMATCH` → 403 on principal mismatch (session.ts:118). DP rejects client-resend of history and keeps server authoritative (explicitly credits Zapp concern).
- **Bounded history:** 50-turn cap in `recordTurn` (session.ts:55–60). SDK-level compaction deferred as future hardening.
- **Retry/cancel safe:** adapter ships only user/assistant text items; no side-effect tool replay.

### Carry-forwards (non-blocking, for Bender's Layer 0 PR review)
1. Unit test asserting `HarnessSessionAdapter.getItems()` excludes tool-call turns.
2. Guardrail-on-capture invariant — sanitized text is what lands in `recentTurns`; replays must not re-run sanitization over raw input.
3. Cross-ref #1069 inert-skills: any security-posture skill is currently unenforced at the prompt layer because only skill id + one-liner reaches the LLM. Out of scope for #1062 but should be filed as a follow-up issue.

### Key learning
- Preferred Option A (SDK `Session` adapter) over Option B (manually-built input array) from a security angle: single canonical history source avoids path divergence.
- Server-authoritative conversation state is the correct trust boundary; client-sent `messages` array in `converse.ts:44` should remain ignored (as it is today).
