---
sidebar_position: 10
title: "Requirement-Gathering Methodology"
---


**Status:** Current | **Scope:** Every agent that asks the user *anything* (triage, architects, ops, publisher, specialists).

---

## Purpose

This document defines the system-wide requirement-gathering methodology. It covers **how many** questions to ask, **in what order**, **in what shape**, **when not to ask at all**, and — critically — **what to do before asking**.

The methodology rests on a single principle: **inference first, questions second**. Every agent must exhaust what it can learn from context (repo inspection, grounded skills, conversation history, configuration defaults) before spending a question from its budget.

The structured question budgets are encoded in `config/tracks.json` (via `requirementHints`) and `config/inference-backends.json` (via `questionPolicy`). This document is the human-readable specification; the JSON files are the machine-enforceable form.

> **Note:** This document covers the core methodology for requirement gathering. Additional #222 acceptance criteria (acknowledge-before-asking opener pattern, bulk/multi-field exceptions, target-zero-questions metric, per-agent forbidden question lists) are tracked for a follow-up iteration.

---

## The Inference-First Principle

Before asking the user *anything*, every agent must:

1. **Read `inspect_repo` output** — if a repo URL or local path is available, call `core.inspect_repo` and consume the result. Framework, language, existing Dockerfile, Helm charts, and deployment targets are usually discoverable.
2. **Consult grounded skills** — call `core.read_skill` for any relevant Microsoft skill (e.g., `azure-kubernetes-automatic-readiness`). Skills contain constraint specs, best practices, and defaults that answer many questions automatically.
3. **Parse the conversation history** — answers given to a previous agent (or earlier in the same phase) are authoritative. Never re-ask.
4. **Apply configuration defaults** — `tracks.json` `requirementHints` and `inference-backends.json` `questionPolicy` define what can be inferred vs. what must be asked.

Only after steps 1–4 produce no answer should an agent spend a question from its budget.

### Why inference-first matters

Every question has a cost (user time, abandonment risk) and a benefit (information the agent cannot get any other way). The inference-first principle eliminates questions whose benefit is zero — the information was already available. It also ensures agents are grounded in real data (actual repo contents, actual skill constraints) rather than assumptions.

---

## Structured Question Budgets

Question budgets are defined per-track and per-inference-backend in the configuration layer:

```jsonc
// config/inference-backends.json — each backend defines:
{
  "questionPolicy": {
    "maxQuestions": 3,
    "askOneAtATime": true,
    "candidateQuestionsInPriorityOrder": [
      { "key": "model_override", "askOnlyIf": "user has expressed a model preference" }
    ],
    "forbidden": ["presenting a stale fixed list of model families"]
  }
}
```

```jsonc
// config/tracks.json — each track defines:
{
  "requirementHints": {
    "imageSource": "infer (built-from-source / dockerfile / prebuilt-image)",
    "registry": "do not assume ACR; accept public or private OCI",
    "askOnlyIfMaterial": ["registry credentials", "database/cache needs", "scale requirements"]
  }
}
```

**Enforcement rules:**

| Field | Meaning |
|---|---|
| `maxQuestions` | Hard cap per agent per phase. After this many, forced action (route or generate with defaults). |
| `askOneAtATime` | When `true`, the agent must emit exactly one question per turn. No bundling. |
| `candidateQuestionsInPriorityOrder` | Ordered list; agent asks from top to bottom, skipping any whose `askOnlyIf` condition is not met. |
| `forbidden` | Actions the agent must never take regardless of question budget remaining. |
| `askOnlyIfMaterial` | Fields that should only be asked about when they materially affect the output. |

Agents consume these policies at runtime. The question budget is the ceiling, not the target — zero questions is the goal.

---

## The Five Rules

These are the load-bearing rules. Everything else in this doc is illustration or per-agent specialisation.

### Rule 1 — One question per turn (`askOneAtATime: true`)

Never bundle multiple prose questions into one response. This rule is enforced in configuration via the `askOneAtATime` field in `questionPolicy`. A `Questionnaire` component is one *artefact*, not multiple questions — emit it as a single surface, then wait. Two prose questions ("What region? Also what SKU?") in one turn is a violation.

### Rule 2 — Hard cap of three questions per agent per phase

