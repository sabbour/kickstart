---
sidebar_position: 4
---

# ADR-0004: Triage Mode Recognition + Typed Handoff Briefing

**Date:** 2026-05-01
**Status:** Accepted
**Deciders:** Ahmed Sabbour (Lead, "Leela"), Squad (Zapp security review, Nibbler code review)
**Affects:** `packages/pack-core/src/agents/triage.agent.md`, `packages/pack-core/src/triage/handoff-schema.ts`, `packages/pack-core/src/triage/mode-recognition.ts`, `packages/pack-core/src/tools/read_file.ts`

## Context

The original `triage.agent.md` (186 lines, pre-#198) performed **track selection only** — it asked the user (or inferred from one signal) which track to follow (AKS, Azure-PaaS, GitHub) and handed off. Sim transcripts sim-01..12 (DP §6.1) revealed five repeating failure shapes that track selection alone cannot represent:

1. **Iteration** turns ("we just added a worker") were re-routed through full track selection, asking redundant questions instead of picking up `.kickstart/state.json`.
2. **Handover** ("package this for SRE Sarah to review PR #47") had no destination — the closest agent was reviewer-as-tool inside aks-architect, which discarded the briefing.
3. **Bulk** ("3 Heroku apps, one PR per app") was treated as a single greenfield request, losing repo enumeration.
4. **PaaS migration** ("moving from Render to Azure") was forced into the AKS track when the user explicitly wanted a managed PaaS.
5. **Migration readiness** ("migrate AKS Standard → Automatic") needed an explicit constraint pin (AKS Automatic v1.1.1) that downstream prompts never received as a typed slot — they re-derived it from prose, with a 2/12 sim drift rate on `safeguardSpecVersion`.

Additionally, Zapp's security review flagged that the prompt-side rule "triage may only read three files" was a soft control. A jailbroken triage instance could call `core.read_file` on any path the runtime allowed.

## Decision

We split the triage workflow into **two layers** and add **one tool-layer hard control**:

### 1. Mode recognition layer (D2/Z3/R1/R7/R8)

A pure classifier (`packages/pack-core/src/triage/mode-recognition.ts`) inspects the opener and any cached repo signals and returns one of six modes with documented precedence:

```
Iteration > Handover > Bulk > PaaSMigration > MigrationReadiness > Greenfield
```

Iteration wins highest because the cached state in `.kickstart/state.json` is more specific than any opener keyword. Handover beats everything else not iteration because the user has explicitly named a downstream consumer. Greenfield is the safe fallback when nothing else matches. Precedence is encoded both in the classifier's switch order and inline in the triage prompt — a reviewer cannot reorder one without the other.

The classifier is read-only (R8): it never writes `migration_phase` to disk; `inferMigrationPhase` is a pure function called per-turn from observed signals.

Cost-objection detection (R7) is a separate function, used only as illustration in the prompt — never as a hard gate. The five canonical phrasings live in `COST_OBJECTION_EXAMPLES`.

### 2. Typed handoff briefing schema (D7/D8/Z1/Z2/R5)

`packages/pack-core/src/triage/handoff-schema.ts` exports a Zod schema (`TriageHandoffBriefingSchema`) that is the single source of truth for the downstream payload. Every triage handoff produces a JSON object that:

- carries `version: "triage-handoff/v1"` (so future schema changes can be migrated),
- selects a `mode` from a strict enum (`Z3`),
- attaches mode-specific blocks (`iteration`, `handover`, `bulk`, `paasMigration`, `migrationReadiness`, `greenfield`) — exactly one matches the chosen mode (refine),
- carries a `constraintSpec` literal for `handover` and `migration-readiness` modes that pins `safeguardSpecVersion: "v1.1.1"` and `aksVersion: "2026-03-15"` (D7/D8/Z1).

`aks.reviewer` is promoted from "asTool inside aks-architect" to a first-class triage handoff target (D7) so handover and migration-readiness flows reach it directly with the typed briefing. The `corePack.handoffTargets` allowlist already includes `aks`.

### 3. Per-agent file allowlist on `core.read_file` (Z4)

`READ_FILE_AGENT_ALLOWLIST` in `packages/pack-core/src/tools/read_file.ts` enforces, at the tool layer, that `core.triage` may only read three files:

- `.kickstart/state.json`
- `plan.md`
- `safeguards-report.md`

Other agents (`core.codesmith`, `core.reviewer`) have no entry and remain unrestricted by design — they need broad repo access. The allowlist runs **before** workspace resolution so a misconfigured `workspaceRoot` cannot broaden it. Hard-coded in source (not env-driven) to prevent silent deployment-time loosening.

## Consequences

### Positive

- **Zero ambiguity in downstream prompts.** Sibling PRs (aks-architect, aks-reviewer, azure-architect rewrites) consume `briefing.constraintSpec.safeguardSpecVersion` directly instead of re-deriving from prose. Z2 CI gate will hard-fail any drift once those PRs land.
- **Sim coverage is the canary.** The 12 sims now have a regression suite (`triage-sim-replay.test.ts`) that re-validates mode + briefing shape on every commit. A regression in classifier or schema fails CI before the prompt ships.
- **Defence in depth on triage reads.** Even a fully-jailbroken triage instance cannot exfiltrate `.env` or arbitrary repo files via `core.read_file`.
- **Clear evolution path.** Schema is versioned; new modes are additive (new enum value + new optional block + new refine).

### Negative / Trade-offs

- **Two-layer semantic adds 327 lines to triage prompt.** Mitigation: every section cites the decision (`D1`–`D14`) it satisfies; reviewers can navigate by decision number.
- **Phase 2 PR queue.** Five sibling agent rewrites must consume the typed slot before Z2 hard-gate flips on. Soft-warn in the CI test logs the pending list to stderr so Hermes can pick them up.
- **`config/handoff-rules.json` not implemented in this PR.** R3 (rollback runbook for handoff-rules.json sync) is deferred; documented in the PR body. The Zod schema is the authoritative rules source until that file exists.

## Alternatives Considered

### A. Keep single-track triage, push mode recognition into each downstream agent

Rejected. Each downstream would need its own copy of the classifier; drift between five copies is a worse problem than the one we have today. Centralising in triage means one classifier, one schema.

### B. Use a free-form JSON briefing without Zod refinement

Rejected. The 2/12 `safeguardSpecVersion` drift in sims is the precise failure mode an unrefined contract perpetuates. Zod with refines makes drift a build-time error.

### C. Feature-flag dual-route (old triage + new triage in parallel for one cycle)

Rejected per DP §9 framing: the sim corpus is the canary. Maintaining two prompts doubles the surface area for prompt drift and triples the test matrix. Sim-replay regression suite + DRAFT-PR consensus checkpoint #197 is sufficient evidence for a single-cut migration.

## Validation

- 12/12 sim openers route to the documented mode (`triage-sim-replay.test.ts`).
- Every fenced `triage-handoff/v1` example in the prompt round-trips the schema (`triage-handoff-ci-enforcement.test.ts`).
- 9/9 existing `agents.test.ts` literal-string assertions still green.
- 9/9 Z4 allowlist tests cover deny-by-default for arbitrary paths plus normalization corner-cases (`./` prefix, backslashes, null bytes).

## References

- Issue [#198](https://github.com/azure-management-and-platforms/kickstart/issues/198) — Triage rewrite (PR-1)
- Consensus checkpoint [#197](https://github.com/azure-management-and-platforms/kickstart/issues/197)
- DP v1 (Leela), DR (Zapp), DR (Nibbler) — see #198 timeline
- ADR-0003: SDK-native parallel guardrails (sibling architecture)
