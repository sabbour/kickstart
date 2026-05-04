---
"@aks-kickstart/pack-core": minor
---

feat(triage): mode-recognition layer + typed handoff briefing; expand per-track handlers (#198)

Triage now recognises six conversation modes — iteration, handover, bulk, paas-migration, migration-readiness, greenfield — before track selection, and emits a typed JSON briefing to the next agent so downstream prompts stop re-deriving constraints from prose.

What you'll notice as a user:

- "We just added a worker, redeploy" no longer asks you to pick a track again. Triage sees the cached `.kickstart/state.json` and routes to the same agent that built the original deployment.
- "Package this for SRE Sarah to review PR #47" reaches a real reviewer agent (`aks.reviewer`) with a pinned constraint spec, instead of dead-ending in an asTool call inside the architect.
- Migration to AKS Automatic now propagates the version pin (`safeguardSpecVersion: v1.1.1`, `aksVersion: 2026-03-15`) verbatim — Mike's sims used to drift on the version 2/12 times.
- Cost-shock objections ("$320/mo is more than I'm paying on Render today") flip the route to Container Apps via `azure.architect` instead of arguing the AKS case.
- `triage` can now only read three sanctioned files (`.kickstart/state.json`, `plan.md`, `safeguards-report.md`); arbitrary repo reads from inside triage are rejected at the tool layer, not just the prompt.

What's new for downstream agents:

- `aks.reviewer` is now a first-class triage handoff target (was previously asTool inside `aks.architect`).
- A typed handoff schema (`@aks-kickstart/pack-core` exports `TriageHandoffBriefingSchema` and `parseTriageHandoffBriefing`) — sibling agent rewrites should consume `briefing.constraintSpec.safeguardSpecVersion` instead of regexing prose.
- A sim-replay regression suite covers all 12 sim transcripts; classifier or schema regressions fail CI.

See [ADR-0004](../docs-site/docs/architecture/decisions/ADR-0004-triage-mode-recognition-and-typed-handoff.md) for the architectural rationale.

**Wave 4 handler expansions (this PR):**

- `containerized_web`: 3-question scoping flow, multi-service detection with R2 composition, sequential `azure.architect` → `aks.architect` routing, SummaryCard before handoff.
- `static_site`: 2-question scoping flow (build step, custom domain), explicit routing to correct architect.
- `select_inference[kaito]`: 4-step GPU quota preflight — QuotaCard on insufficient quota, CPU-based fallback alternatives (Phi-2, Llama-3.2-1B) when quota is zero, cost disclosure before handoff.
- `select_inference[foundry]`: Workload Identity enforcement (never API keys), Service Connector wiring, UAMI+FederatedCredential resource count disclosure.
- New `## Compound and ambiguous request handling` section: RadioGroup-based disambiguation for multi-track openers.
- Guardrails: WI-only, quota-preflight, and compound-detection rules added.