After three questions in the current agent's phase, **forced action**: route, hand off, or generate using best-fit defaults. The cap counts prose-questions, A2UI-form-submissions, and confirm dialogs equally. The cap **resets on handoff** — the next agent starts at zero. (Cross-agent ping-pong reuses budget; see Rule 5.)

### Rule 3 — Discriminating value first

If you must ask, ask the question whose answer would change *which agent next handles this* or *what architecture/platform you'd recommend* — before any question that only changes parameters or names. Cosmetic questions are forbidden until the structural ones are answered.

### Rule 4 — Don't ask what you can infer or default

If the user's words, the repo content, or a sensible default already answer the question, don't ask. State the assumption transparently ("Defaulting to AKS Automatic — say 'standard' to override") and continue.

### Rule 5 — Zero questions is a target, not a fallback

If the user's first message is sufficient to route, route. Don't ask "just to confirm". Confirmation friction is real; mistakes are correctable.

---

## Why these rules (the discriminating-value model)

A clarification has a cost: user time, user attention, and abandonment risk. It has a benefit: information that changes what the agent does next. The rules above are the operational form of *only ask when benefit > cost*:

- Rule 1 keeps each ask atomic so the user can answer in flow.
- Rule 2 puts a ceiling on cumulative cost.
- Rule 3 maximises benefit-per-question by ordering on impact.
- Rule 4 avoids questions whose benefit is zero (you already knew the answer).
- Rule 5 normalises the zero case as the goal, not a happy accident.

This is the same lens the [Tool Usage Framework](./tool-usage-framework.md) applies to tool calls. Calling tools and asking questions are both ways of reducing uncertainty — the discriminating-value test is the unified rule.

---

## Acknowledge before asking

When a user has stated multiple constraints or requirements upfront, **acknowledge what you heard before asking any clarifying questions**. This pattern signals that you are listening and building on their context, not starting over with a generic interview.

### Pattern

> User: "I need a Node.js API on AKS in the East US region, but we're budget-constrained and can't use premium SKUs."

Agent (instead of asking three questions):

> "I understand you need a Node.js API on AKS in East US with a focus on cost control (no premium SKUs). Let me verify one thing before I route: is this a new cluster or migrating an existing workload?"

This accomplishes several things:
- **Proves active listening** — the user sees their constraints reflected back.
- **Reduces question count** — it's not a new question; it's a focused follow-up after acknowledgment.
- **Minimizes repetition** — downstream agents inherit this context without re-clarifying.

Use acknowledgment **whenever the user opens with 2+ criteria**. The opener pattern is:
1. State what you understood in one clear sentence (mention their constraints).
2. Then ask the single highest-value clarifying question (if needed).

**Do not** acknowledge, then list five follow-up questions. Acknowledge, ask *one*, then re-evaluate.

---

## Bulk-handling exception to one-question-per-turn

Rule 1 states "one question per turn". However, **when input is inherently multi-value**, a single multi-field form (Questionnaire) is legitimate and does not violate this rule.

### When bulk forms are appropriate

| Case | Example | Why OK |
|---|---|---|
| Coupled fields (user must answer together) | Region + SKU + zone redundancy for a single AKS cluster | The user cannot decide one without the others |
| Pre-filled defaults (user is confirming or lightly editing) | "`resource names: <app-name>-rg`, `<app-name>-acr` — proceed?"` (Questionnaire with pre-filled names) | The user is reviewing and approving, not being interviewed |
| Multi-select from a defined list | "Which of these 5 integration services apply? (CheckBox list)" | The domain is bounded; the user can parse all options at once |

### When bulk forms are NOT appropriate

| Case | Problem | Fix |
|---|---|---|
| Unrelated fields bundled for convenience | "Name the resource group AND tell me your budget AND pick a SKU" | Ask resource-group name in prose, default budget, pick SKU in prose or UI — three separate flows |
| Open-ended fields mixed with structured | "Paste your Dockerfile AND configure RBAC AND name the ingress" | Ask Dockerfile intent in prose ("existing or should I scaffold one?"), then proceed with RBAC and ingress separately |
| User thinking is still forming | "Pick container registry type, Azure region, AND cost model" | Ask the single highest-value question first, let them think, then ask the next one |

### Questionnaire guidance

- **Pre-fill all defaults** — show the user what will be created if they accept. Never ask for a field without suggesting a sensible default.
- **Group by domain** — if fields are on different topics (networking vs naming vs identity), split them across turns.
- **Surface constraints** — if picking one field affects available options for another (e.g., "AKS Automatic" disables Standard node pool questions), use conditional visibility or inline clarification.

---

## Target-zero-questions as primary outcome metric

The methodology's **gold standard** is resolving requirements without asking *any* questions when the user has provided sufficient context. This is not a corner case; it's the primary outcome metric.

### Sim #1 pattern: Rich context → Confident action

> User: "Deploy this React app (`https://github.com/me/site`) to Static Web Apps in `eastus2`."

Agent:
- No questions asked.
- Route immediately to `azure.architect` with full context.

**Why this matters:** The user gave you enough to act. Asking "just to confirm" is friction without benefit. If they meant something else, they will speak up during architecture review.

### Measuring "enough" context

An agent has enough context to proceed (zero questions) when it can answer all discriminating-value questions from:
1. **User's words** — explicitly stated track, backend, region, constraints, preferences.
2. **Repo inspection** — framework, existing Dockerfile, deployment targets, language version, team conventions.
3. **Defaults** — approved sensible defaults for that phase (e.g., Bicep over ARM, Automatic over Standard, primary region fallback).
4. **Conversation history** — answers given to a previous agent or earlier in the same phase.

If all four sources together answer the discriminating-value questions (Rule 3 priority table), you have "enough" — proceed confidently.

### Setting the metric

In Phase 2 telemetry (audit hooks):
- Track per-agent: **median questions per conversation** (target ≤ 1).
- Flag conversations where triage + architect phase combined asked **more than 2 questions** (target ≤ 2 for most scenarios).
- Log **zero-question routes** (the Sim #1 pattern) as the primary success marker.

Agents that hit zero questions for >60% of conversations are performing optimally. This is not luck — it's the inference-first principle working.

---

## Question shape: prose vs A2UI

When you've decided to ask, choose the right vehicle.

| Use **prose** | Use a **UI surface** |
|---|---|
| Free-form answer (URL, name, a paragraph of intent) | 3+ discrete options |
| 1–2 obvious options inline ("AKS or AKS Automatic?") | Structured input that benefits from typed fields |
| Follow-up clarifying a previous prose answer | Multi-select or grouped choices |
| You're mid-conversation and want to maintain flow | A first impression / branching point (TrackPicker) |

Specific cross-references:
- For *which component* to emit, see the [Component Selection Framework](./component-selection-framework.md).
- For *whether `core.emit_ui` should fire at all*, see the **Category 5: UI emission** rules in the [Tool Usage Framework](./tool-usage-framework.md).

The current triage prompt enforces an important sub-rule under `repo_uplift`: **do not bundle the inspect_repo questionnaire array into a single multi-field form** — ask the most important one in prose, re-evaluate, then maybe ask the next. That's Rule 1 + Rule 3 in practice; it generalises: a Questionnaire is for inputs the user must answer *together*, not for whatever questions the agent has on its mental list.

---

## Switching mid-conversation

You can switch between prose and UI freely; what matters is each switch has a reason.

- **Prose → UI** when the option set grows past two ("Let me show you the available tracks." → emit `TrackPicker`).
- **UI → Prose** when a UI selection prompted a follow-up that doesn't fit a form ("You picked `kaito`. What model family are you targeting?" — prose, even though `core.search_kaito_models` will be called next to ground the answer).
- **Surface re-use over surface proliferation.** When you re-ask on the same logical surface (e.g., `shared:triage-main`), update components on the existing surface; don't `createSurface` a new one each turn.

---

## Inferred defaults

Defaults are how Rule 4 is enforced in practice. The table below lists current and proposed defaults across agents. Any default in **bold** is enforced by an existing prompt; the rest are *recommended* (for adoption in Phase 2).

| Question | Default | Override trigger | Source |
|---|---|---|---|
| Inference backend (agentic_app) | **`foundry`** | User mentions self-host, OSS weights, or BYO endpoint | triage prompt — `pick_track` handler |
| Cluster type (AKS) | AKS Automatic | User mentions Standard or "I want my own node pools" | recommended |
| Resource group naming | `<app-name>-rg` | User specifies | recommended |
| Container registry | New ACR `<app-name>cr` | User mentions an existing registry | recommended |
| Region | User's home subscription region; fallback `eastus2` | User mentions a region | recommended |
| K8s namespace | `default` for single-app, `<app-name>` for multi-app | User specifies | recommended |
| Bicep vs ARM | Bicep | User mentions ARM JSON specifically | recommended |
| GitHub branch | `main` | User specifies | recommended |
| Inference model (KAITO) | None — must call `core.search_kaito_models` | n/a (always live-look-up) | triage prompt — `select_inference` `kaito` |

**Surface defaults transparently.** When the agent uses a default, mention it in one sentence. Hidden defaults erode trust the first time they bite.

---

## Question priority order

When Rule 3 says "discriminating value first", this is the ordering. Questions higher on the list rule out more downstream questions, so they're cheaper to *answer* (one answer cascades) and cheaper to *not-ask* (their absence blocks more).

| Rank | Question class | Why it's high | Asked by |
|---|---|---|---|
| 1 | **Track** (which app type) | Determines which specialist handles the rest | triage |
| 2 | **Repo presence** (existing code or scratch) | Determines `inspect_repo` vs scaffold | triage |
| 3 | **Inference backend** (agentic only) | Determines AKS vs Foundry vs generic deployment shape | triage |
| 4 | **Cloud target** (subscription / region) | Required for any provisioning | architects |
| 5 | **Acceptance criteria** ("done" definition) | Sets plan scope | any |
| 6 | **Constraints** (budget, compliance, deadline) | Affects design tradeoffs | architects |
| 7 | **Cosmetic** (names, casing) | Default-friendly; rarely worth asking | none, ideally |

Stop asking once you have enough to route or design. **You do not need answers from every level** — most conversations get to "enough" in 1–2 questions.

---

## Worked examples

### Example 1 — Crystal-clear request (0 questions)

> User: "Deploy this React static site (`https://github.com/me/site`) to Azure Static Web Apps in `eastus2`."

Agent (triage): immediately route to `azure.architect` with full context. **No question.** No "just to confirm". The user gave you levels 1, 2, 4 and an implicit 6 (the SWA SKU choice signals their cost tolerance).

### Example 2 — One discriminating question (1 question)

> User: "I want to build a chatbot for my team."

Triage analysis:
- Level 1 (track): `agentic_app` (clear from "chatbot")
- Level 3 (inference backend): missing — and this is the next decision
- Levels 4–6: defaultable

Triage emits the inference backend `RadioGroup` with `value: "foundry"` pre-selected. One UI ask, one user click, then route.

### Example 3 — Vague request (2–3 questions, one via UI)

> User: "Help me deploy something to Azure."

Triage:
1. Emit `TrackPicker` (level 1). User picks "Containerized Web App".
2. Prose: "Existing repo or starting fresh?" (level 2). User pastes a repo URL.
3. `inspect_repo`, then route to `azure.architect`.

Two questions, hard cap not even threatened.

### Example 4 — Hard cap hit (3 questions, then forced action)

> User: "I need help with cloud stuff."

Triage:
1. `TrackPicker` → user: "An app, I think."
2. Prose: "Web app, API, agent, or something else?" → user: "I dunno."
3. Prose: "Existing code or starting fresh?" → user: "Fresh I think."

**Cap hit.** Route to triage's best guess (`containerized_web` on Azure default region) with a one-line note: "Routing as containerized web on Azure default region — say more if that's wrong." The receiving specialist starts at zero questions.

### Example 5 — Default surfaced (0 questions, transparent)

> User: "Set up an AKS cluster for an internal tool."

`aks.architect`:
- Defaults to AKS Automatic, single user node pool, Gateway API ingress.
- Emits the plan summary surface (per the architect's existing prompt) with the defaults visible in the `SummaryCard`.
- One sentence: "I've defaulted to AKS Automatic with one user node pool. Click 'Revise' if you need a Standard cluster or different topology."

Zero questions, no friction, full transparency.

---

## Cross-agent rules

The cap *resets* on handoff (Rule 2), but a few cross-agent constraints stop that from being abused.

### C1. Handoff context carries answered questions

The `prompt:` field on a handoff (in agent frontmatter) must include the answers already given by the user — *not* re-ask them in the receiving agent. If triage asked "which inference backend?" and got `foundry`, the handoff prompt to the architect must say so. The receiving agent treats those answers as authoritative and never re-asks.

### C2. No question in the handoff prompt itself

The handoff prompt is for *briefing*, not *querying*. If the receiving agent needs more info, it asks once it's in the conversation — counted against its own cap, not the previous agent's.

### C3. Ping-pong is a smell

If A → B → A → B happens within four turns, the workflow is broken. The fix is structural: either A should have used `asTools` to consult B without handing off, or A's job was incomplete and B should not have been called yet. Reviewers (and Phase 3 telemetry) should flag this.

### C4. `asTools` consultations don't count against the user's cap

When agent A calls `ask_<specialist>` via `asTools`, the specialist's questions to A are agent-to-agent, not agent-to-user. They don't burn user-question budget. They do count against `maxTurns` on the asTool wiring (typically 3–5).

---

## Context Preservation Across Handoffs

Handoff context is the mechanism that prevents re-asking. When agent A routes to agent B, the handoff briefing must carry:

1. **All user-stated values** — answers to questions, constraints mentioned in the opener, preferences expressed anywhere.
2. **All inferred values** — what `inspect_repo` found, what skills reported, what defaults were applied and surfaced.
3. **The constraint-spec pin** — if a constraint spec version was established (e.g., AKS Automatic v1.1.1), it must travel in a typed `constraintSpec` slot so downstream agents enforce the same version.
4. **Skill IDs loaded** — which skills were read and are authoritative for this conversation.

The typed handoff schema (see `packages/pack-core/src/triage/handoff-schema.ts`) enforces structure:

```typescript
// Typed slots ensure nothing is lost in prose translation
constraintSpec: { safeguardSpecVersion: 'v1.1.1', aksVersion: '2026-03-15' }
skillIdsLoaded: ["azure-kubernetes-automatic-readiness"]
// Note: there is no `userStatedValues` typed field. User-stated values travel in
// the handoff prompt prose and in mode-specific blocks (e.g., greenfield.track).
greenfield: { track: 'containerized_web' }
```

**The receiving agent treats handoff data as authoritative input.** It does not re-validate, re-ask, or second-guess. If the handoff data is wrong, that's a bug in the sending agent — file an issue, don't burn the user's time.

---

## The Constraint-Spec Pattern (Enterprise Scenarios)

In enterprise scenarios, agents must enforce versioned constraint specifications — curated sets of rules, limits, and best practices that represent organizational policy. The pattern:

### How it works

1. **Triage identifies the applicable constraint spec** during initial routing (e.g., `AKS Automatic constraint-spec v1.1.1`).
2. **The spec version is pinned in the handoff briefing** via the typed `constraintSpec` slot — every downstream agent inherits it.
3. **Downstream agents cite the spec** when enforcing constraints: *"Per constraint spec v1.1.1 §2.7, GPU node pools require spot-instance fallback configuration."*
4. **The reviewer validates against the pinned spec** — it uses the same version the architect used, not whatever is "latest" at review time.

### Why version-pin?

- **Reproducibility** — the same conversation always applies the same rules, even if the spec is updated mid-sprint.
- **Auditability** — every recommendation can be traced to a specific spec clause.
- **Consistency across agents** — architect and reviewer see the same constraints, eliminating contradictory advice.

### Configuration

Constraint specs are referenced in `config/microsoft-skills.json`:

```jsonc
{
  "loadConvention": {
    "constraintSpecCitationFormat": "Per `<skill-id>` skill v<version>, constraint spec v<x.y.z> (AKS <date>)"
  },
  "skills": [
    {
      "id": "azure-kubernetes-automatic-readiness",
      "references": {
        "constraintSpec": "references/constraint-spec-v1.yaml",
        "constraintSpecVersion": "1.1.1"
      }
    }
  ]
}
```

Agents loading a skill that includes a constraint spec must:
- Pin the version in the handoff briefing.
- Never mix versions within a single conversation.
- Cite the spec version + section when surfacing a constraint to the user.

---

## Per-agent application

The **triage** rules apply universally; per-agent notes capture where each specialist's phase has its own constraints.

### `core.triage`
- Phase: track selection, backend selection, repo inspection, initial routing.
- Cap: 3 (already enforced in prompt).
- Priority: levels 1 → 2 → 3 from the priority table.
- UI defaults: `TrackPicker` for level 1 ambiguity, `RadioGroup` for level 3, prose for level 2.
- Forbidden: multi-field Questionnaire on `repo_uplift` (per existing prompt — ask single question from `inspect_repo.questionnaire` array).

### `core.codesmith`
- Phase: file generation. Already has clear inputs from the plan.
- Cap: 1, and only for scope narrowing ("which files first?").
- Priority: acceptance criteria > naming convention.
- Defaults: derive from inspected repo (file naming, frameworks, license).
- Forbidden: re-asking architectural questions answered upstream.

### `core.reviewer`
- Phase: validation.
- Cap: 0–1. Reviewer asks only when surfacing a finding the user must adjudicate ("block on this warning, or ship?").
- Priority: blocking issues only.
- Forbidden: open-ended "anything else?" questions.

### `azure.architect`
- Phase: Azure resource design + cost estimation.
- Cap: 3, owned by the architect (separate budget from triage).
- Priority: subscription/region (level 4) → SLA/availability tier (level 5) → cost ceiling (level 6).
- Defaults: home-subscription primary region; Bicep over ARM; managed services over self-hosted equivalents; `validate_bicep` on every snippet shown to the user.
- Forbidden: asking the user to *paste* secret values; ask for secret *names* and reference them via Key Vault.

### `aks.architect`
- Phase: cluster design + workload placement.
- Cap: 3, owned by the architect.
- Priority: cluster type (Automatic vs Standard) → workload identity model → ingress topology.
- Defaults: AKS Automatic, single user node pool, Gateway API + `HTTPRoute`, Azure Workload Identity for any Azure-resource access.
- Forbidden: asking the user to choose between `secretKeyRef` and Workload Identity (per existing prompt: never recommend `secretKeyRef` for Azure credentials — Workload Identity is mandatory).

### `aks.manifests_author`
- Phase: YAML generation. Inputs come fully from the architect's plan.
- Cap: 0 in steady state. If something is genuinely missing, hand back to the architect rather than asking the user directly.

### `aks.reviewer`
- Phase: safeguard + policy review.
- Cap: 0–1. Like core.reviewer, only ask when the user must adjudicate a non-blocker.
- Forbidden: skipping `validate_safeguards` because of a perceived urgency.

### `azure.ops`
- Phase: deployment.
- Cap: 1 — only the explicit deploy confirmation (post `what_if`).
- Priority: review the diff, then ask "Apply?".
- Forbidden: deploying without showing the `what_if` first; deleting anything without an explicit `core.confirm` in the immediately preceding turn.

### `github.publisher`
- Phase: PR creation.
- Cap: 1, structural — target repo (org/repo) and branch (default `main`).
- Priority: target repo > branch.
- Defaults: `main` for branch, current org from `github:login`, new repo only if `github:pick_repo` returns nothing.
- Note: most "questions" here are user actions (`github:pick_org`, `github:pick_repo`), not LLM prompts — they don't count against the cap because they're click-not-type.

---

## Anti-patterns

### A1. The interview
Asking 5+ questions in a row before doing anything ("region?", "SKU?", "redundancy?", "compliance?", "budget?"). Violates Rules 1, 2, 3.

**Fix:** ask the single highest-value question. Default the rest, surface the defaults, let the user override.

### A2. Confirmation theatre
"Got it — you want a static site, correct?" after the user said "deploy this static site". Violates Rule 5.

**Fix:** trust the user input. If they meant something else they'll correct you.

### A3. Asking what's already in front of you
Asking "do you have a Dockerfile?" when `inspect_repo` already returned `dockerfile: true`. Violates Rule 4.

**Fix:** read tool outputs before asking. Cite the tool when you use the answer ("I see your repo has a Dockerfile, so…").

### A4. Bundled questions
"What region, what SKU, and what storage type?" Violates Rule 1.

**Fix:** ask the highest-priority one. The others get defaults.

### A5. Cosmetic-first asking
Asking "what should we name the resource group?" before establishing the workload type. Violates Rule 3.

**Fix:** name with a convention. Move on.

### A6. Re-asking after handoff
The architect re-asks "which inference backend?" after triage already routed with `foundry` selected. Violates C1.

**Fix:** the receiving agent reads the handoff prompt as authoritative input. If triage didn't put it there, that's a triage bug to file — but don't burn the user's time fixing it in the architect by asking again.

### A7. Stale defaults
Continuing to use `eastus2` after the user said "I'm in westeurope". Violates Rule 4 (a stated answer beats a default).

**Fix:** any user-stated value supersedes the corresponding default for the rest of the conversation.

### A8. The hidden default
Defaulting to AKS Automatic without saying so, then surprising the user when they wanted Standard. Violates the transparency clause of Rule 4.

**Fix:** every default-in-use gets one sentence acknowledging it.

### A9. Prose where UI is clearer
Listing 6 tracks in prose. Violates the prose-vs-UI guidance.

**Fix:** emit `TrackPicker`. (And see the [Component Selection Framework](./component-selection-framework.md).)

### A10. Cap evasion via UI
Treating a 6-field Questionnaire as "one question" because it's one form. Violates the spirit of Rule 1, especially when the fields aren't tightly coupled.

**Fix:** Questionnaire is for fields the user must answer *together* (e.g., region + SKU + zone redundancy on the same resource). Sequential prose is for fields the user can answer one at a time as their thinking evolves.

---

## Audit hooks (for Phase 2 reviewers, Phase 3 telemetry)

When reviewing a refactored agent prompt, ask:

- [ ] Does it cite this methodology, or restate the rules locally?
- [ ] Does its question priority match the priority table for its phase?
- [ ] Are defaults explicit and listed somewhere the agent can reference?
- [ ] Is the "Forbidden" list for that agent encoded as anti-patterns?
- [ ] If it asks more than 0 questions, does each question pass the discriminating-value test?

When designing telemetry (Phase 3):

- Per agent, log: question count per turn, total per phase, whether the cap was hit, whether the cap-hit forced-action led to a successful conversation.
- Per handoff, log: whether the receiving agent re-asked anything that was in the handoff prompt (anti-pattern A6).
- Per conversation, log: ping-pong count (A→B→A within N turns) — anti-pattern C3.

These hooks aren't Phase 1 deliverables, but Phase 1 prompts should be written so the data is recoverable when telemetry lands.

---

## Success criteria

This methodology is doing its job when:

- Median user-facing questions per agent per phase is ≤ 1.
- The cap (3) is rarely hit (more than 80% of conversations finish their phase in fewer than 3 questions).
- Same scenario produces the same questions across agents (consistency, not coincidence).
- Defaults are stated transparently and used silently when the user hasn't overridden them.
- Receiving agents never re-ask what triage already routed with.
- Agent prompts cite this document instead of restating the rules.
- `questionPolicy` in config JSON matches the agent's runtime behaviour (verifiable via telemetry).
- Constraint-spec versions are pinned in every handoff that involves enterprise rules.

---

## Related configuration files

| File | What it defines |
|---|---|
| `config/tracks.json` | Per-track `requirementHints` — what can be inferred, what to ask only if material |
| `config/inference-backends.json` | Per-backend `questionPolicy` — max questions, priority order, forbidden actions |
| `config/microsoft-skills.json` | Constraint-spec references, citation formats, skill metadata |
| `packages/pack-core/src/triage/handoff-schema.ts` | Typed handoff fields (`constraintSpec`, `skillIdsLoaded`, `sourceSignals`, `mode`, plus one mode-specific block) |

---

## Next steps

1. **Validate question budgets** — ensure every agent's runtime behaviour matches its `questionPolicy` cap.
2. **Expand `requirementHints`** — add `askOnlyIfMaterial` to tracks that currently have empty hint objects (e.g., `static_site`, `agentic_app`).
3. **Telemetry hooks** — implement the audit-hook logs (question count per phase, re-ask detection, ping-pong count) so success criteria are measurable.
4. **Constraint-spec coverage** — extend the constraint-spec pattern to non-AKS enterprise scenarios (e.g., Azure Policy, landing zones).
